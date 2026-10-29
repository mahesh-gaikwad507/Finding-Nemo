/**
 * QuizPage — active gameplay screen.
 * Shows: progress bar, Nemo's journey, current question, answer options,
 * feedback overlay after each answer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizAPI } from '../api';
import { sounds } from '../utils/audio';
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
  const timerRef = useRef(null);

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

  const handleSelect = async (letter) => {
    if (selected || submitting || !state?.question) return;
    setSelected(letter);
    setSubmitting(true);
    sounds.playBubble();

    try {
      const res = await quizAPI.answer(attemptId, {
        question_id: state.question.id,
        selected_answer: letter,
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

  // Auto-advance after 3 s on correct, 4 s on wrong
  useEffect(() => {
    if (!feedback) return;
    const delay = feedback.is_correct ? 2800 : 4000;
    timerRef.current = setTimeout(handleNext, delay);
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
            {current_question} <span className="q-of">/ {TOTAL}</span>
          </span>
        </div>

        <div className="quiz-stats">
          <StatBadge icon="✅" value={correct_answers} label="Correct" color="#34d399" />
          <StatBadge icon="❌" value={wrong_answers} label="Wrong" color="#f87171" />
          <StatBadge icon="⭐" value={score} label="Score" color="#fbbf24" />
        </div>

        <div className="header-actions">
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
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Nemo's ocean journey */}
      <div className="nemo-track" aria-label={`Nemo has answered ${correct_answers} questions correctly`}>
        <div className="ocean-track">
          <div className="track-start">🏠</div>
          <div className="track-line">
            <div className="nemo-dot" style={{ left: `${nemoProgress}%` }}>
              🐠
            </div>
          </div>
          <div className="track-end">🪸</div>
        </div>
        <p className="nemo-label">
          Nemo is {correct_answers}/{TOTAL} of the way home
        </p>
      </div>

      {/* Question card */}
      {question ? (
        <div className="question-section">
          {/* Clue */}
          <div className="clue-box">
            <span className="clue-icon">💡</span>
            <p className="clue-text">{question.clue}</p>
          </div>

          {/* Concept + difficulty */}
          <div className="question-meta">
            <span className="concept-tag">{question.concept}</span>
            <span className={`diff-tag diff-${question.difficulty}`}>{question.difficulty}</span>
          </div>

          {/* Question text */}
          <div className="question-card">
            <p className="question-text">{question.question_text}</p>

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
