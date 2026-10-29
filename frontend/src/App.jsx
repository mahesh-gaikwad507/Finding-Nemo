/**
 * App.jsx — routing root for Dexerity: Finding Nemo Quiz Adventure.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import CategoryPage from './pages/CategoryPage';
import QuizPage from './pages/QuizPage';
import ResultPage from './pages/ResultPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminDashboard from './pages/AdminDashboard';
import OceanBackground from './components/OceanBackground';
import { sounds } from './utils/audio';

/** Route that redirects to /auth if the user is not logged in. */
function Protected({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          fontSize: '48px',
        }}
      >
        <span className="ocean-spin">🐠</span>
      </div>
    );
  }

  return user ? children : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Protected */}
      <Route path="/categories" element={<Protected><CategoryPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
      <Route path="/quiz/:attemptId" element={<Protected><QuizPage /></Protected>} />
      <Route path="/result/:attemptId" element={<Protected><ResultPage /></Protected>} />
      <Route path="/leaderboard" element={<Protected><LeaderboardPage /></Protected>} />

      {/* Room features removed per requirements: redirect to categories */}
      <Route path="/room" element={<Navigate to="/categories" replace />} />
      <Route path="/room/*" element={<Navigate to="/categories" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default function App() {
  const [muted, setMuted] = useState(sounds.isMuted());

  useEffect(() => {
    // Attach automatic audio sound to every click across the entire app
    sounds.attachGlobalClickListener();
  }, []);

  const toggleSound = () => {
    const isM = sounds.toggleMute();
    setMuted(isM);
  };

  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Classy animated underwater aquatic life & fish in background */}
        <OceanBackground />

        {/* Global floating audio toggle for easy sound control */}
        <button
          className="global-sound-bubble"
          onClick={toggleSound}
          title={muted ? 'Enable aquatic sounds' : 'Mute sounds'}
          aria-label="Toggle sound effects"
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
