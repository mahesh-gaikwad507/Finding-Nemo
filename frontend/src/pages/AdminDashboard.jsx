/**
 * AdminDashboard.jsx — Official Host Command Center for mahesh123.
 * Features:
 * 1. Global Competition Start button (begins game for all teams).
 * 2. Real-time live scoreboard of all registered teams with phone number, leader name, and score.
 * 3. Direct Excel sheet download (.xlsx) using openpyxl backend.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../api';
import { sounds } from '../utils/audio';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [statusData, setStatusData] = useState({
    is_game_started: false,
    started_at: null,
    total_teams: 0,
    completed_teams: 0,
  });
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const pollRef = useRef(null);

  const fetchAdminData = async () => {
    try {
      const [statusRes, teamsRes] = await Promise.all([
        adminAPI.status(),
        adminAPI.getTeams(),
      ]);
      setStatusData(statusRes.data);
      setTeams(teamsRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to refresh admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    pollRef.current = setInterval(fetchAdminData, 2500);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleStartGame = async () => {
    setActionLoading(true);
    setError('');
    sounds.playVictory();
    try {
      await adminAPI.startGame();
      setSuccessMsg('🚀 Competition Started! All teams can now enter and take their quiz.');
      await fetchAdminData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start competition.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetGame = async () => {
    if (!window.confirm('Are you sure you want to pause/reset the competition to waiting mode?')) return;
    setActionLoading(true);
    sounds.playBubble();
    try {
      await adminAPI.resetGame();
      setSuccessMsg('Competition paused. Teams will wait until you click Start again.');
      await fetchAdminData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset competition.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    sounds.playBubble();
    try {
      const res = await adminAPI.downloadExcel();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Techflix_Competition_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleClearTeams = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: Are you sure you want to clear ALL registered teams and reset their test history?\n\nThis will remove all participant accounts, scores, and quiz attempts so you can start a completely fresh competition. This action cannot be undone!'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    sounds.playBubble();
    try {
      const res = await adminAPI.clearTeams();
      setSuccessMsg(res.data.message || 'All registered teams and history successfully cleared!');
      await fetchAdminData();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear teams.');
    } finally {
      setActionLoading(false);
    }
  };

  const topScore = teams.length > 0 ? Math.max(...teams.map((t) => t.score || 0)) : 0;
  const inProgressCount = teams.filter((t) => t.status.includes('In Progress')).length;

  return (
    <div className="admin-page">
      {/* Top Navbar */}
      <nav className="admin-nav">
        <div className="admin-nav-brand">
          <span>👑</span>
          <div>
            <span className="brand-title">Techflix Admin</span>
            <span className="brand-subtitle">Host Command Center</span>
          </div>
        </div>

        <div className="admin-nav-right">
          <div className="admin-user-pill">
            <span className="admin-badge-icon">🛡️</span>
            <span>Organizer: <strong>{user?.username}</strong></span>
          </div>
          <button
            id="admin-logout-btn"
            className="btn-admin-logout"
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="admin-container">
        {/* Alerts */}
        {error && <div className="admin-alert error">⚠️ {error}</div>}
        {successMsg && <div className="admin-alert success">✅ {successMsg}</div>}

        {/* Competition Control Banner */}
        <section className="admin-control-card">
          <div className="control-left">
            <div className={`status-orb ${statusData.is_game_started ? 'live' : 'waiting'}`} />
            <div>
              <h2>
                {statusData.is_game_started
                  ? '🟢 Competition is LIVE'
                  : '🟡 Competition Status: WAITING FOR START'}
              </h2>
              <p>
                {statusData.is_game_started
                  ? 'All registered teams can currently take their test. Scores update in real time below.'
                  : 'Participants are on the waiting screen. Click START to begin the test for all teams simultaneously!'}
              </p>
            </div>
          </div>

          <div className="control-actions">
            {!statusData.is_game_started ? (
              <button
                id="admin-start-comp-btn"
                className="btn-start-competition"
                onClick={handleStartGame}
                disabled={actionLoading}
              >
                {actionLoading ? 'Launching…' : '🚀 START COMPETITION NOW'}
              </button>
            ) : (
              <button
                id="admin-pause-comp-btn"
                className="btn-pause-competition"
                onClick={handleResetGame}
                disabled={actionLoading}
              >
                {actionLoading ? 'Updating…' : '⏸️ Pause Competition'}
              </button>
            )}

            <button
              id="admin-download-excel-btn"
              className="btn-download-excel"
              onClick={handleDownloadExcel}
              disabled={downloading}
            >
              {downloading ? 'Preparing Excel…' : '📥 Download Excel Sheet (.xlsx)'}
            </button>

            <button
              id="admin-clear-teams-btn"
              className="btn-clear-teams"
              onClick={handleClearTeams}
              disabled={actionLoading}
              title="Delete all previously registered teams and history for a fresh tournament"
            >
              {actionLoading ? 'Clearing…' : '🗑️ Clear All Registered Teams'}
            </button>
          </div>
        </section>

        {/* Stats Summary Cards */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <span className="stat-label">Registered Teams</span>
              <span className="stat-val">{statusData.total_teams}</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-label">Tests Completed</span>
              <span className="stat-val">{statusData.completed_teams}</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <span className="stat-label">Currently Playing</span>
              <span className="stat-val">{inProgressCount}</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <span className="stat-label">Top Score</span>
              <span className="stat-val">{topScore} pts</span>
            </div>
          </div>
        </div>

        {/* Teams Table */}
        <section className="admin-table-card">
          <div className="table-header-row">
            <div>
              <h3>📋 Live Registered Teams &amp; Scorecards</h3>
              <p>Real-time records. Click &quot;Download Excel Sheet&quot; to export complete records anytime.</p>
            </div>
            <button
              className="btn-refresh-manual"
              onClick={fetchAdminData}
              title="Refresh records"
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div className="admin-loading">
              <span className="ocean-spin">🐠</span>
              <p>Loading registered teams…</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="admin-empty-state">
              <span>🌊</span>
              <p>No teams have registered yet. Share the competition link with participants to begin!</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="admin-teams-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team Name</th>
                    <th>Leader Name</th>
                    <th>Phone Number</th>
                    <th>Domain</th>
                    <th>Score</th>
                    <th>Correct</th>
                    <th>Mistakes</th>
                    <th>Time</th>
                    <th>Speed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.user_id} className={t.status === 'Completed' ? 'row-completed' : ''}>
                      <td className="cell-rank">
                        {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : `#${t.rank}`}
                      </td>
                      <td className="cell-team">
                        <strong>{t.team_name}</strong>
                      </td>
                      <td>{t.leader_name}</td>
                      <td className="cell-phone">{t.phone_number}</td>
                      <td>
                        <span className={`domain-tag ${t.domain.toLowerCase()}`}>
                          {t.domain}
                        </span>
                      </td>
                      <td className="cell-score">
                        <strong>{t.score}</strong> pts
                      </td>
                      <td className="cell-correct">{t.correct_answers} / 30</td>
                      <td className="cell-wrong">{t.wrong_answers}</td>
                      <td className="cell-time">{t.time_formatted}</td>
                      <td>{t.answering_speed}</td>
                      <td>
                        <span className={`status-pill ${t.status === 'Completed' ? 'done' : t.status.includes('Progress') ? 'active' : 'pending'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
