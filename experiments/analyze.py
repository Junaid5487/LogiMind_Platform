"""Statistical analysis: Wilcoxon tests, effect sizes, LaTeX tables, plots.

Inputs : experiments/results/raw_results.csv
Outputs: results/summary.md, results/tables/*.tex, results/figures/*.png

Pre-registered comparisons (primary lambda = config.PRIMARY_LAMBDA):
  1. ours  vs baseline      -- the paper's headline claim
  2. assign_aware vs baseline -- ablation: assignment mechanism alone
  3. ours  vs ortools       -- quality gap to a strong solver
  4. ortools_aware vs ortools -- solver-agnostic benefit of the mechanism

Run:  backend\\.venv\\Scripts\\python experiments\\analyze.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

METRICS = ["exposure", "mc_cost_mean", "analytic_breakdowns",
           "distance", "mc_ontime_frac", "solve_ms"]


def rank_biserial(d: np.ndarray) -> float:
    """Rank-biserial correlation from paired differences (d = a - b)."""
    d = d[d != 0]
    if d.size == 0:
        return 0.0
    from scipy.stats import rankdata
    ranks = rankdata(np.abs(d))
    w_pos = ranks[d > 0].sum()
    w_neg = ranks[d < 0].sum()
    return float((w_pos - w_neg) / (w_pos + w_neg))


def paired_test(df: pd.DataFrame, a: str, b: str, metric: str) -> dict:
    """Paired Wilcoxon on (instance, fleet_seed) for variant a vs b."""
    piv = df.pivot_table(index=["instance", "fleet_seed"],
                         columns="variant", values=metric)
    sub = piv[[a, b]].dropna()
    d = (sub[a] - sub[b]).to_numpy()
    if np.allclose(d, 0):
        stat, p = 0.0, 1.0
    else:
        stat, p = wilcoxon(sub[a], sub[b], alternative="two-sided")
    return {
        "metric": metric, "comparison": f"{a} vs {b}", "n": int(d.size),
        "median_a": float(np.median(sub[a])), "median_b": float(np.median(sub[b])),
        "median_diff": float(np.median(d)),
        "w_stat": float(stat), "p_value": float(p),
        "rank_biserial": rank_biserial(d),
    }


def fmt_row(r: dict) -> str:
    sig = "***" if r["p_value"] < 0.001 else "**" if r["p_value"] < 0.01 \
        else "*" if r["p_value"] < 0.05 else "ns"
    return (f"{r['metric']} & {r['median_a']:.2f} & {r['median_b']:.2f} & "
            f"{r['median_diff']:.2f} & {r['p_value']:.4f} ({sig}) & "
            f"{r['rank_biserial']:.3f} \\\\")


def latex_table(rows: list[dict], a: str, b: str, path: Path) -> None:
    hdr = (f"% {a} (ours) vs {b} (ref); medians over paired runs\n"
           "\\begin{tabular}{lrrrrr}\n\\toprule\n"
           "Metric & Med. ours & Med. ref & Med. diff & $p$ (Wilcoxon) "
           "& $r_{rb}$ \\\\\n\\midrule\n")
    body = "\n".join(fmt_row(r) for r in rows)
    path.write_text(hdr + body + "\n\\bottomrule\n\\end{tabular}\n")


def main(csv_path: str | None = None) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if csv_path is None:
        in_csv = config.RESULTS_DIR / "raw_results.csv"
        out_dir = config.RESULTS_DIR
    else:
        in_csv = Path(csv_path)
        tag = in_csv.stem.replace("raw_results", "").lstrip("_")
        out_dir = config.RESULTS_DIR / (f"sensitivity_{tag}" if tag else ".")
    fig_dir = out_dir / "figures"
    tab_dir = out_dir / "tables"
    for d in (out_dir, fig_dir, tab_dir):
        d.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(in_csv)
    lam = config.PRIMARY_LAMBDA
    ours = f"ours_lam{lam}"
    assert ours in df["variant"].unique(), f"{ours} missing from results"

    comparisons = [
        (ours, "baseline", "headline"),
        ("assign_aware", "baseline", "ablation_assignment"),
        (ours, "ortools", "vs_ortools"),
        ("ortools_aware", "ortools", "solver_agnostic"),
    ]
    all_rows: dict[str, list[dict]] = {}
    for a, b, tag in comparisons:
        all_rows[tag] = [paired_test(df, a, b, m) for m in METRICS]
        tex = tab_dir / f"table_{tag}.tex"
        latex_table(all_rows[tag], a, b, tex)
        print(f"[analyze] table -> {tex}")

    # ---------------------------------------------------- lambda sweep table
    lam_rows = []
    for L in config.LAMBDA_SWEEP:
        sub = df[df["variant"] == f"ours_lam{L}"]
        lam_rows.append({
            "lambda": L, "n_routes": sub["n_routes"].median(),
            "vehicles": sub["vehicles_used"].median(),
            "distance": sub["distance"].median(),
            "exposure": sub["exposure"].median(),
            "cost": sub["mc_cost_mean"].median(),
        })
    lam_df = pd.DataFrame(lam_rows)
    lam_tex = tab_dir / "table_lambda.tex"
    lam_tex.write_text(
        "$\\lambda$ & Routes & Vehicles & Distance & Exposure & MC cost \\\\\n"
        "\\midrule\n" + "\n".join(
            f"{r['lambda']:g} & {r['n_routes']:.0f} & {r['vehicles']:.0f} & "
            f"{r['distance']:.1f} & {r['exposure']:.2f} & {r['cost']:.1f} \\\\"
            for r in lam_rows) + "\n")
    print(f"[analyze] table -> {lam_tex}")

    # ------------------------------------------------------------ figures
    # 1. Pareto front: distance vs exposure across lambda
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(lam_df["distance"], lam_df["exposure"], "o-", color="#38bdf8",
            zorder=2, label="risk-aware (ours)")
    base = df[df["variant"] == "baseline"]
    orto = df[df["variant"] == "ortools"]
    ax.scatter([base["distance"].median()], [base["exposure"].median()],
               marker="X", s=140, c="#f59e0b", zorder=3, label="CW baseline")
    ax.scatter([orto["distance"].median()], [orto["exposure"].median()],
               marker="s", s=120, c="#10b981", zorder=3, label="OR-Tools")
    for _, r in lam_df.iterrows():
        ax.annotate(f"$\\lambda$={r['lambda']:g}",
                    (r["distance"], r["exposure"]), fontsize=8,
                    textcoords="offset points", xytext=(5, 5))
    ax.set_xlabel("total distance (CVRPLIB units)")
    ax.set_ylabel(r"risk-weighted exposure $\sum r_v D_v$")
    ax.set_title("Distance vs. risk exposure (median of 60 paired runs)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(fig_dir / "fig_pareto.png", dpi=160)

    # 2. Boxplots: exposure and MC cost, key variants side by side
    order = ["baseline", "assign_aware", ours, "ortools", "ortools_aware"]
    labels = ["CW\nbaseline", "+risk\nassign", "ours\n(full)",
              "OR-Tools", "OR-Tools\n+risk"]
    for metric, fname, ylab in [
        ("exposure", "fig_box_exposure.png", r"exposure $\sum r_v D_v$"),
        ("mc_cost_mean", "fig_box_cost.png", "simulated disruption cost"),
    ]:
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.boxplot([df[df["variant"] == v][metric] for v in order],
                   tick_labels=labels, showfliers=False)
        ax.set_ylabel(ylab)
        ax.set_title(f"{metric} across 60 paired runs")
        fig.tight_layout()
        fig.savefig(fig_dir / fname, dpi=160)
        print(f"[analyze] figure -> {fig_dir / fname}")

    # 3. Runtime comparison
    fig, ax = plt.subplots(figsize=(6, 3.5))
    rt = [df[df["variant"] == v]["solve_ms"] for v in ["baseline", ours, "ortools"]]
    ax.boxplot(rt, tick_labels=["Clarke-Wright", "ours (full)", "OR-Tools"],
               showfliers=False)
    ax.set_ylabel("solve time (ms)")
    ax.set_title("Solver runtime")
    fig.tight_layout()
    fig.savefig(fig_dir / "fig_runtime.png", dpi=160)

    # ------------------------------------------------------------- summary
    lines = ["# Path A experiment summary", ""]
    lines.append(f"- instances: {df['instance'].nunique()}, fleet seeds: "
                 f"{df['fleet_seed'].nunique()}, paired runs: "
                 f"{df.groupby(['instance','fleet_seed']).ngroups}")
    lines.append(f"- variants: {', '.join(sorted(df['variant'].unique()))}")
    lines.append(f"- primary lambda: {lam}, MC trials/config: {config.MC_TRIALS}")
    for tag, rows_ in all_rows.items():
        lines += ["", f"## {tag}", "",
                  "| metric | ours | ref | diff | p | r_rb |",
                  "|---|---|---|---|---|---|"]
        for r in rows_:
            lines.append(
                f"| {r['metric']} | {r['median_a']:.3f} | {r['median_b']:.3f} "
                f"| {r['median_diff']:.3f} | {r['p_value']:.4f} "
                f"| {r['rank_biserial']:.3f} |")
    md_table = "| " + " | ".join(lam_df.columns) + " |\n|" + "|".join(
        ["---"] * len(lam_df.columns)) + "|\n" + "\n".join(
        "| " + " | ".join(f"{v:.2f}" if isinstance(v, float) else str(v)
                          for v in row) + " |"
        for row in lam_df.itertuples(index=False, name=None))
    lines += ["", "## lambda sweep", "", md_table]
    summary_path = out_dir / "summary.md"
    summary_path.write_text("\n".join(lines))
    print(f"[analyze] summary -> {summary_path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)

