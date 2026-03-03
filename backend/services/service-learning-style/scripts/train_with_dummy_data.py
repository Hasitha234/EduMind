"""
Train the learning style ML model using synthetic dummy data.

- Generates 200 realistic dummy students (Visual / Auditory / Reading / Kinesthetic)
- Trains a RandomForestClassifier on the 23 features used in production
- Saves the model to:
    1. ml_models/  (where the FastAPI service looks at startup)
    2. C:/Projects/edumind/EduMind/ml/models/learning_style_recognizer/
- Does NOT write any dummy data to the database

Run from the service-learning-style directory:
    python scripts/train_with_dummy_data.py
"""

import sys
import json
import random
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from ml.feature_engineering import LearningStyleFeatureEngineer

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
RANDOM_SEED = 42
N_STUDENTS = 200
DAYS_PER_STUDENT = 20
STYLES = ["Visual", "Auditory", "Reading", "Kinesthetic"]

MODEL_DIR_SERVICE = Path(__file__).resolve().parent.parent / "ml_models"
MODEL_DIR_REPO    = Path("C:/Projects/edumind/EduMind/ml/models/learning_style_recognizer")

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ─────────────────────────────────────────────────────────────
# Dummy data generation
# Each style has a distinct behavioural "signature" in the raw
# columns that StudentBehaviorTracking stores.
# ─────────────────────────────────────────────────────────────

def _rnd(lo, hi):
    return round(random.uniform(lo, hi), 2)

def generate_daily_record(student_id: str, day: int, style: str) -> dict:
    """Return one fake StudentBehaviorTracking-like dict for a student."""
    base = {
        "student_id": student_id,
        "tracking_date": day,   # used only for count; not stored in DB
        "total_session_time": _rnd(30, 180),
        "login_count": random.randint(1, 5),
        "video_completion_rate": _rnd(0, 100),
    }

    if style == "Visual":
        base.update({
            "video_watch_time":       _rnd(40, 120),
            "video_interactions":     random.randint(5, 20),
            "diagram_views":          random.randint(5, 20),
            "image_interactions":     random.randint(5, 15),
            "visual_aid_usage":       random.randint(3, 12),
            "text_read_time":         _rnd(5, 20),
            "articles_read":          random.randint(0, 2),
            "note_taking_count":      random.randint(0, 3),
            "audio_playback_time":    _rnd(0, 10),
            "podcast_completions":    random.randint(0, 1),
            "simulation_time":        _rnd(0, 10),
            "interactive_exercises":  random.randint(0, 2),
            "hands_on_activities":    random.randint(0, 2),
            "forum_posts":            random.randint(0, 2),
            "discussion_participation": random.randint(0, 2),
            "peer_interactions":      random.randint(0, 2),
        })
    elif style == "Auditory":
        base.update({
            "audio_playback_time":    _rnd(40, 120),
            "podcast_completions":    random.randint(3, 10),
            "forum_posts":            random.randint(3, 10),
            "discussion_participation": random.randint(3, 10),
            "peer_interactions":      random.randint(2, 8),
            "video_watch_time":       _rnd(5, 25),
            "video_interactions":     random.randint(0, 3),
            "diagram_views":          random.randint(0, 3),
            "image_interactions":     random.randint(0, 3),
            "visual_aid_usage":       random.randint(0, 2),
            "text_read_time":         _rnd(5, 20),
            "articles_read":          random.randint(0, 2),
            "note_taking_count":      random.randint(0, 2),
            "simulation_time":        _rnd(0, 10),
            "interactive_exercises":  random.randint(0, 2),
            "hands_on_activities":    random.randint(0, 2),
        })
    elif style == "Reading":
        base.update({
            "text_read_time":         _rnd(50, 140),
            "articles_read":          random.randint(5, 15),
            "note_taking_count":      random.randint(5, 15),
            "video_watch_time":       _rnd(5, 20),
            "video_interactions":     random.randint(0, 3),
            "diagram_views":          random.randint(0, 3),
            "image_interactions":     random.randint(0, 3),
            "visual_aid_usage":       random.randint(0, 2),
            "audio_playback_time":    _rnd(0, 10),
            "podcast_completions":    random.randint(0, 1),
            "simulation_time":        _rnd(0, 10),
            "interactive_exercises":  random.randint(0, 2),
            "hands_on_activities":    random.randint(0, 2),
            "forum_posts":            random.randint(0, 3),
            "discussion_participation": random.randint(0, 3),
            "peer_interactions":      random.randint(0, 2),
        })
    else:  # Kinesthetic
        base.update({
            "simulation_time":        _rnd(40, 120),
            "interactive_exercises":  random.randint(5, 20),
            "hands_on_activities":    random.randint(5, 15),
            "video_watch_time":       _rnd(5, 25),
            "video_interactions":     random.randint(0, 4),
            "diagram_views":          random.randint(0, 4),
            "image_interactions":     random.randint(0, 4),
            "visual_aid_usage":       random.randint(0, 3),
            "text_read_time":         _rnd(5, 20),
            "articles_read":          random.randint(0, 3),
            "note_taking_count":      random.randint(0, 3),
            "audio_playback_time":    _rnd(0, 10),
            "podcast_completions":    random.randint(0, 1),
            "forum_posts":            random.randint(0, 3),
            "discussion_participation": random.randint(0, 3),
            "peer_interactions":      random.randint(0, 3),
        })

    return base


