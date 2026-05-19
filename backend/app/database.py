import os

from sqlalchemy import (
    create_engine,
    text,
)

from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
)

# DATABASE URL

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./spendwise.db",
)

if DATABASE_URL.startswith(
    "postgres://"
):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

# ENGINE

engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False}
        if "sqlite" in DATABASE_URL
        else {}
    ),
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


# SAFE SQL EXECUTION

def safe_execute(
    conn,
    query,
):
    try:
        conn.execute(
            text(query)
        )

    except Exception as e:

        error = str(e)

        if (
            "duplicate column name"
            in error
        ):
            return

        print(
            f"Migration warning: {error}"
        )


# DATABASE MIGRATIONS

def run_migrations():

    with engine.connect() as conn:

        migrations = [

            # USERS TABLE

            """
            ALTER TABLE users
            ADD COLUMN failed_login_attempts
            INTEGER DEFAULT 0
            """,

            """
            ALTER TABLE users
            ADD COLUMN locked_until
            TIMESTAMP
            """,

            """
            ALTER TABLE users
            ADD COLUMN reset_token
            VARCHAR
            """,

            """
            ALTER TABLE users
            ADD COLUMN reset_token_expiry
            TIMESTAMP
            """,

            """
            ALTER TABLE users
            ADD COLUMN is_active
            BOOLEAN DEFAULT TRUE
            """,

            # EXPENSES TABLE

            """
            ALTER TABLE expenses
            ADD COLUMN payment_method
            VARCHAR DEFAULT 'UPI'
            """,

            """
            ALTER TABLE expenses
            ADD COLUMN note
            VARCHAR DEFAULT ''
            """,

            """
            ALTER TABLE expenses
            ADD COLUMN is_recurring
            BOOLEAN DEFAULT FALSE
            """,
        ]

        for query in migrations:
            safe_execute(
                conn,
                query,
            )

        # PostgreSQL ONLY

        if (
            "postgresql"
            in DATABASE_URL
        ):

            safe_execute(
                conn,
                """
                ALTER TABLE expenses
                ALTER COLUMN user_id
                DROP NOT NULL
                """,
            )

        conn.commit()


# RUN MIGRATIONS

try:
    run_migrations()

except Exception as e:

    print(
        f"Startup migration error: {e}"
    )


# DATABASE SESSION

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()