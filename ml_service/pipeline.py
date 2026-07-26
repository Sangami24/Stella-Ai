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

        # Convert to DataFrame
        df = pd.DataFrame(telemetry_history)

        # 1. Signal Processing
        df = self._smooth_signals(df)

        # 2. Feature Engineering
        features = self._engineer_features(df)
        
        return features

    def _smooth_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Moving average smoothing, noise filtering, missing value handling.
        """
        # Fill missing values with forward fill, then backward fill
        df = df.ffill().bfill()
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        # Apply moving average for smoothing (window size of 3)
        # Using min_periods=1 so we don't get NaNs early on
        df[numeric_cols] = df[numeric_cols].rolling(window=3, min_periods=1).mean()
        
        return df

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generate engineered features for the ML model.
        Requires at least a few rows to calculate rates of change.
        """
        # If we only have 1 row, rate of change is 0
        if len(df) < 2:
            df['temp_rate_of_rise'] = 0.0
            df['battery_discharge_rate'] = 0.0
            df['voltage_fluctuation'] = 0.0
            df['rpm_variance'] = 0.0
            df['pressure_gradient'] = 0.0
        else:
            df['temp_rate_of_rise'] = df['engineTemp'].diff().fillna(0)
            df['battery_discharge_rate'] = -df['batterySoc'].diff().fillna(0)  # Negative diff = discharge
            df['voltage_fluctuation'] = df['voltage'].diff().abs().fillna(0)
            df['rpm_variance'] = df['rpm'].rolling(window=3, min_periods=1).std().fillna(0)
            df['pressure_gradient'] = df['coolantPressure'].diff().fillna(0)

        # We return the LAST row as the current feature vector for the Edge Analytics Engine
        feature_vector = df.iloc[-1:]
        
        return feature_vector
