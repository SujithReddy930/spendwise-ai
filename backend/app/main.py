import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.database import Base, engine
from app.routes import auth, expenses, ocr
from app.routes.expenses import router as expense_router
from app.routes.trips import router as trips_router
from app.routes.splits import router as splits_router
from app.routes.wallet import router as wallet_router
from app.routes.profile import router as profile_router
from app.routes.export import router as export_router
from app.routes.ai import router as ai_router          # ← NEW

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="SpendWise AI", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ───────────────────────────────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Create all tables ──────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(expense_router)
app.include_router(trips_router)
app.include_router(splits_router)
app.include_router(wallet_router)
app.include_router(ocr.router)
app.include_router(profile_router)
app.include_router(export_router)
app.include_router(ai_router)                          # ← NEW


@app.get("/")
def root():
    return {"status": "SpendWise AI is running"}