# LogiMind Path A — Explainability-Driven Risk-Aware Vehicle Routing

Reproduction package for the experiment described in
[`paper/PAPER_OUTLINE.md`](paper/PAPER_OUTLINE.md).

## What this studies

A failure-risk model (random forest + **genuine SHAP explanations**, trained on
the UCI AI4I 2020 predictive-maintenance dataset) is coupled into capacitated
vehicle routing. Three mechanisms, each ablated:

| id | mechanism | where |
|----|-----------|-------|
| M1 | healthiest-vehicle-first dispatch (implicit in rectangular Hungarian solve) | `routing/solvers.py::risk_aware_assign` |
| M2 | risk-weighted route↔vehicle assignment, `min Σ (1+λ·r_v)·D_k` | same |
| M3 | risk-scaled effective capacity inside Clarke-Wright merges, `Q_eff = Q/(1+λ·r̄)` | `benchmark.py` (savings stage) |

**Baselines:** risk-agnostic Clarke-Wright (status quo), Google OR-Tools
Google OR-Tools CVRP reference, risk-agnostic and risk-aware assignment on top
of OR-Tools routes (solver-agnostic portability test).

**Metrics:** total distance, risk-weighted exposure `Σ r_v·D_v` (primary
endpoint), expected breakdowns, Monte-Carlo disruption cost (tow + recovery +
missed stops; 2000 trials with sim-side hazard `γ=1.5e-3` and lognormal risk
noise, decoupled from the training model), on-time fraction, solve time.

## Reproduce (from the repo root)

```powershell
$py = "backend\.venv\Scripts\python.exe"
& $py experiments\risk\train_risk_model.py     # ~15 s: model + SHAP + risk pool
& $py experiments\benchmark.py                 # ~130 s: main study (600 rows)
& $py experiments\analyze.py                   # tests, LaTeX tables, figures
# sensitivity: spare-vehicle pool size
& $py experiments\benchmark.py --spares 0 --tag _spares0
& $py experiments\benchmark.py --spares 5 --tag _spares5
& $py experiments\analyze.py experiments\results\raw_results_spares0.csv
& $py experiments\analyze.py experiments\results\raw_results_spares5.csv
```

Internet is required on first run (AI4I CSV from UCI + Augerat A-set `.vrp`
instances from a GitHub CVRPLIB mirror; both are cached under
`experiments/data/`).

## Design (pre-registered choices)

- 12 Augerat A-set instances (32–80 nodes), 5 fleet seeds → **60 paired runs**
  per method; every method sees the *same* vehicle-risk pool per pair and the
  simulator uses *common random numbers* across methods (variance reduction).
- Vehicle risk pool = uniform sample of 60 AI4I telemetry rows scored by the
  trained model (min 0.000, max 0.990, mean 0.102); each run draws
  `K + spares` vehicles from it (spares ∈ {0, 5, 10}).
- **Primary λ = 1.0** (fixed before the run); sweep λ ∈ {0, 0.25, 0.5, 1, 2, 4}
  reported for the Pareto trade-off. λ=0 is the structural ablation of M3.
- Statistics: Wilcoxon signed-rank over the 60 pairs, two-sided, with
  rank-biserial correlation as effect size. No p-hacking: all four comparison
  tables are emitted for every pool size.

## Key results (also in `results/summary.md`)

- Risk-aware dispatch reduces exposure and simulated disruption cost by
  **~88–99 % vs Clarke-Wright and vs OR-Tools**, at **3–7 % distance overhead**,
  all `p < 0.0001`, `|r_rb| ≥ 0.92` — replicated at spares ∈ {0, 5, 10}.
- Ablation: **assignment (M1+M2) delivers most of the gain at zero distance
  cost**; capacity scaling (M3) adds value mainly in tight pools (spares=0:
  exposure 11.8 → 4.5 by shedding risky vehicles from dispatch).
- Solver-agnostic: risk-aware assignment on OR-Tools routes reproduces the
  benefit → the mechanism composes with any routing engine.
- Runtime: Clarke-Wright + Hungarian ≈ **2.6 ms vs 10 001 ms** for OR-Tools.

## Layout

```
experiments/
  config.py                 all knobs (seeds, λ, hazard, instances)
  risk/dataset.py           AI4I download/load
  risk/train_risk_model.py  RF + SHAP + risk pool export
  routing/cvrplib.py        .vrp download/parser
  routing/solvers.py        Clarke-Wright, Hungarian risk assignment, OR-Tools
  simulate.py               vectorised Monte-Carlo disruption model
  benchmark.py              experiment runner → raw_results*.csv
  analyze.py                Wilcoxon/effect sizes → LaTeX + PNG + summary.md
  paper/PAPER_OUTLINE.md    paper skeleton mapped to artifacts
```

## Known limitations (stated in the paper)

- AI4I is a *synthetic* maintenance dataset; telemetry → vehicle-health mapping
  is an experimental construct (documented in the outline).
- Distance is Euclidean on CVRPLIB coordinates; no time windows / stochastic
  travel times.
- OR-Tools runs 10 s/instance with GLS; gaps to published optima are not
  enforced (we compare against the *found* solutions).
- Baseline fleet policy is random assignment (the operational status quo), not
  an adversarial or expert policy.
