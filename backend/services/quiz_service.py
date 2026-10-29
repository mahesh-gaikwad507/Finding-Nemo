"""Quiz game service — core game logic, scoring, and answer validation."""

import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import Question, QuizAttempt, UserAnswer


TOTAL_QUESTIONS = 30
CORRECT_POINTS = 10
WRONG_PENALTY = 2


def start_new_game(db: Session, user_id: int, category: str) -> QuizAttempt:
    """Start a new quiz game session for a user in a given category."""
    # Check if there's an incomplete attempt in this category
    existing = db.query(QuizAttempt).filter(
        and_(
            QuizAttempt.user_id == user_id,
            QuizAttempt.category == category,
            QuizAttempt.is_completed == False
        )
    ).first()

    if existing:
        # Return existing incomplete attempt
        return existing

    attempt = QuizAttempt(
        user_id=user_id,
        category=category,
        current_question=1,
        correct_answers=0,
        wrong_answers=0,
        score=0,
        is_completed=False
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_game_state(db: Session, attempt_id: int, user_id: int) -> dict:
    """Get the full game state including current question."""
    attempt = db.query(QuizAttempt).filter(
        and_(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    ).first()

    if not attempt:
        return None

    result = {
        "attempt_id": attempt.id,
        "category": attempt.category,
        "current_question": attempt.current_question,
        "correct_answers": attempt.correct_answers,
        "wrong_answers": attempt.wrong_answers,
        "score": attempt.score,
        "is_completed": attempt.is_completed,
        "started_at": attempt.started_at,
        "nemo_position": attempt.correct_answers,
        "progress_percentage": round((attempt.correct_answers / TOTAL_QUESTIONS) * 100, 2),
        "total_questions": TOTAL_QUESTIONS,
        "question": None
    }

    if not attempt.is_completed and attempt.current_question <= TOTAL_QUESTIONS:
        question = get_question_for_attempt(db, attempt)
        if question:
            result["question"] = format_question_for_client(question)

    return result


def get_question_for_attempt(db: Session, attempt: QuizAttempt) -> Question:
    """Get the current question for the attempt, enforcing sequence."""
    return db.query(Question).filter(
        and_(
            Question.category == attempt.category,
            Question.sequence_number == attempt.current_question
        )
    ).first()


def format_question_for_client(question: Question) -> dict:
    """Format a question for the frontend — keeps options fixed, constant, and identical for every user and domain."""
    options = {
        "A": question.option_a,
        "B": question.option_b,
        "C": question.option_c,
        "D": question.option_d
    }

    return {
        "id": question.id,
        "sequence_number": question.sequence_number,
        "clue": question.clue,
        "question_text": question.question_text,
        "options": options,
        "concept": question.concept,
        "difficulty": question.difficulty,
        "narrative_context": question.narrative_context,
        "_correct_answer": question.correct_answer
    }


def submit_answer(db: Session, attempt_id: int, user_id: int, question_id: int, selected_answer: str) -> dict:
    """Process a submitted answer with full validation."""
    # Get the attempt
    attempt = db.query(QuizAttempt).filter(
        and_(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    ).first()

    if not attempt:
        return {"error": "Game session not found"}

    if attempt.is_completed:
        return {"error": "This game is already completed"}

    # Get the question
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        return {"error": "Invalid question"}

    # Enforce sequence — the submitted question must be the current one
    if question.sequence_number != attempt.current_question:
        return {"error": f"Expected question {attempt.current_question}, got {question.sequence_number}"}

    if question.category != attempt.category:
        return {"error": "Question does not belong to this category"}

    # Check for duplicate submission
    existing_answer = db.query(UserAnswer).filter(
        and_(UserAnswer.attempt_id == attempt_id, UserAnswer.question_id == question_id)
    ).first()

    if existing_answer:
        return {"error": "This question has already been answered"}

    # Validate the answer
    is_correct = selected_answer == question.correct_answer
    score_change = CORRECT_POINTS if is_correct else -WRONG_PENALTY

    # Record the answer
    user_answer = UserAnswer(
        attempt_id=attempt_id,
        question_id=question_id,
        selected_answer=selected_answer,
        is_correct=is_correct
    )
    db.add(user_answer)

    # Update attempt stats
    attempt.score += score_change
    if is_correct:
        attempt.correct_answers += 1
    else:
        attempt.wrong_answers += 1

    attempt.current_question += 1

    # Check if game is complete
    if attempt.current_question > TOTAL_QUESTIONS:
        attempt.is_completed = True
        attempt.completed_at = datetime.now(timezone.utc)
        # Calculate total time
        started = attempt.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        total_seconds = int((datetime.now(timezone.utc) - started).total_seconds())
        attempt.total_time_seconds = total_seconds

    db.commit()
    db.refresh(attempt)

    return {
        "question_id": question_id,
        "selected_answer": selected_answer,
        "correct_answer": question.correct_answer,
        "is_correct": is_correct,
        "explanation": question.explanation,
        "score_change": score_change,
        "total_score": attempt.score,
        "correct_count": attempt.correct_answers,
        "wrong_count": attempt.wrong_answers,
        "current_question": attempt.current_question,
        "nemo_position": attempt.correct_answers,
        "progress_percentage": round((attempt.correct_answers / TOTAL_QUESTIONS) * 100, 2),
        "is_completed": attempt.is_completed
    }


def get_game_result(db: Session, attempt_id: int, user_id: int) -> dict:
    """Get the final result of a completed game."""
    attempt = db.query(QuizAttempt).filter(
        and_(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.is_completed == True
        )
    ).first()

    if not attempt:
        return None

    total_answered = attempt.correct_answers + attempt.wrong_answers
    accuracy = round((attempt.correct_answers / total_answered * 100), 2) if total_answered > 0 else 0

    return {
        "attempt_id": attempt.id,
        "category": attempt.category,
        "score": attempt.score,
        "correct_answers": attempt.correct_answers,
        "wrong_answers": attempt.wrong_answers,
        "total_questions": TOTAL_QUESTIONS,
        "accuracy": accuracy,
        "total_time_seconds": attempt.total_time_seconds or 0,
        "completed_at": attempt.completed_at,
        "nemo_reached_home": attempt.correct_answers == TOTAL_QUESTIONS
    }


def abandon_game(db: Session, attempt_id: int, user_id: int) -> bool:
    """Abandon an incomplete game. Mark it as completed with current stats."""
    attempt = db.query(QuizAttempt).filter(
        and_(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.is_completed == False
        )
    ).first()

    if not attempt:
        return False

    attempt.is_completed = True
    attempt.completed_at = datetime.now(timezone.utc)
    started = attempt.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    attempt.total_time_seconds = int((datetime.now(timezone.utc) - started).total_seconds())

    db.commit()
    return True
