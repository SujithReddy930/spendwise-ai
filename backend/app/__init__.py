# backend/app/models/__init__.py
# Import all models here so SQLAlchemy Base.metadata knows about them
# and can create all tables on startup.

from app.models.user import User
from app.models.expense import Expense
from app.models.receipt import Receipt
from app.models.trip import Trip, TripExpense, TripMember, ExpenseSplit, TripExpenseHistory
from app.models.wallet import TripWallet, WalletDeposit, WalletTransaction
from app.models.ai_models import AIInsight, AIPrediction, BudgetLimit