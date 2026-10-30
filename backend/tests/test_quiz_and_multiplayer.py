"""Unit and integration tests for quiz statistics, timing, speed, scoring, and multiplayer leaderboards."""

import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure backend path is configured
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import User, Question, QuizAttempt, UserAnswer, Room, RoomTeam, RoomParticipant
from services.quiz_service import start_new_game, submit_answer, get_game_result, abandon_game
from services.leaderboard_service import get_category_leaderboard, get_overall_leaderboard
from services.room_service import (
    create_room, join_room, start_room_game, submit_room_answer, get_room_state
)


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database session for isolated testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()

    # Seed 30 sample Python questions
    for i in range(1, 31):
        q = Question(
            category="python",
            sequence_number=i,
            clue=f"Clue {i}",
            question_text=f"Question {i} text",
            option_a="Option A",
            option_b="Option B",
            option_c="Option C",
            option_d="Option D",
            correct_answer="A",
            explanation=f"Explanation {i}",
            concept=f"Concept {i}",
            difficulty="beginner"
        )
        session.add(q)

    # Seed test users
    user1 = User(id=1, username="nemo_user1", email="nemo1@test.com", password_hash="hash1")
    user2 = User(id=2, username="dory_user2", email="dory2@test.com", password_hash="hash2")
    user3 = User(id=3, username="marlin_user3", email="marlin3@test.com", password_hash="hash3")
    session.add_all([user1, user2, user3])

    # Seed CompetitionSetting so games can start in tests by default
    from models import CompetitionSetting
    setting = CompetitionSetting(id=1, is_game_started=True)
    session.add(setting)
    session.commit()

    yield session
    session.close()


def test_elapsed_time_current_session_only_unplayed_stale_attempt(db_session):
    """Verify that an ancient unplayed attempt refreshes started_at so time is measured for the current session only."""
    # Create an attempt from 2 days ago with 0 answers (sitting at question 1)
    two_days_ago = datetime.now(timezone.utc) - timedelta(days=2)
    stale_attempt = QuizAttempt(
        user_id=1,
        category="python",
        current_question=1,
        correct_answers=0,
        wrong_answers=0,
        score=0,
        is_completed=False,
        started_at=two_days_ago,
        total_time_seconds=0
    )
    db_session.add(stale_attempt)
    db_session.commit()

    # User starts new game today
    active_attempt = start_new_game(db_session, user_id=1, category="python")

    # started_at should be refreshed to NOW (not 2 days ago!)
    now = datetime.now(timezone.utc)
    started = active_attempt.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)

    diff_seconds = abs((now - started).total_seconds())
    assert diff_seconds < 5, f"Start time was not refreshed to current session: diff={diff_seconds}s"


def test_elapsed_time_abandoned_partial_attempt_starts_fresh(db_session):
    """Verify that an attempt idle for >30 minutes is finalized as abandoned and a new session starts."""
    ancient_time = datetime.now(timezone.utc) - timedelta(hours=44)
    old_partial = QuizAttempt(
        user_id=1,
        category="python",
        current_question=5,
        correct_answers=3,
        wrong_answers=1,
        score=28,
        is_completed=False,
        started_at=ancient_time,
        total_time_seconds=0
    )
    db_session.add(old_partial)
    db_session.commit()

    # User clicks Start Quiz
    new_attempt = start_new_game(db_session, user_id=1, category="python")

    # Old partial attempt should be finalized
    db_session.refresh(old_partial)
    assert old_partial.is_completed is True

    # New attempt should be clean at Q1 and started now
    assert new_attempt.id != old_partial.id
    assert new_attempt.current_question == 1
    assert new_attempt.score == 0
    now = datetime.now(timezone.utc)
    started = new_attempt.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    assert abs((now - started).total_seconds()) < 5


def test_answering_speed_formula_and_zero_answers_safe(db_session):
    """Verify that answering speed uses total_time / answered_count and safely handles zero."""
    now = datetime.now(timezone.utc)
    # Attempt with 10 correct, 20 wrong, total_time = 120s
    attempt = QuizAttempt(
        user_id=1,
        category="python",
        current_question=31,
        correct_answers=10,
        wrong_answers=20,
        score=60,
        is_completed=True,
        started_at=now - timedelta(seconds=120),
        completed_at=now,
        total_time_seconds=120
    )
    db_session.add(attempt)
    db_session.commit()

    res = get_game_result(db_session, attempt.id, 1)
    assert res is not None
    assert res["total_answered"] == 30
    assert res["total_time_seconds"] == 120
    # 120s / 30 questions = 4.0s / Q
    assert res["answering_speed"] == 4.0

    # Test with 0 answered questions (abandoned at start)
    empty_attempt = QuizAttempt(
        user_id=2,
        category="python",
        current_question=1,
        correct_answers=0,
        wrong_answers=0,
        score=0,
        is_completed=True,
        started_at=now,
        completed_at=now,
        total_time_seconds=0
    )
    db_session.add(empty_attempt)
    db_session.commit()

    empty_res = get_game_result(db_session, empty_attempt.id, 2)
    assert empty_res["total_answered"] == 0
    assert empty_res["answering_speed"] == 0.0  # Safe handling without division by zero


