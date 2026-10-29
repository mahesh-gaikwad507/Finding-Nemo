import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { quizAPI, adminAPI, userAPI } from '../api';
import { sounds } from '../utils/audio';
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(sounds.isMuted());
  const [lockedDomain, setLockedDomain] = useState(user?.locked_domain || null);
  const [competitionStarted, setCompetitionStarted] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const isAdmin = user?.is_admin || user?.username?.toLowerCase() === 'mahesh123';

  const checkStatus = () => {
    adminAPI.status()
      .then((res) => {
        setCompetitionStarted(res.data.is_game_started);
      })
      .catch(() => {});

    quizAPI.domainStatus()
      .then((res) => {
        if (res.data?.locked_domain) {
          setLockedDomain(res.data.locked_domain);
        }
      })
      .catch(() => {});

    userAPI.profile()
      .then((res) => {
        if (res.data.completed_games > 0) {
          setHasCompleted(true);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    const isM = sounds.toggleMute();
    setMuted(isM);
  };

  const handleStart = async (categoryId) => {
    if (starting) return;

    if (!competitionStarted && !isAdmin) {
      setError('The quiz competition has not started yet. Please wait for Admin (mahesh123) to click Start.');
      return;
    }

    if (hasCompleted && !isAdmin) {
      setError('You have already completed your quiz attempt. Under competition rules, each team is allowed only one attempt.');
      return;
    }

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
          {isAdmin && (
            <button
              id="admin-nav-btn"
              className="nav-btn primary-room"
              onClick={() => { sounds.playBubble(); navigate('/admin'); }}
            >
              👑 Admin Command
            </button>
          )}
          <button
            id="leaderboard-nav-btn"
            className="nav-btn secondary"
            onClick={() => { sounds.playBubble(); navigate('/leaderboard'); }}
          >
            🏆 Leaderboard
          </button>
          <div className="nav-user">
            <span className="nav-avatar">{user?.team_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}</span>
            <span className="nav-username">{user?.team_name || user?.username}</span>
          </div>
          <button id="logout-btn" className="nav-btn logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="cat-hero">
        <h1>Dexerity Quiz Competition</h1>
        <p>
          Team: <strong>{user?.team_name || user?.username}</strong> {user?.leader_name ? `• Leader: ${user.leader_name}` : ''}
        </p>
      </div>

      {/* Competition Status Banner */}
      {!competitionStarted ? (
        <div className="competition-waiting-banner">
          <span className="waiting-pulse-icon">⏳</span>
          <div className="waiting-banner-info">
            <div className="waiting-banner-title">Waiting for Admin (mahesh123) to Start Quiz</div>
            <div className="waiting-banner-desc">
              The competition has not begun yet. Review the domains below. As soon as the host clicks <strong>START</strong>, quiz buttons will automatically activate!
            </div>
          </div>
        </div>
      ) : (
        <div className="competition-live-banner">
          <span className="live-pulse-dot" />
          <span>Competition is <strong>LIVE</strong>! Select your chosen field below to begin.</span>
        </div>
      )}

      {/* Single Attempt Already Completed Banner */}
      {hasCompleted && (
        <div className="domain-enforced-banner completed-banner">
          <span className="domain-enforced-icon">✅</span>
          <div className="domain-enforced-content">
            <div className="domain-enforced-title">Quiz Attempt Completed</div>
            <div className="domain-enforced-desc">
              Your team has officially completed the quiz. In accordance with competition rules, each team can only attempt the test once. Check the Leaderboard to view final rankings!
            </div>
          </div>
        </div>
      )}

      {/* 1 Domain Per Team Rule Banner */}
      {lockedDomain && !hasCompleted && (
        <div className="domain-enforced-banner">
          <span className="domain-enforced-icon">🔒</span>
          <div className="domain-enforced-content">
            <div className="domain-enforced-title">1 Team = 1 Field Enforced</div>
            <div className="domain-enforced-desc">
              Your team is registered for <strong>{lockedDomain.toUpperCase()}</strong>. Each team can select only one field and play in that field. Other domains are locked.
            </div>
          </div>
        </div>
      )}

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
          const isButtonDisabled = starting !== null || isLockedOut || hasCompleted || (!competitionStarted && !isAdmin);

          return (
            <article
              key={cat.id}
              className={`cat-card ${isAssigned ? 'cat-card-assigned' : ''} ${isLockedOut || hasCompleted ? 'cat-card-locked' : ''}`}
              style={{ '--glow': cat.glow, '--gradient': cat.gradient, '--color': cat.color }}
            >
              <div className="cat-card-inner">
                <span className="cat-emoji">{cat.emoji}</span>
                <h2>{cat.label}</h2>
                <p className="cat-desc">{cat.description}</p>
                
                {hasCompleted ? (
                  <div className="cat-badge badge-locked">✅ COMPLETED (1 ATTEMPT RULE)</div>
                ) : isAssigned ? (
                  <div className="cat-badge badge-assigned">⭐ YOUR ASSIGNED DOMAIN</div>
                ) : isLockedOut ? (
                  <div className="cat-badge badge-locked">🔒 LOCKED (1 FIELD RULE)</div>
                ) : (
                  <div className="cat-badge">30 Questions</div>
                )}

                <button
                  id={`start-${cat.id}-btn`}
                  className={`cat-start-btn ${isAssigned ? 'assigned' : ''} ${isLockedOut || hasCompleted || !competitionStarted ? 'locked' : ''}`}
                  onClick={() => handleStart(cat.id)}
                  disabled={isButtonDisabled}
                  title={
                    hasCompleted
                      ? 'You have already submitted your attempt.'
                      : !competitionStarted
                      ? 'Waiting for Admin (mahesh123) to start the quiz.'
                      : isLockedOut
                      ? `Your team domain is locked to ${lockedDomain.toUpperCase()}`
                      : ''
                  }
                >
                  {starting === cat.id ? (
                    <span className="spinner-sm" />
                  ) : hasCompleted ? (
                    '✅ Attempt Finished'
                  ) : !competitionStarted ? (
                    '⏳ Waiting for Start'
                  ) : isLockedOut ? (
                    '🔒 Locked'
                  ) : (
                    'Start Quiz →'
                  )}
                </button>
                {hasCompleted ? (
                  <div className="cat-lock-subtext">Each team is allowed only 1 attempt</div>
                ) : isLockedOut ? (
                  <div className="cat-lock-subtext">Each team is restricted to 1 field</div>
                ) : !competitionStarted ? (
                  <div className="cat-lock-subtext">Host will launch shortly</div>
                ) : null}
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

