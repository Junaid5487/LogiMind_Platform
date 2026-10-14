"""Path A experiment runner.

Stages:
  1. Train the SHAP risk model if artifacts are missing.
  2. Load CVRPLIB instances (download on first run).
  3. Per instance: Clarke-Wright nominal routes + OR-Tools reference (once).
  4. Per (instance, fleet seed): evaluate all method variants with paired
     vehicle pools and common random numbers in the simulator.
  5. Emit results/raw_results.csv, example_solution.json, run_config.json.

Run:  backend\\.venv\\Scripts\\python experiments\\benchmark.py
"""
from __future__ import annotations

import csv
import json
import platform
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402
from routing import cvrplib  # noqa: E402
from routing.solvers import (  # noqa: E402
    clarke_wright, ortools_solve, random_assign, risk_aware_assign,
    route_cost, total_cost,
)
import simulate  # noqa: E402

COLUMNS = [
    "instance", "n_customers", "vehicles_k", "fleet_seed", "variant", "lam",
    "n_routes", "vehicles_used", "distance", "solve_ms",
    "exposure", "analytic_breakdowns",
    "mc_cost_mean", "mc_cost_sd", "mc_breakdowns_mean", "mc_ontime_frac",
]


def load_risk_pool() -> list[float]:
    if not (config.MODEL_PATH.exists() and config.RISK_POOL_PATH.exists()):
        from risk.train_risk_model import train
        train()
    return json.loads(config.RISK_POOL_PATH.read_text())["scores"]


def draw_pool(pool: list[float], size: int, seed: int) -> list[float]:
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(pool), size=size, replace=(len(pool) < size))
    return [float(pool[i]) for i in idx]


def variant_row(inst: dict, fseed: int, variant: str, lam, routes, assign,
                risk, solve_ms, mc_seed) -> dict:
    D = inst["dist"]
    metrics = simulate.evaluate(routes, assign, risk, D, seed=mc_seed)
    return {
        "instance": inst["name"], "n_customers": inst["n_customers"],
        "vehicles_k": inst["vehicles"], "fleet_seed": fseed,
        "variant": variant, "lam": lam,
        "n_routes": len(routes), "vehicles_used": len(set(assign.values())),
        "distance": round(total_cost(routes, D), 1),
        "solve_ms": round(solve_ms, 2), **metrics,
    }


