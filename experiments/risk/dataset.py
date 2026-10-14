"""Download + load the UCI AI4I 2020 Predictive Maintenance dataset.

Reference:
  Matzka, S. (2020). AI4I 2020 Predictive Maintenance Dataset. UCI ML Repository.
  https://archive.ics.uci.edu/ml/dataset/604

The dataset is synthetic but physically informed (NASA C-MAPSS-inspired) and is
the standard benchmark in the predictive-maintenance literature, making it an
acceptable telemetry source for training the vehicle failure-risk model.
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402

NUMERIC_FEATURES = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
TARGET = "Machine failure"


def ensure_dataset() -> Path:
    if not config.AI4I_PATH.exists():
        print(f"[dataset] downloading AI4I from {config.AI4I_URL}")
        urllib.request.urlretrieve(config.AI4I_URL, config.AI4I_PATH)
    return config.AI4I_PATH


def load_ai4i() -> pd.DataFrame:
    ensure_dataset()
    return pd.read_csv(config.AI4I_PATH)


def features_target(df: pd.DataFrame):
    """One-hot encode `Type`, keep the 5 numeric telemetry columns."""
    X = pd.get_dummies(df[NUMERIC_FEATURES + ["Type"]], columns=["Type"], dtype=float)
    y = df[TARGET].astype(int)
    return X, y
