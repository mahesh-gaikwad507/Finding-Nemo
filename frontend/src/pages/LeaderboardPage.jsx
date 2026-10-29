/**
 * LeaderboardPage — shows top rankings decided on the basis of:
 * 1. Most number of questions answered correctly
 * 2. Quick answering / timing (speed factor)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { leaderboardAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { sounds } from '../utils/audio';
import './LeaderboardPage.css';

const TABS = [
  { id: 'python', label: '🐍 Python' },
  { id: 'sql',    label: '🗄️ SQL'    },
  { id: 'excel',  label: '📊 Excel'  },
  { id: 'overall', label: '🌊 Overall' },
];

function formatTime(s) {
  if (s === undefined || s === null || isNaN(s)) return '—';
  const total = Math.max(0, Math.floor(s));
  if (total === 0) return '0s';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${m}m ${sec < 10 ? '0' : ''}${sec}s`;
  return m > 0 ? `${m}m ${sec < 10 ? '0' : ''}${sec}s` : `${sec}s`;
}

function formatSpeed(s, answeredCount) {
  if (!s || !answeredCount || answeredCount <= 0 || isNaN(s)) return '—';
  const perQ = (s / answeredCount).toFixed(1);
  return `${perQ}s / Q`;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('category') || 'python';
  const [activeTab, setActiveTab] = useState(
    TABS.find((t) => t.id === defaultTab) ? defaultTab : 'python'
  );
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const fetch = activeTab === 'overall'
      ? leaderboardAPI.overall()
      : leaderboardAPI.category(activeTab);

    fetch
      .then((res) => setEntries(res.data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    sounds.playBubble();
    setActiveTab(tabId);
  };

  const champion = entries[0];

  return (
    <div className="lb-page">
      {/* Nav */}
      <nav className="lb-nav">
        <button id="lb-back-btn" className="lb-back" onClick={() => navigate('/categories')}>
          ← Back to Categories
        </button>
        <div className="lb-title">
          <span>🏆</span>
          <span>Ocean Winner Board</span>
        </div>
        <div className="nav-user-mini">
          <span className="nav-avatar-sm">{user?.username?.[0]?.toUpperCase()}</span>
          <span className="nav-username-sm">{user?.username}</span>
        </div>
      </nav>

      {/* Criteria Info Banner */}
      <div className="lb-criteria-banner">
        <span className="criteria-badge-icon">⚖️</span>
        <span>
          Winner decided on the basis of: <strong>Most Questions Answered Correctly (🎯)</strong> &amp; <strong>Quick Answering Timing (⏱️)</strong>
        </span>
      </div>

      {/* Tabs */}
      <div className="lb-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`lb-tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`lb-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top Winner Spotlight if available */}
      {champion && !loading && (
        <div className="lb-champion-card">
          <span className="champ-crown">👑</span>
          <div className="champ-info">
            <span className="champ-label">Current Reef Champion</span>
            <h2 className="champ-name">{champion.username}</h2>
            <div className="champ-badges">
              <span className="badge-pill green">
                🎯 {champion.correct_answers}/30 Correct Questions
              </span>
              <span className="badge-pill cyan">
                ⏱️ {formatTime(champion.total_time_seconds)} Total Timing
              </span>
              <span className="badge-pill gold">
                ⚡ {formatSpeed(champion.total_time_seconds, (champion.correct_answers || 0) + (champion.wrong_answers || 0))}
              </span>
              <span className="badge-pill purple">
                ⭐ {champion.score} Points
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="lb-table-wrap">
        {loading ? (
          <div className="lb-loading">
            <span className="ocean-spin">🐠</span>
            <p>Gathering reef dive records…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="lb-empty">
            <span>🌊</span>
            <p>No completed games yet in this category. Be the first to rescue Nemo!</p>
            <button
              id="lb-play-first-btn"
              className="lb-play-btn"
              onClick={() => navigate('/categories')}
            >
              Start Playing →
            </button>
          </div>
        ) : (
          <table className="lb-table" aria-label={`${activeTab} leaderboard`}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Explorer</th>
                <th>🎯 Correct Questions</th>
                <th>⏱️ Timing</th>
                <th>Speed (Per Q)</th>
                <th>Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = entry.username === user?.username;
                const isFirst = entry.rank === 1;

                return (
                  <tr
                    key={`${entry.rank}-${entry.username}`}
                    className={`lb-row ${isFirst ? 'lb-first-row' : ''} ${isMe ? 'lb-me' : ''}`}
                  >
                    <td className="lb-rank">
                      {entry.rank <= 3 ? (
                        <span className="medal">{MEDAL[entry.rank - 1]}{entry.is_tie ? ' (Tie)' : ''}</span>
                      ) : (
                        <span className="rank-num">#{entry.rank}{entry.is_tie ? ' (Tie)' : ''}</span>
                      )}
                    </td>
                    <td className="lb-player">
                      <span className="lb-avatar">{entry.username[0].toUpperCase()}</span>
                      <span className="lb-name">{entry.username}</span>
                      {isMe && <span className="me-badge">You</span>}
                      {isFirst && <span className="champ-tag">{entry.is_tie ? 'Co-Winner' : 'Winner'}</span>}
                    </td>
                    <td className="lb-correct">
                      <span className="correct-count-bold">{entry.correct_answers}/30</span>
                      <span className="correct-sub">({Math.round((entry.correct_answers / 30) * 100)}%)</span>
                    </td>
                    <td className="lb-time">
                      <span className="time-badge">⏱️ {formatTime(entry.total_time_seconds)}</span>
                    </td>
                    <td className="lb-speed">
                      <span className="speed-badge">{formatSpeed(entry.total_time_seconds, (entry.correct_answers || 0) + (entry.wrong_answers || 0))}</span>
                    </td>
                    <td className="lb-score">{entry.score} pts</td>
                    <td className="lb-accuracy">{entry.accuracy}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
