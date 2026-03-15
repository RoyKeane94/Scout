import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ScoutSelect from '../components/ScoutSelect';
import { formatShortAddress, getTownFromAddress } from '../utils/geocode';

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

function isActivePromo(p) {
  if (!p) return false;
  const arr = Array.isArray(p) ? p : [p];
  return arr.some((x) => String(x).trim().toLowerCase() !== 'full price');
}
const VENUE_TYPES = ['cafe', 'pub', 'bar', 'deli', 'gym', 'restaurant', 'shop', 'other'];
const VENUE_TYPE_LABELS = { cafe: 'Cafe', pub: 'Pub', bar: 'Bar', deli: 'Deli', gym: 'Gym', restaurant: 'Restaurant', shop: 'Shop', other: 'Other' };

export default function Log() {
  const location = useLocation();
  const navigate = useNavigate();
  const editSighting = location.state?.editSighting;
  const [step, setStep] = useState('form');
  const [fields, setFields] = useState([]);
  const [brands, setBrands] = useState([]);
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [photoB64, setPhotoB64] = useState(null);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [data, setData] = useState({});
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Venue add form
  const [venueAdding, setVenueAdding] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueType, setNewVenueType] = useState('cafe');
  const photoCameraInputRef = useRef(null);
  const photoUploadInputRef = useRef(null);

  // Geo
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoRefreshed, setGeoRefreshed] = useState(false);
  const [geoAddress, setGeoAddress] = useState(null);
  const [geoAddressLoading, setGeoAddressLoading] = useState(false);
  const [geoBusinessName, setGeoBusinessName] = useState(null);
  const [geoTown, setGeoTown] = useState(null);
  const [venueAutoFromGeoDone, setVenueAutoFromGeoDone] = useState(false);

  // Brand add
  const [brandAdding, setBrandAdding] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    api.get('/config/fields/').then((res) => {
      setFields(res.data.filter((f) => f.is_active).sort((a, b) => a.display_order - b.display_order));
    });
    api.get('/config/brands/').then((res) => setBrands(res.data));
    api.get('/venues/').then((res) => setVenues(res.data || [])).catch(() => setVenues([]));
  }, []);

  useEffect(() => {
    if (!editSighting) return;
    setVenueId(editSighting.venue?.id ? String(editSighting.venue.id) : '');
    setBrandId(editSighting.brand?.id ? String(editSighting.brand.id) : '');
    if (editSighting.town) setGeoTown(editSighting.town);
    setData({
      ...(editSighting.data || {}),
      promo_details: editSighting.promo_details ?? editSighting.data?.promo_details ?? '',
    });
    setCoords({
      lat: editSighting.lat != null ? Number(editSighting.lat) : null,
      lng: editSighting.lng != null ? Number(editSighting.lng) : null,
    });
    if (editSighting.id && editSighting.photo_url && editSighting.photo_url.includes('/api/sightings/') && editSighting.photo_url.includes('/photo/')) {
      api.get(`sightings/${editSighting.id}/photo/`, { responseType: 'blob' })
        .then((res) => {
          const blob = res.data;
          if (blob && blob.size > 0 && !(blob.type && blob.type.startsWith('application/json'))) {
            const reader = new FileReader();
            reader.onload = () => setPhotoB64(reader.result);
            reader.readAsDataURL(blob);
          }
        })
        .catch(() => {});
    }
  }, [editSighting?.id]);

  useEffect(() => {
    if (geoLat != null && geoLng != null) setCoords({ lat: geoLat, lng: geoLng });
  }, [geoLat, geoLng]);

  useEffect(() => {
    if (geoLat == null || geoLng == null) {
      setGeoAddress(null);
      setGeoAddressLoading(false);
      return;
    }
    let cancelled = false;
    setGeoAddress(null);
    setGeoAddressLoading(true);
    const timer = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${geoLat}&lon=${geoLng}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'Scout/1.0 (field-logging-app)' } }
      )
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || !data) return;
          const business = (data.name || '').trim();
          setGeoBusinessName(business || null);
          const short = formatShortAddress(data);
          if (short) setGeoAddress(short);
          const town = getTownFromAddress(data);
          setGeoTown(town || null);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setGeoAddressLoading(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setGeoAddressLoading(false);
    };
  }, [geoLat, geoLng]);

  const getGeo = () => {
    setGeoLoading(true);
    setGeoError(null);
    setGeoRefreshed(false);
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
        setGeoRefreshed(true);
        setTimeout(() => setGeoRefreshed(false), 2000);
      },
      () => {
        setGeoError('Location unavailable');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!editSighting) {
      getGeo();
    } else {
      // For edits, initialise geo state from existing sighting and don't refresh coordinates.
      setGeoLoading(false);
      setGeoLat(editSighting.lat != null ? Number(editSighting.lat) : null);
      setGeoLng(editSighting.lng != null ? Number(editSighting.lng) : null);
    }
  }, [editSighting]);

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
    if (coords.lat != null && coords.lng != null) {
      payload.lat = Number(coords.lat);
      payload.lng = Number(coords.lng);
    }
    api
      .post('/venues/', payload)
      .then((res) => {
        setVenues((prev) => [...prev, res.data]);
        setVenueId(String(res.data.id));
        setNewVenueName('');
        setNewVenueType('cafe');
        setVenueAdding(false);
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

  // When we have a business name from live location, try to auto-select or prefill venue once.
  useEffect(() => {
    if (venueAutoFromGeoDone) return;
    if (!geoBusinessName) return;
    if (!venues || venues.length === 0) return;

    const lower = geoBusinessName.toLowerCase();
    const match = venues.find((v) => (v.name || '').trim().toLowerCase() === lower);
    if (match) {
      setVenueId(String(match.id));
      setVenueAdding(false);
      setVenueAutoFromGeoDone(true);
      return;
    }

    // No existing venue - prefill add-venue form and let user confirm.
    setVenueAdding(true);
    setNewVenueName((prev) => prev || geoBusinessName);
    setVenueAutoFromGeoDone(true);
  }, [geoBusinessName, venues, venueAutoFromGeoDone]);

  const toggleChip = (key, opt) => {
    const arr = data[key] || [];
    const next = arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt];
    updateData(key, next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const venue = venues.find((v) => v.id === venueId || v.id === parseInt(venueId, 10));
    if (!venue?.id) {
      setError('Please select or add a venue');
      setSubmitting(false);
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
          setSubmitting(false);
          return;
        }
      } else if (!resolvedBrandId) {
        setError('Please select a brand');
        setSubmitting(false);
        return;
      }
    }
    const payloadData = { ...data };
    if (!isActivePromo(data.promo)) delete payloadData.promo_details;
    const payload = {
      venue_id: Number(venue.id),
      brand_id: Number(resolvedBrandId),
      photo_b64: photoB64 || null,
      data: payloadData,
    };
    if (coords.lat != null && coords.lng != null) {
      payload.lat = Number(coords.lat);
      payload.lng = Number(coords.lng);
    }
    const town = geoTown != null && String(geoTown).trim() ? String(geoTown).trim() : '';
    payload.town = town;
    const req = editSighting
      ? api.patch(`sightings/${editSighting.id}/`, payload)
      : api.post('/sightings/', payload);
    req
      .then((res) => {
        setSubmitted(res.data);
        setStep('confirm');
      })
      .catch((err) => {
        const d = err.response?.data;
        const msg = d?.detail || (typeof d === 'object' && Object.values(d).flat().find(Boolean)) || 'Failed to submit';
        setError(typeof msg === 'string' ? msg : String(msg));
      })
      .finally(() => setSubmitting(false));
  };

  const resetForm = () => {
    navigate('/log', { replace: true, state: {} });
    setStep('form');
    setVenueId('');
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
      : geoAddressLoading
        ? 'Looking up address…'
        : geoAddress
          ? geoAddress
          : geoLat != null && geoLng != null
            ? `${geoLat.toFixed(5)}° N, ${Math.abs(geoLng).toFixed(5)}° W`
            : 'Locating…';

  if (step === 'confirm') {
    return (
      <div className="page log-page">
        <div className="log-inner">
          <div className="log-success">
            <div className="log-success-ring">✓</div>
            <h2>{editSighting ? 'Sighting updated' : 'Sighting logged'}</h2>
            <p>{editSighting ? 'Changes saved. Your team can see the update.' : 'Added to the map. Your team can see it now.'}</p>
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
          <h1 className="page-title">{editSighting ? 'Edit sighting' : 'Log a sighting'}</h1>
        </div>

        <form onSubmit={handleSubmit} id="log-form-body">
          {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

          <div className="log-form-fields">
          <div className="log-field-group">
            <div className="card-label">Location</div>
            <div className="log-geo-row">
              <div className="log-geo-pill">
                {geoAddressLoading ? (
                  <span className="log-geo-spinner" aria-hidden />
                ) : (
                  <div className="log-geo-dot" />
                )}
                <span className="log-geo-text">{geoText}</span>
              </div>
              <button type="button" className="log-geo-refresh-btn" onClick={getGeo} title="Refresh location" disabled={geoLoading}>
                {geoRefreshed ? 'Refreshed' : geoLoading ? 'Locating…' : 'Refresh'}
              </button>
            </div>
          </div>

          {editSighting && (
            <div className="log-field-group">
              <div className="card-label">Town</div>
              <div className="log-field">
                <input
                  type="text"
                  value={geoTown ?? ''}
                  onChange={(e) => setGeoTown(e.target.value || null)}
                  placeholder="e.g. North Sheen"
                />
              </div>
            </div>
          )}

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
                      placeholder="e.g. Allpress"
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

          {(fields.some((f) => f.field_id === 'brand') || fields.some((f) => f.field_id === 'placement')) && (
            <div className="log-field-group">
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
            <div className="log-field-group">
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
            <div className="log-field-group">
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
              {isActivePromo(data.promo) && (
                <div className="log-field" style={{ marginTop: 12 }}>
                  <label>Promo details</label>
                  <textarea
                    value={data.promo_details ?? ''}
                    onChange={(e) => updateData('promo_details', e.target.value)}
                    placeholder="e.g. 2 for £5, 20% off until Sunday…"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          {fields.some((f) => f.field_id === 'obs') && (
            <div className="log-field-group">
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

          {fields.some((f) => f.field_id === 'unit') && (
            <div className="log-field-group">
              <div className="card-label">Multipack or Single unit</div>
              <div className="log-field">
                <ScoutSelect
                  value={data.unit || ''}
                  onChange={(v) => updateData('unit', v)}
                  placeholder="Please select…"
                  options={[
                    { value: 'Multipack', label: 'Multipack' },
                    { value: 'Single unit', label: 'Single unit' },
                  ]}
                />
              </div>
            </div>
          )}

          {fields.some((f) => f.field_id === 'notes') && (
            <div className="log-field-group">
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

          <div className="log-field-group log-field-group-photo">
            <div className="card-label">Photo <span className="optional-hint">(optional)</span></div>
            {photoB64 ? (
              <div className="log-photo-preview">
                <img src={photoB64} alt="" />
                <button type="button" className="log-photo-remove" onClick={() => setPhotoB64(null)} aria-label="Remove photo">
                  &#215;
                </button>
              </div>
            ) : (
              <div className="log-photo-buttons">
                <input
                  ref={photoCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  style={{ display: 'none' }}
                />
                <input
                  ref={photoUploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="log-photo-btn log-photo-btn-camera"
                  onClick={() => photoCameraInputRef.current?.click()}
                >
                  Take photo
                </button>
                <button
                  type="button"
                  className="log-photo-btn log-photo-btn-upload"
                  onClick={() => photoUploadInputRef.current?.click()}
                >
                  <span className="log-photo-btn-icon">↑</span>
                  Upload
                </button>
              </div>
            )}
          </div>

          </div>

          <button type="submit" className="log-submit-btn" disabled={submitting}>
            {submitting ? (
              <>
                <span className="log-submit-spinner" aria-hidden />
                Submitting…
              </>
            ) : (
              editSighting ? 'Update sighting →' : 'Submit sighting →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
