from app.database import Base, engine
from app.models.trip import TripExpenseHistory

def run():
    Base.metadata.create_all(bind=engine)
    print("Migration complete - trip_expense_history table created.")

if __name__ == "__main__":
    run()
