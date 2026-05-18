import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.routes.expenses import router as expense_router
from app.database import Base, engine
from app.routes import auth, expenses, ocr
from app.routes.trips import router as trips_router
app.include_router(trips_router, prefix="/trips", tags=["trips"])

Base.metadata.create_all(bind=engine)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="SpendWise AI", version="1.0", redirect_slashes=False)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://spendwise-ai-smoky.vercel.app",
	"https://spendwise-ai-smoky-five.vercel.app",
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