def test_final_scores_and_accuracy_calculation(db_session):
    """Verify score calculation (+10 for correct, 0 for wrong - no negative marking)."""
    attempt = start_new_game(db_session, user_id=1, category="python")

    # Answer question 1 correctly (option A is correct)
    res1 = submit_answer(db_session, attempt.id, 1, 1, "A", client_time_seconds=5)
    assert res1["is_correct"] is True
    assert res1["score_change"] == 10
    assert res1["total_score"] == 10

    # Answer question 2 incorrectly (option B is wrong)
    res2 = submit_answer(db_session, attempt.id, 1, 2, "B", client_time_seconds=10)
    assert res2["is_correct"] is False
    assert res2["score_change"] == 0
    assert res2["total_score"] == 10


def test_multiplayer_winner_score_based_ranking(db_session):
    """Verify that multiplayer winner is decided primarily by final score, not just correct answers."""
    now = datetime.now(timezone.utc)

    # Player 1: 20 correct, 0 wrong -> Score = 200 pts, time = 100s
    p1 = QuizAttempt(
        user_id=1, category="python", current_question=31,
        correct_answers=20, wrong_answers=10, score=180,  # 200 - 20 = 180
        is_completed=True, total_time_seconds=100, completed_at=now
    )
    # Player 2: 22 correct, 8 wrong -> Score = 220 - 16 = 204 pts, time = 120s
    p2 = QuizAttempt(
        user_id=2, category="python", current_question=31,
        correct_answers=22, wrong_answers=8, score=204,
        is_completed=True, total_time_seconds=120, completed_at=now
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    entries = get_category_leaderboard(db_session, "python")
    # Player 2 has higher score (204 > 180), so Player 2 must be #1!
    assert entries[0]["username"] == "dory_user2"
    assert entries[0]["score"] == 204
    assert entries[0]["rank"] == 1

    assert entries[1]["username"] == "nemo_user1"
    assert entries[1]["score"] == 180
    assert entries[1]["rank"] == 2


def test_multiplayer_tied_winners_consistent_ranking(db_session):
    """Verify that identical final scores, correct answers, and times result in tied ranks (1224 competition rank)."""
    now = datetime.now(timezone.utc)

    # Player 1 and Player 2 have exact same performance (Tie for 1st)
    p1 = QuizAttempt(
        user_id=1, category="python", current_question=31,
        correct_answers=25, wrong_answers=5, score=240,
        is_completed=True, total_time_seconds=90, completed_at=now
    )
    p2 = QuizAttempt(
        user_id=2, category="python", current_question=31,
        correct_answers=25, wrong_answers=5, score=240,
        is_completed=True, total_time_seconds=90, completed_at=now
    )
    # Player 3 has lower score
    p3 = QuizAttempt(
        user_id=3, category="python", current_question=31,
        correct_answers=20, wrong_answers=10, score=180,
        is_completed=True, total_time_seconds=110, completed_at=now
    )
    db_session.add_all([p1, p2, p3])
    db_session.commit()

    entries = get_category_leaderboard(db_session, "python")
    assert len(entries) == 3

    # Both top players should have rank 1
    assert entries[0]["rank"] == 1
    assert entries[1]["rank"] == 1
    assert entries[1]["is_tie"] is True

    # Third player should have rank 3 (not 2!)
    assert entries[2]["rank"] == 3
    assert entries[2]["is_tie"] is False


def test_multiplayer_room_completion_and_persistence(db_session):
    """Verify that multiplayer room completes when all teams finish and remains completed upon refresh."""
    # Create room
    room = create_room(db_session, host_user_id=1, category="python", team_name="Team Sharks")
    join_room(db_session, user_id=2, room_code=room.room_code, team_name="Team Dolphins")

    # Host starts the room
    started = start_room_game(db_session, room.room_code, current_user_id=1)
    assert started is True

    state_during = get_room_state(db_session, room.room_code, current_user_id=1)
    assert state_during["status"] == "in_progress"

    # Finish Team Sharks (advance through 30 questions)
    sharks_team = db_session.query(RoomTeam).filter(RoomTeam.room_id == room.id, RoomTeam.team_name == "Team Sharks").first()
    sharks_team.current_question = 31
    sharks_team.is_finished = True
    sharks_team.score = 250
    sharks_team.correct_answers = 26
    sharks_team.total_time_seconds = 75

    # Finish Team Dolphins
    dolphins_team = db_session.query(RoomTeam).filter(RoomTeam.room_id == room.id, RoomTeam.team_name == "Team Dolphins").first()
    dolphins_team.current_question = 31
    dolphins_team.is_finished = True
    dolphins_team.score = 270
    dolphins_team.correct_answers = 28
    dolphins_team.total_time_seconds = 80

    db_session.commit()

    # Get room state after all finish
    state_after = get_room_state(db_session, room.room_code, current_user_id=1)
    assert state_after["status"] == "completed"

    # Winning team should be Dolphins (Score 270 > 250)
    assert state_after["winning_team"]["team_name"] == "Team Dolphins"
    assert state_after["winning_team"]["score"] == 270

    # Calling get_room_state again (simulating page refresh) preserves completed state and winner
    refresh_state = get_room_state(db_session, room.room_code, current_user_id=2)
    assert refresh_state["status"] == "completed"
    assert refresh_state["winning_team"]["team_name"] == "Team Dolphins"
    assert refresh_state["winning_team"]["score"] == 270


def test_one_domain_per_team_locking_and_enforcement(db_session):
    """Verify that completing a test in one domain locks the user/team to that field,
    preventing them from taking quizzes or multiplayer rooms in any other domain,
    while allowing replay in their chosen domain."""
    # Seed questions for SQL as well
    for i in range(1, 31):
        q_sql = Question(
            category="sql",
            sequence_number=i,
            clue=f"SQL Clue {i}",
            question_text=f"SQL Question {i}",
            option_a="Option A",
            option_b="Option B",
            option_c="Option C",
            option_d="Option D",
            correct_answer="A",
            explanation="SQL Exp",
            concept="SQL Concept",
            difficulty="beginner"
        )
        db_session.add(q_sql)
    db_session.commit()

    # User 3 starts without a locked domain
    user3 = db_session.query(User).filter(User.id == 3).first()
    assert user3.locked_domain is None

    # User 3 starts and finishes a Python quiz
    attempt = start_new_game(db_session, user_id=3, category="python")
    attempt.current_question = 30
    db_session.commit()

    # User 3 answers question 30 to complete the quiz
    q30 = db_session.query(Question).filter(Question.category == "python", Question.sequence_number == 30).first()
    res = submit_answer(db_session, attempt_id=attempt.id, user_id=3, question_id=q30.id, selected_answer="A")
    assert res["is_completed"] is True

    # User 3's domain is now permanently locked to 'python'
    db_session.refresh(user3)
    assert user3.locked_domain == "python"

    # User 3 attempts to start an SQL solo quiz -> MUST BE REJECTED
    with pytest.raises(ValueError, match="Domain locked"):
        start_new_game(db_session, user_id=3, category="sql")

    # User 3 attempts to create an SQL multiplayer room -> MUST BE REJECTED
    with pytest.raises(ValueError, match="Domain locked"):
        create_room(db_session, host_user_id=3, category="sql", team_name="Team Sharks")

    # User 3 attempts to join an SQL room created by another user -> MUST BE REJECTED
    user1 = db_session.query(User).filter(User.id == 1).first()
    user1.locked_domain = None
    db_session.commit()
    sql_room = create_room(db_session, host_user_id=1, category="sql", team_name="Team SQL")

    # User 3 attempts to retake the quiz -> MUST BE REJECTED under single attempt rule
    with pytest.raises(ValueError, match="already completed"):
        start_new_game(db_session, user_id=3, category="python")


def test_competition_admin_controls_and_excel_export(db_session):
    """Test admin competition start/pause controls, teams status, and Excel export."""
    from models import CompetitionSetting, User
    from services.quiz_service import start_new_game
    from routes.admin_routes import export_teams_excel
    import io
    import openpyxl

    # Ensure admin user exists
    admin = db_session.query(User).filter(User.username == "mahesh123").first()
    if not admin:
        admin = User(
            id=99,
            username="mahesh123",
            password_hash="hashed_dummy",
            team_name="Nemo Admins",
            leader_name="Mahesh",
            phone_number="9876543210",
            is_admin=True
        )
        db_session.add(admin)
        db_session.commit()

    # Create new participant user
    team_user = User(
        id=101,
        username="team_ocean",
        password_hash="pw",
        team_name="Team Ocean",
        leader_name="Alice",
        phone_number="9988776655",
        is_admin=False
    )
    db_session.add(team_user)
    db_session.commit()

    # 1. When competition is paused, participant cannot start
    setting = db_session.query(CompetitionSetting).filter(CompetitionSetting.id == 1).first()
    setting.is_game_started = False
    db_session.commit()

    with pytest.raises(ValueError, match="competition has not started yet"):
        start_new_game(db_session, user_id=101, category="python")

    # 2. When admin starts the competition, participant can start
    setting.is_game_started = True
    db_session.commit()

    attempt = start_new_game(db_session, user_id=101, category="python")
    assert attempt is not None
    assert attempt.user_id == 101

    # 3. Verify Excel export produces valid workbook with headers
    response = export_teams_excel(db=db_session)
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "Dexerity_Competition_Records" in response.headers["Content-Disposition"]
    assert response.headers["Content-Disposition"].endswith(".xlsx")

    # Verify workbook content
    wb = openpyxl.load_workbook(io.BytesIO(response.body))
    ws = wb.active
    assert ws.title == "Competition Scorecard"

    # Check header columns (Row 4 has the table headers)
    headers = [cell.value for cell in ws[4]]
    assert "Team Name" in headers
    assert "Leader Name" in headers
    assert "Phone No." in headers
    assert "Field / Domain" in headers
    assert "Score" in headers
    assert "Correct Qs" in headers
    assert "Time Taken" in headers


def test_clues_lifeline_three_maximum(db_session):
    """Verify that players are granted exactly 3 clues out of 30 questions."""
    from services.quiz_service import reveal_clue_for_attempt, get_game_state

    # Start new game for user1
    attempt = start_new_game(db_session, user_id=1, category="python")

    # Initial state: clues hidden by default, 3/3 remaining
    state1 = get_game_state(db_session, attempt.id, user_id=1)
    assert state1["clues_total"] == 3
    assert state1["clues_used"] == 0
    assert state1["clues_remaining"] == 3
    assert state1["is_clue_revealed"] is False
    assert state1["question"]["clue"] is None

    # Reveal 1st clue on Question 1
    res1 = reveal_clue_for_attempt(db_session, attempt.id, user_id=1)
    assert res1["clue"] == "Clue 1"
    assert res1["clues_used"] == 1
    assert res1["clues_remaining"] == 2
    assert res1["is_clue_revealed"] is True

    # Re-revealing on Question 1 does not consume another clue
    res1_repeat = reveal_clue_for_attempt(db_session, attempt.id, user_id=1)
    assert res1_repeat["clues_used"] == 1
    assert res1_repeat["clues_remaining"] == 2

    # Answer Question 1
    q1 = db_session.query(Question).filter(Question.category == "python", Question.sequence_number == 1).first()
    submit_answer(db_session, attempt.id, user_id=1, question_id=q1.id, selected_answer="A")

    # Move to Question 2: clue hidden by default
    state2 = get_game_state(db_session, attempt.id, user_id=1)
    assert state2["current_question"] == 2
    assert state2["clues_remaining"] == 2
    assert state2["question"]["clue"] is None

    # Reveal 2nd clue on Question 2
    res2 = reveal_clue_for_attempt(db_session, attempt.id, user_id=1)
    assert res2["clues_used"] == 2
    assert res2["clues_remaining"] == 1
    assert res2["clue"] == "Clue 2"

    # Answer Question 2
    q2 = db_session.query(Question).filter(Question.category == "python", Question.sequence_number == 2).first()
    submit_answer(db_session, attempt.id, user_id=1, question_id=q2.id, selected_answer="A")

    # Reveal 3rd clue on Question 3
    res3 = reveal_clue_for_attempt(db_session, attempt.id, user_id=1)
    assert res3["clues_used"] == 3
    assert res3["clues_remaining"] == 0
    assert res3["clue"] == "Clue 3"

    # Answer Question 3
    q3 = db_session.query(Question).filter(Question.category == "python", Question.sequence_number == 3).first()
    submit_answer(db_session, attempt.id, user_id=1, question_id=q3.id, selected_answer="A")

    # Now on Question 4: Attempting to reveal a 4th clue MUST raise an error
    state4 = get_game_state(db_session, attempt.id, user_id=1)
    assert state4["current_question"] == 4
    assert state4["clues_remaining"] == 0

    with pytest.raises(ValueError, match="No clues remaining"):
        reveal_clue_for_attempt(db_session, attempt.id, user_id=1)


