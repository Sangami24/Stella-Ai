from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from pipeline import TelemetryPipeline
from edge_analytics import EdgeAnalyticsEngine

app = FastAPI(title="STLA Guardian ML Microservice")

pipeline = TelemetryPipeline(window_size=5)
edge_engine = EdgeAnalyticsEngine()

class TelemetryPayload(BaseModel):
    history: List[Dict[str, Any]]

@app.post("/predict")
async def predict_fault(payload: TelemetryPayload):
    try:
        if not payload.history:
            raise HTTPException(status_code=400, detail="Empty telemetry history")

        # 1. Signal Processing & Feature Engineering
        feature_vector = pipeline.process(payload.history)

        # 2. Edge Analytics Inference
        prediction = edge_engine.analyze(feature_vector)

        return prediction

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "models_loaded": edge_engine.is_ready}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
