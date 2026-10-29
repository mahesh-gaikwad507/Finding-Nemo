import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI } from '../api';
import { sounds } from '../utils/audio';
import WinnerDashboard, { formatTime } from '../components/WinnerDashboard';
import './RoomQuizPage.css';

const CATEGORY_COLOR = {
  python: '#00f0ff',
  sql: '#10b981',
  excel: '#f59e0b',
};

const FISH_ICONS = ['🐠', '🐡', '🐟', '🐙', '🐬', '🦈', '🐢', '🪼'];

export default function RoomQuizPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(sounds.isMuted());

  const pollIntervalRef = useRef(null);
  const timerRef = useRef(null);
  const victoryPlayedRef = useRef(false);
  const lastProcessedQuestionSeq = useRef(null);

  const toggleSound = () => {
    const isM = sounds.toggleMute();
    setMuted(isM);
  };

  const fetchRoomState = useCallback(async () => {
    try {
      const res = await roomAPI.get(roomCode);
      const data = res.data;
      setRoom(data);

      if (data.status === 'completed' && !victoryPlayedRef.current) {
        victoryPlayedRef.current = true;
        sounds.playVictory();
      }

      // Check if a teammate submitted an answer while we were on the question
      const myTeam = data.my_team;
      if (myTeam && myTeam.last_answered_by && myTeam.last_answered_by !== user?.username) {
        // If team's current question advanced beyond what we last processed
        const lastQSeq = myTeam.current_question - 1;
        if (lastProcessedQuestionSeq.current !== null && lastQSeq > lastProcessedQuestionSeq.current) {
          lastProcessedQuestionSeq.current = lastQSeq;
          // Show teammate answer feedback
          setFeedback({
            is_correct: myTeam.last_is_correct,
            score_change: myTeam.last_score_change,
            correct_answer: myTeam.last_correct_answer,
            explanation: myTeam.last_explanation,
            answered_by: myTeam.last_answered_by,
            is_teammate: true,
            is_finished: myTeam.is_finished,
            selected_answer: myTeam.last_selected_answer,
          });

          if (myTeam.last_is_correct) {
            sounds.playCorrect();
          } else {
            sounds.playWrong();
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update room state.');
    }
  }, [roomCode, user?.username]);

  // Fast polling (every 1.2s) to synchronize all teammates and teams in real time
  useEffect(() => {
    fetchRoomState();
    sounds.playSplash();
    pollIntervalRef.current = setInterval(fetchRoomState, 1200);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchRoomState]);

  // Keep track of the current question sequence to detect teammate answer transitions
  useEffect(() => {
    if (room?.my_team?.current_question !== undefined) {
      if (lastProcessedQuestionSeq.current === null) {
        lastProcessedQuestionSeq.current = room.my_team.current_question - 1;
      }
    }
  }, [room?.my_team?.current_question]);

  const handleSelect = async (letter) => {
    if (selected || submitting || !room?.question) return;
    setSelected(letter);
    setSubmitting(true);
    sounds.playBubble();

    try {
      const res = await roomAPI.answer(roomCode, {
        question_id: room.question.id,
        selected_answer: letter,
      });

      lastProcessedQuestionSeq.current = (room?.my_team?.current_question || 1);

      setFeedback({
        ...res.data,
        is_teammate: res.data.already_answered_by_teammate || (res.data.answered_by && res.data.answered_by !== user?.username),
      });

      if (res.data.is_correct) {
        sounds.playCorrect();
      } else {
        sounds.playWrong();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error submitting answer.');
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = useCallback(async () => {
    clearTimeout(timerRef.current);
    setFeedback(null);
    setSelected(null);
    await fetchRoomState();
  }, [fetchRoomState]);

  // Auto-advance after 2.8s on correct, 3.8s on wrong
  useEffect(() => {
    if (!feedback) return;
    const delay = feedback.is_correct ? 2800 : 3800;
    timerRef.current = setTimeout(handleNext, delay);
    return () => clearTimeout(timerRef.current);
  }, [feedback, handleNext]);

  const handleLeave = async () => {
    if (!window.confirm('Leave this multiplayer room?')) return;
    try {
      await roomAPI.leave(roomCode);
    } catch { /* ignore */ }
    navigate('/categories');
  };

  if (!room) {
    return (
      <div className="room-quiz-page loading">
        <div className="ocean-spin">🐠</div>
        <p>Connecting to Reef Race…</p>
      </div>
    );
  }

  const { category, participants, question, total_questions, status, current_user_id, teams_summary, my_team } = room;
  const color = CATEGORY_COLOR[category] || '#3b82f6';

  // Use team-level completion rather than individual
  const isTeamFinished = my_team?.is_finished || !question;
  const allTeamsFinished = status === 'completed' || (teams_summary && teams_summary.length > 0 && teams_summary.every((t) => t.is_finished));

  // ── Render Completed / Winner Dashboard Screen ──────────────────────────────
  const isAdmin = room.is_admin || room.is_host || (user?.username && ['admin', 'host'].includes(user.username.toLowerCase()));
  const isLeaderboardReleased = room.leaderboard_released;

  const handleReleaseLeaderboard = async () => {
    setReleasing(true);
    sounds.playVictory();
    try {
      await roomAPI.releaseLeaderboard(roomCode);
      await fetchRoomState();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to release leaderboard.');
    } finally {
      setReleasing(false);
    }
  };

  // ── Render Completed / Winner Dashboard Screen ──────────────────────────────
  if (allTeamsFinished) {
    return (
      <div className="room-quiz-page podium-view" style={{ '--accent': color }}>
        {isAdmin && (
          <div className="admin-decision-banner">
            <div className="admin-badge-row">
              <span className="admin-crown-icon">👑</span>
              <div className="admin-title-box">
                <h2 className="admin-banner-heading">Room Admin Command — Standings &amp; Winner Verification</h2>
                <p className="admin-banner-desc">
                  Final standings decided by <strong>1. Actual Final Score (⭐)</strong> &bull; <strong>2. Correct Questions (🎯)</strong> &bull; <strong>3. Fastest Timing (⏱️)</strong>.
                </p>
              </div>
            </div>
            <div className="admin-action-row">
              {!isLeaderboardReleased ? (
                <button
                  id="announce-winner-btn"
                  className="btn-admin-announce"
                  onClick={handleReleaseLeaderboard}
                  disabled={releasing}
                >
                  {releasing ? 'Broadcasting…' : '📢 Broadcast Official Confirmation to All Divers'}
                </button>
              ) : (
                <span className="badge-announced">✓ Official Standings Confirmed for Room</span>
              )}
            </div>
          </div>
        )}

        <WinnerDashboard
          participants={participants}
          teamsSummary={teams_summary}
          totalQuestions={total_questions}
          currentUserId={current_user_id}
          currentUsername={user?.username}
          category={category}
          onBackHome={() => navigate('/categories')}
          onPlayAgain={() => navigate(`/room/${roomCode}`)}
          isRoom={true}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="room-quiz-page" style={{ '--accent': color }}>
      {/* Top Bar */}
      <header className="room-quiz-header">
        <div className="left-meta">
          <span className="room-pill">ROOM: {roomCode}</span>
          <span className="cat-pill" style={{ borderColor: color, color }}>
            {category?.toUpperCase()}
          </span>
          <span className="q-pill">
            Q {Math.min(my_team?.current_question || 1, total_questions)} / {total_questions}
          </span>
        </div>

        <div className="right-meta">
          <div className="my-score-badge" title="Combined Team Score">
            <span className="score-label">Team Score:</span>
            <span className="score-num">{my_team?.score ?? 0}</span>
          </div>
          <button
            id="sound-toggle-btn"
            className="sound-toggle-btn"
            onClick={toggleSound}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-label="Toggle audio"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="quit-btn" onClick={handleLeave}>
            ✕ Leave
          </button>
        </div>
      </header>

      {/* ── COOPERATIVE TEAM BANNER ─────────────────────────────────────────── */}
      {my_team && (
        <section className="team-collab-banner">
          <div className="team-collab-left">
            <span className="team-shield-icon">🛡️</span>
            <div className="team-collab-info">
              <div className="team-title-row">
                <span className="team-display-name">{my_team.team_name}</span>
                <span className="team-collab-tag">🤝 Teammate Squad</span>
              </div>
              <div className="team-members-chips">
                <span className="chips-label">Teammates:</span>
                {my_team.members?.map((m) => (
                  <span
                    key={m}
                    className={`teammate-chip ${m === user?.username ? 'is-me' : ''}`}
                  >
                    {m === user?.username ? `You (${m})` : m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="team-collab-right">
            <div className="team-metric">
              <span className="metric-val">🎯 {my_team.correct_answers ?? 0} / {total_questions}</span>
              <span className="metric-lbl">Correct Answers</span>
            </div>
            <div className="team-metric">
              <span className="metric-val">⏱️ {formatTime(my_team.total_time_seconds)}</span>
              <span className="metric-lbl">Elapsed Timing</span>
            </div>
          </div>
        </section>
      )}

      {/* ── LIVE MULTIPLAYER RACE TRACK (TEAMS COMPETING) ──────────────────── */}
      <section className="live-race-section">
        <div className="race-header">
          <div className="race-title-group">
            <span className="race-title">🏁 Live Reef Race — Teams Expedition</span>
            <span className="race-sub">All teammates swim in the same squad bubble! Race other teams to the Coral Reef.</span>
          </div>
          <div className="race-criteria-badge">
            Ranked by: <strong>1. Max Correct (🎯)</strong> &bull; <strong>2. Fastest Time (⏱️)</strong>
          </div>
        </div>

        <div className="ocean-track-container">
          <div className="track-water">
            {(teams_summary || []).map((t, idx) => {
              const fish = FISH_ICONS[idx % FISH_ICONS.length];
              const prog = Math.min(t.progress_percentage || 0, 100);
              const isMyTeam = my_team && t.team_name === my_team.team_name;

              return (
                <div key={t.team_name} className={`swimmer-lane ${isMyTeam ? 'is-me-lane is-my-team-lane' : ''}`}>
                  <div
                    className="swimmer-bubble"
                    style={{ left: `calc(${prog}% - 24px)` }}
                    title={`${t.team_name} (${t.members?.join(', ')}): ${t.correct_answers} correct, ${t.score} pts`}
                  >
                    <span className="swimmer-tag">
                      {isMyTeam ? '⭐ ' : ''}<strong>{t.team_name}</strong>
                      <span className="swimmer-roster"> ({t.members?.join(', ')})</span>
                      <span className="swimmer-score-chip"> 🎯 {t.correct_answers} | {t.score} pts</span>
                    </span>
                    <span className="swimmer-fish">{fish}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="track-landmarks">
            <span>🏠 Start</span>
            <span>🌊 Open Deep</span>
            <span>🪸 Coral Safe Zone (Finish 🏁)</span>
          </div>
        </div>
      </section>

      {/* ── QUESTION OR WAITING AREA ────────────────────────────────────────── */}
      {isTeamFinished ? (
        <div className="waiting-finish-card">
          <span className="finish-icon">🏁</span>
          <h2>Your Team Finished The Expedition!</h2>
          <p>
            <strong>{my_team?.team_name}</strong> solved <strong>{my_team?.correct_answers}/{total_questions} questions correctly</strong> in{' '}
            <strong>{formatTime(my_team?.total_time_seconds)}</strong> with a score of <strong>{my_team?.score} pts</strong>!
          </p>
          <div className="ocean-spin-sm">🐠</div>
          <p className="waiting-others-text">
            Waiting for other teams to reach the Coral Safe Zone…
          </p>
        </div>
      ) : question ? (
        <section className="room-question-card">
          {/* Team cooperative rule reminder */}
          <div className="team-instruction-banner">
            <span className="instruction-icon">🤝</span>
            <span>
              <strong>Team Environment:</strong> Think together with your squad! Any member of{' '}
              <strong>{my_team?.team_name}</strong> can click the option to submit for the entire team.
            </span>
          </div>

          <div className="clue-banner">
            <span className="clue-icon">💡</span>
            <span>{question.clue}</span>
          </div>

          <div className="q-tags-row">
            <span className="concept-badge">{question.concept}</span>
            <span className={`diff-badge diff-${question.difficulty}`}>{question.difficulty}</span>
          </div>

          <h2 className="q-text">{question.question_text}</h2>

          <div className="options-grid">
            {Object.entries(question.options).map(([letter, text]) => {
              let optClass = 'opt-btn';
              if (selected) {
                if (letter === feedback?.correct_answer) optClass += ' correct';
                else if (letter === selected && !feedback?.is_correct) optClass += ' wrong';
                else optClass += ' dimmed';
              }

              return (
                <button
                  key={letter}
                  className={optClass}
                  onClick={() => handleSelect(letter)}
                  disabled={!!selected || submitting}
                >
                  <span className="opt-letter">{letter}</span>
                  <span className="opt-text">{text}</span>
                </button>
              );
            })}
          </div>

          {/* Forward-only navigation rule notice */}
          <div className="forward-only-indicator">
            <span className="indicator-icon">➡️</span>
            <span>Forward-Only Mode: Only "Next Question" is available after each answer. Previous questions cannot be revisited.</span>
          </div>

          {question.narrative_context && (
            <p className="q-narrative">{question.narrative_context}</p>
          )}
        </section>
      ) : (
        <div className="waiting-finish-card">
          <p>Preparing next question…</p>
        </div>
      )}

      {/* Feedback Overlay (Supports both own clicks and teammate clicks) */}
      {feedback && (
        <div className={`room-feedback-overlay ${feedback.is_correct ? 'correct' : 'wrong'}`}>
          <div className="room-feedback-box">
            <div className="fb-icon">{feedback.is_correct ? '🎉' : '❌'}</div>
            <h3 className="fb-title">
              {feedback.is_correct ? 'Correct Dive!' : 'Ouch, Shark Bite!'}
            </h3>

            {/* Teammate Answer Indicator */}
            {feedback.answered_by && (
              <div className="fb-answered-badge">
                {feedback.answered_by === user?.username ? (
                  <span>👉 Submitted by you ({user?.username}) for <strong>{my_team?.team_name}</strong></span>
                ) : (
                  <span>🤝 Submitted by teammate <strong>{feedback.answered_by}</strong> for <strong>{my_team?.team_name}</strong></span>
                )}
              </div>
            )}

            <p className="fb-score">
              {feedback.is_correct
                ? `+${feedback.score_change} Team Points`
                : `Correct answer was ${feedback.correct_answer} (${feedback.score_change} pts)`}
            </p>
            <p className="fb-expl">{feedback.explanation}</p>
            <button className="fb-btn" onClick={handleNext}>
              {feedback.is_finished ? 'Finish Expedition 🏁' : 'Next Question →'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="room-quiz-err">⚠️ {error}</div>}
    </div>
  );
}
