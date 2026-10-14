# Path A experiment summary

- instances: 12, fleet seeds: 5, paired runs: 60
- variants: assign_aware, baseline, ortools, ortools_aware, ours_lam0.0, ours_lam0.25, ours_lam0.5, ours_lam1.0, ours_lam2.0, ours_lam4.0
- primary lambda: 1.0, MC trials/config: 2000

## headline

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 4.011 | 92.903 | -82.431 | 0.0000 | -1.000 |
| mc_cost_mean | 2.390 | 57.650 | -51.450 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.006 | 0.139 | -0.124 | 0.0000 | -1.000 |
| distance | 927.750 | 872.850 | 57.600 | 0.0000 | 0.988 |
| mc_ontime_frac | 1.000 | 0.989 | 0.010 | 0.0000 | 1.000 |
| solve_ms | 2.690 | 2.555 | -0.260 | 0.1964 | -0.192 |

## ablation_assignment

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 3.594 | 92.903 | -90.728 | 0.0000 | -1.000 |
| mc_cost_mean | 2.000 | 57.650 | -53.355 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.005 | 0.139 | -0.136 | 0.0000 | -1.000 |
| distance | 872.850 | 872.850 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 1.000 | 0.989 | 0.010 | 0.0000 | 1.000 |
| solve_ms | 2.585 | 2.555 | 0.030 | 0.0000 | 1.000 |

## vs_ortools

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 4.011 | 85.619 | -81.908 | 0.0000 | -1.000 |
| mc_cost_mean | 2.390 | 55.340 | -52.545 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.006 | 0.128 | -0.123 | 0.0000 | -1.000 |
| distance | 927.750 | 826.400 | 83.600 | 0.0000 | 1.000 |
| mc_ontime_frac | 1.000 | 0.990 | 0.010 | 0.0000 | 1.000 |
| solve_ms | 2.690 | 10000.980 | -9998.540 | 0.0000 | -1.000 |

## solver_agnostic

| metric | ours | ref | diff | p | r_rb |
|---|---|---|---|---|---|
| exposure | 3.386 | 85.619 | -82.919 | 0.0000 | -1.000 |
| mc_cost_mean | 1.835 | 55.340 | -52.510 | 0.0000 | -1.000 |
| analytic_breakdowns | 0.005 | 0.128 | -0.124 | 0.0000 | -1.000 |
| distance | 826.400 | 826.400 | 0.000 | 1.0000 | 0.000 |
| mc_ontime_frac | 1.000 | 0.990 | 0.009 | 0.0000 | 1.000 |
| solve_ms | 10001.110 | 10000.980 | 0.020 | 0.0000 | 1.000 |

## lambda sweep

| lambda | n_routes | vehicles | distance | exposure | cost |
|---|---|---|---|---|---|
| 0.00 | 6.50 | 6.50 | 872.85 | 85.54 | 46.91 |
| 0.25 | 6.50 | 6.50 | 895.70 | 3.78 | 1.92 |
| 0.50 | 6.50 | 6.50 | 912.35 | 3.86 | 1.98 |
| 1.00 | 7.00 | 7.00 | 927.75 | 4.01 | 2.39 |
| 2.00 | 8.00 | 8.00 | 1027.90 | 5.63 | 2.84 |
| 4.00 | 9.00 | 9.00 | 1178.60 | 13.06 | 6.43 |