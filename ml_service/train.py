import os
import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

def train_models():
    print("Loading dataset...")
    # Assuming dataset is in the parent directory
    dataset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'STLA_Guardian_AI_ECU_Telemetry_Dataset_No_Normal.xlsx')
    
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}")
        print("Please ensure the excel file is in the root CON1 folder.")
        return

    df = pd.read_excel(dataset_path)

    # We assume the dataset has columns that match our telemetry fields.
    # We will grab all numeric columns for features, and a 'Fault_Type' column for labels.
    # If the user's dataset has different column names, they might need to map them.
    # For now, we will dynamically use what's there, assuming 'Fault_Type' or similar exists.
    
    label_col = 'Fault_Type' if 'Fault_Type' in df.columns else df.columns[-1]
    
    # Feature Engineering (mimic the pipeline)
    # Since this is a static dataset, we will just use the raw numeric columns as features for simplicity
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if label_col in numeric_cols:
        numeric_cols.remove(label_col)

    X = df[numeric_cols].fillna(0)
    y = df[label_col].astype(str)

    print(f"Features: {numeric_cols}")
    print(f"Labels found: {y.unique()}")

    # 1. Train Isolation Forest
    print("Training Isolation Forest...")
    iso = IsolationForest(contamination=0.1, random_state=42)
    iso.fit(X)

    # 2. Train XGBoost
    print("Training XGBoost Classifier...")
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    xgb_model = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=len(le.classes_),
        eval_metric='mlogloss',
        use_label_encoder=False,
        random_state=42
    )
    xgb_model.fit(X, y_encoded)

    # Save models
    model_dir = os.path.dirname(os.path.abspath(__file__))
    
    iso_path = os.path.join(model_dir, "isolation_forest.pkl")
    with open(iso_path, 'wb') as f:
        pickle.dump(iso, f)

    xgb_path = os.path.join(model_dir, "xgboost_model.pkl")
    with open(xgb_path, 'wb') as f:
        pickle.dump({
            'model': xgb_model,
            'encoder': le,
            'features': numeric_cols
        }, f)

    print("✅ Models trained and saved successfully in ml_service directory.")

if __name__ == "__main__":
    train_models()
