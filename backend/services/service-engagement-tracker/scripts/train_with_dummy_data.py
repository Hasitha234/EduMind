"""
Train the disengagement prediction ML model using synthetic dummy data.

- Generates 300 synthetic student-day records across realistic engagement patterns
- Trains a GradientBoostingClassifier on the 20 features used in production
- Saves the model to:
    1. ml_models/  (where the FastAPI service will load it at startup)
    2. C:/Projects/edumind/EduMind/ml/models/engagement_predictor/
- Does NOT write any dummy data to the database

Run from the service-engagement-tracker directory:
    python scripts/train_with_dummy_data.py
"""

import sys
import json
import random
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
RANDOM_SEED = 42
N_STUDENTS = 300
DAYS_PER_STUDENT = 30
AT_RISK_THRESHOLD = 30       # engagement_score < 30 → at-risk label

MODEL_DIR_SERVICE = Path(__file__).resolve().parent.parent / "ml_models"
MODEL_DIR_REPO    = Path("C:/Projects/edumind/EduMind/ml/models/engagement_predictor")

FEATURE_COLUMNS = [
    "login_score", "session_score", "interaction_score",
    "forum_score", "assignment_score",
    "engagement_score", "engagement_score_lag_1day", "engagement_score_lag_7days",
    "engagement_score_lag_3days", "engagement_score_lag_14days",
    "rolling_avg_7days", "rolling_avg_30days",
    "engagement_volatility_7days", "is_declining", "is_improving",
    "login_to_session_ratio", "interaction_to_forum_ratio",
    "consecutive_low_days", "days_since_start", "cumulative_avg_score",
]

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ─────────────────────────────────────────────────────────────
# Dummy data generation
# ─────────────────────────────────────────────────────────────

def _rnd(lo, hi):
    return round(random.uniform(lo, hi), 2)


def generate_score_series(base_score: float, n_days: int, trend: str) -> list:
    """Generate a plausible day-by-day engagement score time series."""
    scores = []
    score = base_score
    for _ in range(n_days):
        if trend == "declining":
            delta = _rnd(-6, 1)
        elif trend == "improving":
            delta = _rnd(-1, 6)
        else:
            delta = _rnd(-3, 3)
        score = max(0.0, min(100.0, score + delta))
        scores.append(round(score, 2))
    return scores


def generate_component_scores(eng_score: float, style: str) -> dict:
    """Generate sub-scores that roughly add up to the engagement score."""
    noise = lambda lo, hi: _rnd(lo, hi)
    if style == "high":
        return {
            "login_score": noise(60, 100),
            "session_score": noise(60, 100),
            "interaction_score": noise(60, 100),
            "forum_score": noise(50, 100),
            "assignment_score": noise(60, 100),
        }
    elif style == "low":
        return {
            "login_score": noise(0, 35),
            "session_score": noise(0, 35),
            "interaction_score": noise(0, 35),
            "forum_score": noise(0, 30),
            "assignment_score": noise(0, 35),
        }
    else:  # medium
        return {
            "login_score": noise(30, 70),
            "session_score": noise(30, 70),
            "interaction_score": noise(30, 70),
            "forum_score": noise(20, 65),
            "assignment_score": noise(30, 70),
        }


