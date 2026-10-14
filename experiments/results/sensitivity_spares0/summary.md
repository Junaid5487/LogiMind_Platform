# Path A experiment summary

- instances: 12, fleet seeds: 5, paired runs: 60
- variants: assign_aware, baseline, ortools, ortools_aware, ours_lam0.0, ours_lam0.25, ours_lam0.5, ours_lam1.0, ours_lam2.0, ours_lam4.0
- primary lambda: 1.0, MC trials/config: 2000

## headline

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 4.466 | 36.472 | -25.121 | 0.0000 | -0.997 |
| mc_cost_mean | 2.545 | 22.180 | -14.135 | 0.0000 | -0.997 |
| analytic_breakdowns | 0.007 | 0.055 | -0.038 | 0.0000 | -0.997 |
| distance | 910.850 | 872.850 | 30.200 | 0.0000 | 0.925 |
| mc_ontime_frac | 1.000 | 0.995 | 0.003 | 0.0000 | 1.000 |
| solve_ms | 2.645 | 2.870 | -0.185 | 0.7073 | 0.056 |

## ablation_assignment

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 11.835 | 36.472 | -14.213 | 0.0000 | -1.000 |
| mc_cost_mean | 6.200 | 22.180 | -11.085 | 0.0000 | -0.988 |
| analytic_breakdowns | 0.018 | 0.055 | -0.021 | 0.0000 | -1.000 |
| distance | 872.850 | 872.850 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 0.999 | 0.995 | 0.002 | 0.0000 | 0.981 |
| solve_ms | 2.920 | 2.870 | 0.030 | 0.0000 | 1.000 |

## vs_ortools

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 4.466 | 34.716 | -26.050 | 0.0000 | -0.970 |
| mc_cost_mean | 2.545 | 21.495 | -16.360 | 0.0000 | -0.973 |
| analytic_breakdowns | 0.007 | 0.052 | -0.039 | 0.0000 | -0.970 |
| distance | 910.850 | 826.400 | 58.000 | 0.0000 | 0.977 |
| mc_ontime_frac | 1.000 | 0.995 | 0.004 | 0.0000 | 0.980 |
| solve_ms | 2.645 | 10000.900 | -9998.210 | 0.0000 | -1.000 |

## solver_agnostic

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 26.255 | 34.716 | -9.634 | 0.0000 | -1.000 |
| mc_cost_mean | 14.195 | 21.495 | -6.845 | 0.0000 | -0.989 |
| analytic_breakdowns | 0.039 | 0.052 | -0.014 | 0.0000 | -1.000 |
| distance | 826.400 | 826.400 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 0.997 | 0.995 | 0.002 | 0.0000 | 0.973 |
| solve_ms | 10001.150 | 10000.900 | 0.020 | 0.0000 | 1.000 |

## lambda sweep

| lambda | n_routes | vehicles | distance | exposure | cost |
|---|---|---|---|---|---|
| 0.00 | 6.50 | 5.50 | 872.85 | 35.94 | 19.46 |
| 0.25 | 6.50 | 5.00 | 892.95 | 4.55 | 3.12 |
| 0.50 | 6.50 | 4.00 | 909.80 | 4.40 | 2.67 |
| 1.00 | 7.00 | 4.00 | 910.85 | 4.47 | 2.54 |
| 2.00 | 7.00 | 4.00 | 951.70 | 5.17 | 3.00 |
| 4.00 | 8.00 | 5.00 | 1037.65 | 8.14 | 3.75 |