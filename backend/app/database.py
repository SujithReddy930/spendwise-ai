import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# ── DATABASE URL ──────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./spendwise.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── ENGINE ────────────────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args=({"check_same_thread": False} if "sqlite" in DATABASE_URL else {}),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── SAFE SQL EXECUTION ────────────────────────────────────────────────────────

def safe_execute(conn, query):
    try:
        conn.execute(text(query))
    except Exception as e:
        error = str(e).lower()
        conn.rollback()
        if "duplicate column name" not in error and "already exists" not in error:
            print(f"Migration warning: {e}")


# ── DATABASE MIGRATIONS ───────────────────────────────────────────────────────

def run_migrations():
    with engine.connect() as conn:

        migrations = [
            # USERS TABLE
            "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP",
            "ALTER TABLE users ADD COLUMN reset_token VARCHAR",
            "ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP",
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE",

            # EXPENSES TABLE
            "ALTER TABLE expenses ADD COLUMN payment_method VARCHAR DEFAULT 'UPI'",
            "ALTER TABLE expenses ADD COLUMN note VARCHAR DEFAULT ''",
            "ALTER TABLE expenses ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE",

            # RECEIPTS TABLE — new columns
            "ALTER TABLE receipts ADD COLUMN user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE receipts ADD COLUMN merchant VARCHAR",
            "ALTER TABLE receipts ADD COLUMN date TIMESTAMP",
            "ALTER TABLE receipts ADD COLUMN created_at TIMESTAMP",

            # AI INSIGHTS TABLE
            """
            CREATE TABLE IF NOT EXISTS ai_insights (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                insights JSON NOT NULL DEFAULT '[]',
                total_spent FLOAT,
                top_category VARCHAR(100),
                expense_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,

            # AI PREDICTIONS TABLE
            """
            CREATE TABLE IF NOT EXISTS ai_predictions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                predicted_total FLOAT,
                confidence VARCHAR(20),
                summary TEXT,
                breakdown JSON,
                days_elapsed INTEGER,
                days_in_month INTEGER,
                total_spent_so_far FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,

            # BUDGET LIMITS TABLE
            """
            CREATE TABLE IF NOT EXISTS budget_limits (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                category VARCHAR(100) NOT NULL,
                monthly_limit FLOAT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
        ]

        for query in migrations:
            safe_execute(conn, query)
            conn.commit()

        # PostgreSQL ONLY
        if "postgresql" in DATABASE_URL:
            safe_execute(conn, "ALTER TABLE expenses ALTER COLUMN user_id DROP NOT NULL")
            conn.commit()


# ── RUN MIGRATIONS ON STARTUP ─────────────────────────────────────────────────

try:
    run_migrations()
except Exception as e:
    print(f"Startup migration error: {e}")


# ── DATABASE SESSION ──────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()