def build_dataframe() -> pd.DataFrame:
    """Build a synthetic engagement_scores-like DataFrame."""
    rows = []

    # 33% high engagement, 34% medium, 33% low
    profiles = (
        [("high",   "stable")    ] * 50 +
        [("high",   "declining") ] * 50 +
        [("medium", "stable")    ] * 50 +
        [("medium", "declining") ] * 50 +
        [("low",    "stable")    ] * 50 +
        [("low",    "declining") ] * 50
    )
    random.shuffle(profiles)

    for i, (style, trend) in enumerate(profiles):
        sid = f"DUMMY_{i:04d}"
        base = {"high": _rnd(60, 95), "medium": _rnd(35, 65), "low": _rnd(5, 34)}[style]
        scores = generate_score_series(base, DAYS_PER_STUDENT, trend)

        for day_idx, eng in enumerate(scores):
            comp = generate_component_scores(eng, style)
            row = {
                "student_id": sid,
                "date": day_idx,
                "engagement_score": eng,
                "engagement_trend": "Declining" if trend == "declining" else (
                    "Improving" if day_idx > 0 and scores[day_idx] > scores[day_idx - 1] + 2 else "Stable"
                ),
                **comp,
            }
            rows.append(row)

    df = pd.DataFrame(rows)
    df = df.sort_values(["student_id", "date"]).reset_index(drop=True)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Replicate the same feature engineering as the production training script."""
    df = df.sort_values(["student_id", "date"])

    df["engagement_score_lag_1day"]  = df.groupby("student_id")["engagement_score"].shift(1)
    df["engagement_score_lag_3days"] = df.groupby("student_id")["engagement_score"].shift(3)
    df["engagement_score_lag_7days"] = df.groupby("student_id")["engagement_score"].shift(7)
    df["engagement_score_lag_14days"]= df.groupby("student_id")["engagement_score"].shift(14)

    df["rolling_avg_7days"]  = df.groupby("student_id")["engagement_score"].transform(
        lambda x: x.rolling(7, min_periods=1).mean()
    )
    df["rolling_avg_30days"] = df.groupby("student_id")["engagement_score"].transform(
        lambda x: x.rolling(30, min_periods=1).mean()
    )
    df["engagement_volatility_7days"] = df.groupby("student_id")["engagement_score"].transform(
        lambda x: x.rolling(7, min_periods=1).std().fillna(0)
    )

    df["is_declining"] = (df["engagement_trend"] == "Declining").astype(int)
    df["is_improving"] = (df["engagement_trend"] == "Improving").astype(int)

    df["login_to_session_ratio"]     = df["login_score"] / (df["session_score"] + 1)
    df["interaction_to_forum_ratio"] = df["interaction_score"] / (df["forum_score"] + 1)

    df["low_engagement"] = (df["engagement_score"] < AT_RISK_THRESHOLD).astype(int)
    df["consecutive_low_days"] = df.groupby("student_id")["low_engagement"].transform(
        lambda x: x.groupby((x != x.shift()).cumsum()).cumsum()
    )

    df["days_since_start"]   = df.groupby("student_id").cumcount() + 1
    df["cumulative_avg_score"] = (
        df.groupby("student_id")["engagement_score"]
        .expanding().mean()
        .reset_index(level=0, drop=True)
    )

    # Label
    df["at_risk"] = (df["engagement_score"] < AT_RISK_THRESHOLD).astype(int)

    return df


# ─────────────────────────────────────────────────────────────
# Train & Save
# ─────────────────────────────────────────────────────────────

def train():
    print("=" * 60)
    print("GENERATING SYNTHETIC ENGAGEMENT DATA")
    print("=" * 60)
    df_raw = build_dataframe()
    print(f"  Raw rows          : {len(df_raw)}")
    print(f"  Unique students   : {df_raw['student_id'].nunique()}")

    print("\n" + "=" * 60)
    print("FEATURE ENGINEERING")
    print("=" * 60)
    df = engineer_features(df_raw)

    # Drop rows missing critical lag features (first few days per student)
    df_ml = df.dropna(subset=["engagement_score_lag_7days", "rolling_avg_7days"]).copy()
    df_ml[FEATURE_COLUMNS] = df_ml[FEATURE_COLUMNS].fillna(0)

    X = df_ml[FEATURE_COLUMNS]
    y = df_ml["at_risk"]
    print(f"  ML-ready rows     : {len(df_ml)}")
    print(f"  Features          : {len(FEATURE_COLUMNS)}")
    print(f"  At-risk rate      : {y.mean()*100:.1f}%")

    print("\n" + "=" * 60)
    print("TRAINING GradientBoostingClassifier")
    print("=" * 60)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    clf = GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        min_samples_split=20,
        min_samples_leaf=10,
        random_state=RANDOM_SEED,
    )
    clf.fit(X_train, y_train)

    y_pred      = clf.predict(X_test)
    y_pred_prob = clf.predict_proba(X_test)[:, 1]
    acc     = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_prob)

    print(f"\n  Test Accuracy : {acc:.4f}")
    print(f"  ROC-AUC       : {roc_auc:.4f}")
    print()
    print(classification_report(y_test, y_pred, target_names=["Not At Risk", "At Risk"]))

    # Feature importance
    importances = sorted(
        [{"feature": f, "importance": float(imp)}
         for f, imp in zip(FEATURE_COLUMNS, clf.feature_importances_)],
        key=lambda x: x["importance"], reverse=True
    )

    metadata = {
        "model_type": type(clf).__name__,
        "training_date": datetime.now().isoformat(),
        "num_features": len(FEATURE_COLUMNS),
        "feature_names": FEATURE_COLUMNS,
        "num_training_samples": len(X_train),
        "num_test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "roc_auc": round(roc_auc, 4),
        "at_risk_threshold": AT_RISK_THRESHOLD,
        "risk_thresholds": {"high": 0.7, "medium": 0.4, "low": 0.0},
        "feature_importance": importances,
        "version": "1.0",
        "trained_on": "synthetic_dummy_data",
    }

    # ── Save to both locations ──────────────────────────────
    for dest_dir in [MODEL_DIR_SERVICE, MODEL_DIR_REPO]:
        dest_dir.mkdir(parents=True, exist_ok=True)

        joblib.dump(clf,              dest_dir / "disengagement_classifier_v1.0.pkl")
        joblib.dump(FEATURE_COLUMNS,  dest_dir / "feature_names.pkl")
        with open(dest_dir / "model_metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"  Saved to: {dest_dir}")
        print(f"    disengagement_classifier_v1.0.pkl")
        print(f"    feature_names.pkl")
        print(f"    model_metadata.json")

    print("\n" + "=" * 60)
    print("DONE — model ready. No dummy data written to DB.")
    print("=" * 60)
    return clf, FEATURE_COLUMNS, metadata


if __name__ == "__main__":
    train()