def generate_dummy_dataset():
    records = []
    labels  = {}
    for i in range(N_STUDENTS):
        student_id = f"DUMMY_{i:04d}"
        style = STYLES[i % len(STYLES)]
        labels[student_id] = style
        for day in range(DAYS_PER_STUDENT):
            records.append(generate_daily_record(student_id, day, style))
    return records, labels


# ─────────────────────────────────────────────────────────────
# Train
# ─────────────────────────────────────────────────────────────

def train():
    print("=" * 60)
    print("GENERATING DUMMY TRAINING DATA")
    print("=" * 60)
    records, labels = generate_dummy_dataset()
    print(f"  Generated {len(records)} daily records for {N_STUDENTS} students")
    print(f"  Style distribution: { {s: list(labels.values()).count(s) for s in STYLES} }")

    print("\n" + "=" * 60)
    print("FEATURE ENGINEERING")
    print("=" * 60)
    fe = LearningStyleFeatureEngineer()
    aggregated = fe.aggregate_behavior_data(records)
    features_df = fe.engineer_features(aggregated)
    features_df["learning_style"] = features_df["student_id"].map(labels)

    feature_cols = [
        "visual_time_ratio", "reading_time_ratio", "audio_time_ratio",
        "kinesthetic_time_ratio", "visual_interaction_score",
        "social_interaction_score", "kinesthetic_interaction_score",
        "video_engagement_depth", "reading_engagement_depth",
        "audio_engagement_depth", "note_taking_intensity",
        "visual_preference_score", "reading_preference_score",
        "auditory_preference_score", "kinesthetic_preference_score",
        "activity_diversity", "engagement_balance",
        "video_vs_text_ratio", "active_vs_passive_ratio",
        "social_learning_score", "visual_aid_dependency",
        "video_completion_rate", "login_count",
    ]

    # Keep only columns that exist (feature engineering may vary)
    available = [c for c in feature_cols if c in features_df.columns]
    missing   = [c for c in feature_cols if c not in features_df.columns]
    if missing:
        print(f"  WARNING: missing features (will use 0): {missing}")
        for c in missing:
            features_df[c] = 0.0
        available = feature_cols

    X = features_df[available].fillna(0.0)
    y = features_df["learning_style"]

    print(f"  Feature matrix: {X.shape}")
    print(f"  Labels: {y.value_counts().to_dict()}")

    print("\n" + "=" * 60)
    print("TRAINING RandomForestClassifier")
    print("=" * 60)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=2,
        random_state=RANDOM_SEED,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n  Test accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred))

    # ─────────────────────────────────────────────────────────
    # Build metadata
    # ─────────────────────────────────────────────────────────
    importances = [
        {"feature": f, "importance": float(imp)}
        for f, imp in zip(available, clf.feature_importances_)
    ]
    importances.sort(key=lambda x: x["importance"], reverse=True)

    metadata = {
        "model_type": type(clf).__name__,
        "training_date": datetime.now().isoformat(),
        "num_features": len(available),
        "num_training_samples": len(X_train),
        "num_test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "classes": sorted(clf.classes_.tolist()),
        "feature_names": available,
        "feature_importance": importances,
        "version": "1.0",
        "trained_on": "synthetic_dummy_data",
        "note": "Model trained on synthetic data; real predictions use actual behavior features.",
    }

    # ─────────────────────────────────────────────────────────
    # Save to both locations
    # ─────────────────────────────────────────────────────────
    for dest_dir in [MODEL_DIR_SERVICE, MODEL_DIR_REPO]:
        dest_dir.mkdir(parents=True, exist_ok=True)

        model_path    = dest_dir / "learning_style_classifier_v1.0.pkl"
        features_path = dest_dir / "feature_names.pkl"
        meta_path     = dest_dir / "model_metadata.json"

        joblib.dump(clf, model_path)
        joblib.dump(available, features_path)
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"\n  Saved to: {dest_dir}")
        print(f"    {model_path.name}")
        print(f"    {features_path.name}")
        print(f"    {meta_path.name}")

    print("\n" + "=" * 60)
    print("DONE — model ready. No dummy data written to DB.")
    print("=" * 60)
    return acc


if __name__ == "__main__":
    train()
