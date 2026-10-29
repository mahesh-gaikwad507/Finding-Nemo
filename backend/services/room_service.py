"""Multiplayer room service — collaborative team-based gameplay and live synchronization."""

import random
import string
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import Room, RoomTeam, RoomParticipant, Question, User
from services.quiz_service import format_question_for_client, CORRECT_POINTS, WRONG_PENALTY


def generate_room_code(length: int = 6) -> str:
    """Generate a clean, readable alphanumeric room code."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Omits 0/O, 1/I for clarity
    return "".join(random.choices(chars, k=length))


def get_or_create_team(db: Session, room_id: int, team_name: str) -> RoomTeam:
    """Find or create a RoomTeam in a room."""
    clean_name = team_name.strip() if team_name else "Team Clownfish"
    team = db.query(RoomTeam).filter(
        and_(RoomTeam.room_id == room_id, RoomTeam.team_name == clean_name)
    ).first()

    if not team:
        team = RoomTeam(
            room_id=room_id,
            team_name=clean_name,
            current_question=1,
            score=0,
            correct_answers=0,
            wrong_answers=0,
            total_time_seconds=0,
            is_finished=False,
        )
        db.add(team)
        db.commit()
        db.refresh(team)

    return team


def create_room(db: Session, host_user_id: int, category: str, total_questions: int = 30, team_name: str = "Team Clownfish") -> Room:
    """Create a new multiplayer quiz room with collaborative teams."""
    # Ensure unique room code
    for _ in range(10):
        code = generate_room_code()
        if not db.query(Room).filter(Room.room_code == code).first():
            break

    room = Room(
        room_code=code,
        host_id=host_user_id,
        category=category,
        total_questions=30,  # Fixed and unchanged 30 questions
        status="waiting"
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    clean_team = team_name.strip() if team_name else "Team Clownfish"

    # Create host's team
    get_or_create_team(db, room.id, clean_team)

    # Add host as first participant
    host_part = RoomParticipant(
        room_id=room.id,
        user_id=host_user_id,
        is_host=True,
        team_name=clean_team,
        current_question=1,
        score=0,
        correct_answers=0,
        wrong_answers=0,
        total_time_seconds=0,
        is_finished=False
    )
    db.add(host_part)
    db.commit()

    return room


def join_room(db: Session, user_id: int, room_code: str, team_name: str = "Team Clownfish") -> Room:
    """Join an existing room and join a team."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        return None

    clean_team = team_name.strip() if team_name else "Team Clownfish"

    # Check if user already joined
    existing = db.query(RoomParticipant).filter(
        and_(RoomParticipant.room_id == room.id, RoomParticipant.user_id == user_id)
    ).first()

    if not existing:
        if room.status == "completed":
            return None  # Cannot join completed game

        part = RoomParticipant(
            room_id=room.id,
            user_id=user_id,
            is_host=(room.host_id == user_id),
            team_name=clean_team,
            current_question=1,
            score=0,
            correct_answers=0,
            wrong_answers=0,
            total_time_seconds=0,
            is_finished=False
        )
        db.add(part)
        db.commit()
        get_or_create_team(db, room.id, clean_team)
    elif clean_team:
        existing.team_name = clean_team
        db.commit()
        get_or_create_team(db, room.id, clean_team)

    return room


def set_participant_team(db: Session, room_code: str, user_id: int, team_name: str) -> bool:
    """Update a participant's chosen team in the lobby."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room or room.status != "waiting":
        return False

    clean_team = team_name.strip() if team_name else "Team Clownfish"

    participant = db.query(RoomParticipant).filter(
        and_(RoomParticipant.room_id == room.id, RoomParticipant.user_id == user_id)
    ).first()
    if not participant:
        return False

    participant.team_name = clean_team
    db.commit()
    get_or_create_team(db, room.id, clean_team)
    return True


def start_room_game(db: Session, room_code: str, current_user_id: int) -> bool:
    """Start the room quiz for all teams."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room or room.host_id != current_user_id:
        return False

    room.status = "in_progress"
    room.started_at = datetime.now(timezone.utc)

    # Reset all teams in this room to question 1
    teams = db.query(RoomTeam).filter(RoomTeam.room_id == room.id).all()
    for t in teams:
        t.current_question = 1
        t.score = 0
        t.correct_answers = 0
        t.wrong_answers = 0
        t.total_time_seconds = 0
        t.is_finished = False
        t.finished_at = None
        t.last_answered_by = None
        t.last_question_id = None
        t.last_selected_answer = None

    # Reset all participants
    parts = db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id).all()
    for p in parts:
        p.current_question = 1
        p.score = 0
        p.correct_answers = 0
        p.wrong_answers = 0
        p.total_time_seconds = 0
        p.is_finished = False
        p.finished_at = None

    db.commit()
    return True


