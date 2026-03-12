import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LogChoice() {
  const { user } = useAuth();
  const companyName = user?.organisation?.name || 'your brand';

  return (
    <div className="page log-choice-page">
      <div className="log-choice-inner">
        <div className="log-choice-buttons">
          <Link to="/log/sighting" className="log-choice-btn log-choice-btn-primary">
            <div className="log-choice-text">
              <span className="log-choice-label">Sighting</span>
              <span className="log-choice-sub">Seen a brand in the wild</span>
            </div>
            <span className="log-choice-arrow">→</span>
          </Link>
          <Link to="/log/gap" className="log-choice-btn log-choice-btn-secondary">
            <div className="log-choice-text">
              <span className="log-choice-label">Gap</span>
              <span className="log-choice-sub">Opportunity for {companyName}</span>
            </div>
            <span className="log-choice-arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

