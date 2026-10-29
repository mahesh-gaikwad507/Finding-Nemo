"""Quiz game service — core game logic, scoring, and answer validation."""

import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from typing import Optional
from models import Question, QuizAttempt, UserAnswer, User


TOTAL_QUESTIONS = 30
CORRECT_POINTS = 10
WRONG_PENALTY = 2


def get_user_locked_domain(db: Session, user_id: int) -> Optional[str]:
    """Retrieve user's locked domain.
    
    If locked_domain is not yet set on the user record, check whether the user has
    completed any solo quiz attempt or finished any multiplayer room. If found, lock
    and persist user.locked_domain so that rules are strictly enforced.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    if user.locked_domain:
        return user.locked_domain

    # Check for any quiz attempt (active in progress or completed)
    any_attempt = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id
    ).order_by(QuizAttempt.id.asc()).first()

    if any_attempt:
        user.locked_domain = any_attempt.category
        db.commit()
        db.refresh(user)
        return user.locked_domain

    # Check for completed multiplayer room
    try:
        from models import RoomParticipant
        finished_part = db.query(RoomParticipant).filter(
            and_(RoomParticipant.user_id == user_id, RoomParticipant.is_finished == True)
        ).first()
        if finished_part and finished_part.room:
            user.locked_domain = finished_part.room.category
            db.commit()
            db.refresh(user)
            return user.locked_domain
    except Exception:
        pass

    return None


def start_new_game(db: Session, user_id: int, category: str) -> QuizAttempt:
    """Start a new quiz game session for a user in a given category.
    
    Ensures that elapsed time is measured for the current quiz session only.
    Stale or unplayed attempts have their start timestamp refreshed, and abandoned
    attempts older than 30 minutes are finalized so a fresh session begins.
    """
    from models import CompetitionSetting

    user = db.query(User).filter(User.id == user_id).first()
    is_admin_user = user and (user.is_admin or user.username.lower() in ("mahesh123", "admin"))

    # 1. Enforce competition start by admin
    setting = db.query(CompetitionSetting).filter(CompetitionSetting.id == 1).first()
    if setting and not setting.is_game_started and not is_admin_user:
        raise ValueError(
            "The quiz competition has not started yet. Please wait for Admin (mahesh123) to click Start."
        )

    # 2. Enforce 1-domain-per-team rule: 1 team can select only one field and play in that field
    locked = get_user_locked_domain(db, user_id)
    if locked and category != locked:
        raise ValueError(
            f"Domain locked: Your team is registered for '{locked.upper()}'. "
            f"In accordance with competition rules, each team can only select 1 field and cannot play '{category.upper()}'."
        )

    # 3. Enforce single attempt rule: "No same user can play game again"
    completed = db.query(QuizAttempt).filter(
        and_(QuizAttempt.user_id == user_id, QuizAttempt.is_completed == True)
    ).first()
    if completed and not is_admin_user:
        raise ValueError(
            "You have already completed the quiz. In accordance with competition rules, each team is allowed only one attempt."
        )

    now = datetime.now(timezone.utc)

    # Check if there's an incomplete attempt in this category
    existing = db.query(QuizAttempt).filter(
        and_(
            QuizAttempt.user_id == user_id,
            QuizAttempt.category == category,
            QuizAttempt.is_completed == False
        )
    ).first()

    if existing:
        # If the attempt was never played (still on Q1 with 0 answers), refresh started_at to now
        if existing.current_question == 1 and existing.correct_answers == 0 and existing.wrong_answers == 0:
            existing.started_at = now
            existing.total_time_seconds = 0
            db.commit()
            db.refresh(existing)
            return existing

        # If it was partially played long ago (> 30 mins idle without activity), close it and start fresh
        started = existing.started_at
        if started:
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            idle_seconds = (now - started).total_seconds()
            if idle_seconds > 1800:
                existing.is_completed = True
                existing.completed_at = now
                existing.total_time_seconds = min(max(1, int(idle_seconds)), 600)
                db.commit()
                existing = None

    if existing:
        return existing

    attempt = QuizAttempt(
        user_id=user_id,
        category=category,
        current_question=1,
        correct_answers=0,
        wrong_answers=0,
        score=0,
        is_completed=False,
        started_at=now,
        total_time_seconds=0
    )
    db.add(attempt)
    if user and not user.locked_domain and not is_admin_user:
        user.locked_domain = category
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


def submit_answer(
    db: Session,
    attempt_id: int,
    user_id: int,
    question_id: int,
    selected_answer: str,
    client_time_seconds: int = None
) -> dict:
    """Process a submitted answer with full validation and accurate session timing."""
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

    now = datetime.now(timezone.utc)

    # Calculate active session elapsed time
    started = attempt.started_at
    if started:
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        server_elapsed = max(1, int((now - started).total_seconds()))
    else:
        server_elapsed = 1

    # Prefer client-measured active session timing if provided and reasonable
    if client_time_seconds is not None and 0 < client_time_seconds <= server_elapsed + 10:
        session_duration = max(1, client_time_seconds)
    else:
        session_duration = server_elapsed

    attempt.total_time_seconds = session_duration

    # Check if game is complete
    if attempt.current_question > TOTAL_QUESTIONS:
        attempt.is_completed = True
        attempt.completed_at = now
        attempt.total_time_seconds = session_duration

        # Automatically lock user's domain upon completing the test
        user = db.query(User).filter(User.id == user_id).first()
        if user and not user.locked_domain:
            user.locked_domain = attempt.category

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
        "total_time_seconds": attempt.total_time_seconds,
        "nemo_position": attempt.correct_answers,
        "progress_percentage": round((attempt.correct_answers / TOTAL_QUESTIONS) * 100, 2),
        "is_completed": attempt.is_completed
    }


def get_game_result(db: Session, attempt_id: int, user_id: int) -> dict:
    """Get the final result of a completed game with safely computed stats."""
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
    total_time = attempt.total_time_seconds if attempt.total_time_seconds and attempt.total_time_seconds > 0 else 0
    answering_speed = round(total_time / total_answered, 1) if total_answered > 0 else 0.0

    return {
        "attempt_id": attempt.id,
        "category": attempt.category,
        "score": attempt.score,
        "correct_answers": attempt.correct_answers,
        "wrong_answers": attempt.wrong_answers,
        "total_questions": TOTAL_QUESTIONS,
        "total_answered": total_answered,
        "accuracy": accuracy,
        "total_time_seconds": total_time,
        "answering_speed": answering_speed,
        "completed_at": attempt.completed_at,
        "nemo_reached_home": attempt.correct_answers == TOTAL_QUESTIONS
    }


def abandon_game(db: Session, attempt_id: int, user_id: int) -> bool:
    """Abandon an incomplete game. Mark it as completed with current session stats."""
    attempt = db.query(QuizAttempt).filter(
        and_(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.is_completed == False
        )
    ).first()

    if not attempt:
        return False

    now = datetime.now(timezone.utc)
    attempt.is_completed = True
    attempt.completed_at = now
    started = attempt.started_at
    if started:
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed = int((now - started).total_seconds())
        attempt.total_time_seconds = max(1, elapsed)
    else:
        attempt.total_time_seconds = 1

    db.commit()
    return True