def get_room_state(db: Session, room_code: str, current_user_id: int) -> dict:
    """Get full room status, synchronized team state, teams ordered by correct count then timing, and current question."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        return None

    # Get all participants with usernames
    participants_query = (
        db.query(RoomParticipant, User.username)
        .join(User, User.id == RoomParticipant.user_id)
        .filter(RoomParticipant.room_id == room.id)
        .all()
    )

    participant_list = []
    my_participant = None

    for part, username in participants_query:
        if part.user_id == current_user_id:
            my_participant = part

        prog = round((part.correct_answers / room.total_questions) * 100, 1)
        participant_list.append({
            "user_id": part.user_id,
            "username": username,
            "is_host": part.is_host,
            "team_name": part.team_name or "Team Clownfish",
            "current_question": part.current_question,
            "score": part.score,
            "correct_answers": part.correct_answers,
            "wrong_answers": part.wrong_answers,
            "total_time_seconds": part.total_time_seconds or 0,
            "is_finished": part.is_finished,
            "progress_percentage": min(prog, 100.0)
        })

    # My team
    my_team_name = my_participant.team_name if my_participant else "Team Clownfish"
    my_team = db.query(RoomTeam).filter(
        and_(RoomTeam.room_id == room.id, RoomTeam.team_name == my_team_name)
    ).first()

    if not my_team:
        my_team = get_or_create_team(db, room.id, my_team_name)

    # Gather teammates
    my_teammates = [p["username"] for p in participant_list if p["team_name"] == my_team_name]

    # Query all teams in room
    room_teams = db.query(RoomTeam).filter(RoomTeam.room_id == room.id).all()
    teams_summary = []

    for t in room_teams:
        members = [p["username"] for p in participant_list if p["team_name"] == t.team_name]
        # Only include teams that have at least 1 member
        if not members:
            continue

        prog = min(round((t.correct_answers / room.total_questions) * 100, 1), 100.0)
        total_ans = t.correct_answers + t.wrong_answers
        acc = round((t.correct_answers / total_ans) * 100, 1) if total_ans > 0 else 0

        teams_summary.append({
            "team_name": t.team_name,
            "current_question": t.current_question,
            "score": t.score,
            "total_score": t.score,
            "correct_answers": t.correct_answers,
            "total_correct": t.correct_answers,
            "avg_correct": t.correct_answers,
            "wrong_answers": t.wrong_answers,
            "total_wrong": t.wrong_answers,
            "total_time_seconds": t.total_time_seconds or 0,
            "avg_time_seconds": t.total_time_seconds or 0,
            "is_finished": t.is_finished,
            "progress_percentage": prog,
            "accuracy": acc,
            "members": members,
            "members_count": len(members),
            "last_answered_by": t.last_answered_by,
            "last_is_correct": t.last_is_correct,
            "last_score_change": t.last_score_change,
        })

    # Position of teams strictly decided on:
    # 1. Actual Final Score (DESC)
    # 2. Max no. of correct questions (DESC)
    # 3. Timing (ASC, fastest time taken)
    teams_summary.sort(
        key=lambda t: (
            -t["score"],
            -t["correct_answers"],
            t["total_time_seconds"] if t["total_time_seconds"] > 0 else 999999
        )
    )

    participant_list.sort(
        key=lambda p: (
            -p["score"],
            -p["correct_answers"],
            p["total_time_seconds"] if p["total_time_seconds"] > 0 else 999999
        )
    )

    # Check if all active teams are finished to complete the room
    if room.status == "in_progress" and teams_summary:
        if all(t["is_finished"] for t in teams_summary):
            room.status = "completed"
            room.completed_at = datetime.now(timezone.utc)
            db.commit()

    winning_team = teams_summary[0] if teams_summary else None
    winning_participant = participant_list[0] if participant_list else None

    # Get current question for the calling user's team if game is active
    current_question_data = None
    if room.status == "in_progress" and my_team and not my_team.is_finished:
        q = (
            db.query(Question)
            .filter(
                and_(
                    Question.category == room.category,
                    Question.sequence_number == my_team.current_question
                )
            )
            .first()
        )
        if q:
            current_question_data = format_question_for_client(q)
            if "_correct_answer" in current_question_data:
                del current_question_data["_correct_answer"]

    host_user = db.query(User).filter(User.id == room.host_id).first()

    # Team detail object for current user
    my_team_data = {
        "team_name": my_team.team_name,
        "current_question": my_team.current_question,
        "score": my_team.score,
        "total_score": my_team.score,
        "correct_answers": my_team.correct_answers,
        "total_correct": my_team.correct_answers,
        "wrong_answers": my_team.wrong_answers,
        "total_time_seconds": my_team.total_time_seconds or 0,
        "is_finished": my_team.is_finished,
        "members": my_teammates,
        "members_count": len(my_teammates),
        "last_answered_by": my_team.last_answered_by,
        "last_question_id": my_team.last_question_id,
        "last_selected_answer": my_team.last_selected_answer,
        "last_is_correct": my_team.last_is_correct,
        "last_score_change": my_team.last_score_change,
        "last_explanation": my_team.last_explanation,
        "last_correct_answer": my_team.last_correct_answer,
    }

    is_admin = (room.host_id == current_user_id)
    if not is_admin:
        curr_user = db.query(User).filter(User.id == current_user_id).first()
        if curr_user and curr_user.username.lower() in ('admin', 'host'):
            is_admin = True

    is_leaderboard_released = getattr(room, "leaderboard_released", False)

    return {
        "room_code": room.room_code,
        "host_id": room.host_id,
        "host_username": host_user.username if host_user else "Host",
        "category": room.category,
        "status": room.status,
        "total_questions": room.total_questions,
        "participants": participant_list,
        "teams_summary": teams_summary,
        "my_team": my_team_data,
        "winner": winning_participant,
        "winning_team": winning_team,
        "is_host": (room.host_id == current_user_id),
        "is_admin": is_admin,
        "leaderboard_released": is_leaderboard_released,
        "current_user_id": current_user_id,
        "started_at": room.started_at,
        "completed_at": room.completed_at,
        "question": current_question_data
    }


def release_room_leaderboard(db: Session, room_code: str, user_id: int) -> bool:
    """Allow room admin/host to broadcast final leaderboard and official winner to all users."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        return False
    user = db.query(User).filter(User.id == user_id).first()
    is_admin = (room.host_id == user_id) or (user and user.username.lower() in ('admin', 'host'))
    if not is_admin:
        return False
    room.leaderboard_released = True
    db.commit()
    return True


