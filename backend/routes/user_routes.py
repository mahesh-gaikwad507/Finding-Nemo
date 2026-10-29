"""User profile and attempt history routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from database import get_db
from models import User, QuizAttempt
from auth import get_current_user
from schemas import UserResponse
from services.leaderboard_service import get_user_attempts, get_user_best_scores

router = APIRouter(prefix="/api/user", tags=["User"])


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the full user profile with stats and attempt history."""
    attempts = get_user_attempts(db, current_user.id)
    best_scores = get_user_best_scores(db, current_user.id)

    total_games = len(attempts)
    completed_games = sum(1 for a in attempts if a["is_completed"])

    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "created_at": current_user.created_at
        },
        "total_games": total_games,
        "completed_games": completed_games,
        "best_scores": best_scores,
        "attempts": attempts
    }


@router.get("/attempts")
def get_my_attempts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all attempts for the current user."""
    return get_user_attempts(db, current_user.id)
