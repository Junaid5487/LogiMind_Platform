"""Train a real failure-risk classifier + genuine SHAP explanations.

Outputs (in experiments/artifacts and experiments/results/figures):
  risk_model.pkl            trained RandomForest (pickled)
  risk_model_metrics.json   hold-out ROC-AUC / PR-AUC / precision / recall / F1
  shap_importance.csv       mean |SHAP| per feature (global explanation)
  fig_shap_importance.png   bar chart for the paper
  risk_pool.json            sampled telemetry -> per-vehicle risk scores

Run:  backend\\.venv\\Scripts\\python experiments\\risk\\train_risk_model.py
"""
from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, average_precision_score, f1_score,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
from risk.dataset import features_target, load_ai4i  # noqa: E402


def train() -> dict:
    df = load_ai4i()
    X, y = features_target(df)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=config.MODEL_SEED
    )

    clf = RandomForestClassifier(
        n_estimators=400, min_samples_leaf=4, class_weight="balanced",
        random_state=config.MODEL_SEED, n_jobs=-1,
    )
    clf.fit(X_tr, y_tr)

    p = clf.predict_proba(X_te)[:, 1]
    pred = (p >= 0.5).astype(int)
    metrics = {
        "n_train": int(len(X_tr)), "n_test": int(len(X_te)),
        "positive_rate_test": float(y_te.mean()),
        "roc_auc": round(float(roc_auc_score(y_te, p)), 4),
        "pr_auc": round(float(average_precision_score(y_te, p)), 4),
        "accuracy": round(float(accuracy_score(y_te, pred)), 4),
        "precision": round(float(precision_score(y_te, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_te, pred)), 4),
        "f1": round(float(f1_score(y_te, pred)), 4),
    }
    print("[risk] hold-out metrics:", json.dumps(metrics, indent=2))

    # -------------------------------------------------------------- SHAP
    import matplotlib
    matplotlib.use("Agg")
    import shap

    explainer = shap.TreeExplainer(clf)
    sample_idx = X_te.sample(min(1000, len(X_te)), random_state=config.MODEL_SEED).index
    shap_values = explainer.shap_values(X.loc[sample_idx])
    # binary classification: shap_values may be [class0, class1] (list) or 3D
    sv = shap_values[1] if isinstance(shap_values, list) else shap_values[:, :, -1]
    importance = pd.DataFrame({
        "feature": X.columns,
        "mean_abs_shap": np.abs(sv).mean(axis=0),
    }).sort_values("mean_abs_shap", ascending=False)
    importance.to_csv(config.SHAP_PATH, index=False)

    fig_path = config.FIGURES_DIR / "fig_shap_importance.png"
    ax = importance.head(10).iloc[::-1].plot.barh(
        x="feature", y="mean_abs_shap", legend=False, color="#38bdf8", figsize=(7, 4)
    )
    ax.set_xlabel("mean |SHAP value|")
    ax.set_title("Global feature attribution for failure-risk model")
    ax.figure.tight_layout()
    ax.figure.savefig(fig_path, dpi=160)
    print(f"[risk] SHAP importance -> {config.SHAP_PATH}")
    print(f"[risk] SHAP figure     -> {fig_path}")

    # ------------------------------------------- risk pool (vehicle scores)
    rng = np.random.default_rng(config.MODEL_SEED)
    pool_idx = rng.choice(len(df), size=config.RISK_POOL_SIZE, replace=False)
    pool_scores = clf.predict_proba(X.iloc[pool_idx])[:, 1]
    pool = {
        "scores": [round(float(s), 6) for s in pool_scores],
        "source_rows": [int(i) for i in pool_idx],
        "failure_labels": [int(y.iloc[i]) for i in pool_idx],
        "note": ("Uniform sample of AI4I telemetry rows; predicted failure "
                 "probability = per-vehicle risk score r_v used by the VRP study."),
    }
    config.RISK_POOL_PATH.write_text(json.dumps(pool, indent=2))
    print(f"[risk] pool of {len(pool['scores'])} vehicle risk scores "
          f"(min={min(pool['scores']):.3f}, max={max(pool['scores']):.3f}, "
          f"mean={np.mean(pool['scores']):.3f}) -> {config.RISK_POOL_PATH}")

    with open(config.MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    config.METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    train()