def submit_room_answer(
    db: Session,
    room_code: str,
    user_id: int,
    question_id: int,
    selected_answer: str
) -> dict:
    """Process an answer submitted by ANY member of the team. Locks answer for whole team and advances team together."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room or room.status != "in_progress":
        return {"error": "Room game is not active"}

    participant = db.query(RoomParticipant).filter(
        and_(RoomParticipant.room_id == room.id, RoomParticipant.user_id == user_id)
    ).first()

    if not participant:
        return {"error": "Participant not found"}

    team = db.query(RoomTeam).filter(
        and_(RoomTeam.room_id == room.id, RoomTeam.team_name == participant.team_name)
    ).first()

    if not team:
        return {"error": "Team not found"}

    if team.is_finished:
        return {"error": "Your team has already completed the expedition!"}

    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        return {"error": "Invalid question"}

    # If this question was ALREADY answered by another teammate, return cached feedback without double-counting!
    if question.sequence_number < team.current_question:
        return {
            "question_id": team.last_question_id or question_id,
            "selected_answer": team.last_selected_answer or selected_answer,
            "correct_answer": team.last_correct_answer or question.correct_answer,
            "is_correct": team.last_is_correct,
            "explanation": team.last_explanation or question.explanation,
            "score_change": team.last_score_change or 0,
            "total_score": team.score,
            "correct_count": team.correct_answers,
            "wrong_count": team.wrong_answers,
            "total_time_seconds": team.total_time_seconds or 0,
            "current_question": team.current_question,
            "is_finished": team.is_finished,
            "answered_by": team.last_answered_by,
            "team_name": team.team_name,
            "room_status": room.status,
            "already_answered_by_teammate": True
        }

    current_user = db.query(User).filter(User.id == user_id).first()
    user_name = current_user.username if current_user else "Teammate"

    # Evaluate team answer
    is_correct = selected_answer == question.correct_answer
    score_change = CORRECT_POINTS if is_correct else -WRONG_PENALTY

    team.score += score_change
    if is_correct:
        team.correct_answers += 1
    else:
        team.wrong_answers += 1

    team.current_question += 1

    # Update team timing (seconds elapsed since game started)
    if room.started_at:
        started = room.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        team.total_time_seconds = max(1, int((datetime.now(timezone.utc) - started).total_seconds()))

    if team.current_question > room.total_questions:
        team.is_finished = True
        team.finished_at = datetime.now(timezone.utc)

    # Cache last answer details for team synchronization
    team.last_answered_by = user_name
    team.last_question_id = question_id
    team.last_selected_answer = selected_answer
    team.last_correct_answer = question.correct_answer
    team.last_is_correct = is_correct
    team.last_explanation = question.explanation
    team.last_score_change = score_change

    # Synchronize all participants in this team
    teammates = db.query(RoomParticipant).filter(
        and_(RoomParticipant.room_id == room.id, RoomParticipant.team_name == team.team_name)
    ).all()
    for tm in teammates:
        tm.current_question = team.current_question
        tm.score = team.score
        tm.correct_answers = team.correct_answers
        tm.wrong_answers = team.wrong_answers
        tm.total_time_seconds = team.total_time_seconds
        tm.is_finished = team.is_finished
        tm.finished_at = team.finished_at

    db.commit()
    db.refresh(team)

    # Check if all teams are finished
    all_teams = db.query(RoomTeam).filter(RoomTeam.room_id == room.id).all()
    if all_teams and all(t.is_finished for t in all_teams):
        room.status = "completed"
        room.completed_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "question_id": question_id,
        "selected_answer": selected_answer,
        "correct_answer": question.correct_answer,
        "is_correct": is_correct,
        "explanation": question.explanation,
        "score_change": score_change,
        "total_score": team.score,
        "correct_count": team.correct_answers,
        "wrong_count": team.wrong_answers,
        "total_time_seconds": team.total_time_seconds or 0,
        "current_question": team.current_question,
        "is_finished": team.is_finished,
        "answered_by": user_name,
        "team_name": team.team_name,
        "room_status": room.status
    }


def leave_room(db: Session, room_code: str, user_id: int) -> bool:
    """Leave a room. Reassigns host if current host leaves."""
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        return False

    participant = db.query(RoomParticipant).filter(
        and_(RoomParticipant.room_id == room.id, RoomParticipant.user_id == user_id)
    ).first()

    if not participant:
        return False

    team_name = participant.team_name
    db.delete(participant)
    db.commit()

    # Check remaining participants
    remaining = db.query(RoomParticipant).filter(RoomParticipant.room_id == room.id).all()
    if not remaining:
        # Delete empty room and teams
        db.query(RoomTeam).filter(RoomTeam.room_id == room.id).delete()
        db.delete(room)
        db.commit()
    else:
        # Check if team still has any members left
        team_members = db.query(RoomParticipant).filter(
            and_(RoomParticipant.room_id == room.id, RoomParticipant.team_name == team_name)
        ).all()
        if not team_members:
            db.query(RoomTeam).filter(
                and_(RoomTeam.room_id == room.id, RoomTeam.team_name == team_name)
            ).delete()
            db.commit()

        if room.host_id == user_id:
            # Reassign host
            new_host = remaining[0]
            new_host.is_host = True
            room.host_id = new_host.user_id
            db.commit()

    return True
