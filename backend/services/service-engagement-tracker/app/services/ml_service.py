"""
ML service for disengagement prediction.

Loads the trained GradientBoostingClassifier from disk and exposes a single
`predict` method that accepts the features already available inside
`generate_prediction` (engagement scores + lags + trend).

Model location: ml_models/disengagement_classifier_v1.0.pkl
"""

import json
import joblib
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ── Paths ────────────────────────────────────────────────────────────────────
_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent   # service-engagement-tracker/
_MODEL_DIR    = _SERVICE_ROOT / "ml_models"

RISK_THRESHOLDS = {"high": 0.7, "medium": 0.4}


# ── Singleton ────────────────────────────────────────────────────────────────

class DisengagementMLService:
    def __init__(self):
        self.model         = None
        self.feature_names = None
        self.metadata: dict = {}
        self._load()

    def _load(self):
        try:
            model_files = sorted(_MODEL_DIR.glob("disengagement_classifier_v*.pkl"))
            if not model_files:
                raise FileNotFoundError(f"No model found in {_MODEL_DIR}")

            model_path = model_files[-1]
            self.model = joblib.load(model_path)

            feat_path = _MODEL_DIR / "feature_names.pkl"
            self.feature_names = joblib.load(feat_path) if feat_path.exists() else None

            meta_path = _MODEL_DIR / "model_metadata.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    self.metadata = json.load(f)

            print(f"[DisengagementML] Loaded {model_path.name}  "
                  f"acc={self.metadata.get('accuracy', '?')}  "
                  f"features={len(self.feature_names or [])}")
        except Exception as e:
            print(f"[DisengagementML] WARNING – model not loaded: {e}")
            self.model = None

    @property
    def is_ready(self) -> bool:
        return self.model is not None and self.feature_names is not None

    def predict(
        self,
        engagement_score: float,
        engagement_trend: str,
        login_score: float = 0.0,
        session_score: float = 0.0,
        interaction_score: float = 0.0,
        forum_score: float = 0.0,
        assignment_score: float = 0.0,
        lag_1: Optional[float] = None,
        lag_3: Optional[float] = None,
        lag_7: Optional[float] = None,
        lag_14: Optional[float] = None,
        rolling_avg_7: Optional[float] = None,
        rolling_avg_30: Optional[float] = None,
        days_tracked: int = 1,
    ) -> dict:
        """
        Predict disengagement risk for a student.

        Returns a dict with:
            risk_probability  (float 0-1)
            risk_level        ('Low' | 'Medium' | 'High')
            at_risk           (bool)
            confidence_score  (float)
            model_version     (str)
        """
        if not self.is_ready:
            return self._rule_fallback(engagement_score, engagement_trend)

        # ── Build feature vector ──────────────────────────────────────────
        is_declining = 1 if engagement_trend == "Declining" else 0
        is_improving = 1 if engagement_trend == "Improving" else 0

        # Use engagement_score as fallback for missing lags / rolling averages
        es = engagement_score
        l1  = lag_1  if lag_1  is not None else es
        l3  = lag_3  if lag_3  is not None else es
        l7  = lag_7  if lag_7  is not None else es
        l14 = lag_14 if lag_14 is not None else es
        r7  = rolling_avg_7  if rolling_avg_7  is not None else es
        r30 = rolling_avg_30 if rolling_avg_30 is not None else es

        # Approximate volatility (|today - yesterday|) since we have no window here
        volatility = abs(es - l1)

        low_eng_flag = 1 if es < 30 else 0

        feature_map = {
            "login_score":                  login_score,
            "session_score":                session_score,
            "interaction_score":            interaction_score,
            "forum_score":                  forum_score,
            "assignment_score":             assignment_score,
            "engagement_score":             es,
            "engagement_score_lag_1day":    l1,
            "engagement_score_lag_7days":   l7,
            "engagement_score_lag_3days":   l3,
            "engagement_score_lag_14days":  l14,
            "rolling_avg_7days":            r7,
            "rolling_avg_30days":           r30,
            "engagement_volatility_7days":  volatility,
            "is_declining":                 is_declining,
            "is_improving":                 is_improving,
            "login_to_session_ratio":       login_score / (session_score + 1),
            "interaction_to_forum_ratio":   interaction_score / (forum_score + 1),
            "consecutive_low_days":         float(low_eng_flag * min(days_tracked, 14)),
            "days_since_start":             float(days_tracked),
            "cumulative_avg_score":         r30,   # best approximation available
        }

        X = pd.DataFrame([{f: feature_map.get(f, 0.0) for f in self.feature_names}])
        prob       = float(self.model.predict_proba(X)[0][1])
        confidence = float(max(prob, 1 - prob))

        if prob >= RISK_THRESHOLDS["high"]:
            risk_level = "High"
            at_risk    = True
        elif prob >= RISK_THRESHOLDS["medium"]:
            risk_level = "Medium"
            at_risk    = True
        else:
            risk_level = "Low"
            at_risk    = False

        return {
            "risk_probability": round(prob, 3),
            "risk_level":       risk_level,
            "at_risk":          at_risk,
            "confidence_score": round(confidence, 3),
            "model_version":    self.metadata.get("version", "1.0") + "_GradientBoosting",
            "model_type":       self.metadata.get("model_type", "GradientBoostingClassifier"),
        }

    # ── Rule-based fallback (original logic) ─────────────────────────────────
    @staticmethod
    def _rule_fallback(engagement_score: float, engagement_trend: str) -> dict:
        base_prob = round(max(0.0, min(1.0, (100 - engagement_score) / 100)), 3)
        if engagement_trend == "Declining":
            base_prob = round(min(1.0, base_prob + 0.15), 3)

        if base_prob >= 0.7:
            risk_level, at_risk = "High",   True
        elif base_prob >= 0.4:
            risk_level, at_risk = "Medium", True
        else:
            risk_level, at_risk = "Low",    False

        return {
            "risk_probability": base_prob,
            "risk_level":       risk_level,
            "at_risk":          at_risk,
            "confidence_score": 0.75,
            "model_version":    "rule-v1.0",
            "model_type":       "rule_based",
        }


# ── Singleton instance ────────────────────────────────────────────────────────
_instance: Optional[DisengagementMLService] = None


def get_disengagement_ml_service() -> DisengagementMLService:
    global _instance
    if _instance is None:
        _instance = DisengagementMLService()
    return _instance
