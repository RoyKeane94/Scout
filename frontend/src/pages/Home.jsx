import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page auth-layout home-page">
      <div className="auth-container">
        <div className="logo-block">
          <span className="logo">SCOUT<span className="logo-dot">.</span></span>
          <p className="tagline">Field intelligence for drinks brands</p>
        </div>
        <div className="auth-card">
          <div className="home-ctas">
            <Link to="/register" className="btn-auth-primary">
              Register your brand
            </Link>
            <Link to="/join" className="btn-auth-secondary">
              <span className="btn-label">Got an invite code?</span>
              Join your team
            </Link>
            <div className="auth-divider"><span>or</span></div>
            <Link to="/login" className="btn-auth-secondary">
              <span className="btn-label">Already have an account?</span>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
