"""Leaderboard service — rankings, sorting, and statistics."""

from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc, func

from models import QuizAttempt, User


def get_category_leaderboard(db: Session, category: str, limit: int = 50) -> list:
    """Get leaderboard for a specific category.
    
    Sort order: highest score → shortest time → most correct answers.
    Only completed attempts are included.
    """
    results = (
        db.query(
            QuizAttempt,
            User.username
        )
        .join(User, User.id == QuizAttempt.user_id)
        .filter(
            and_(
                QuizAttempt.category == category,
                QuizAttempt.is_completed == True,
                QuizAttempt.correct_answers + QuizAttempt.wrong_answers == 30  # Full games only
            )
        )
        .order_by(
            desc(QuizAttempt.correct_answers),
            asc(QuizAttempt.total_time_seconds),
            desc(QuizAttempt.score)
        )
        .limit(limit)
        .all()
    )

    entries = []
    for rank, (attempt, username) in enumerate(results, 1):
        total_answered = attempt.correct_answers + attempt.wrong_answers
        accuracy = round((attempt.correct_answers / total_answered * 100), 2) if total_answered > 0 else 0

        entries.append({
            "rank": rank,
            "username": username,
            "score": attempt.score,
            "correct_answers": attempt.correct_answers,
            "wrong_answers": attempt.wrong_answers,
            "accuracy": accuracy,
            "total_time_seconds": attempt.total_time_seconds or 0,
            "completed_at": attempt.completed_at
        })

    return entries


def get_overall_leaderboard(db: Session, limit: int = 50) -> list:
    """Get overall leaderboard across all categories.
    
    Winner decided on the basis of: most correct answers, then quickest time (speed), then score.
    """
    # Get best attempt per user (most correct, then shortest time)
    subquery = (
        db.query(
            QuizAttempt.user_id,
            func.max(QuizAttempt.correct_answers).label("best_correct"),
            func.min(QuizAttempt.total_time_seconds).label("best_time")
        )
        .filter(
            and_(
                QuizAttempt.is_completed == True,
                QuizAttempt.correct_answers + QuizAttempt.wrong_answers == 30
            )
        )
        .group_by(QuizAttempt.user_id)
        .subquery()
    )

    results = (
        db.query(
            QuizAttempt,
            User.username
        )
        .join(User, User.id == QuizAttempt.user_id)
        .join(
            subquery,
            and_(
                QuizAttempt.user_id == subquery.c.user_id,
                QuizAttempt.correct_answers == subquery.c.best_correct
            )
        )
        .filter(
            and_(
                QuizAttempt.is_completed == True,
                QuizAttempt.correct_answers + QuizAttempt.wrong_answers == 30
            )
        )
        .order_by(
            desc(QuizAttempt.correct_answers),
            asc(QuizAttempt.total_time_seconds),
            desc(QuizAttempt.score)
        )
        .limit(limit)
        .all()
    )

    entries = []
    seen_users = set()
    rank = 0
    for attempt, username in results:
        if username in seen_users:
            continue
        seen_users.add(username)
        rank += 1

        total_answered = attempt.correct_answers + attempt.wrong_answers
        accuracy = round((attempt.correct_answers / total_answered * 100), 2) if total_answered > 0 else 0

        entries.append({
            "rank": rank,
            "username": username,
            "score": attempt.score,
            "correct_answers": attempt.correct_answers,
            "wrong_answers": attempt.wrong_answers,
            "accuracy": accuracy,
            "total_time_seconds": attempt.total_time_seconds or 0,
            "completed_at": attempt.completed_at
        })

    return entries


def get_user_rank(db: Session, user_id: int, category: str) -> int:
    """Get a user's rank in a specific category."""
    # Get user's best score in this category
    user_best = (
        db.query(func.max(QuizAttempt.score))
        .filter(
            and_(
                QuizAttempt.user_id == user_id,
                QuizAttempt.category == category,
                QuizAttempt.is_completed == True
            )
        )
        .scalar()
    )

    if user_best is None:
        return None

    # Count how many users have a higher score
    higher_count = (
        db.query(func.count(func.distinct(QuizAttempt.user_id)))
        .filter(
            and_(
                QuizAttempt.category == category,
                QuizAttempt.is_completed == True,
                QuizAttempt.score > user_best
            )
        )
        .scalar()
    )

    return higher_count + 1


def get_user_attempts(db: Session, user_id: int) -> list:
    """Get all attempts for a user across all categories."""
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user_id)
        .order_by(desc(QuizAttempt.started_at))
        .all()
    )

    result = []
    for attempt in attempts:
        total_answered = attempt.correct_answers + attempt.wrong_answers
        accuracy = round((attempt.correct_answers / total_answered * 100), 2) if total_answered > 0 else 0

        result.append({
            "attempt_id": attempt.id,
            "category": attempt.category,
            "score": attempt.score,
            "correct_answers": attempt.correct_answers,
            "wrong_answers": attempt.wrong_answers,
            "accuracy": accuracy,
            "total_time_seconds": attempt.total_time_seconds,
            "is_completed": attempt.is_completed,
            "started_at": attempt.started_at,
            "completed_at": attempt.completed_at
        })

    return result


def get_user_best_scores(db: Session, user_id: int) -> dict:
    """Get user's best score per category."""
    categories = ["python", "sql", "excel"]
    best_scores = {}

    for cat in categories:
        best = (
            db.query(func.max(QuizAttempt.score))
            .filter(
                and_(
                    QuizAttempt.user_id == user_id,
                    QuizAttempt.category == cat,
                    QuizAttempt.is_completed == True
                )
            )
            .scalar()
        )
        best_scores[cat] = best if best is not None else 0

    return best_scores
