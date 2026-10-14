"""Central configuration for the LogiMind Path A research experiments.

Every constant that influences experimental results lives here so that a
reader can reproduce the exact study from `run_config` dumps.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "results"
FIGURES_DIR = RESULTS_DIR / "figures"
TABLES_DIR = RESULTS_DIR / "tables"
ARTIFACTS_DIR = ROOT / "artifacts"

for _d in (DATA_DIR, RESULTS_DIR, FIGURES_DIR, TABLES_DIR, ARTIFACTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- risk model
AI4I_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv"
AI4I_PATH = DATA_DIR / "ai4i2020.csv"
MODEL_SEED = 42
MODEL_PATH = ARTIFACTS_DIR / "risk_model.pkl"
METRICS_PATH = ARTIFACTS_DIR / "risk_model_metrics.json"
SHAP_PATH = ARTIFACTS_DIR / "shap_importance.csv"
RISK_POOL_PATH = ARTIFACTS_DIR / "risk_pool.json"
RISK_POOL_SIZE = 60           # telemetry rows sampled -> vehicle risk scores

# ------------------------------------------------------------------ VRP data
VRP_MIRROR = (
    "https://raw.githubusercontent.com/giulianoxt/vehicle-routing-aco/"
    "master/augerat-a/{}.vrp"
)
VRP_DIR = DATA_DIR / "vrp"
# Augerat et al. (A-set) CVRPLIB instances, Euclidean, capacitated.
INSTANCES = [
    "A-n32-k5", "A-n33-k5", "A-n33-k6", "A-n34-k5", "A-n36-k5", "A-n38-k5",
    "A-n39-k5", "A-n45-k6", "A-n48-k7", "A-n53-k7", "A-n60-k9", "A-n80-k10",
]

# ---------------------------------------------------------- experiment design
FLEET_SEEDS = [101, 202, 303, 404, 505]   # paired across all methods
SPARE_VEHICLES = 10        # vehicle pool per run = K + SPARE_VEHICLES
LAMBDA_SWEEP = [0.0, 0.25, 0.5, 1.0, 2.0, 4.0]
PRIMARY_LAMBDA = 1.0       # pre-registered primary configuration (see README)
ASSIGN_LAMBDA = 1.0        # lambda used by the risk-aware assignment stage

MC_TRIALS = 2000           # Monte Carlo disruption trials per configuration
HAZARD_GAMMA = 1.5e-3      # sim-side breakdown hazard per km at risk = 1.0
RISK_NOISE_SIGMA = 0.30    # lognormal noise on risk inside the simulator
TOW_COST_USD = 200.0
RECOVERY_COST_PER_KM = 1.0
MISSED_STOP_COST_USD = 25.0

CW_SEED = 7                # only used for tie-breaking / instance fallback
ORTOOLS_TIME_LIMIT_S = 10
DIST_INT_SCALE = 1000      # integer scaling for the OR-Tools cost model
