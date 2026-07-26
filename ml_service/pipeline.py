import pandas as pd
import numpy as np
class TelemetryPipeline:
    """
    Handles Signal Processing and Feature Engineering
    """
    def __init__(self, window_size=5):
        self.window_size = window_size
    def process(self, telemetry_history: list[dict]) -> pd.DataFrame:
        if not telemetry_history:
            raise ValueError("Empty telemetry history")
        df = pd.DataFrame(telemetry_history)
        df = self._smooth_signals(df)
        features = self._engineer_features(df)
        return features
    def _smooth_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Moving average smoothing, noise filtering, missing value handling.
        """
        df = df.ffill().bfill()
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df[numeric_cols] = df[numeric_cols].rolling(window=3, min_periods=1).mean()
        return df
    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generate engineered features for the ML model.
        Requires at least a few rows to calculate rates of change.
        """
        if len(df) < 2:
            df['temp_rate_of_rise'] = 0.0
            df['battery_discharge_rate'] = 0.0
            df['voltage_fluctuation'] = 0.0
            df['rpm_variance'] = 0.0
            df['pressure_gradient'] = 0.0
        else:
            df['temp_rate_of_rise'] = df['engineTemp'].diff().fillna(0)
            df['battery_discharge_rate'] = -df['batterySoc'].diff().fillna(0)  
            df['voltage_fluctuation'] = df['voltage'].diff().abs().fillna(0)
            df['rpm_variance'] = df['rpm'].rolling(window=3, min_periods=1).std().fillna(0)
            df['pressure_gradient'] = df['coolantPressure'].diff().fillna(0)
        feature_vector = df.iloc[-1:]
        return feature_vector