def parse_args():
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--spares", type=int, default=config.SPARE_VEHICLES,
                   help="spare vehicles in the depot pool (sensitivity knob)")
    p.add_argument("--tag", default="",
                   help="suffix for output files, e.g. _spares0")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    spares, tag = args.spares, args.tag
    t_start = time.perf_counter()
    pool = load_risk_pool()
    instances = cvrplib.load_all()
    if not instances:
        raise SystemExit("No CVRPLIB instances could be loaded.")

    rows: list[dict] = []
    example = None

    for inst in instances:
        D, demands, cap, K = inst["dist"], inst["demands"], inst["capacity"], inst["vehicles"]
        print(f"[benchmark] {inst['name']}: n={inst['n_customers']} Q={cap} k={K}")

        t0 = time.perf_counter()
        cw_nominal = clarke_wright(D, demands, cap)
        cw_ms = (time.perf_counter() - t0) * 1000
        ot_routes, ot_ms = ortools_solve(
            D, demands, cap, K, config.ORTOOLS_TIME_LIMIT_S, config.DIST_INT_SCALE)
        print(f"[benchmark]   CW {len(cw_nominal)} routes ({cw_ms:.1f} ms) | "
              f"OR-Tools {len(ot_routes)} routes ({ot_ms:.1f} ms, "
              f"cost {total_cost(ot_routes, D):.1f} vs CW {total_cost(cw_nominal, D):.1f})")

        for fi, fseed in enumerate(config.FLEET_SEEDS):
            pool_size = K + spares
            risk = draw_pool(pool, pool_size, seed=fseed * 31 + fi)
            r_bar = float(np.mean(risk))
            mc_seed = fseed * 1000 + fi
            variants: list[tuple] = []

            # --- risk-agnostic status quo --------------------------------
            variants.append(("baseline", None, cw_nominal,
                             random_assign(len(cw_nominal), pool_size, fseed), cw_ms))

            # --- M1+M2 only (assignment-aware, nominal capacity) ---------
            a, a_ms = risk_aware_assign(cw_nominal, D, risk, config.ASSIGN_LAMBDA)
            variants.append(("assign_aware", None, cw_nominal, a, cw_ms + a_ms))

            # --- full method across the pre-registered lambda sweep -------
            for lam in config.LAMBDA_SWEEP:
                if lam == 0.0:
                    routes_l, ms_l = cw_nominal, cw_ms
                else:
                    q_eff = max(1, int(cap / (1.0 + lam * r_bar)))
                    t0 = time.perf_counter()
                    routes_l = clarke_wright(D, demands, q_eff)
                    ms_l = (time.perf_counter() - t0) * 1000
                a, a_ms = risk_aware_assign(routes_l, D, risk, lam)
                variants.append((f"ours_lam{lam}", lam, routes_l, a, ms_l + a_ms))

            # --- OR-Tools reference, risk-agnostic & risk-aware assignment
            variants.append(("ortools", None, ot_routes,
                             random_assign(len(ot_routes), pool_size, fseed), ot_ms))
            a, a_ms = risk_aware_assign(ot_routes, D, risk, config.ASSIGN_LAMBDA)
            variants.append(("ortools_aware", None, ot_routes, a, ot_ms + a_ms))

            for vname, lam, routes, assign, ms in variants:
                rows.append(variant_row(inst, fseed, vname, lam, routes, assign,
                                        risk, ms, mc_seed))
            if example is None:
                example = build_example(inst, fseed, risk, cw_nominal, variants)

    # ---------------------------------------------------------------- output
    out_csv = config.RESULTS_DIR / f"raw_results{tag}.csv"
    with out_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"[benchmark] {len(rows)} rows -> {out_csv}")

    (config.RESULTS_DIR / f"example_solution{tag}.json").write_text(
        json.dumps(example, indent=2))
    (config.RESULTS_DIR / f"run_config{tag}.json").write_text(json.dumps({
        "instances": [i["name"] for i in instances],
        "fleet_seeds": config.FLEET_SEEDS,
        "lambda_sweep": config.LAMBDA_SWEEP,
        "primary_lambda": config.PRIMARY_LAMBDA,
        "mc_trials": config.MC_TRIALS,
        "hazard_gamma": config.HAZARD_GAMMA,
        "risk_noise_sigma": config.RISK_NOISE_SIGMA,
        "ortools_time_limit_s": config.ORTOOLS_TIME_LIMIT_S,
        "spare_vehicles": spares,
        "python": platform.python_version(),
        "elapsed_s": round(time.perf_counter() - t_start, 1),
    }, indent=2))
    print(f"[benchmark] done in {time.perf_counter() - t_start:.1f} s")


def build_example(inst, fseed, risk, cw_nominal, variants) -> dict:
    keep = {"baseline", "assign_aware", "ours_lam1.0"}
    out = {"instance": inst["name"], "fleet_seed": fseed,
           "risk_scores": [round(r, 4) for r in risk], "methods": {}}
    for vname, lam, routes, assign, _ms in variants:
        if vname not in keep:
            continue
        out["methods"][vname] = [
            {"stops": rt, "vehicle_idx": assign[k],
             "vehicle_risk": round(risk[assign[k]], 4),
             "distance": round(route_cost(rt, inst["dist"]), 1),
             "exposure": round(risk[assign[k]] * route_cost(rt, inst["dist"]), 3)}
            for k, rt in enumerate(routes)
        ]
    return out


if __name__ == "__main__":
    main()


