import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Join() {
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const navigate = useNavigate();
  const { setLoggedIn } = useAuth();

  const validateCode = () => {
    if (!code.trim()) return;
    setValidating(true);
    setError('');
    api
      .get(`/auth/validate-code/?code=${encodeURIComponent(code.trim().toUpperCase())}`)
      .then((res) => {
        if (res.data.valid) {
          setTeamName(res.data.brand_name || 'your team');
          setStep('form');
        } else {
          setError('Invalid or expired code. Check the code and try again.');
        }
      })
      .catch((err) => {
        const msg = err.response?.status === 401
          ? 'Invalid or expired code. Check the code and try again.'
          : (err.response?.data?.detail || 'Invalid code. Please try again.');
        setError(msg);
      })
      .finally(() => setValidating(false));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const [first_name, ...lastParts] = (form.name || '').trim().split(/\s+/);
    const last_name = lastParts.join(' ') || '';
    api
      .post('/auth/register-member/', {
        code: code.trim().toUpperCase(),
        first_name: first_name || form.name,
        last_name,
        email: form.email,
        password: form.password,
      })
      .then((res) => {
        localStorage.setItem('token', res.data.token);
        setLoggedIn();
        navigate('/log');
      })
      .catch((err) => {
        const d = err.response?.data;
        const msg = d?.detail || (typeof d === 'object' && Object.values(d).flat().find(Boolean)) || 'Registration failed';
        setError(typeof msg === 'string' ? msg : 'Registration failed');
      });
  };

  if (step === 'form') {
    return (
      <div className="page auth-layout join-page">
        <div className="auth-container">
          <div className="logo-block">
            <span className="logo">SCOUT<span className="logo-dot">.</span></span>
            <p className="tagline">Log it. Map it. Act on it.</p>
          </div>
          <div className="auth-card">
            <form onSubmit={handleSubmit}>
              <h2 className="join-team-title">Join {teamName}</h2>
              <p className="join-confirm">Enter your details to join the team.</p>
              {error && <p className="error-msg join-error-msg">{error}</p>}
              <div className="auth-field">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
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
              <div className="auth-field">
                <label>Confirm password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-auth-primary">Join team →</button>
              <button type="button" className="btn-auth-secondary" onClick={() => { setStep('code'); setError(''); }} style={{ marginTop: 8 }}>
                Back
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-layout join-page">
      <div className="auth-container">
        <div className="logo-block">
          <span className="logo">SCOUT<span className="logo-dot">.</span></span>
          <p className="tagline">Log it. Map it. Act on it.</p>
        </div>
        <div className="auth-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              validateCode();
            }}
          >
            <div className="card-label">Join your team</div>
            {error && <p className="error-msg join-error-msg">{error}</p>}
            <div className="auth-field">
              <label>Company code</label>
              <input
                type="text"
                placeholder="Enter 6-character code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
            </div>
            <button type="submit" className="btn-auth-primary" disabled={validating}>
              {validating ? 'Checking...' : 'Continue →'}
            </button>
            <div className="auth-divider"><span>or</span></div>
            <div className="auth-secondary">
              <Link to="/register" className="btn-auth-secondary">
                <span className="btn-label">New to Scout?</span>
                Register your brand
              </Link>
              <Link to="/login" className="btn-auth-secondary">
                <span className="btn-label">Already have an account?</span>
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
