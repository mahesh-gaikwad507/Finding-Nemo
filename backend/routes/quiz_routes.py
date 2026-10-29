"""Quiz routes — game session management, questions, and answer submission."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import StartGameRequest, GameStateResponse, AnswerSubmit, AnswerFeedback
from auth import get_current_user
from services.quiz_service import (
    start_new_game, get_game_state, submit_answer, get_game_result, abandon_game
)

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


@router.post("/start")
def start_game(data: StartGameRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Start a new quiz game in the selected category."""
    attempt = start_new_game(db, current_user.id, data.category)
    state = get_game_state(db, attempt.id, current_user.id)

    if not state:
        raise HTTPException(status_code=500, detail="Failed to initialize game")

    # Strip internal fields from question before sending
    if state.get("question") and "_correct_answer" in state["question"]:
        del state["question"]["_correct_answer"]

    return state


@router.get("/state/{attempt_id}")
def get_state(attempt_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the current game state including the current question."""
    state = get_game_state(db, attempt_id, current_user.id)

    if not state:
        raise HTTPException(status_code=404, detail="Game session not found")

    # Strip internal fields from question before sending
    if state.get("question") and "_correct_answer" in state["question"]:
        del state["question"]["_correct_answer"]

    return state


@router.post("/answer/{attempt_id}")
def answer_question(
    attempt_id: int,
    data: AnswerSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit an answer for the current question."""
    result = submit_answer(
        db, attempt_id, current_user.id, data.question_id, data.selected_answer, data.client_time_seconds
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/result/{attempt_id}")
def game_result(attempt_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the final result of a completed game."""
    result = get_game_result(db, attempt_id, current_user.id)

    if not result:
        raise HTTPException(status_code=404, detail="Completed game not found")

    return result


@router.post("/abandon/{attempt_id}")
def abandon(attempt_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Abandon an in-progress game."""
    success = abandon_game(db, attempt_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Active game session not found")

    return {"message": "Game abandoned", "attempt_id": attempt_id}
