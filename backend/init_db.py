"""Database initialization and question bank seeding script."""

import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, Base
from models import Question, User
from questions.python_questions import PYTHON_QUESTIONS
from questions.sql_questions import SQL_QUESTIONS
from questions.excel_questions import EXCEL_QUESTIONS


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")


def seed_questions():
    """Seed the question bank with all 90 questions."""
    db = SessionLocal()
    try:
        # Check if questions already exist
        existing_count = db.query(Question).count()
        if existing_count > 0:
            print(f"Questions already exist ({existing_count} found). Skipping seed.")
            return

        print("Seeding questions...")

        all_questions = [
            ("python", PYTHON_QUESTIONS),
            ("sql", SQL_QUESTIONS),
            ("excel", EXCEL_QUESTIONS),
        ]

        total_added = 0
        for category, questions in all_questions:
            for q_data in questions:
                question = Question(
                    category=category,
                    sequence_number=q_data["sequence_number"],
                    clue=q_data["clue"],
                    question_text=q_data["question_text"],
                    option_a=q_data["option_a"],
                    option_b=q_data["option_b"],
                    option_c=q_data["option_c"],
                    option_d=q_data["option_d"],
                    correct_answer=q_data["correct_answer"],
                    explanation=q_data["explanation"],
                    concept=q_data["concept"],
                    prerequisite_concept=q_data.get("prerequisite_concept"),
                    difficulty=q_data["difficulty"],
                    narrative_context=q_data.get("narrative_context"),
                )
                db.add(question)
                total_added += 1

            print(f"  Added {len(questions)} {category} questions")

        db.commit()
        print(f"Total questions seeded: {total_added}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding questions: {e}")
        raise
    finally:
        db.close()


def init_database():
    """Full database initialization."""
    create_tables()
    seed_questions()
    print("\nDatabase initialization complete!")
    print("You can now start the FastAPI server with: uvicorn main:app --reload")


if __name__ == "__main__":
    init_database()
