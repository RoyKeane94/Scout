import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { hasToken, isAdmin, setLoggedOut } = useAuth();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="header-logo">
          SCOUT
        </Link>
        <nav className="header-nav">
          {hasToken ? (
            <>
              <NavLink to="/log" className={({ isActive }) => isActive ? 'header-link active' : 'header-link'}>
                Sightings
              </NavLink>
              <NavLink to="/dashboard" className={({ isActive }) => `header-link header-link-dashboard ${isActive ? 'active' : ''}`}>
                Dashboard
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => isActive ? 'header-link active' : 'header-link'}>
                  Admin
                </NavLink>
              )}
              <button
                type="button"
                className="header-link logout"
                onClick={() => {
                  setLoggedOut();
                  window.location.href = '/';
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/register" className={({ isActive }) => isActive ? 'header-link active' : 'header-link'}>
                Register
              </NavLink>
              <NavLink to="/join" className={({ isActive }) => isActive ? 'header-link active' : 'header-link'}>
                Join
              </NavLink>
              <NavLink to="/login" className={({ isActive }) => isActive ? 'header-link active' : 'header-link'}>
                Log in
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
