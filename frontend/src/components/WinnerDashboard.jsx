import { useState, useMemo } from 'react';
import './WinnerDashboard.css';

const FISH_ICONS = ['🐠', '🐡', '🐟', '🐙', '🐬', '🦈'];

export function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '—';
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
}

export function formatSpeed(seconds, answeredCount) {
  if (!seconds || !answeredCount || answeredCount <= 0) return '—';
  const perQ = (seconds / answeredCount).toFixed(1);
  return `${perQ}s / Q`;
}

/**
 * WinnerDashboard — Comprehensive winner screen decided on the basis of:
 * 1. More number of questions answered correctly (Primary)
 * 2. Quick answering / timing (Secondary speed factor)
 *
 * Displays timing and number of corrected questions for both Teams and Solo members.
 */
export default function WinnerDashboard({
  participants = [],
  teamsSummary = [],
  totalQuestions = 30,
  currentUserId = null,
  currentUsername = '',
  category = 'python',
  onPlayAgain,
  onBackHome,
  isRoom = true,
  isAdmin = false,
}) {
  // Sort participants by:
  // 1. More number of questions answered correctly (DESC)
  // 2. Quick answering / timing (ASC, lowest seconds)
  // 3. Score (DESC)
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // 1. More correct questions
      const correctDiff = (b.correct_answers || 0) - (a.correct_answers || 0);
      if (correctDiff !== 0) return correctDiff;

      // 2. Quick answering / timing (fastest time wins)
      const timeA = a.total_time_seconds || 999999;
      const timeB = b.total_time_seconds || 999999;
      if (timeA !== timeB) return timeA - timeB;

      // 3. Score
      return (b.score || 0) - (a.score || 0);
    });
  }, [participants]);

  // Sort teams strictly:
  // 1. Highest correct questions (DESC)
  // 2. Fastest total timing (ASC)
  // 3. Score (DESC)
  const sortedTeams = useMemo(() => {
    if (!teamsSummary || teamsSummary.length === 0) {
      // Build from participants if not provided
      const dict = {};
      participants.forEach((p) => {
        const tname = p.team_name || 'Solo';
        if (!dict[tname]) {
          dict[tname] = {
            team_name: tname,
            members_count: 0,
            correct_answers: 0,
            total_correct: 0,
            wrong_answers: 0,
            total_wrong: 0,
            total_time_seconds: 0,
            score: 0,
            total_score: 0,
            members: [],
          };
        }
        dict[tname].members_count += 1;
        dict[tname].correct_answers = Math.max(dict[tname].correct_answers, p.correct_answers || 0);
        dict[tname].total_correct = dict[tname].correct_answers;
        dict[tname].wrong_answers = Math.max(dict[tname].wrong_answers, p.wrong_answers || 0);
        dict[tname].total_wrong = dict[tname].wrong_answers;
        dict[tname].total_time_seconds = Math.max(dict[tname].total_time_seconds, p.total_time_seconds || 0);
        dict[tname].score = Math.max(dict[tname].score, p.score || 0);
        dict[tname].total_score = dict[tname].score;
        if (!dict[tname].members.includes(p.username)) {
          dict[tname].members.push(p.username);
        }
      });

      const list = Object.values(dict).map((t) => {
        const totalAns = (t.correct_answers || 0) + (t.wrong_answers || 0);
        return {
          ...t,
          accuracy: totalAns > 0 ? Math.round((t.correct_answers / totalAns) * 100) : 0,
        };
      });

      return list.sort((a, b) => {
        const corrA = a.correct_answers ?? a.total_correct ?? 0;
        const corrB = b.correct_answers ?? b.total_correct ?? 0;
        if (corrB !== corrA) return corrB - corrA;

        const timeA = a.total_time_seconds || 999999;
        const timeB = b.total_time_seconds || 999999;
        if (timeA !== timeB) return timeA - timeB;

        return (b.score ?? b.total_score ?? 0) - (a.score ?? a.total_score ?? 0);
      });
    }

    return [...teamsSummary].sort((a, b) => {
      const corrA = a.correct_answers ?? a.total_correct ?? a.avg_correct ?? 0;
      const corrB = b.correct_answers ?? b.total_correct ?? b.avg_correct ?? 0;
      if (corrB !== corrA) return corrB - corrA;

      const timeA = a.total_time_seconds || 999999;
      const timeB = b.total_time_seconds || 999999;
      if (timeA !== timeB) return timeA - timeB;

      return (b.score ?? b.total_score ?? 0) - (a.score ?? a.total_score ?? 0);
    });
  }, [participants, teamsSummary]);

  // Check if any team exists that isn't just "Solo"
  const hasTeams = useMemo(() => {
    return sortedTeams.some((t) => t.team_name && t.team_name.toLowerCase() !== 'solo');
  }, [sortedTeams]);

  const [activeTab, setActiveTab] = useState(hasTeams ? 'teams' : 'solo');

  const winner = sortedParticipants[0];
  const winningTeam = sortedTeams[0];

  // Active champion stats depending on whether we view teams or solo
  const activeChampion = activeTab === 'teams' && hasTeams ? winningTeam : winner;
  const activeCorrect = activeChampion?.correct_answers ?? activeChampion?.total_correct ?? 0;
  const activeTime = activeChampion?.total_time_seconds ?? 0;
  const activeWrong = activeChampion?.wrong_answers ?? activeChampion?.total_wrong ?? 0;
  const activeScore = activeChampion?.score ?? activeChampion?.total_score ?? 0;

  return (
    <div className="winner-dashboard-card">
      {isAdmin && (
        <div className="admin-status-strip">
          <span className="admin-status-icon">👑</span>
          <span><strong>Administrator Decision View:</strong> Full performance rankings of all users &amp; teams displayed exclusively to Admin.</span>
        </div>
      )}

      {/* Criteria Header Badge */}
      <div className="winner-criteria-pill">
        <span className="criteria-icon">⚖️</span>
        <span className="criteria-text">
          Standings Decided By: <strong>1. Max Correct Questions (🎯)</strong> &amp; <strong>2. Fastest Timing (⏱️)</strong>
        </span>
      </div>

      {/* Hero Grand Winner Banner */}
      <div className="winner-hero">
        <div className="crown-shimmer">👑</div>
        <div className="winner-headline">
          {hasTeams && activeTab === 'teams' ? (
            <>
              <h2 className="winner-team-title">🏆 Champion Team: {winningTeam?.team_name}</h2>
              <p className="winner-sub">
                Dominated the reef with <strong>{activeCorrect}/{totalQuestions} Correct Questions</strong> in{' '}
                <strong>{formatTime(activeTime)}</strong>! (Teammates: {winningTeam?.members?.join(', ')})
              </p>
            </>
          ) : (
            <>
              <h2 className="winner-solo-title">🏆 Grand Winner: {winner?.username}</h2>
              <p className="winner-sub">
                Fastest &amp; sharpest diver with <strong>{winner?.correct_answers}/{totalQuestions} Correct Questions</strong> in{' '}
                <strong>{formatTime(winner?.total_time_seconds)}</strong>!
              </p>
            </>
          )}
        </div>

        {/* Winner Highlight Stat Badges */}
        <div className="winner-stat-strip">
          <div className="stat-pill highlight-green">
            <span className="stat-pill-icon">🎯</span>
            <div className="stat-pill-content">
              <span className="stat-pill-val">
                {activeCorrect} / {totalQuestions}
              </span>
              <span className="stat-pill-lbl">Correct Questions</span>
            </div>
          </div>

          <div className="stat-pill highlight-cyan">
            <span className="stat-pill-icon">⏱️</span>
            <div className="stat-pill-content">
              <span className="stat-pill-val">
                {formatTime(activeTime)}
              </span>
              <span className="stat-pill-lbl">Total Timing</span>
            </div>
          </div>

          <div className="stat-pill highlight-gold">
            <span className="stat-pill-icon">⚡</span>
            <div className="stat-pill-content">
              <span className="stat-pill-val">
                {formatSpeed(activeTime, activeCorrect + activeWrong)}
              </span>
              <span className="stat-pill-lbl">Speed Rate</span>
            </div>
          </div>

          <div className="stat-pill highlight-purple">
            <span className="stat-pill-icon">⭐</span>
            <div className="stat-pill-content">
              <span className="stat-pill-val">{activeScore} pts</span>
              <span className="stat-pill-lbl">Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium (Visual Stage for Teams or Solo) */}
      {hasTeams && activeTab === 'teams' ? (
        sortedTeams.length > 1 && (
          <div className="podium-stage">
            {sortedTeams[1] && (
              <div className="podium-col rank-2">
                <div className="podium-avatar">
                  🥈 {sortedTeams[1].team_name}
                  <span className="avatar-team-tag">{sortedTeams[1].members?.join(', ')}</span>
                </div>
                <div className="podium-pillar pillar-2">
                  <span className="pillar-rank">2nd Place</span>
                  <span className="pillar-detail">🎯 {sortedTeams[1].correct_answers ?? sortedTeams[1].total_correct ?? 0} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(sortedTeams[1].total_time_seconds)}</span>
                  <span className="pillar-score">{sortedTeams[1].score ?? sortedTeams[1].total_score ?? 0} pts</span>
                </div>
              </div>
            )}

            {winningTeam && (
              <div className="podium-col rank-1">
                <div className="podium-avatar gold">
                  🥇 {winningTeam.team_name}
                  <span className="avatar-team-tag">{winningTeam.members?.join(', ')}</span>
                </div>
                <div className="podium-pillar pillar-1">
                  <span className="pillar-rank">1st Champion</span>
                  <span className="pillar-detail">🎯 {winningTeam.correct_answers ?? winningTeam.total_correct ?? 0} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(winningTeam.total_time_seconds)}</span>
                  <span className="pillar-score">{winningTeam.score ?? winningTeam.total_score ?? 0} pts</span>
                </div>
              </div>
            )}

            {sortedTeams[2] && (
              <div className="podium-col rank-3">
                <div className="podium-avatar">
                  🥉 {sortedTeams[2].team_name}
                  <span className="avatar-team-tag">{sortedTeams[2].members?.join(', ')}</span>
                </div>
                <div className="podium-pillar pillar-3">
                  <span className="pillar-rank">3rd Place</span>
                  <span className="pillar-detail">🎯 {sortedTeams[2].correct_answers ?? sortedTeams[2].total_correct ?? 0} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(sortedTeams[2].total_time_seconds)}</span>
                  <span className="pillar-score">{sortedTeams[2].score ?? sortedTeams[2].total_score ?? 0} pts</span>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        sortedParticipants.length > 1 && (
          <div className="podium-stage">
            {sortedParticipants[1] && (
              <div className="podium-col rank-2">
                <div className="podium-avatar">
                  🥈 {sortedParticipants[1].username}
                  <span className="avatar-team-tag">{sortedParticipants[1].team_name || 'Solo'}</span>
                </div>
                <div className="podium-pillar pillar-2">
                  <span className="pillar-rank">2nd</span>
                  <span className="pillar-detail">🎯 {sortedParticipants[1].correct_answers} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(sortedParticipants[1].total_time_seconds)}</span>
                  <span className="pillar-score">{sortedParticipants[1].score} pts</span>
                </div>
              </div>
            )}

            {winner && (
              <div className="podium-col rank-1">
                <div className="podium-avatar gold">
                  🥇 {winner.username}
                  <span className="avatar-team-tag">{winner.team_name || 'Solo'}</span>
                </div>
                <div className="podium-pillar pillar-1">
                  <span className="pillar-rank">1st Winner</span>
                  <span className="pillar-detail">🎯 {winner.correct_answers} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(winner.total_time_seconds)}</span>
                  <span className="pillar-score">{winner.score} pts</span>
                </div>
              </div>
            )}

            {sortedParticipants[2] && (
              <div className="podium-col rank-3">
                <div className="podium-avatar">
                  🥉 {sortedParticipants[2].username}
                  <span className="avatar-team-tag">{sortedParticipants[2].team_name || 'Solo'}</span>
                </div>
                <div className="podium-pillar pillar-3">
                  <span className="pillar-rank">3rd</span>
                  <span className="pillar-detail">🎯 {sortedParticipants[2].correct_answers} Correct</span>
                  <span className="pillar-time">⏱️ {formatTime(sortedParticipants[2].total_time_seconds)}</span>
                  <span className="pillar-score">{sortedParticipants[2].score} pts</span>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Standings View Switcher Tabs (Solo vs Teams) */}
      <div className="winner-tabs-row">
        {hasTeams && (
          <button
            className={`winner-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            👥 Team Standings ({sortedTeams.length})
          </button>
        )}
        <button
          className={`winner-tab-btn ${activeTab === 'solo' ? 'active' : ''}`}
          onClick={() => setActiveTab('solo')}
        >
          👤 Explorers Breakdown ({sortedParticipants.length})
        </button>
      </div>

      {/* Standings Table */}
      <div className="standings-table-wrap">
        {activeTab === 'teams' ? (
          <table className="classy-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Team</th>
                <th>Teammates</th>
                <th>🎯 Correct Questions</th>
                <th>⏱️ Total Timing</th>
                <th>⚡ Speed (Per Q)</th>
                <th>Team Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, idx) => {
                const isChampion = idx === 0;
                const correct = team.correct_answers ?? team.total_correct ?? 0;
                const wrong = team.wrong_answers ?? team.total_wrong ?? 0;
                const totalAns = correct + wrong;
                const teamTime = team.total_time_seconds || 0;
                const score = team.score ?? team.total_score ?? 0;

                return (
                  <tr key={team.team_name} className={`table-row ${isChampion ? 'champion-row' : ''}`}>
                    <td className="rank-cell">
                      {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                    </td>
                    <td className="team-name-cell">
                      <strong>{team.team_name}</strong>
                      {isChampion && <span className="winner-chip">Champion</span>}
                    </td>
                    <td className="members-cell">
                      <span className="members-count-tag">{team.members_count || team.members?.length || 1} player{(team.members_count || team.members?.length) > 1 ? 's' : ''}</span>
                      <span className="members-list">({team.members?.join(', ')})</span>
                    </td>
                    <td className="correct-cell">
                      <span className="badge-correct-lg">{correct} / {totalQuestions}</span>
                      <span className="correct-percent">({Math.round((correct / totalQuestions) * 100)}%)</span>
                    </td>
                    <td className="time-cell">
                      <span className="badge-time-lg">⏱️ {formatTime(teamTime)}</span>
                    </td>
                    <td className="speed-cell">
                      <span className="badge-speed">{formatSpeed(teamTime, totalAns)}</span>
                    </td>
                    <td className="score-cell">{score} pts</td>
                    <td className="acc-cell">{team.accuracy}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="classy-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Explorer</th>
                <th>Team</th>
                <th>🎯 Correct Questions</th>
                <th>⏱️ Timing</th>
                <th>Speed (Per Q)</th>
                <th>Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {sortedParticipants.map((p, idx) => {
                const totalAns = (p.correct_answers || 0) + (p.wrong_answers || 0);
                const acc = totalAns > 0 ? Math.round(((p.correct_answers || 0) / totalAns) * 100) : 0;
                const isMe =
                  (currentUserId && p.user_id === currentUserId) ||
                  (currentUsername && p.username === currentUsername);
                const isWinner = idx === 0;

                return (
                  <tr key={p.user_id || p.username} className={`table-row ${isWinner ? 'champion-row' : ''} ${isMe ? 'is-me-row' : ''}`}>
                    <td className="rank-cell">
                      {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                    </td>
                    <td className="player-col-cell">
                      <span className="player-fish">{FISH_ICONS[idx % FISH_ICONS.length]}</span>
                      <span className="player-name">
                        {p.username} {isMe && <span className="me-chip">You</span>}
                      </span>
                    </td>
                    <td className="team-col-cell">
                      <span className="team-badge-tag">{p.team_name || 'Solo Member'}</span>
                    </td>
                    <td className="correct-cell">
                      <span className="badge-correct-lg">{p.correct_answers}/{totalQuestions}</span>
                      <span className="correct-percent">
                        ({Math.round(((p.correct_answers || 0) / totalQuestions) * 100)}%)
                      </span>
                    </td>
                    <td className="time-cell">
                      <span className="badge-time-lg">⏱️ {formatTime(p.total_time_seconds)}</span>
                    </td>
                    <td className="speed-cell">
                      <span className="badge-speed">{formatSpeed(p.total_time_seconds, totalAns)}</span>
                    </td>
                    <td className="score-cell">{p.score} pts</td>
                    <td className="acc-cell">{acc}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Action Buttons */}
      <div className="dashboard-actions">
        {onBackHome && (
          <button className="btn-action btn-secondary" onClick={onBackHome}>
            ← Categories
          </button>
        )}
        {onPlayAgain && (
          <button className="btn-action btn-primary" onClick={onPlayAgain}>
            {isRoom ? 'Re-enter Room Lobby 🔄' : 'Play Another Adventure 🔄'}
          </button>
        )}
      </div>
    </div>
  );
}
