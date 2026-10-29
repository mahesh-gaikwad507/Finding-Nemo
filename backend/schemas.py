"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============================================================
# AUTH SCHEMAS
# ============================================================
class UserRegister(BaseModel):
    team_name: str = Field(..., min_length=2, max_length=100)
    leader_name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=5, max_length=20)
    username: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., min_length=4, max_length=100)


class UserLogin(BaseModel):
    username: Optional[str] = None
    team_name: Optional[str] = None
    phone_number: Optional[str] = None
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    team_name: Optional[str] = None
    leader_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_admin: bool = False
    locked_domain: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CompetitionStatusResponse(BaseModel):
    is_game_started: bool
    started_at: Optional[datetime] = None
    started_by: Optional[str] = None
    total_teams: int = 0


class DomainStatusResponse(BaseModel):
    locked_domain: Optional[str] = None
    is_locked: bool
    allowed_categories: List[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============================================================
# QUESTION SCHEMAS
# ============================================================
class QuestionOut(BaseModel):
    """Question sent to the frontend — NO correct answer or explanation."""
    id: int
    sequence_number: int
    clue: str
    question_text: str
    options: dict  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    concept: str
    difficulty: str
    narrative_context: Optional[str] = None


# ============================================================
# ANSWER SCHEMAS
# ============================================================
class AnswerSubmit(BaseModel):
    question_id: int
    selected_answer: str = Field(..., pattern=r"^[ABCD]$")
    client_time_seconds: Optional[int] = None


class AnswerFeedback(BaseModel):
    question_id: int
    selected_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    score_change: int
    total_score: int
    correct_count: int
    wrong_count: int
    current_question: int
    nemo_position: int
    progress_percentage: float


# ============================================================
# GAME SESSION SCHEMAS
# ============================================================
class StartGameRequest(BaseModel):
    category: str = Field(..., pattern=r"^(python|sql|excel)$")


class GameSessionResponse(BaseModel):
    attempt_id: int
    category: str
    current_question: int
    correct_answers: int
    wrong_answers: int
    score: int
    is_completed: bool
    started_at: datetime
    total_questions: int = 30


class GameStateResponse(BaseModel):
    attempt_id: int
    category: str
    current_question: int
    correct_answers: int
    wrong_answers: int
    score: int
    is_completed: bool
    started_at: datetime
    nemo_position: int
    progress_percentage: float
    total_questions: int = 30
    question: Optional[QuestionOut] = None


# ============================================================
# RESULTS SCHEMAS
# ============================================================
class GameResultResponse(BaseModel):
    attempt_id: int
    category: str
    score: int
    correct_answers: int
    wrong_answers: int
    total_questions: int = 30
    accuracy: float
    total_time_seconds: int
    completed_at: datetime
    nemo_reached_home: bool
    rank: Optional[int] = None


# ============================================================
# LEADERBOARD SCHEMAS
# ============================================================
class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    score: int
    correct_answers: int
    wrong_answers: int
    accuracy: float
    total_time_seconds: int
    completed_at: datetime


class LeaderboardResponse(BaseModel):
    category: Optional[str] = None
    entries: List[LeaderboardEntry]
    total_entries: int


# ============================================================
# PROFILE SCHEMAS
# ============================================================
class AttemptHistoryEntry(BaseModel):
    attempt_id: int
    category: str
    score: int
    correct_answers: int
    wrong_answers: int
    accuracy: float
    total_time_seconds: Optional[int] = None
    is_completed: bool
    started_at: datetime
    completed_at: Optional[datetime] = None


class UserProfileResponse(BaseModel):
    user: UserResponse
    total_games: int
    completed_games: int
    best_scores: dict  # {"python": 280, "sql": 250, "excel": 300}
    attempts: List[AttemptHistoryEntry]


# ============================================================
# ROOM (MULTIPLAYER) SCHEMAS
# ============================================================
class CreateRoomRequest(BaseModel):
    category: str = Field(..., pattern=r"^(python|sql|excel)$")
    total_questions: int = Field(30, ge=30, le=30)
    team_name: Optional[str] = "Solo"


class JoinRoomRequest(BaseModel):
    room_code: str = Field(..., min_length=4, max_length=10)
    team_name: Optional[str] = "Solo"


class SetTeamRequest(BaseModel):
    team_name: str = Field(..., min_length=1, max_length=50)


class RoomParticipantOut(BaseModel):
    user_id: int
    username: str
    is_host: bool
    team_name: Optional[str] = "Solo"
    current_question: int
    score: int
    correct_answers: int
    wrong_answers: int
    total_time_seconds: Optional[int] = 0
    is_finished: bool
    progress_percentage: float


class RoomDetailResponse(BaseModel):
    room_code: str
    host_id: int
    host_username: str
    category: str
    status: str
    total_questions: int
    participants: List[RoomParticipantOut]
    teams_summary: Optional[List[dict]] = None
    my_team: Optional[dict] = None
    winner: Optional[dict] = None
    winning_team: Optional[dict] = None
    is_host: bool
    is_admin: Optional[bool] = False
    leaderboard_released: Optional[bool] = False
    current_user_id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    question: Optional[QuestionOut] = None


