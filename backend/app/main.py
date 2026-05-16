from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.expenses import router as expense_router
from app.database import Base, engine
from app.routes import auth, expenses
from app.routes import ocr
from fastapi.staticfiles import StaticFiles
from app.models.receipt import Receipt


Base.metadata.create_all(bind=engine)

app = FastAPI(title="SpendWise AI", version="1.0")
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)   

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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