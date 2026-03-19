import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ScoutSelect from '../components/ScoutSelect';
import { fetchShortAddress } from '../utils/geocode';

const VENUE_TYPES = ['cafe', 'pub', 'bar', 'deli', 'gym', 'restaurant', 'shop', 'other'];
const VENUE_TYPE_LABELS = { cafe: 'Cafe', pub: 'Pub', bar: 'Bar', deli: 'Deli', gym: 'Gym', restaurant: 'Restaurant', shop: 'Shop', other: 'Other' };

export default function LogGap() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [venueAdding, setVenueAdding] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueType, setNewVenueType] = useState('other');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [venueName, setVenueName] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    api.get('/venues/').then((res) => setVenues(res.data || [])).catch(() => setVenues([]));
  }, []);

  useEffect(() => {
    document.title = 'Log a gap — Scout';
    if (!navigator.geolocation) {
      setLocationError('Location unavailable');
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationLoading(false);
      },
      () => {
        setLocationError('Location unavailable');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (lat == null || lng == null) return;
    setAddressLoading(true);
    fetchShortAddress(lat, lng)
      .then((name) => setVenueName(name))
      .catch(() => setVenueName(`${lat.toFixed(5)}°, ${lng.toFixed(5)}°`))
      .finally(() => setAddressLoading(false));
  }, [lat, lng]);

  useEffect(() => {
    if (venueAdding && venueName && !newVenueName) setNewVenueName(venueName);
  }, [venueAdding, venueName]);

  const addVenue = () => {
    if (!newVenueName.trim()) return;
    const payload = {
      name: newVenueName.trim(),
      venue_type: String(newVenueType),
    };
    if (lat != null && lng != null) {
      payload.lat = lat;
      payload.lng = lng;
    }
    api
      .post('/venues/', payload)
      .then((res) => {
        setVenues((prev) => [...prev, res.data]);
        setVenueId(String(res.data.id));
        setNewVenueName('');
        setNewVenueType('other');
        setVenueAdding(false);
      })
      .catch((err) => {
        const d = err.response?.data;
        const msg = d?.detail || (typeof d === 'object' && Object.values(d).flat().find(Boolean)) || 'Failed to add venue';
        setError(typeof msg === 'string' ? msg : String(msg));
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const hasSelectedVenue = venueId && venues.some((v) => v.id === parseInt(venueId, 10));
    const hasNewVenue = venueAdding && newVenueName.trim();
    if (!hasSelectedVenue && !hasNewVenue) {
      setError('Please select or add a venue');
      return;
    }
    setSubmitting(true);
    const payload = { lat, lng, notes: notes.trim() };
    if (venueName) payload.town_name = venueName;
    if (hasSelectedVenue) {
      payload.venue_id = parseInt(venueId, 10);
    } else {
      payload.venue_name = newVenueName.trim();
      payload.venue_type = newVenueType;
    }
    api
      .post('/gaps/', payload)
      .then((res) => {
        setSubmitted(res.data);
      })
      .catch((err) => {
        const d = err.response?.data;
        const msg = d?.detail || (typeof d === 'object' && Object.values(d).flat().find(Boolean)) || 'Failed to log gap';
        setError(typeof msg === 'string' ? msg : String(msg));
      })
      .finally(() => setSubmitting(false));
  };

  if (submitted) {
    return (
      <div className="page log-page">
        <div className="log-inner">
          <div className="log-success">
            <div className="log-success-ring">✓</div>
            <h2>Gap logged</h2>
            <div className="log-success-card">
              <div className="log-s-row">
                <span>Venue</span>
                <span>{submitted?.venue?.name || '—'}</span>
              </div>
            </div>
            <button type="button" className="log-btn-again" onClick={() => navigate('/log-gap', { replace: true })}>
              Log another gap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page log-page">
      <div className="log-inner">
        <div className="page-header log-page-header">
          <h1 className="page-title">Log a gap</h1>
        </div>

        {locationLoading ? (
          <div className="log-gap-loading">
            <span className="log-geo-spinner" aria-hidden />
            Getting your location…
          </div>
        ) : locationError ? (
          <p className="error-msg">{locationError}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

            <div className="log-field-group">
              <div className="card-label">Location</div>
              <div className="log-geo-row">
                <div className="log-geo-pill">
                  {addressLoading ? (
                    <span className="log-geo-spinner" aria-hidden />
                  ) : (
                    <div className="log-geo-dot" />
                  )}
                  <span className="log-geo-text">
                    {addressLoading ? 'Looking up address…' : venueName || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="log-field-group">
              <div className="card-label">Venue</div>
              {venueAdding ? (
                <div className="log-venue-add">
                  <div className="log-new-venue-row">
                    <div className="log-field">
                      <label>Venue name</label>
                      <input
                        type="text"
                        value={newVenueName}
                        onChange={(e) => setNewVenueName(e.target.value)}
                        placeholder="e.g. North Sheen, TW10 6DS"
                        autoFocus
                      />
                    </div>
                    <div className="log-field">
                      <label>Type</label>
                      <ScoutSelect
                        value={newVenueType}
                        onChange={(v) => setNewVenueType(v)}
                        placeholder="Select type…"
                        options={VENUE_TYPES.map((t) => ({ value: t, label: VENUE_TYPE_LABELS[t] || t }))}
                      />
                    </div>
                  </div>
                  <div className="log-venue-add-actions">
                    <button type="button" className="log-confirm-btn" onClick={addVenue}>
                      Add
                    </button>
                    <button type="button" className="log-brand-cancel-btn" onClick={() => { setVenueAdding(false); setNewVenueName(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <ScoutSelect
                  value={venueId}
                  onChange={(v) => { if (v === '__add__') setVenueAdding(true); else setVenueId(v); }}
                  placeholder="Please select…"
                  getLabel={(v) => {
                    if (!v || v === '__add__') return '';
                    const ven = venues.find((x) => x.id === v || x.id === parseInt(v, 10));
                    return ven ? `${ven.name}${ven.venue_type ? ` · ${VENUE_TYPE_LABELS[ven.venue_type] || ven.venue_type}` : ''}` : '';
                  }}
                  renderOptions={({ onSelect }) => (
                    <>
                      <button type="button" role="option" className="scout-select-option" onClick={() => onSelect('')}>
                        Please select…
                      </button>
                      {venues.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="option"
                          className={`scout-select-option scout-select-option-venue ${venueId === String(v.id) ? 'selected' : ''}`}
                          onClick={() => onSelect(String(v.id))}
                        >
                          <span>{v.name}</span>
                          {v.venue_type && <span className="log-venue-type-badge">{VENUE_TYPE_LABELS[v.venue_type] || v.venue_type}</span>}
                        </button>
                      ))}
                      <button type="button" role="option" className="scout-select-option" onClick={() => onSelect('__add__')}>
                        + Add other venue
                      </button>
                    </>
                  )}
                />
              )}
            </div>

            <div className="log-field-group">
              <div className="card-label">Notes <span className="optional-hint">(optional)</span></div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. New site, no cold drinks yet…"
                rows={3}
                className="log-gap-notes"
              />
            </div>

            <button type="submit" className="log-submit-btn" disabled={submitting || addressLoading}>
              {submitting ? (
                <>
                  <span className="log-submit-spinner" aria-hidden />
                  Logging…
                </>
              ) : (
                'Log gap'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
