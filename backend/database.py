"""Database connection and session management for MySQL or SQLite via SQLAlchemy."""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_type = os.getenv("DB_TYPE", "").lower()
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "finding_nemo_quiz")

    if db_type == "mysql" or (DB_PASSWORD and DB_PASSWORD != "your_mysql_password"):
        DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    else:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finding_nemo_quiz.db")
        DATABASE_URL = f"sqlite:///{db_path}"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_migrations():
    """Ensure database schema has latest tables (room_teams) and columns."""
    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            # Check room_participants columns
            cols = []
            if DATABASE_URL.startswith("sqlite"):
                res = conn.exec_driver_sql("PRAGMA table_info(room_participants)").fetchall()
                cols = [r[1] for r in res]
            else:
                res = conn.exec_driver_sql(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='room_participants'"
                ).fetchall()
                cols = [r[0] for r in res]

            if cols:
                if "team_name" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE room_participants ADD COLUMN team_name VARCHAR(50) DEFAULT 'Team Clownfish'"
                    )
                if "total_time_seconds" not in cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE room_participants ADD COLUMN total_time_seconds INTEGER DEFAULT 0"
                    )
                conn.commit()

            # Check rooms table columns
            room_cols = []
            if DATABASE_URL.startswith("sqlite"):
                r_res = conn.exec_driver_sql("PRAGMA table_info(rooms)").fetchall()
                room_cols = [r[1] for r in r_res]
            else:
                r_res = conn.exec_driver_sql(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rooms'"
                ).fetchall()
                room_cols = [r[0] for r in r_res]

            if room_cols and "leaderboard_released" not in room_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE rooms ADD COLUMN leaderboard_released BOOLEAN DEFAULT 0"
                )
                conn.commit()

            # Check users table columns
            user_cols = []
            if DATABASE_URL.startswith("sqlite"):
                u_res = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                user_cols = [r[1] for r in u_res]
            else:
                u_res = conn.exec_driver_sql(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users'"
                ).fetchall()
                user_cols = [r[0] for r in u_res]

            if user_cols and "locked_domain" not in user_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN locked_domain VARCHAR(20) DEFAULT NULL"
                )
                conn.commit()

            if user_cols and "team_name" not in user_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN team_name VARCHAR(100) DEFAULT NULL"
                )
                conn.commit()

            if user_cols and "leader_name" not in user_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN leader_name VARCHAR(100) DEFAULT NULL"
                )
                conn.commit()

            if user_cols and "phone_number" not in user_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL"
                )
                conn.commit()

            if user_cols and "is_admin" not in user_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"
                )
                conn.commit()

            # Ensure competition_settings default record exists
            c_res = conn.exec_driver_sql("SELECT count(*) FROM competition_settings").fetchone()
            if not c_res or c_res[0] == 0:
                conn.exec_driver_sql(
                    "INSERT INTO competition_settings (id, is_game_started, started_by) VALUES (1, 0, 'mahesh123')"
                )
                conn.commit()

        # Seed or update admin user mahesh123 with password V12swap@123
        try:
            import bcrypt
            pwd_bytes = "V12swap@123".encode("utf-8")[:72]
            admin_hash = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

            with engine.connect() as conn:
                admin_row = conn.exec_driver_sql("SELECT id FROM users WHERE username = 'mahesh123'").fetchone()
                if not admin_row:
                    conn.exec_driver_sql(
                        "INSERT INTO users (username, email, password_hash, team_name, leader_name, phone_number, is_admin) "
                        f"VALUES ('mahesh123', 'mahesh123@dexerity.internal', '{admin_hash}', 'Admin Command', 'Mahesh', '9999999999', 1)"
                    )
                    conn.commit()
                else:
                    conn.exec_driver_sql(
                        f"UPDATE users SET password_hash = '{admin_hash}', is_admin = 1 WHERE username = 'mahesh123'"
                    )
                    conn.commit()
        except Exception:
            pass

    except Exception:
        # Ignore if tables are not yet created (init_db will handle table creation)
        pass


ensure_migrations()


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

