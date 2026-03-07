import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const VENUE_TYPES = ['cafe', 'pub', 'bar', 'deli', 'gym', 'restaurant', 'shop', 'other'];

export default function VenueTypeahead({ value, onChange, lat, lng }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('cafe');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) setQuery(value.name || '');
  }, [value]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowAdd(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get(`/venues/?search=${encodeURIComponent(query)}`).then((res) => {
        setResults(res.data);
        setShowAdd(true);
      });
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const handleAddVenue = () => {
    if (!newName.trim()) return;
    setAdding(true);
    api
      .post('/venues/', {
        name: newName.trim(),
        venue_type: newType,
        lat: lat ?? null,
        lng: lng ?? null,
      })
      .then((res) => {
        onChange(res.data);
        setQuery(res.data.name);
        setNewName('');
        setNewType('cafe');
        setShowAdd(false);
        setAdding(false);
        setOpen(false);
      })
      .catch(() => setAdding(false));
  };

  return (
    <div className="venue-typeahead" ref={containerRef}>
      <label className="field-label">Venue</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search or add venue..."
      />
      {open && (results.length > 0 || showAdd) && (
        <div className="venue-dropdown">
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              className="venue-option"
              onClick={() => {
                onChange(v);
                setQuery(v.name);
                setOpen(false);
              }}
            >
              <span className="venue-name">{v.name}</span>
              <span className="venue-type">{v.venue_type}</span>
            </button>
          ))}
          {showAdd && (
            <div className="venue-add-section">
              {adding ? (
                <div className="venue-add-form">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Venue name"
                    autoFocus
                  />
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    {VENUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="venue-add-actions">
                    <button type="button" onClick={() => setAdding(false)}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleAddVenue}>
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="venue-add-btn"
                  onClick={() => setAdding(true)}
                >
                  Add new venue
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
