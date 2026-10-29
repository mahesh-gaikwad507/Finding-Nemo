/**
 * CategoryPage — pick Python, SQL, or Excel to start a quiz.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { quizAPI } from '../api';
import { sounds } from '../utils/audio';
import { useState, useEffect } from 'react';
import './CategoryPage.css';

const CATEGORIES = [
  {
    id: 'python',
    label: 'Python',
    emoji: '🐍',
    color: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.5)',
    description: 'Variables, loops, functions & more — follow Nemo through the coral reef of code.',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #00f0ff 50%, #38bdf8 100%)',
  },
  {
    id: 'sql',
    label: 'SQL',
    emoji: '🗄️',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.5)',
    description: 'Queries, joins & aggregations — dive into the deep ocean database.',
    gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 50%, #34d399 100%)',
  },
  {
    id: 'excel',
    label: 'Excel',
    emoji: '📊',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.5)',
    description: 'Formulas, charts & pivot tables — chart your course across the spreadsheet sea.',
    gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fbbf24 100%)',
  },
];

export default function CategoryPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(sounds.isMuted());
  const [lockedDomain, setLockedDomain] = useState(user?.locked_domain || null);

  useEffect(() => {
    // Check real-time domain lock status
    quizAPI.domainStatus()
      .then((res) => {
        if (res.data?.locked_domain) {
          setLockedDomain(res.data.locked_domain);
        }
      })
      .catch(() => {});
  }, []);

  const toggleSound = () => {
    const isM = sounds.toggleMute();
    setMuted(isM);
  };

  const handleStart = async (categoryId) => {
    if (starting) return;

    // Enforce 1-domain-per-team rule on client
    if (lockedDomain && lockedDomain !== categoryId) {
      setError(`Domain locked: Your team is registered for ${lockedDomain.toUpperCase()}. Competition rules permit only 1 field per team.`);
      return;
    }

    setStarting(categoryId);
    setError('');
    sounds.playSplash();
    try {
      const res = await quizAPI.start(categoryId);
      const attemptId = res.data.attempt_id;
      navigate(`/quiz/${attemptId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Could not open quiz. Please try again.');
      setStarting(null);
    }
  };

  return (
    <div className="category-page">
      {/* Seabed animation */}
      <div className="seabed" aria-hidden="true">
        <div className="waves" />
        <div className="seabed-floor" />
      </div>

      {/* Navbar */}
      <nav className="cat-nav">
        <div className="cat-nav-brand">
          <span>🐠</span>
          <span>Dexerity</span>
        </div>
        <div className="cat-nav-right">
          <button
            id="cat-sound-toggle-btn"
            className="nav-btn sound-nav-btn"
            onClick={toggleSound}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            id="multiplayer-nav-btn"
            className="nav-btn primary-room"
            onClick={() => { sounds.playBubble(); navigate('/room'); }}
          >
            👥 Play Together
          </button>
          <button
            id="leaderboard-nav-btn"
            className="nav-btn secondary"
            onClick={() => { sounds.playBubble(); navigate('/leaderboard'); }}
          >
            🏆 Leaderboard
          </button>
          <div className="nav-user">
            <span className="nav-avatar">{user?.username?.[0]?.toUpperCase()}</span>
            <span className="nav-username">{user?.username}</span>
          </div>
          <button id="logout-btn" className="nav-btn logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="cat-hero">
        <h1>Choose Your Adventure</h1>
        <p>Help Nemo find his way home by mastering a skill. Pick a solo category or create a multiplayer room!</p>
      </div>

      {/* 1 Domain Per Team Rule Banner */}
      {lockedDomain && (
        <div className="domain-enforced-banner">
          <span className="domain-enforced-icon">🔒</span>
          <div className="domain-enforced-content">
            <div className="domain-enforced-title">1 Team = 1 Field Enforced</div>
            <div className="domain-enforced-desc">
              Your team completed the <strong>{lockedDomain.toUpperCase()}</strong> test. Under competition rules, each team can select only one field and play in that field. Other domains are locked.
            </div>
          </div>
        </div>
      )}

      {/* Multiplayer Callout Banner */}
      <div className="multiplayer-banner">
        <div className="banner-left">
          <span className="banner-icon">🌊</span>
          <div>
            <h3>Want to play with friends?</h3>
            <p>Create a private room, share your code, and race Nemo together in real-time!</p>
          </div>
        </div>
        <button
          id="create-room-banner-btn"
          className="banner-btn"
          onClick={() => navigate('/room')}
        >
          Create / Join Room 🚀
        </button>
      </div>

      {error && (
        <div className="cat-error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Cards */}
      <div className="cat-cards">
        {CATEGORIES.map((cat) => {
          const isAssigned = lockedDomain && lockedDomain === cat.id;
          const isLockedOut = lockedDomain && lockedDomain !== cat.id;

          return (
            <article
              key={cat.id}
              className={`cat-card ${isAssigned ? 'cat-card-assigned' : ''} ${isLockedOut ? 'cat-card-locked' : ''}`}
              style={{ '--glow': cat.glow, '--gradient': cat.gradient, '--color': cat.color }}
            >
              <div className="cat-card-inner">
                <span className="cat-emoji">{cat.emoji}</span>
                <h2>{cat.label}</h2>
                <p className="cat-desc">{cat.description}</p>
                
                {isAssigned ? (
                  <div className="cat-badge badge-assigned">⭐ YOUR ASSIGNED DOMAIN</div>
                ) : isLockedOut ? (
                  <div className="cat-badge badge-locked">🔒 LOCKED (1 FIELD RULE)</div>
                ) : (
                  <div className="cat-badge">30 Questions</div>
                )}

                <button
                  id={`start-${cat.id}-btn`}
                  className={`cat-start-btn ${isAssigned ? 'assigned' : ''} ${isLockedOut ? 'locked' : ''}`}
                  onClick={() => handleStart(cat.id)}
                  disabled={starting !== null || isLockedOut}
                  title={isLockedOut ? `Your team domain is locked to ${lockedDomain.toUpperCase()}` : ''}
                >
                  {starting === cat.id ? (
                    <span className="spinner-sm" />
                  ) : isLockedOut ? (
                    '🔒 Locked'
                  ) : isAssigned ? (
                    'Play Again →'
                  ) : (
                    'Start Quiz →'
                  )}
                </button>
                {isLockedOut && (
                  <div className="cat-lock-subtext">Each team is restricted to 1 field</div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Nemo swimming decoration */}
      <div className="nemo-swim" aria-hidden="true">🐠</div>
    </div>
  );
}
