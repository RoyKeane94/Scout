import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import ScoutSelect from '../components/ScoutSelect';

const PLACEMENT_OPTIONS = [
  'Eye level fridge',
  'Low fridge',
  'Top fridge',
  'Ambient shelf',
  'Counter display',
  'Window display',
];
const OBS_OPTIONS = ['Stocked', 'POS material', 'Shelf talker', 'Branded fridge', 'Sampling', 'Window display'];
const PROMO_OPTIONS = ['Full price', 'Promotional price', '2 for 1', '% off', 'Price marked', 'Bundle'];
const VENUE_TYPES = ['cafe', 'pub', 'bar', 'deli', 'gym', 'restaurant', 'shop', 'other'];
const VENUE_TYPE_LABELS = { cafe: 'Cafe', pub: 'Pub', bar: 'Bar', deli: 'Deli', gym: 'Gym', restaurant: 'Restaurant', shop: 'Shop', other: 'Other' };

export default function Log() {
  const [step, setStep] = useState('form');
  const [fields, setFields] = useState([]);
  const [brands, setBrands] = useState([]);
  const [venue, setVenue] = useState(null);
  const [brandId, setBrandId] = useState('');
  const [photoB64, setPhotoB64] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [data, setData] = useState({});
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  // Venue typeahead
  const [venueQuery, setVenueQuery] = useState('');
  const [venueResults, setVenueResults] = useState([]);
  const [venueOpen, setVenueOpen] = useState(false);
  const [venueAdding, setVenueAdding] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueType, setNewVenueType] = useState('cafe');
  const venueRef = useRef(null);
  const venueInputRef = useRef(null);
  const [venueDropdownPos, setVenueDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef(null);

  // Geo
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);

  // Brand add
  const [brandAdding, setBrandAdding] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    api.get('/config/fields/').then((res) => {
      setFields(res.data.filter((f) => f.is_active).sort((a, b) => a.display_order - b.display_order));
    });
    api.get('/config/brands/').then((res) => setBrands(res.data));
  }, []);

  useEffect(() => {
    if (venue) setVenueQuery(venue.name || '');
  }, [venue]);

  useEffect(() => {
    if (venueQuery.length < 1) {
      setVenueResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get(`/venues/?search=${encodeURIComponent(venueQuery)}`).then((res) => {
        setVenueResults(res.data);
      });
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [venueQuery]);

  useEffect(() => {
    const h = (e) => {
      if (venueRef.current && !venueRef.current.contains(e.target) && !e.target.closest('.log-typeahead-results-portal')) setVenueOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  useEffect(() => {
    if (venueOpen && venueQuery.length >= 1 && venueInputRef.current) {
      const updatePos = () => {
        if (venueInputRef.current) {
          const rect = venueInputRef.current.getBoundingClientRect();
          setVenueDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
      };
      updatePos();
      window.addEventListener('scroll', updatePos, true);
      window.addEventListener('resize', updatePos);
      return () => {
        window.removeEventListener('scroll', updatePos, true);
        window.removeEventListener('resize', updatePos);
      };
    }
  }, [venueOpen, venueQuery]);

  useEffect(() => {
    if (geoLat != null && geoLng != null) setLocation({ lat: geoLat, lng: geoLng });
  }, [geoLat, geoLng]);

  const getGeo = () => {
    setGeoLoading(true);
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Location unavailable');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Location unavailable');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    getGeo();
  }, []);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoB64(reader.result);
    reader.readAsDataURL(file);
  };

  const addVenue = () => {
    if (!newVenueName.trim()) return;
    const payload = {
      name: newVenueName.trim(),
      venue_type: String(newVenueType),
    };
    if (location.lat != null && location.lng != null) {
      payload.lat = Number(location.lat);
      payload.lng = Number(location.lng);
    }
    api
      .post('/venues/', payload)
      .then((res) => {
        setVenue(res.data);
        setVenueQuery(res.data.name);
        setNewVenueName('');
        setNewVenueType('cafe');
        setVenueAdding(false);
        setVenueOpen(false);
      })
      .catch((err) => {
        const d = err.response?.data;
        let msg = 'Failed to add venue';
        if (d) {
          if (typeof d === 'string') msg = d;
          else if (d.detail) msg = d.detail;
          else if (typeof d === 'object') {
            const first = Object.values(d).flat().find(Boolean);
            if (first) msg = typeof first === 'string' ? first : first[0] || msg;
          }
        }
        setError(msg);
      });
  };

  const addBrand = () => {
    if (!newBrandName.trim()) return;
    api
      .post('/config/brands/create/', { name: newBrandName.trim() })
      .then((res) => {
        setBrands((b) => [...b, res.data]);
        setBrandId(String(res.data.id));
        setNewBrandName('');
        setBrandAdding(false);
      });
  };

  const updateData = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const toggleChip = (key, opt) => {
    const arr = data[key] || [];
    const next = arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt];
    updateData(key, next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!venue?.id) {
      setError('Please select or add a venue');
      return;
    }
    let resolvedBrandId = brandId || brands[0]?.id;
    if (fields.some((f) => f.field_id === 'brand')) {
      if (brandAdding && newBrandName.trim()) {
        try {
          const res = await api.post('/config/brands/create/', { name: newBrandName.trim() });
          resolvedBrandId = res.data.id;
          setBrands((b) => [...b, res.data]);
          setBrandAdding(false);
          setNewBrandName('');
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to add brand');
          return;
        }
      } else if (!resolvedBrandId) {
        setError('Please select a brand');
        return;
      }
    }
    const payload = {
      venue_id: Number(venue.id),
      brand_id: Number(resolvedBrandId),
      photo_b64: photoB64 || null,
      data,
    };
    if (location.lat != null && location.lng != null) {
      payload.lat = Number(location.lat);
      payload.lng = Number(location.lng);
    }
    api
      .post('/sightings/', payload)
      .then((res) => {
        setSubmitted(res.data);
        setStep('confirm');
      })
      .catch((err) => {
        const d = err.response?.data;
        const msg = d?.detail || (typeof d === 'object' && Object.values(d).flat().find(Boolean)) || 'Failed to submit';
        setError(typeof msg === 'string' ? msg : String(msg));
      });
  };

  const resetForm = () => {
    setStep('form');
    setVenue(null);
    setVenueQuery('');
    setBrandId('');
    setBrandAdding(false);
    setNewBrandName('');
    setPhotoB64(null);
    setData({});
    setSubmitted(null);
  };

  const geoText = geoLoading
    ? 'Locating…'
    : geoError
      ? geoError
      : geoLat != null && geoLng != null
        ? `${geoLat.toFixed(5)}° N, ${Math.abs(geoLng).toFixed(5)}° W`
        : 'Locating…';

  if (step === 'confirm') {
    return (
      <div className="page log-page">
        <div className="log-inner">
          <div className="log-success">
            <div className="log-success-ring">✓</div>
            <h2>Sighting logged</h2>
            <p>Added to the map. Your team can see it now.</p>
            <div className="log-success-card">
              <div className="log-s-row">
                <span>Venue</span>
                <span>{submitted?.venue?.name || '—'}</span>
              </div>
              <div className="log-s-row">
                <span>Brand</span>
                <span>{submitted?.brand?.name || '—'}</span>
              </div>
            </div>
            <button type="button" className="log-btn-again" onClick={resetForm}>
              Log another sighting
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
          <h1 className="page-title">Log a sighting</h1>
        </div>

        <form onSubmit={handleSubmit} id="log-form-body">
          {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

          <div className="log-card">
            <div className="card-label">Photo <span className="optional-hint">(optional)</span></div>
            <label htmlFor="photo-file">
              <div className={`photo-zone ${photoB64 ? 'has-photo' : ''}`}>
                {photoB64 && <img src={photoB64} alt="" />}
                <div className="photo-inner" style={{ display: photoB64 ? 'none' : 'block' }}>
                  <span className="photo-icon">📷</span>
                  <p className="photo-hint">Tap to <strong>take a photo</strong> or upload</p>
                </div>
              </div>
            </label>
            <input type="file" id="photo-file" accept="image/*" capture="environment" onChange={handlePhoto} />
          </div>

          <div className="log-card">
            <div className="card-label">Location</div>
            <div className="log-geo-row">
              <div className="log-geo-pill">
                <div className="log-geo-dot" />
                <span className="log-geo-text">{geoText}</span>
              </div>
              <button type="button" className="log-geo-refresh-btn" onClick={getGeo} title="Refresh location">
                Refresh
              </button>
            </div>
          </div>

          <div className={`log-card ${(venueOpen && venueQuery.length >= 1) || venueAdding ? 'log-typeahead-open' : ''}`} ref={venueRef}>
            <div className="card-label">Venue</div>
            <div className="log-typeahead">
              <div className="log-field" ref={venueInputRef}>
                <input
                  type="text"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  onFocus={() => setVenueOpen(true)}
                  placeholder="Search or add venue…"
                  autoComplete="off"
                />
              </div>
              {venueOpen && venueQuery.length >= 1 && createPortal(
                <div
                  className="log-typeahead-results log-typeahead-results-portal"
                  style={{
                    position: 'fixed',
                    top: venueDropdownPos.top,
                    left: venueDropdownPos.left,
                    width: venueDropdownPos.width,
                    zIndex: 2147483647,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {venueResults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="log-typeahead-item"
                      onClick={() => {
                        setVenue(v);
                        setVenueQuery(v.name);
                        setVenueOpen(false);
                      }}
                    >
                      <span>{v.name}</span>
                      <span className="log-typeahead-item-type">{v.venue_type}</span>
                    </button>
                  ))}
                  {venueResults.length === 0 ? (
                    <button
                      type="button"
                      className="log-typeahead-add"
                      onClick={() => { setNewVenueName(venueQuery); setVenueAdding(true); }}
                    >
                      <span className="log-typeahead-add-icon">+</span>
                      {`Add "${venueQuery}" as new venue`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="log-typeahead-add"
                      onClick={() => setVenueAdding(!venueAdding)}
                    >
                      <span className="log-typeahead-add-icon">+</span>
                      Add new venue
                    </button>
                  )}
                  {venueAdding && (
                    <div className="log-new-venue-form">
                      <div className="log-new-venue-row">
                        <div className="log-field">
                          <label>Venue name</label>
                          <input
                            type="text"
                            value={newVenueName}
                            onChange={(e) => setNewVenueName(e.target.value)}
                            placeholder="e.g. Allpress"
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
                      <button type="button" className="log-confirm-btn" onClick={addVenue}>
                        Add venue →
                      </button>
                    </div>
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>

          {(fields.some((f) => f.field_id === 'brand') || fields.some((f) => f.field_id === 'placement')) && (
            <div className="log-card">
              <div className="log-field-row">
                {fields.some((f) => f.field_id === 'brand') && (
                  <div className="log-field">
                    <label>Brand</label>
                    {brandAdding ? (
                      <div className="log-brand-add">
                        <input
                          type="text"
                          value={newBrandName}
                          onChange={(e) => setNewBrandName(e.target.value)}
                          placeholder="Brand name"
                          autoFocus
                        />
                        <div className="log-brand-add-actions">
                          <button type="button" className="log-brand-add-btn" onClick={addBrand}>
                            Add
                          </button>
                          <button type="button" className="log-brand-cancel-btn" onClick={() => { setBrandAdding(false); setNewBrandName(''); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ScoutSelect
                        value={brandId}
                        onChange={(v) => { if (v === '__add__') setBrandAdding(true); else setBrandId(v); }}
                        placeholder="Please select…"
                        getLabel={(v) => {
                          if (!v || v === '__add__') return '';
                          const b = brands.find((x) => x.id === v || x.id === parseInt(v, 10));
                          return b ? (b.is_own_brand ? `★ ${b.name}` : b.name) : '';
                        }}
                        renderOptions={({ onSelect }) => (
                          <>
                            <button type="button" role="option" className="scout-select-option" onClick={() => onSelect('')}>
                              Please select…
                            </button>
                            {brands.filter((b) => b.is_own_brand).map((b) => (
                              <button key={b.id} type="button" role="option" className={`scout-select-option ${brandId === String(b.id) ? 'selected' : ''}`} onClick={() => onSelect(String(b.id))}>
                                ★ {b.name}
                              </button>
                            ))}
                            {brands.filter((b) => !b.is_own_brand).length > 0 && (
                              <>
                                <div className="scout-select-group-label">Competitors</div>
                                {brands.filter((b) => !b.is_own_brand).map((b) => (
                                  <button key={b.id} type="button" role="option" className={`scout-select-option ${brandId === String(b.id) ? 'selected' : ''}`} onClick={() => onSelect(String(b.id))}>
                                    {b.name}
                                  </button>
                                ))}
                              </>
                            )}
                            <button type="button" role="option" className="scout-select-option" onClick={() => onSelect('__add__')}>
                              + Add other brand
                            </button>
                          </>
                        )}
                      />
                    )}
                  </div>
                )}
                {fields.some((f) => f.field_id === 'placement') && (
                  <div className="log-field">
                    <label>Placement</label>
                    <ScoutSelect
                      value={data.placement || ''}
                      onChange={(v) => updateData('placement', v)}
                      placeholder="Please select placement…"
                      options={PLACEMENT_OPTIONS.map((o) => ({ value: o, label: o }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {fields.some((f) => f.field_id === 'price') && (
            <div className="log-card">
              <div className="card-label">Price</div>
              <div className="log-field">
                <label>Retail price</label>
                <div className="log-price-wrap">
                  <span className="log-price-prefix">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={data.price ?? ''}
                    onChange={(e) => updateData('price', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {fields.some((f) => f.field_id === 'promo') && (
            <div className="log-card">
              <div className="card-label">Promotion</div>
              <div className="log-chips">
                {PROMO_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`log-chip ${(data.promo || []).includes(opt) ? 'on' : ''}`}
                    onClick={() => toggleChip('promo', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fields.some((f) => f.field_id === 'obs') && (
            <div className="log-card">
              <div className="card-label">Observation type</div>
              <div className="log-chips">
                {OBS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`log-chip ${(data.obs || []).includes(opt) ? 'on' : ''}`}
                    onClick={() => toggleChip('obs', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fields.some((f) => f.field_id === 'notes') && (
            <div className="log-card">
              <div className="card-label">Notes</div>
              <div className="log-field">
                <label>Notes</label>
                <textarea
                  value={data.notes ?? ''}
                  onChange={(e) => updateData('notes', e.target.value)}
                  placeholder="Any additional notes…"
                  rows={3}
                />
              </div>
            </div>
          )}

          <button type="submit" className="log-submit-btn">
            Submit sighting →
          </button>
        </form>
      </div>
    </div>
  );
}
