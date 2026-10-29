/**
 * AuthPage — Login & Register in a tabbed card.
 * Ocean-themed dark glassmorphism UI.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await login(form.username, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      navigate('/categories');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Animated bubbles */}
      <div className="bubbles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="bubble" style={{ '--i': i }} />
        ))}
      </div>

      <div className="auth-card">
        {/* Logo area */}
        <div className="auth-logo">
          <span className="fish-emoji">🐠</span>
          <h1>Dexerity</h1>
          <p className="auth-tagline">Nemo's Quiz Adventure</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-login"
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'active' : ''}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Login
          </button>
          <button
            id="tab-register"
            role="tab"
            aria-selected={tab === 'register'}
            className={tab === 'register' ? 'active' : ''}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              type="text"
              name="username"
              placeholder="e.g. nemo42"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          {tab === 'register' && (
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                name="email"
                placeholder="nemo@ocean.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              name="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              ⚠️ {error}
            </p>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : tab === 'login' ? (
              'Dive In 🌊'
            ) : (
              'Join the Adventure 🐟'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
