"""Solvers: Clarke-Wright baseline, risk-aware variant, OR-Tools reference.

Mechanisms under study (see experiments/README.md):

  M-risk-assign  Minimum-cost route->vehicle assignment
                 min Σ_v Σ_k (1 + λ·r_v)·D_k·x_kv   (Hungarian algorithm)
  M-dispatch     Healthiest vehicles eligible first (implicit when the
                 rectangular Hungarian solve has more vehicles than routes)
  M-capacity     Risk-scaled effective capacity during savings merges:
                 Q_eff = Q / (1 + λ·r̄),  r̄ = mean risk of the vehicle pool

λ = 0 makes the risk-aware method collapse to nominal behaviour -- the
ablation used in the study.
"""
from __future__ import annotations

import math
import random
import time

import numpy as np
from scipy.optimize import linear_sum_assignment


# ------------------------------------------------------------- Clarke-Wright
def route_cost(route: list[int], D: np.ndarray) -> float:
    if not route:
        return 0.0
    c = D[0, route[0]] + D[route[-1], 0]
    for a, b in zip(route, route[1:]):
        c += D[a, b]
    return float(c)


def total_cost(routes: list[list[int]], D: np.ndarray) -> float:
    return float(sum(route_cost(r, D) for r in routes))


def clarke_wright(D: np.ndarray, demands: list[int], capacity: int) -> list[list[int]]:
    """Parallel savings heuristic (Clarke & Wright, 1964)."""
    n = len(demands)
    routes: dict[int, list[int]] = {i: [i] for i in range(1, n)}
    load: dict[int, int] = {i: demands[i] for i in range(1, n)}
    owner: dict[int, int] = {i: i for i in range(1, n)}   # customer -> route id

    savings = []
    for i in range(1, n):
        for j in range(i + 1, n):
            savings.append((D[0, i] + D[0, j] - D[i, j], i, j))
    savings.sort(key=lambda t: -t[0])

    next_id = n
    for _, i, j in savings:
        ri, rj = owner[i], owner[j]
        if ri == rj:
            continue
        A, B = routes[ri], routes[rj]
        if load[ri] + load[rj] > capacity:
            continue
        if A[-1] == i and B[0] == j:
            merged = A + B
        elif A[0] == i and B[-1] == j:
            merged = B + A
        elif A[-1] == i and B[-1] == j:
            merged = A + B[::-1]
        elif A[0] == i and B[0] == j:
            merged = A[::-1] + B
        else:
            continue                                    # not an endpoint merge
        routes[next_id] = merged
        load[next_id] = load.pop(ri) + load.pop(rj)
        for c in merged:
            owner[c] = next_id
        del routes[ri], routes[rj]
        next_id += 1

    return sorted(routes.values(), key=lambda r: min(r))


# ---------------------------------------------------------------- assignment
def risk_aware_assign(routes: list[list[int]], D: np.ndarray,
                      risk_scores: list[float], lam: float):
    """Hungarian assignment minimising Σ (1 + λ·r_v)·D_k.
    Returns ({route_idx: vehicle_idx}, solve_ms).  Vehicle indices always
    refer to the original `risk_scores` list (a vehicle may be reused when
    there are more routes than vehicles)."""
    n_veh = len(risk_scores)
    risk = list(risk_scores)
    if len(routes) > n_veh:              # more routes than vehicles: cycle
        import math                      # the pool (sequential multi-runs)
        risk = risk * math.ceil(len(routes) / n_veh)
    costs = np.empty((len(routes), len(risk)))
    for k, rt in enumerate(routes):
        dk = route_cost(rt, D)
        for v, r in enumerate(risk):
            costs[k, v] = (1.0 + lam * r) * dk
    t0 = time.perf_counter()
    rows, cols = linear_sum_assignment(costs)
    ms = (time.perf_counter() - t0) * 1000
    assignment = {int(k): int(v) % n_veh for k, v in zip(rows, cols)}
    return assignment, ms


def random_assign(n_routes: int, n_vehicles: int, seed: int) -> dict[int, int]:
    """Risk-agnostic baseline: shuffle the vehicle pool, hand routes out
    one vehicle at a time (the operational status quo)."""
    order = list(range(n_vehicles))
    random.Random(seed).shuffle(order)
    return {k: order[k % n_vehicles] for k in range(n_routes)}


# ------------------------------------------------------------------ OR-Tools
def ortools_solve(D: np.ndarray, demands: list[int], capacity: int,
                  n_vehicles: int, time_limit_s: float, scale: int = 1000):
    """Google OR-Tools routing reference solver (risk-agnostic CVRP)."""
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2

    n = len(demands)
    Di = np.rint(D * scale).astype(np.int64)

    manager = pywrapcp.RoutingIndexManager(n, n_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def cb(from_idx, to_idx):
        fi, ti = manager.IndexToNode(from_idx), manager.IndexToNode(to_idx)
        return int(Di[fi][ti])

    transit = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)

    def demand_cb(idx):
        return demands[manager.IndexToNode(idx)]

    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        demand_idx, 0, [capacity] * n_vehicles, True, "Capacity")
    routing.SetFixedCostOfAllVehicles(0)      # vehicles may stay unused

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION)
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    params.time_limit.FromSeconds(int(time_limit_s))

    t0 = time.perf_counter()
    sol = routing.SolveWithParameters(params)
    ms = (time.perf_counter() - t0) * 1000
    if sol is None:
        raise RuntimeError("OR-Tools found no solution")

    routes = []
    for v in range(n_vehicles):
        idx = routing.Start(v)
        stops = []
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node != 0:
                stops.append(node)
            idx = sol.Value(routing.NextVar(idx))
        if stops:
            routes.append(stops)
    return sorted(routes, key=lambda r: min(r)), ms

