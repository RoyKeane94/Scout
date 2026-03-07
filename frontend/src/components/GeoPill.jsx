import { useState, useEffect } from 'react';

export default function GeoPill({ onLocation }) {
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat != null && lng != null && onLocation) {
      onLocation({ lat, lng });
    }
  }, [lat, lng, onLocation]);

  const getLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Location unavailable');
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  return (
    <div className="geo-pill">
      {loading && <span>Getting location...</span>}
      {error && <span className="geo-error">{error}</span>}
      {lat != null && lng != null && !loading && (
        <span className="geo-coords">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      )}
      {!loading && (error || (lat != null && lng != null)) && (
        <button type="button" className="geo-refresh" onClick={getLocation}>
          Refresh
        </button>
      )}
    </div>
  );
}
