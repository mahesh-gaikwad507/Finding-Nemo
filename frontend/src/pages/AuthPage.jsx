/**
 * AuthPage — Login & Register in a tabbed card.
 * Ocean-themed dark glassmorphism UI.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function AuthPage() {
  const [tab, setTab] = useState('register'); // 'login' | 'register' | 'admin'
  const [form, setForm] = useState({
    team_name: '',
    leader_name: '',
    phone_number: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setError('');
    if (newTab === 'admin') {
      setForm((prev) => ({ ...prev, username: prev.username || 'mahesh123', password: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (tab === 'admin') {
        const adminUser = form.username.trim() || 'mahesh123';
        const res = await login({ username: adminUser, password: form.password });
        navigate('/admin');
        return;
      }

      if (tab === 'login') {
        const query = (form.team_name || form.username || form.phone_number || '').trim();
        if (!query) {
          setError('Please enter your Team Name or Phone Number.');
          setLoading(false);
          return;
        }
        const res = await login({ username: query, password: form.password });
        if (res.user?.is_admin || res.user?.username?.toLowerCase() === 'mahesh123') {
          navigate('/admin');
        } else {
          navigate('/categories');
        }
      } else {
        // Register team
        if (!form.team_name.trim() || !form.leader_name.trim() || !form.phone_number.trim()) {
          setError('Please fill in Team Name, Leader Name, and Phone Number.');
          setLoading(false);
          return;
        }

        const res = await register({
          team_name: form.team_name.trim(),
          leader_name: form.leader_name.trim(),
          phone_number: form.phone_number.trim(),
          password: form.password,
        });

        if (res.user?.is_admin || res.user?.username?.toLowerCase() === 'mahesh123') {
          navigate('/admin');
        } else {
          navigate('/categories');
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify your details.');
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
          <p className="auth-tagline">Finding Nemo Quiz Competition</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-register"
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={tab === 'register' ? 'active' : ''}
            onClick={() => handleTabChange('register')}
          >
            Team Register
          </button>
          <button
            id="tab-login"
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'active' : ''}
            onClick={() => handleTabChange('login')}
          >
            Team Login
          </button>
          <button
            id="tab-admin"
            type="button"
            role="tab"
            aria-selected={tab === 'admin'}
            className={`admin-tab-btn ${tab === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabChange('admin')}
          >
            👑 Admin
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {tab === 'register' && (
            <>
              <div className="field">
                <label htmlFor="auth-team-name">Team Name</label>
                <input
                  id="auth-team-name"
                  type="text"
                  name="team_name"
                  placeholder="e.g. Team Sharks"
                  value={form.team_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="auth-leader-name">Leader Name</label>
                <input
                  id="auth-leader-name"
                  type="text"
                  name="leader_name"
                  placeholder="e.g. Mahesh Gaikwad"
                  value={form.leader_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="auth-phone">Phone Number</label>
                <input
                  id="auth-phone"
                  type="tel"
                  name="phone_number"
                  placeholder="e.g. 9876543210"
                  value={form.phone_number}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          {tab === 'login' && (
            <div className="field">
              <label htmlFor="auth-identifier">Team Name or Phone No.</label>
              <input
                id="auth-identifier"
                type="text"
                name="team_name"
                placeholder="Enter your registered team or phone"
                value={form.team_name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          {tab === 'admin' && (
            <>
              <div className="admin-notice-pill">
                <span>👑 Host Portal (Competition Launch & Excel Records)</span>
              </div>
              <div className="field">
                <label htmlFor="admin-username">Admin Username</label>
                <input
                  id="admin-username"
                  type="text"
                  name="username"
                  placeholder="mahesh123"
                  value={form.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="auth-password">
              {tab === 'admin' ? 'Admin Password' : 'Password'}
            </label>
            <input
              id="auth-password"
              type="password"
              name="password"
              placeholder={tab === 'admin' ? 'Enter admin password' : 'Create / enter password'}
              value={form.password}
              onChange={handleChange}
              required
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
            className={`auth-submit ${tab === 'admin' ? 'admin-submit' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : tab === 'admin' ? (
              'Access Admin Dashboard 👑'
            ) : tab === 'login' ? (
              'Dive In 🌊'
            ) : (
              'Register Team & Join 🐟'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
