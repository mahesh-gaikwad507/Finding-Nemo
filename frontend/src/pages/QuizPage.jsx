/**
 * QuizPage — active gameplay screen.
 * Shows: progress bar, Nemo's journey, current question, answer options,
 * feedback overlay after each answer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizAPI } from '../api';
import { sounds } from '../utils/audio';
import { formatTime } from './ResultPage';
import './QuizPage.css';

const TOTAL = 30;
const CATEGORY_COLOR = {
  python: '#00f0ff',
  sql: '#10b981',
  excel: '#f59e0b',
};
const CATEGORY_EMOJI = { python: '🐍', sql: '🗄️', excel: '📊' };

export default function QuizPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // null | { ...answerFeedback }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(sounds.isMuted());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [revealingClue, setRevealingClue] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const timerRef = useRef(null);
  const sessionStartRef = useRef(Date.now());

  // Active quiz session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await quizAPI.state(attemptId);
      if (res.data.is_completed) {
        sounds.playVictory();
        navigate(`/result/${attemptId}`, { replace: true });
        return;
      }
      setState(res.data);
    } catch {
      setError('Failed to load quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    fetchState();
    sounds.playSplash();
  }, [fetchState]);

  const toggleSound = () => {
    const isM = sounds.toggleMute();
    setMuted(isM);
  };

  const handleRevealClue = async () => {
    if (revealingClue || (state?.clues_remaining ?? 0) <= 0) return;
    setRevealingClue(true);
    try {
      const res = await quizAPI.revealClue(attemptId);
      sounds.playBubble();
      setState((prev) => ({
        ...prev,
        clues_used: res.data.clues_used,
        clues_remaining: res.data.clues_remaining,
        is_clue_revealed: true,
        question: {
          ...prev.question,
          clue: res.data.clue,
        },
      }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not unlock clue.');
    } finally {
      setRevealingClue(false);
    }
  };

  const handleSelect = async (letter) => {
    if (selected || submitting || !state?.question) return;
    setSelected(letter);
    setSubmitting(true);
    sounds.playBubble();

    const currentSeconds = Math.max(1, Math.floor((Date.now() - sessionStartRef.current) / 1000));

    try {
      const res = await quizAPI.answer(attemptId, {
        question_id: state.question.id,
        selected_answer: letter,
        client_time_seconds: currentSeconds,
      });
      setFeedback(res.data);
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
    setLoading(true);

    if (feedback?.is_completed) {
      navigate(`/result/${attemptId}`, { replace: true });
      return;
    }

    await fetchState();
  }, [feedback, attemptId, navigate, fetchState]);

  // User advances at their own pace using Next Button; no forced fast timer
  useEffect(() => {
    // 60-second safety timeout only
    if (!feedback) return;
    timerRef.current = setTimeout(handleNext, 60000);
    return () => clearTimeout(timerRef.current);
  }, [feedback, handleNext]);

  const handleAbandon = async () => {
    if (!window.confirm('Abandon this quiz? Your current progress will be saved.')) return;
    try {
      await quizAPI.abandon(attemptId);
    } catch { /* ignore */ }
    navigate('/categories');
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} onBack={() => navigate('/categories')} />;
  if (!state) return null;

  const { question, current_question, correct_answers, wrong_answers, score, category } = state;
  const color = CATEGORY_COLOR[category] || '#3b82f6';
  const progress = ((current_question - 1) / TOTAL) * 100;
  const nemoProgress = (correct_answers / TOTAL) * 100;

  return (
    <div className="quiz-page" style={{ '--cat-color': color }}>
      {/* Header */}
      <header className="quiz-header">
        <div className="quiz-meta">
          <span className="cat-pill">
            {CATEGORY_EMOJI[category]} {category?.toUpperCase()}
          </span>
          <span className="q-counter">
            Q.{current_question} <span className="q-of">/ {TOTAL}</span>
          </span>
        </div>

        <div className="quiz-stats">
          <StatBadge icon="⏱️" value={formatTime(elapsedSeconds)} label="Time" color="#00f0ff" />
          <StatBadge icon="💡" value={`${state.clues_remaining ?? 3}/3`} label="Clues" color="#fbbf24" />
          <StatBadge icon="✅" value={correct_answers} label="Correct" color="#34d399" />
          <StatBadge icon="❌" value={wrong_answers} label="Wrong" color="#f87171" />
          <StatBadge icon="⭐" value={score} label="Score" color="#a78bfa" />
        </div>

        <div className="header-actions">
          <button
            id="rules-toggle-btn"
            className="rules-toggle-btn"
            onClick={() => setShowRulesModal(true)}
            title="View competition instructions & rules"
            aria-label="View instructions"
          >
            📋 Rules
          </button>
          <button
            id="sound-toggle-btn"
            className="sound-toggle-btn"
            onClick={toggleSound}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-label="Toggle audio"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button id="abandon-btn" className="abandon-btn" onClick={handleAbandon}>
            ✕ Quit
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="progress-wrap">
        <div className="progress-info-row">
          <span className="progress-q-label">
            <span className="progress-dot" /> Q.{current_question} of {TOTAL}
          </span>
          <span className="progress-pct-label">{Math.round(((current_question - 1) / TOTAL) * 100)}% Completed</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Nemo's ocean journey (Left to Right from Open Sea to Coral Home with fish facing right) */}
      <div className="nemo-track" aria-label={`Nemo has answered ${correct_answers} questions correctly`}>
        <div className="ocean-track">
          <div className="track-start" title="Lost at Sea (Start)">🌊</div>
          <div className="track-line">
            <div className="track-fill" style={{ width: `${nemoProgress}%` }} />
            <div className="nemo-dot" style={{ left: `${nemoProgress}%` }} title={`Nemo: ${correct_answers}/${TOTAL} steps home`}>
              <span className="nemo-fish-face-right" role="img" aria-label="Nemo swimming right">🐠</span>
            </div>
          </div>
          <div className="track-end" title="Coral Reef Home (Destination)">🏠</div>
        </div>
        <p className="nemo-label">
          Nemo has swum {correct_answers}/{TOTAL} steps toward home
        </p>
      </div>

      {/* Question card */}
      {question ? (
        <div className="question-section">
          {/* Clue Section: 3 clues budget across 30 questions */}
          {state.is_clue_revealed || question.clue ? (
            <div className="clue-box clue-revealed">
              <div className="clue-header-row">
                <span className="clue-icon">💡</span>
                <span className="clue-status-badge">
                  Clue Unlocked • {state.clues_remaining}/3 Lifelines Remaining
                </span>
              </div>
              <p className="clue-text">{question.clue}</p>
            </div>
          ) : (
            <div className="clue-box clue-locked">
              <div className="clue-locked-info">
                <span className="clue-icon">💡</span>
                <div>
                  <div className="clue-locked-title">Question Hint Available</div>
                  <div className="clue-locked-desc">
                    Each team has <strong>{state.clues_remaining}/3</strong> clues remaining across the 30 questions.
                  </div>
                </div>
              </div>
              <button
                id="reveal-clue-btn"
                type="button"
                className="reveal-clue-btn"
                onClick={handleRevealClue}
                disabled={revealingClue || (state.clues_remaining ?? 0) <= 0}
              >
                {revealingClue ? (
                  'Unlocking…'
                ) : (state.clues_remaining ?? 0) > 0 ? (
                  `🔓 Use Clue (${state.clues_remaining}/3 left)`
                ) : (
                  '🔒 0 Clues Left (3/3 used)'
                )}
              </button>
            </div>
          )}

          {/* Question Number Badge + Concept + Difficulty */}
          <div className="question-meta">
            <span className="q-number-pill">Q.{current_question} of {TOTAL}</span>
            <span className="concept-tag">{question.concept}</span>
            <span className={`diff-tag diff-${question.difficulty}`}>{question.difficulty}</span>
          </div>

          {/* Question text with prominent Q.1, Q.2, Q.3 etc. */}
          <div className="question-card">
            <div className="question-header-row">
              <span className="question-badge-chip">Q.{current_question}</span>
              <p className="question-text">
                <span className="q-prefix-num">Q.{current_question}</span>{' '}
                {question.question_text?.replace(/^Q\.?\s*\d+[:.]?\s*/i, '')}
              </p>
            </div>

            {/* Options grid */}
            <div className="options-grid">
              {Object.entries(question.options).map(([letter, text]) => {
                let optClass = 'option-btn';
                if (selected) {
                  if (letter === feedback?.correct_answer) optClass += ' correct';
                  else if (letter === selected && !feedback?.is_correct) optClass += ' wrong';
                  else optClass += ' dimmed';
                }
                return (
                  <button
                    key={letter}
                    id={`option-${letter}`}
                    className={optClass}
                    onClick={() => handleSelect(letter)}
                    disabled={!!selected}
                    aria-pressed={letter === selected}
                  >
                    <span className="option-letter">{letter}</span>
                    <span className="option-text">{text}</span>
                  </button>
                );
              })}
            </div>

            {/* Forward-only navigation rule notice */}
            <div className="forward-only-indicator">
              <span className="indicator-icon">➡️</span>
              <span>Forward-Only Mode: Answer and proceed with <strong>Next Question</strong>. No previous button is available.</span>
            </div>
          </div>

          {/* Narrative context */}
          {question.narrative_context && (
            <p className="narrative">{question.narrative_context}</p>
          )}
        </div>
      ) : (
        <div className="quiz-complete-msg">
          <p>Quiz complete! Redirecting…</p>
        </div>
      )}

      {/* Feedback overlay */}
      {feedback && (
        <div className={`feedback-overlay ${feedback.is_correct ? 'feedback-correct' : 'feedback-wrong'}`}>
          <div className="feedback-card">
            <div className="feedback-icon">{feedback.is_correct ? '🎉' : '😢'}</div>
            <h3 className="feedback-title">
              {feedback.is_correct ? 'Correct!' : 'Not quite…'}
            </h3>
            <p className="feedback-answer">
              {feedback.is_correct
                ? `Great job! +${feedback.score_change} points`
                : `The correct answer was ${feedback.correct_answer} · −${Math.abs(feedback.score_change)} points`}
            </p>
            <p className="feedback-explanation">{feedback.explanation}</p>
            <button
              id="next-question-btn"
              className="feedback-next-btn"
              onClick={handleNext}
            >
              {feedback.is_completed ? 'See Results 🏁' : 'Next Question →'}
            </button>
          </div>
        </div>
      )}

      {/* Instructions / Rules Modal */}
      {showRulesModal && (
        <div className="quiz-rules-modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="quiz-rules-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rules-modal-header">
              <h2>📋 Tournament Rules & Instructions</h2>
              <button className="rules-close-btn" onClick={() => setShowRulesModal(false)}>✕</button>
            </div>
            <div className="rules-modal-body">
              <div className="rule-item">
                <span className="rule-badge">🔒</span>
                <div>
                  <strong>Single Attempt Tournament:</strong> Each team can only attempt once. Your score and timing are officially logged.
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-badge">💡</span>
                <div>
                  <strong>3 Clues Total (Lifeline System):</strong> You have access to exactly 3 clues out of the 30 questions. Use your clues strategically on the most difficult questions!
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-badge">➡️</span>
                <div>
                  <strong>Forward-Only Progression:</strong> Only the <strong>Next Question</strong> button is available after each question. There is <strong>no Previous button</strong> — questions cannot be revisited.
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-badge">⭐</span>
                <div>
                  <strong>Scoring & Timing:</strong> +10 points for correct answers, -2 points for incorrect answers. Fast completion with high accuracy achieves top ranking.
                </div>
              </div>
            </div>
            <button className="rules-done-btn" onClick={() => setShowRulesModal(false)}>
              Got It, Continue Quiz →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ icon, value, label, color }) {
  return (
    <div className="stat-badge" style={{ '--badge-color': color }}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="quiz-loading">
      <div className="loading-fish">🐠</div>
      <p>Loading your question…</p>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div className="quiz-error">
      <p>⚠️ {message}</p>
      <button onClick={onBack} className="error-back-btn">← Back to Categories</button>
    </div>
  );
}
