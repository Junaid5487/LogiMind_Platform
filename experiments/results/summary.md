# Path A experiment summary

- instances: 12, fleet seeds: 5, paired runs: 60
- variants: assign_aware, baseline, ortools, ortools_aware, ours_lam0.0, ours_lam0.25, ours_lam0.5, ours_lam1.0, ours_lam2.0, ours_lam4.0
- primary lambda: 1.0, MC trials/config: 2000

## headline

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 2.384 | 89.084 | -83.268 | 0.0000 | -1.000 |
| mc_cost_mean | 1.220 | 49.220 | -45.910 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.004 | 0.134 | -0.125 | 0.0000 | -1.000 |
| distance | 922.150 | 872.850 | 50.250 | 0.0000 | 0.969 |
| mc_ontime_frac | 1.000 | 0.991 | 0.009 | 0.0000 | 1.000 |
| solve_ms | 1.330 | 1.605 | -0.235 | 0.0017 | -0.466 |

## ablation_assignment

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 1.710 | 89.084 | -85.177 | 0.0000 | -1.000 |
| mc_cost_mean | 1.060 | 49.220 | -47.315 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.003 | 0.134 | -0.128 | 0.0000 | -1.000 |
| distance | 872.850 | 872.850 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 1.000 | 0.991 | 0.009 | 0.0000 | 1.000 |
| solve_ms | 1.635 | 1.605 | 0.015 | 0.0000 | 1.000 |

## vs_ortools

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 2.384 | 81.507 | -78.136 | 0.0000 | -1.000 |
| mc_cost_mean | 1.220 | 48.565 | -45.580 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.004 | 0.122 | -0.117 | 0.0000 | -1.000 |
| distance | 922.150 | 825.250 | 97.000 | 0.0000 | 0.999 |
| mc_ontime_frac | 1.000 | 0.989 | 0.011 | 0.0000 | 1.000 |
| solve_ms | 1.330 | 10000.380 | -9999.245 | 0.0000 | -1.000 |

## solver_agnostic

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 1.594 | 81.507 | -79.928 | 0.0000 | -1.000 |
| mc_cost_mean | 0.990 | 48.565 | -46.875 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.002 | 0.122 | -0.120 | 0.0000 | -1.000 |
| distance | 825.250 | 825.250 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 1.000 | 0.989 | 0.011 | 0.0000 | 1.000 |
| solve_ms | 10000.395 | 10000.380 | 0.010 | 0.0000 | 1.000 |

## lambda sweep

| lambda | n_routes | vehicles | distance | exposure | cost |
|---|---|---|---|---|---|
| 0.00 | 6.50 | 6.50 | 872.85 | 108.84 | 64.33 |
| 0.25 | 6.50 | 6.50 | 893.20 | 1.94 | 1.13 |
| 0.50 | 6.50 | 6.50 | 912.05 | 2.15 | 1.12 |
| 1.00 | 7.00 | 7.00 | 922.15 | 2.38 | 1.22 |
| 2.00 | 7.00 | 7.00 | 983.30 | 3.33 | 1.60 |
| 4.00 | 8.00 | 8.00 | 1131.05 | 4.36 | 2.07 |