# Paper outline (Path A)

**Working title:** *Explainability-Driven Risk-Aware Vehicle Routing: Coupling
SHAP Feature Attributions with Savings Heuristics for Resilient Fleet Dispatch*

**Target venues (in order):** IEEE Access (Q1, fast), IEEE Intelligent
Transportation Systems Conference (ITSC), IEEE Transactions on Intelligent
Transportation Systems (T-ITS, ambitious — needs real fleet data).
Demo-track fallback: IEEE Conference on AI (CAI) / systems-demonstration
tracks with the LogiMind UI.

---

## 1. Contribution statement (honest)

1. An **end-to-end, executable coupling** of an XAI failure-risk model
   (random forest + SHAP on UCI AI4I 2020) with a capacitated VRP solver:
   per-vehicle risk scores enter the savings heuristic (risk-scaled effective
   capacity) and the route↔vehicle assignment (Hungarian on
   `Σ (1+λ·r_v)·D_k`), with a single trade-off parameter λ.
2. A **paired, seeded benchmark** (12 Augerat instances × 5 fleet seeds,
   Clarke-Wright / OR-Tools baselines, 2000-trial disruption Monte-Carlo,
   Wilcoxon + rank-biserial) including a **mechanism ablation** and a
   **solver-agnostic portability test**.
3. A **robustness study over fleet-pool tightness** (spares ∈ {0,5,10}) that
   isolates *when each mechanism matters*: assignment dominates with spares;
   capacity scaling matters when every vehicle must be dispatched.

Not claimed: global optimality, real-world fleet validation, causal effects of
maintenance on failure.

## 2. Section map → artifacts

| section | content | artifact |
|---|---|---|
| Abstract | headline numbers: exposure −88…−99 %, distance +3…7 %, p<1e-4 | `results/summary.md` |
| I. Intro | dispatch decisions ignore fleet health; XAI risk scores exist but stop at dashboards | — |
| II. Related work | reliability-aware VRP (Ernst & Hinchey 2014; Prakash et al. 2022 survey), SHAP in predictive maintenance (Molnar survey; Lundberg/NPI), OR-Tools baselines | search seeds below |
| III. Method | risk model + SHAP (Fig. 1), CW recap, M1–M3 formalised, complexity | `fig_shap_importance.png`, `routing/solvers.py` |
| IV. Experimental design | instances, pools, seeds, metrics, pre-registration, threats | `README.md`, `results/run_config*.json` |
| V. Results | RQ1 headline, RQ2 λ-Pareto, RQ3 ablation, RQ4 solver-agnostic, RQ5 runtime, RQ6 sensitivity | tables + figures below |
| VI. Discussion/Limitations | synthetic telemetry, EUCLIDEAN distances, random baseline policy | `README.md` limitations |
| VII. Conclusion | XAI scores are actionable *inside* optimizers, not just dashboards | — |

## 3. Figures & tables (all generated)

- Fig. 1 `results/figures/fig_shap_importance.png` — global SHAP attribution.
- Fig. 2 `results/figures/fig_pareto.png` — distance ↔ exposure across λ.
- Fig. 3 `results/figures/fig_box_exposure.png` + `fig_box_cost.png` —
  method comparison boxplots (60 paired runs).
- Fig. 4 `results/figures/fig_runtime.png` — ms-scale CW+Hungarian vs OR-Tools.
- Tab. I `results/tables/table_headline.tex` — Wilcoxon, ours vs baseline.
- Tab. II `results/tables/table_ablation_assignment.tex` — M1+M2 alone.
- Tab. III `results/tables/table_vs_ortools.tex` + `table_solver_agnostic.tex`.
- Tab. IV `results/tables/table_lambda.tex` — λ sweep / Pareto.
- Tab. V `results/sensitivity_spares{0,5}/tables/table_headline.tex` —
  robustness over pool tightness.
- Case study box: `results/example_solution.json` — one depot plan before/after
  risk-aware assignment with per-vehicle risk annotations (great for a figure
  in the UI/demo track).

## 4. Related-work search seeds

- "reliability-based vehicle routing problem" (Ernst & Hinchey, Computers &
  Operations Research 2014)
- "vehicle routing breakdown stochastic disruptions" (Reyes et al.; Pillac et
  al. survey 2013)
- "predictive maintenance vehicle routing" / "maintenance-aware dispatch"
- "SHAP explainable predictive maintenance" (Lundberg et al. 2020 nature MI
  paper is the canonical citation; AI4I: Matzka et al. 2020)
- Clarke & Wright 1964; Toth & Vigo "Vehicle Routing: Problems, Methods and
  Applications" (SIAM 2014)
- OR-Tools: Holtzer et al. (2021) academic reference

## 5. Threats to validity (draft text)

- **Construct:** exposure `Σ r_v·D_v` is a proxy; the Monte-Carlo cost model
  (γ, penalties) is a scenario, not observed data → sensitivity over γ
  suggested as camera-ready addition (`config.HAZARD_GAMMA`).
- **Internal:** baseline policy is deliberately simple (random pool draw);
  paired seeds + CRN remove sampling noise; all comparisons pre-registered.
- **External:** synthetic AI4I telemetry; A-set instances ≤ 80 nodes; no time
  windows. Real-fleet log data = future work.

## 6. Next steps to camera-ready

1. [x] Risk model + SHAP + artifacts
2. [x] Risk-aware CW + OR-Tools baselines + Monte-Carlo harness
3. [x] Main study + λ sweep + ablations + solver-agnostic test
4. [x] Sensitivity over spare-pool tightness
5. [ ] Add γ-sensitivity sweep (1D loop over `HAZARD_GAMMA`, reuse CSV)
6. [ ] Bibtex pass for related work; read Ernst & Hinchey, Prakash et al.
7. [ ] Assemble LaTeX (IEEEtran) using the generated tables/figures
8. [ ] Optional: LogiMind dashboard screenshot for the applied/demo angle
