"""Independent Monte Carlo disruption evaluation (vectorised over trials).

Decoupled from the training model on purpose:
  * hazard uses HAZARD_GAMMA (a sim-side constant never seen by training),
  * per-trial lognormal noise perturbs each vehicle's risk score,
  * breakdown events are sampled per road segment via 1-exp(-gamma*r*d).

Per configuration we report:
  exposure              E = Σ r_v · D_v                 (primary endpoint)
  analytic_breakdowns   Σ gamma · r_v · D_v
  mc_cost_mean / sd     tow + recovery distance + missed-stop penalties
  mc_breakdowns_mean    simulated breakdowns per dispatch cycle
  mc_ontime_frac        fraction of stops served before any breakdown
"""
from __future__ import annotations

import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def segment_lengths(route: list[int], D: np.ndarray) -> np.ndarray:
    pts = [0] + list(route) + [0]
    return np.array([D[a, b] for a, b in zip(pts, pts[1:])], dtype=float)


def evaluate(routes: list[list[int]], assignments: dict[int, int],
             risk_scores: list[float], D: np.ndarray,
             trials: int = config.MC_TRIALS, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    exposure = 0.0
    analytic = 0.0

    cost = np.zeros(trials)
    breakdowns = np.zeros(trials)
    served = np.zeros(trials)
    stops_total = 0

    for k, rt in enumerate(routes):
        if not rt:
            continue
        r_base = risk_scores[assignments[k]]
        segs = segment_lengths(rt, D)
        exposure += r_base * float(segs.sum())
        analytic += config.HAZARD_GAMMA * r_base * float(segs.sum())

        # vectorised per-trial failure sampling
        r_noise = r_base * rng.lognormal(0.0, config.RISK_NOISE_SIGMA, size=trials)
        p_fail = 1.0 - np.exp(-config.HAZARD_GAMMA * r_noise[:, None] * segs[None, :])
        failed = rng.random((trials, len(segs))) < p_fail
        has = failed.any(axis=1)
        first = failed.argmax(axis=1)

        suffix = np.cumsum(segs[::-1])[::-1]        # suffix[i] = segs[i:].sum()
        n_stops = len(rt)
        stops_total += n_stops
        missed = np.where(has, n_stops - first, 0)
        remaining = np.where(has, suffix[first], 0.0)
        cost += np.where(has,
                         config.TOW_COST_USD
                         + config.RECOVERY_COST_PER_KM * remaining
                         + config.MISSED_STOP_COST_USD * missed,
                         0.0)
        breakdowns += has
        served += np.where(has, first, n_stops)

    return {
        "exposure": round(exposure, 3),
        "analytic_breakdowns": round(analytic, 5),
        "mc_cost_mean": round(float(cost.mean()), 2),
        "mc_cost_sd": round(float(cost.std(ddof=1)), 2),
        "mc_breakdowns_mean": round(float(breakdowns.mean()), 4),
        "mc_ontime_frac": round(float(served.sum() / (trials * max(stops_total, 1))), 4),
    }
