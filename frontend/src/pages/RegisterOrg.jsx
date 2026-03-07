import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function RegisterOrg() {
  const [step, setStep] = useState('form');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ brand_name: '', name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setLoggedIn } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const { confirmPassword, ...payload } = form;
    api
      .post('/auth/register-org/', payload)
      .then((res) => {
        setCode(res.data.org_code);
        localStorage.setItem('token', res.data.token);
        setLoggedIn();
        setStep('confirm');
      })
      .catch((err) => setError(err.response?.data?.detail || err.response?.data?.email?.[0] || 'Registration failed'));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  if (step === 'confirm') {
    return (
      <div className="page auth-layout register-page">
        <div className="auth-container">
          <div className="logo-block">
            <span className="logo">SCOUT<span className="logo-dot">.</span></span>
            <p className="tagline">Field intelligence for drinks brands</p>
          </div>
          <div className="auth-card">
            <div className="card-label">Your team code</div>
            <div className="code-display">{code}</div>
            <button type="button" className="btn-auth-primary" onClick={copyCode}>
              Copy code
            </button>
            <p className="confirm-msg">Share this code with your team so they can sign up.</p>
            <button type="button" className="btn-auth-secondary" onClick={() => navigate('/log')}>
              Go to Log
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-layout register-page">
      <div className="auth-container">
        <div className="logo-block">
          <span className="logo">SCOUT<span className="logo-dot">.</span></span>
          <p className="tagline">Field intelligence for drinks brands</p>
        </div>
        <div className="auth-card">
          <form onSubmit={handleSubmit}>
            <div className="card-label">Register your brand</div>
            {error && <p className="error-msg">{error}</p>}
            <div className="auth-field">
              <label>Brand name</label>
              <input
                type="text"
                placeholder="Your brand name"
                value={form.brand_name}
                onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label>Your name</label>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
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
            <button type="submit" className="btn-auth-primary">Register →</button>
          </form>
        </div>
      </div>
    </div>
  );
}
