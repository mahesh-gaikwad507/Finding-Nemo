"""Room routes — multiplayer room lobby, live quiz race, and synchronization."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import (
    CreateRoomRequest, JoinRoomRequest, SetTeamRequest, RoomDetailResponse, AnswerSubmit
)
from auth import get_current_user
from services.room_service import (
    create_room, join_room, set_participant_team, get_room_state, start_room_game, submit_room_answer, leave_room, release_room_leaderboard
)

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.post("/create", response_model=RoomDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_room(
    data: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new multiplayer quiz room."""
    try:
        room = create_room(db, current_user.id, data.category, data.total_questions, data.team_name or "Solo")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    state = get_room_state(db, room.room_code, current_user.id)
    if not state:
        raise HTTPException(status_code=500, detail="Failed to initialize room")
    return state


@router.post("/join", response_model=RoomDetailResponse)
def join_existing_room(
    data: JoinRoomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join an existing multiplayer room using room code."""
    try:
        room = join_room(db, current_user.id, data.room_code, data.team_name or "Solo")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not room:
        raise HTTPException(status_code=404, detail="Room not found or cannot be joined")

    state = get_room_state(db, room.room_code, current_user.id)
    if not state:
        raise HTTPException(status_code=500, detail="Failed to retrieve room details")
    return state


@router.post("/{room_code}/team", response_model=RoomDetailResponse)
def choose_team(
    room_code: str,
    data: SetTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Choose or change team in the lobby."""
    success = set_participant_team(db, room_code, current_user.id, data.team_name)
    if not success:
        raise HTTPException(status_code=400, detail="Could not update team (room might already be in progress)")
    state = get_room_state(db, room_code, current_user.id)
    return state


@router.get("/{room_code}", response_model=RoomDetailResponse)
def get_room(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get real-time room status, live scores, and current question."""
    state = get_room_state(db, room_code, current_user.id)
    if not state:
        raise HTTPException(status_code=404, detail="Room not found")
    return state


@router.post("/{room_code}/start")
def start_game(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Host starts the multiplayer quiz."""
    success = start_room_game(db, room_code, current_user.id)
    if not success:
        raise HTTPException(status_code=403, detail="Only the room host can start the quiz")
    return {"message": "Game started", "room_code": room_code}


@router.post("/{room_code}/answer")
def submit_answer(
    room_code: str,
    data: AnswerSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit an answer in a multiplayer room quiz."""
    result = submit_room_answer(db, room_code, current_user.id, data.question_id, data.selected_answer)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{room_code}/leave")
def leave(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave the multiplayer room."""
    success = leave_room(db, room_code, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Could not leave room")
    return {"message": "Left room", "room_code": room_code}


@router.post("/{room_code}/release_leaderboard")
def release_leaderboard(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow room admin/host to announce and release final leaderboard to all room users."""
    success = release_room_leaderboard(db, room_code, current_user.id)
    if not success:
        raise HTTPException(status_code=403, detail="Only the room admin or host can release the final leaderboard.")
    return {"message": "Final leaderboard announced to all room members!"}

