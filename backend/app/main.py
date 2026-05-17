import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes.expenses import router as expense_router
from app.database import Base, engine
from app.routes import auth, expenses, ocr
from app.models.receipt import Receipt

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SpendWise AI", version="1.0", redirect_slashes=False)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://spendwise-ai-smoky.vercel.app",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(expense_router)
app.include_router(expenses.router)
app.include_router(ocr.router)

@app.get("/")
def root():
    return {"message": "SpendWise AI backend is running!"}