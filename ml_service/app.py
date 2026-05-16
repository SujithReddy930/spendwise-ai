from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from categorizer import predict_category
from insights import generate_insights
from predictor import predict_month_end

app = FastAPI(title="SpendWise AI - ML Service", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CategorizeRequest(BaseModel):
    title: str

@app.post("/ai/categorize")
def categorize(req: CategorizeRequest):
    return predict_category(req.title)

class InsightsRequest(BaseModel):
    current_by_category: Dict[str, float]
    previous_by_category: Dict[str, float]
    current_total: float
    previous_total: float
    current_month: str
    previous_month: str

@app.post("/ai/insights")
def insights(req: InsightsRequest):
    tips = generate_insights(
        req.current_by_category,
        req.previous_by_category,
        req.current_total,
        req.previous_total,
        req.current_month,
        req.previous_month
    )
    return {"insights": tips}

class PredictRequest(BaseModel):
    monthly_totals: List[float]
    current_spent: float
    days_elapsed: int
    total_days: int = 30

@app.post("/ai/predict")
def predict(req: PredictRequest):
    return predict_month_end(
        req.monthly_totals,
        req.current_spent,
        req.days_elapsed,
        req.total_days
    )

@app.get("/")
def root():
    return {"message": "SpendWise AI ML Service running!"}