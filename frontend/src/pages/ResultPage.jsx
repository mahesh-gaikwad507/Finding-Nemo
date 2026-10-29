/**
 * ResultPage — shows final score, stats, Nemo celebration, timing, and corrected questions.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizAPI } from '../api';
import { sounds } from '../utils/audio';
import './ResultPage.css';

const CATEGORY_EMOJI = { python: '🐍', sql: '🗄️', excel: '📊' };
const CATEGORY_COLOR = { python: '#00f0ff', sql: '#10b981', excel: '#f59e0b' };

export function formatTime(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  if (total === 0) return '0s';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s < 10 ? '0' : ''}${s}s`;
  }
  return m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
}

export function formatSpeed(seconds, answeredCount) {
  if (!seconds || !answeredCount || answeredCount <= 0 || isNaN(seconds)) return '—';
  const perQ = (seconds / answeredCount).toFixed(1);
  return `${perQ}s / Q`;
}

import { useAuth } from '../context/AuthContext';

export default function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    quizAPI.result(attemptId)
      .then((res) => {
        setResult(res.data);
        if (refreshUser) refreshUser();
        if (res.data.nemo_reached_home || res.data.correct_answers >= 20) {
          sounds.playVictory();
        }
      })
      .catch((err) => {
        console.error('Error fetching result:', err);
        setError(err.response?.data?.detail || 'Could not load results.');
      });
  }, [attemptId, refreshUser]);

  const handleEndGame = () => {
    const teamTitle = result?.team_name || user?.team_name || user?.username || 'Team';
    const finalScore = result?.score ?? 0;
    const confirmExit = window.confirm(
      `🏁 END GAME CONFIRMATION\n\nAre you sure you want to end your tournament session?\n\n• Team: ${teamTitle}\n• Final Score: ${finalScore} pts\n\nClicking OK will finalize your results and safely log you out of the website.`
    );
    if (!confirmExit) return;

    setExiting(true);
    sounds.playBubble();
    setTimeout(() => {
      logout();
      navigate('/auth', { replace: true });
    }, 400);
  };

  if (error) {
    return (
      <div className="result-page">
        <p className="result-error">⚠️ {error}</p>
        <button className="result-btn primary" onClick={() => navigate('/auth')}>← Return to Login</button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="result-page">
        <div className="result-loading ocean-spin">🐠</div>
        <p style={{ color: '#7db8e0' }}>Calculating team performance & final score…</p>
      </div>
    );
  }

  const {
    category, score, correct_answers, wrong_answers,
    total_questions, accuracy, total_time_seconds, nemo_reached_home,
    team_name, leader_name, phone_number,
  } = result;

  const displayTeam = team_name || user?.team_name || user?.username || 'Team';
  const displayLeader = leader_name || user?.leader_name || '—';
  const displayPhone = phone_number || user?.phone_number || '—';

  const answeredCount = (correct_answers || 0) + (wrong_answers || 0);
  const color = CATEGORY_COLOR[category] || '#00f0ff';
  const grade = score >= 250 ? 'S' : score >= 200 ? 'A' : score >= 150 ? 'B' : score >= 100 ? 'C' : 'D';
  const gradeColor = grade === 'S' ? '#fbbf24' : grade === 'A' ? '#34d399' : grade === 'B' ? '#60a5fa' : grade === 'C' ? '#fb923c' : '#f87171';
  const isAdmin = user?.is_admin || user?.username?.toLowerCase() === 'mahesh123';

  return (
    <div className="result-page" style={{ '--cat-color': color }}>
      {/* Confetti particles on success */}
      {nemo_reached_home && <Confetti />}

      <div className="result-card">
        {/* Celebration header */}
        <div className="result-header">
          <div className="result-fish" aria-label={nemo_reached_home ? 'Nemo reached home' : 'Nemo completed dive'}>
            {nemo_reached_home ? '🎉🐠🎉' : correct_answers >= 15 ? '🐬🌊' : '😢🐠'}
          </div>
          <h1 className="result-title">
            {nemo_reached_home ? 'Nemo Made It Safely Home!' : 'Dive Mission Complete!'}
          </h1>
          <p className="result-subtitle">
            {CATEGORY_EMOJI[category]} {category?.charAt(0).toUpperCase() + category?.slice(1)} Competition Scorecard
          </p>
        </div>

        {/* ── Prominent Team Score Hero Showcase ── */}
        <div className="team-score-hero-card">
          <div className="tsh-badge">🏆 OFFICIAL TEAM SCORE</div>
          <div className="tsh-team-name">{displayTeam}</div>
          <div className="tsh-score-wrap">
            <span className="tsh-big-num">{score}</span>
            <span className="tsh-pts">PTS</span>
          </div>
          <div className="tsh-meta-bar">
            <span>Leader: <strong>{displayLeader}</strong></span>
            <span className="tsh-dot">•</span>
            <span>Phone: <strong>{displayPhone}</strong></span>
            <span className="tsh-dot">•</span>
            <span>Field: <strong className="tsh-cat-tag">{category?.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Evaluation Banner (Solo Mode) */}
        <div className="result-criteria-pill">
          <span>🎯 Official Evaluation:</span>
          <strong>Accuracy &bull; Answering Speed &bull; Total Score</strong>
        </div>

        {/* Grade */}
        <div className="result-grade" style={{ '--grade-color': gradeColor }}>
          <div className="grade-ring">
            <span className="grade-letter">{grade}</span>
          </div>
          <span className="grade-label">Performance Grade</span>
        </div>

        {/* Stats grid */}
        <div className="result-stats">
          <StatCard icon="🎯" label="Correct Questions" value={`${correct_answers} / ${total_questions}`} sub={`${accuracy}% Accuracy`} color="#34d399" />
          <StatCard icon="⏱️" label="Total Timing" value={formatTime(total_time_seconds)} sub="Active session" color="#00f0ff" />
          <StatCard icon="⚡" label="Answering Speed" value={formatSpeed(total_time_seconds, answeredCount)} color="#fbbf24" />
          <StatCard icon="⭐" label="Total Score" value={score} sub={`/ ${total_questions * 10} pts`} color="#fbbf24" />
          <StatCard icon="❌" label="Mistakes" value={wrong_answers} sub="Questions missed" color="#f87171" />
          <StatCard icon="🏠" label="Nemo home?" value={nemo_reached_home ? 'Yes! Safe!' : 'Partially safe'} color={nemo_reached_home ? '#34d399' : '#38bdf8'} />
        </div>

        {/* Detailed Individual Team Scorecard Box */}
        <div className="team-scorecard-box">
          <div className="scorecard-header">
            <span className="scorecard-badge-icon">📋</span>
            <span className="scorecard-title">Official Team Record Details</span>
          </div>
          <div className="scorecard-grid">
            <div className="scorecard-item">
              <span className="sc-lbl">Team Name:</span>
              <span className="sc-val bold">{displayTeam}</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Leader Name:</span>
              <span className="sc-val">{displayLeader}</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Phone Number:</span>
              <span className="sc-val mono">{displayPhone}</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Field / Domain:</span>
              <span className="sc-val highlight">{category?.toUpperCase()}</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Total Score:</span>
              <span className="sc-val gold">{score} pts</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Correct Questions:</span>
              <span className="sc-val green">{correct_answers} / {total_questions}</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Accuracy:</span>
              <span className="sc-val green">{accuracy}%</span>
            </div>
            <div className="scorecard-item">
              <span className="sc-lbl">Total Timing:</span>
              <span className="sc-val cyan">{formatTime(total_time_seconds)}</span>
            </div>
          </div>
        </div>

        {/* Single Attempt Lock Notice */}
        <div className="single-attempt-notice">
          <span>🔒</span>
          <span>Official Attempt Completed &bull; Under competition rules, each team can only attempt once. Your score has been submitted to the tournament records.</span>
        </div>

        {/* Action buttons with End Game option */}
        <div className="result-actions">
          <button
            id="result-end-game-btn"
            className="result-btn end-game-btn"
            onClick={handleEndGame}
            disabled={exiting}
            title="End competition and log out from the website"
          >
            {exiting ? 'Ending Session…' : '🏁 End Game & Exit'}
          </button>
          {isAdmin && (
            <button
              id="result-admin-btn"
              className="result-btn admin-btn"
              onClick={() => navigate('/admin')}
            >
              👑 Admin Command
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <span className="sc-icon">{icon}</span>
      <span className="sc-value" style={{ color: color || '#e0f4ff' }}>{value}</span>
      {sub && <span className="sc-sub">{sub}</span>}
      <span className="sc-label">{label}</span>
    </div>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            '--x': `${Math.random() * 100}vw`,
            '--delay': `${Math.random() * 2}s`,
            '--duration': `${2.5 + Math.random() * 2}s`,
            '--color': `hsl(${Math.random() * 360}, 80%, 65%)`,
            '--size': `${6 + Math.random() * 8}px`,
          }}
        />
      ))}
    </div>
  );
}
