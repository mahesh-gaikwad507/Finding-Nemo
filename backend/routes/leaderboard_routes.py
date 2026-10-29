"""Leaderboard routes — category and overall rankings."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth import get_current_user
from services.leaderboard_service import (
    get_category_leaderboard, get_overall_leaderboard, get_user_rank
)

router = APIRouter(prefix="/api/leaderboard", tags=["Leaderboard"])


@router.get("/category/{category}")
def category_leaderboard(
    category: str,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get leaderboard for a specific category."""
    if category not in ("python", "sql", "excel"):
        raise HTTPException(status_code=400, detail="Invalid category")

    entries = get_category_leaderboard(db, category, limit)

    return {
        "category": category,
        "entries": entries,
        "total_entries": len(entries)
    }


@router.get("/overall")
def overall_leaderboard(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get overall leaderboard across all categories."""
    entries = get_overall_leaderboard(db, limit)

    return {
        "category": None,
        "entries": entries,
        "total_entries": len(entries)
    }


@router.get("/rank/{category}")
def my_rank(
    category: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's rank in a category."""
    if category not in ("python", "sql", "excel"):
        raise HTTPException(status_code=400, detail="Invalid category")

    rank = get_user_rank(db, current_user.id, category)

    return {
        "category": category,
        "username": current_user.username,
        "rank": rank
    }
