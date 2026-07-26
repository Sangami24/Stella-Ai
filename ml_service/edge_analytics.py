import os
import pickle
import numpy as np
import pandas as pd

class EdgeAnalyticsEngine:
    def __init__(self):
        self.model_dir = os.path.dirname(os.path.abspath(__file__))
        self.xgb_path = os.path.join(self.model_dir, "xgboost_model.pkl")
        self.iso_path = os.path.join(self.model_dir, "isolation_forest.pkl")
        
        self.xgb_model = None
        self.iso_model = None
        self.label_encoder = None
        self.is_ready = False

        self._load_models()

    def _load_models(self):
        if os.path.exists(self.xgb_path) and os.path.exists(self.iso_path):
            with open(self.xgb_path, 'rb') as f:
                data = pickle.load(f)
                self.xgb_model = data['model']
                self.label_encoder = data['encoder']
                self.features = data['features']
            with open(self.iso_path, 'rb') as f:
                self.iso_model = pickle.load(f)
            self.is_ready = True
            print("✅ ML Models loaded successfully.")
        else:
            print("⚠️ ML Models not found! Run train.py first. Using heuristic fallback mode.")

    def analyze(self, feature_vector: pd.DataFrame) -> dict:
        """
        Runs the Edge Analytics Engine.
        Returns the primary confidence score and fault details.
        """
        # Calculate health score first
        health_score = self._compute_health_score(feature_vector)
        
        if not self.is_ready:
            return self._heuristic_fallback(feature_vector.iloc[0], health_score)

        # Ensure feature alignment
        X = feature_vector[self.features]

        # 1. Isolation Forest for Anomaly Detection
        # Returns -1 for outliers, 1 for inliers
        is_anomaly = self.iso_model.predict(X)[0] == -1
        anomaly_score = float(self.iso_model.score_samples(X)[0])

        if not is_anomaly:
            return {
                "fault": "None",
                "probability": 0.0,
                "confidence": 0.0,
                "severity": 0,
                "affectedSensors": [],
                "recommendedAction": "Continue monitoring",
                "healthScore": health_score
            }

        # 2. XGBoost for Classification
        probs = self.xgb_model.predict_proba(X)[0]
        max_prob_idx = np.argmax(probs)
        probability = float(probs[max_prob_idx])
        
        # Determine fault class
        fault_class = self.label_encoder.inverse_transform([max_prob_idx])[0]
        
        confidence = round(probability * 100, 1)

        # Determine severity based on confidence and fault
        severity = 3
        if confidence > 75: severity = 5
        elif confidence > 60: severity = 4

        affected_sensors = self._get_affected_sensors(fault_class)
        action = self._get_recommended_action(fault_class)

        return {
            "fault": fault_class,
            "probability": probability,
            "confidence": confidence,
            "severity": severity,
            "affectedSensors": affected_sensors,
            "recommendedAction": action,
            "healthScore": health_score
        }

    def _compute_health_score(self, df: pd.DataFrame) -> int:
        """
        Computes a live Vehicle Health Score (0-100)
        """
        row = df.iloc[0]
        score = 100
        
        if row.get('coolantTemp', 90) > 105: score -= 15
        if row.get('oilPressure', 40) < 25: score -= 20
        if row.get('voltage', 14.2) < 11.5: score -= 10
        if row.get('vibration', 0.3) > 1.5: score -= 10
        if row.get('canErrorCount', 0) > 10: score -= 15
        
        return max(0, score)

    def _get_affected_sensors(self, fault: str) -> list:
        mapping = {
            "Coolant Failure": ["coolantTemp", "coolantPressure", "coolantFlowRate"],
            "Engine Failure": ["rpm", "oilPressure", "vibration"],
            "Battery Failure": ["voltage", "batterySoc", "current"],
            "Electrical Short": ["current", "voltage"],
            "Brake Failure": ["brakeTemp", "vehicleSpeed"],
            "Tire Failure": ["tirePressure", "vibration"]
        }
        return mapping.get(fault, [])

    def _get_recommended_action(self, fault: str) -> str:
        mapping = {
            "Coolant Failure": "Immediate inspection of cooling system and thermostat.",
            "Engine Failure": "Tow to nearest certified service center.",
            "Battery Failure": "Check battery health and alternator output.",
            "Electrical Short": "Isolate affected circuit immediately.",
            "Brake Failure": "Stop vehicle safely. Do not drive.",
            "Tire Failure": "Inspect tires for puncture or loss of pressure."
        }
        return mapping.get(fault, "Schedule service appointment.")

    def _heuristic_fallback(self, row: pd.Series, health: int) -> dict:
        """Fallback if models are not trained yet"""
        fault = "None"
        conf = 0.0
        
        if row.get('coolantTemp', 90) > 105:
            fault = "Coolant Failure"
            conf = 85.0 + (row['coolantTemp'] - 105)
        elif row.get('oilPressure', 40) < 25:
            fault = "Engine Failure"
            conf = 90.0
        elif row.get('voltage', 14.2) < 11.5:
            fault = "Electrical Short"
            conf = 88.0

        if fault == "None":
            return {
                "fault": "None",
                "probability": 0.0,
                "confidence": 0.0,
                "severity": 0,
                "affectedSensors": [],
                "recommendedAction": "Continue monitoring",
                "healthScore": health
            }

        return {
            "fault": fault,
            "probability": conf / 100.0,
            "confidence": min(99.9, conf),
            "severity": 4 if conf < 90 else 5,
            "affectedSensors": self._get_affected_sensors(fault),
            "recommendedAction": self._get_recommended_action(fault),
            "healthScore": health
        }
