/**
 * RoomLobbyPage — Create, Join, select Teams/Solo, and wait in a multiplayer room.
 * Enhanced with collaborative team environments and grouped squad rosters.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI } from '../api';
import { sounds } from '../utils/audio';
import './RoomLobbyPage.css';

const CATEGORIES = [
  { id: 'python', label: 'Python', emoji: '🐍', color: '#00f0ff' },
  { id: 'sql', label: 'SQL', emoji: '🗄️', color: '#10b981' },
  { id: 'excel', label: 'Excel', emoji: '📊', color: '#f59e0b' },
];

export const AVAILABLE_TEAMS = [
  { id: 'Team Clownfish', label: 'Team Clownfish', emoji: '🐠', color: '#ff7b25' },
  { id: 'Team Blue Tang', label: 'Team Blue Tang', emoji: '🐟', color: '#3b82f6' },
  { id: 'Team Sea Turtle', label: 'Team Sea Turtle', emoji: '🐢', color: '#10b981' },
  { id: 'Team Great White', label: 'Team Great White', emoji: '🦈', color: '#94a3b8' },
  { id: 'Team Jellyfish', label: 'Team Jellyfish', emoji: '🪼', color: '#ec4899' },
  { id: 'Solo', label: 'Solo Explorer', emoji: '🤿', color: '#00f0ff' },
];

export default function RoomLobbyPage() {
  const { roomCode: paramCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode: if paramCode exists, we are in the lobby; else in create/join hub
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [selectedCategory, setSelectedCategory] = useState('python');
  const [selectedTeam, setSelectedTeam] = useState('Team Clownfish');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const pollIntervalRef = useRef(null);

  // Poll room status if inside a room
  const fetchRoom = useCallback(async (code) => {
    try {
      const res = await roomAPI.get(code);
      setRoomData(res.data);

      // If game has started, transition immediately to play
      if (res.data.status === 'in_progress') {
        navigate(`/room/play/${code}`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load room.');
    }
  }, [navigate]);

  useEffect(() => {
    if (paramCode) {
      fetchRoom(paramCode);
      pollIntervalRef.current = setInterval(() => fetchRoom(paramCode), 1500);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [paramCode, fetchRoom]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    sounds.playSplash();
    try {
      const res = await roomAPI.create({
        category: selectedCategory,
        total_questions: 30,
        team_name: selectedTeam,
      });
      navigate(`/room/${res.data.room_code}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setLoading(true);
    setError('');
    sounds.playSplash();
    try {
      const res = await roomAPI.join({
        room_code: joinCodeInput.trim().toUpperCase(),
        team_name: selectedTeam,
      });
      navigate(`/room/${res.data.room_code}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Room not found or code invalid.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTeamInLobby = async (teamId) => {
    if (!paramCode) return;
    sounds.playBubble();
    try {
      await roomAPI.setTeam(paramCode, teamId);
      await fetchRoom(paramCode);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update team.');
    }
  };

  const handleStartGame = async () => {
    if (!paramCode || starting) return;
    setStarting(true);
    sounds.playSplash();
    try {
      await roomAPI.start(paramCode);
      navigate(`/room/play/${paramCode}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start quiz.');
      setStarting(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!paramCode) return;
    try {
      await roomAPI.leave(paramCode);
    } catch { /* ignore */ }
    navigate('/categories');
  };

  const handleCopyCode = () => {
    if (!paramCode) return;
    navigator.clipboard.writeText(paramCode);
    sounds.playBubble();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group participants by squad / team
  const groupedSquads = useMemo(() => {
    if (!roomData?.participants) return [];
    const groups = {};
    roomData.participants.forEach((p) => {
      const t = p.team_name || 'Team Clownfish';
      if (!groups[t]) {
        groups[t] = [];
      }
      groups[t].push(p);
    });

    return Object.entries(groups).map(([tname, members]) => {
      const teamDef = AVAILABLE_TEAMS.find((at) => at.id === tname) || {
        id: tname,
        label: tname,
        emoji: '🐠',
        color: '#38bdf8',
      };
      return {
        teamName: tname,
        teamDef,
        members,
      };
    });
  }, [roomData?.participants]);

  // ── Render Lobby View ────────────────────────────────────────────────────────
  if (paramCode && roomData) {
    const isHost = roomData.is_host;
    const cat = CATEGORIES.find((c) => c.id === roomData.category) || CATEGORIES[0];
    const myParticipant = roomData.participants.find((p) => p.user_id === roomData.current_user_id);
    const myCurrentTeam = myParticipant?.team_name || 'Team Clownfish';

    return (
      <div className="room-lobby-page">
        <div className="room-stars-bg" aria-hidden="true" />

        <div className="lobby-container">
          {/* Header */}
          <div className="lobby-header">
            <button className="back-btn" onClick={handleLeaveRoom}>
              ← Leave Room
            </button>
            <div className="room-code-badge" onClick={handleCopyCode} title="Click to copy code">
              <span className="code-label">ROOM CODE:</span>
              <span className="code-value">{roomData.room_code}</span>
              <span className="copy-icon">{copied ? '✓ Copied!' : '📋'}</span>
            </div>
          </div>

          {/* Room Info */}
          <div className="lobby-room-card">
            <div className="room-meta-row">
              <span className="meta-tag cat-tag" style={{ borderColor: cat.color, color: cat.color }}>
                {cat.emoji} {cat.label} Track
              </span>
              <span className="meta-tag q-tag">
                🎯 {roomData.total_questions} Fixed Questions
              </span>
              <span className="meta-tag count-tag">
                👥 {roomData.participants.length} Explorer{roomData.participants.length > 1 ? 's' : ''}
              </span>
            </div>

            <h1 className="lobby-title">The Reef Gathering 🪸</h1>
            <p className="lobby-subtitle">
              Invite friends with room code <strong>{roomData.room_code}</strong>. Teammates swim in the same squad and think together!
            </p>

            {/* Collaborative Rules Banner */}
            <div className="lobby-team-rules-card">
              <div className="rules-icon">🤝</div>
              <div className="rules-content">
                <h3>Cooperative Team Gameplay Enabled</h3>
                <p>
                  Teammates in the same squad <strong>do not compete against each other</strong>. All squad members share questions and think together. <strong>Any teammate can click the option</strong> to submit for the entire squad!
                </p>
                <div className="rules-ranking-note">
                  🏆 <strong>Winner Determination:</strong> Squads are ranked by <strong>1. Max Correct Questions (🎯)</strong> &amp; <strong>2. Fastest Timing (⏱️)</strong>.
                </div>
              </div>
            </div>

            {/* Team Picker in Lobby */}
            <div className="team-picker-section">
              <label className="picker-title">
                Choose Your Squad or Dive Solo:
              </label>
              <div className="team-buttons-row">
                {AVAILABLE_TEAMS.map((t) => {
                  const isSelected = myCurrentTeam === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`team-choice-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => handleChangeTeamInLobby(t.id)}
                      style={{ '--team-color': t.color }}
                    >
                      <span className="team-emoji">{t.emoji}</span>
                      <span className="team-name">{t.label}</span>
                      {isSelected && <span className="team-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <div className="room-err-msg">⚠️ {error}</div>}

            {/* Grouped Squad Cards */}
            <div className="lobby-squads-section">
              <h2 className="squads-title">Reef Squads &amp; Teammates ({groupedSquads.length})</h2>
              <div className="squads-grid">
                {groupedSquads.map(({ teamName, teamDef, members }) => {
                  const isMySquad = teamName === myCurrentTeam;
                  return (
                    <div
                      key={teamName}
                      className={`squad-card ${isMySquad ? 'is-my-squad' : ''}`}
                      style={{ '--squad-color': teamDef.color }}
                    >
                      <div className="squad-header">
                        <span className="squad-emoji">{teamDef.emoji}</span>
                        <div className="squad-title-info">
                          <span className="squad-name">{teamName}</span>
                          <span className="squad-count">{members.length} player{members.length > 1 ? 's' : ''}</span>
                        </div>
                        {isMySquad && <span className="your-squad-tag">Your Squad ⭐</span>}
                      </div>
                      <div className="squad-members-list">
                        {members.map((m) => (
                          <div
                            key={m.user_id}
                            className={`squad-player-badge ${m.user_id === roomData.current_user_id ? 'is-me' : ''}`}
                          >
                            <span className="badge-avatar">{m.username[0]?.toUpperCase()}</span>
                            <span className="badge-name">{m.username}</span>
                            {m.is_host && <span className="host-crown" title="Room Host">👑</span>}
                            {m.user_id === roomData.current_user_id && <span className="you-pill">You</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="lobby-actions">
              {isHost ? (
                <button
                  id="start-room-btn"
                  className="btn-start-race"
                  onClick={handleStartGame}
                  disabled={starting}
                >
                  {starting ? 'Diving in…' : '🚀 Start Multiplayer Race!'}
                </button>
              ) : (
                <div className="waiting-host-card">
                  <span className="fish-float">🐠</span>
                  <span>Waiting for <strong>{roomData.host_username}</strong> to launch the race…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Create / Join Hub ────────────────────────────────────────────────
  return (
    <div className="room-lobby-page">
      <div className="room-stars-bg" aria-hidden="true" />

      <div className="hub-container">
        <button className="back-btn top-back" onClick={() => navigate('/categories')}>
          ← Back to Categories
        </button>

        <div className="hub-card">
          <div className="hub-header">
            <span className="hub-icon">🌊</span>
            <h1>Multiplayer Reef</h1>
            <p>Challenge friends in real time! Play cooperatively in squads or battle team-versus-team.</p>
          </div>

          {/* Tabs: Create vs Join */}
          <div className="hub-tabs">
            <button
              className={`hub-tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => { setActiveTab('create'); setError(''); sounds.playBubble(); }}
            >
              🐠 Create a Room
            </button>
            <button
              className={`hub-tab ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => { setActiveTab('join'); setError(''); sounds.playBubble(); }}
            >
              🔑 Join with Code
            </button>
          </div>

          {error && <div className="room-err-msg">⚠️ {error}</div>}

          {activeTab === 'create' ? (
            <form onSubmit={handleCreateRoom} className="hub-form">
              <div className="form-group">
                <label>Select Category</label>
                <div className="category-options">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cat-opt-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                      onClick={() => { setSelectedCategory(cat.id); sounds.playBubble(); }}
                      style={{ '--accent-c': cat.color }}
                    >
                      <span className="cat-opt-emoji">{cat.emoji}</span>
                      <span className="cat-opt-label">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Questions</label>
                <div className="fixed-questions-banner">
                  <span className="fixed-q-icon">🎯</span>
                  <span className="fixed-q-text">30 Questions (Fixed &amp; Complete Expedition)</span>
                </div>
              </div>

              <div className="form-group">
                <label>Choose Starting Squad</label>
                <div className="team-picker-grid">
                  {AVAILABLE_TEAMS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`team-opt-btn ${selectedTeam === t.id ? 'active' : ''}`}
                      onClick={() => { setSelectedTeam(t.id); sounds.playBubble(); }}
                      style={{ '--t-color': t.color }}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                id="create-room-btn"
                className="btn-primary-hub"
                disabled={loading}
              >
                {loading ? 'Creating Reef…' : 'Create Room & Get Code →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="hub-form">
              <div className="form-group">
                <label htmlFor="join-code">Enter Room Code</label>
                <input
                  id="join-code"
                  type="text"
                  placeholder="e.g. REEF42"
                  maxLength={10}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="code-input"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Join Squad</label>
                <div className="team-picker-grid">
                  {AVAILABLE_TEAMS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`team-opt-btn ${selectedTeam === t.id ? 'active' : ''}`}
                      onClick={() => { setSelectedTeam(t.id); sounds.playBubble(); }}
                      style={{ '--t-color': t.color }}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                id="join-room-btn"
                className="btn-primary-hub"
                disabled={loading || !joinCodeInput.trim()}
              >
                {loading ? 'Joining…' : 'Join Room →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
