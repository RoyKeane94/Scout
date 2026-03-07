import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        
        <span className="footer-links">
          <Link to="/privacy" className="footer-link">Privacy</Link>
          <span className="footer-copy">© Scout</span>
        </span>
      </div>
    </footer>
  );
}
