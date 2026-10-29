"""SQLAlchemy ORM models for Finding Nemo Quiz Adventure."""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Enum, ForeignKey, TIMESTAMP,
    UniqueConstraint, Index
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    team_name = Column(String(100), nullable=True, index=True)
    leader_name = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True, index=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    locked_domain = Column(String(20), nullable=True)  # 'python', 'sql', 'excel', or None
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(Enum("python", "sql", "excel"), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    clue = Column(Text, nullable=False)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(Enum("A", "B", "C", "D"), nullable=False)
    explanation = Column(Text, nullable=False)
    concept = Column(String(100), nullable=False)
    prerequisite_concept = Column(String(100), nullable=True)
    difficulty = Column(Enum("beginner", "intermediate", "advanced"), nullable=False)
    narrative_context = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("category", "sequence_number", name="uk_category_sequence"),
    )

    answers = relationship("UserAnswer", back_populates="question")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(Enum("python", "sql", "excel"), nullable=False, index=True)
    current_question = Column(Integer, nullable=False, default=1)
    correct_answers = Column(Integer, nullable=False, default=0)
    wrong_answers = Column(Integer, nullable=False, default=0)
    score = Column(Integer, nullable=False, default=0)
    started_at = Column(TIMESTAMP, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    total_time_seconds = Column(Integer, nullable=True)
    clues_used = Column(Integer, nullable=False, default=0)
    revealed_questions = Column(Text, nullable=False, default="[]")

    __table_args__ = (
        Index("idx_score_time", "score", "total_time_seconds"),
        Index("idx_user_category", "user_id", "category"),
    )

    user = relationship("User", back_populates="attempts")
    answers = relationship("UserAnswer", back_populates="attempt", cascade="all, delete-orphan")


class UserAnswer(Base):
    __tablename__ = "user_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_answer = Column(Enum("A", "B", "C", "D"), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uk_attempt_question"),
    )

    attempt = relationship("QuizAttempt", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_code = Column(String(10), unique=True, nullable=False, index=True)
    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(Enum("python", "sql", "excel"), nullable=False)
    status = Column(String(20), nullable=False, default="waiting")  # waiting, in_progress, completed
    total_questions = Column(Integer, nullable=False, default=30)
    leaderboard_released = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    started_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)

    host = relationship("User", foreign_keys=[host_id])
    participants = relationship("RoomParticipant", back_populates="room", cascade="all, delete-orphan")
    teams = relationship("RoomTeam", back_populates="room", cascade="all, delete-orphan")


class RoomTeam(Base):
    __tablename__ = "room_teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    team_name = Column(String(50), nullable=False)
    current_question = Column(Integer, nullable=False, default=1)
    score = Column(Integer, nullable=False, default=0)
    correct_answers = Column(Integer, nullable=False, default=0)
    wrong_answers = Column(Integer, nullable=False, default=0)
    total_time_seconds = Column(Integer, nullable=False, default=0)
    clues_used = Column(Integer, nullable=False, default=0)
    revealed_questions = Column(Text, nullable=False, default="[]")
    is_finished = Column(Boolean, nullable=False, default=False)
    finished_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Cache last answer feedback for the team
    last_answered_by = Column(String(50), nullable=True)
    last_question_id = Column(Integer, nullable=True)
    last_selected_answer = Column(String(5), nullable=True)
    last_correct_answer = Column(String(5), nullable=True)
    last_is_correct = Column(Boolean, nullable=True)
    last_explanation = Column(Text, nullable=True)
    last_score_change = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("room_id", "team_name", name="uk_room_team"),
    )

    room = relationship("Room", back_populates="teams")


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_host = Column(Boolean, nullable=False, default=False)
    team_name = Column(String(50), nullable=False, default="Team Clownfish")
    current_question = Column(Integer, nullable=False, default=1)
    score = Column(Integer, nullable=False, default=0)
    correct_answers = Column(Integer, nullable=False, default=0)
    wrong_answers = Column(Integer, nullable=False, default=0)
    total_time_seconds = Column(Integer, nullable=True, default=0)
    is_finished = Column(Boolean, nullable=False, default=False)
    finished_at = Column(TIMESTAMP, nullable=True)
    joined_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uk_room_user"),
    )

    room = relationship("Room", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])


class CompetitionSetting(Base):
    __tablename__ = "competition_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    is_game_started = Column(Boolean, nullable=False, default=False)
    started_at = Column(TIMESTAMP, nullable=True)
    started_by = Column(String(50), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())



