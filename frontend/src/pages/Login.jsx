import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { setLoggedIn } = useAuth();
  const from = location.state?.from?.pathname || '/log';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    api
      .post('/auth/login/', form)
      .then((res) => {
        localStorage.setItem('token', res.data.access);
        setLoggedIn();
        navigate(from, { replace: true });
      })
      .catch((err) => setError(err.response?.data?.detail || 'Login failed'));
  };

  return (
    <div className="page auth-layout login-page">
      <div className="auth-container">
        <div className="logo-block">
          <span className="logo">SCOUT<span className="logo-dot">.</span></span>
          <p className="tagline">Log it. Map it. Act on it.</p>
        </div>
        <div className="auth-card">
          <form onSubmit={handleSubmit}>
            <div className="card-label">Sign in</div>
            {error && <p className="error-msg">{error}</p>}
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@yourbrand.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-auth-primary">Sign in →</button>
            <div className="auth-divider"><span>or</span></div>
            <div className="auth-secondary">
              <Link to="/register" className="btn-auth-secondary">
                <span className="btn-label">New to Scout?</span>
                Register your brand
              </Link>
              <Link to="/join" className="btn-auth-secondary">
                <span className="btn-label">Got an invite code?</span>
                Join your team
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
