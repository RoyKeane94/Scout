import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const VENUE_TYPE_LABELS = {
  cafe: 'Cafe', pub: 'Pub', bar: 'Bar', deli: 'Deli', gym: 'Gym',
  restaurant: 'Restaurant', shop: 'Shop', other: 'Other',
};

function getInitials(submitter) {
  if (!submitter) return '?';
  const name = (submitter.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name.slice(0, 2) || '?').toUpperCase();
  }
  const email = (submitter.email || '').trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function formatTime(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateFull(createdAt) {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function isActivePromo(p) {
  if (!p || p === '—') return false;
  return String(p).trim().toLowerCase() !== 'full price';
}

function formatDateGroup(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [sightings, setSightings] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('sightings');
  const [drawerPhotoUrl, setDrawerPhotoUrl] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/sightings/').then((res) => setSightings(res.data || [])).catch(() => setSightings([])),
      api.get('/config/brands/').then((res) => setBrands(res.data || [])).catch(() => setBrands([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const drawerPhotoUrlRef = useRef(null);
  // Load photo from API when drawer opens (works in production where data URI may be blocked or omitted)
  useEffect(() => {
    if (!selectedId || !drawerOpen) {
      if (drawerPhotoUrlRef.current) {
        URL.revokeObjectURL(drawerPhotoUrlRef.current);
        drawerPhotoUrlRef.current = null;
      }
      setDrawerPhotoUrl(null);
      return;
    }
    setDrawerPhotoUrl(null);
    if (drawerPhotoUrlRef.current) {
      URL.revokeObjectURL(drawerPhotoUrlRef.current);
      drawerPhotoUrlRef.current = null;
    }
    api.get(`/sightings/${selectedId}/photo/`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        drawerPhotoUrlRef.current = url;
        setDrawerPhotoUrl(url);
      })
      .catch(() => setDrawerPhotoUrl(null));
    return () => {
      if (drawerPhotoUrlRef.current) {
        URL.revokeObjectURL(drawerPhotoUrlRef.current);
        drawerPhotoUrlRef.current = null;
      }
    };
  }, [selectedId, drawerOpen]);

  const ownBrandName = useMemo(() => brands.find((b) => b.is_own_brand)?.name || 'Your brand', [brands]);

  const filteredSightings = useMemo(() => {
    if (filter === 'all') return sightings;
    if (filter === 'own') return sightings.filter((s) => s.brand?.is_own_brand);
    return sightings.filter((s) => !s.brand?.is_own_brand);
  }, [sightings, filter]);

  const selectedSighting = useMemo(() => sightings.find((s) => s.id === selectedId), [sightings, selectedId]);

  const competitorSightings = useMemo(() => sightings.filter((s) => !s.brand?.is_own_brand), [sightings]);

  const venuesWithOwnBrand = useMemo(() => {
    const ids = new Set();
    sightings.filter((s) => s.brand?.is_own_brand).forEach((s) => {
      if (s.venue?.id) ids.add(s.venue.id);
    });
    return ids;
  }, [sightings]);

  const gapVenues = useMemo(() => {
    const byVenue = new Map();
    competitorSightings.forEach((s) => {
      if (!s.venue) return;
      if (venuesWithOwnBrand.has(s.venue.id)) return; // skip if own brand stocked there
      const key = s.venue.id || s.venue.name;
      if (!byVenue.has(key)) {
        byVenue.set(key, {
          venue: { id: s.venue.id, name: s.venue.name, venue_type: s.venue.venue_type },
          competitors: [],
          lastSighting: null,
        });
      }
      const entry = byVenue.get(key);
      const brandName = s.brand?.name;
      if (brandName && !entry.competitors.some((c) => c.name === brandName)) {
        entry.competitors.push({ name: brandName, id: s.brand?.id });
      }
      if (!entry.lastSighting || new Date(s.created_at) > new Date(entry.lastSighting.created_at)) {
        entry.lastSighting = { when: s.created_at, who: s.submitted_by?.name || s.submitted_by?.email };
      }
    });
    return Array.from(byVenue.values()).sort((a, b) =>
      new Date(b.lastSighting?.when || 0) - new Date(a.lastSighting?.when || 0)
    );
  }, [competitorSightings, venuesWithOwnBrand]);

  const headToHeadCount = useMemo(() => {
    return Array.from(venuesWithOwnBrand).filter((venueId) =>
      competitorSightings.some((s) => s.venue?.id === venueId)
    ).length;
  }, [venuesWithOwnBrand, competitorSightings]);

  const activePromosCount = useMemo(() => {
    return competitorSightings.filter((s) => isActivePromo(s.data?.promo)).length;
  }, [competitorSightings]);

  const competitorBrands = useMemo(() => {
    const byBrand = new Map();
    competitorSightings.forEach((s) => {
      const b = s.brand;
      if (!b) return;
      if (!byBrand.has(b.id)) {
        byBrand.set(b.id, { name: b.name, id: b.id, sightings: [], venues: new Map() });
      }
      const entry = byBrand.get(b.id);
      entry.sightings.push(s);
      if (s.venue?.name) {
        const key = `${s.venue.id || s.venue.name}`;
        if (!entry.venues.has(key)) {
          const isGap = !venuesWithOwnBrand.has(s.venue?.id);
          const sighting = s;
          const promo = isActivePromo(sighting.data?.promo) ? sighting.data.promo : null;
          entry.venues.set(key, {
            name: s.venue.name,
            type: s.venue.venue_type,
            isGap,
            promo,
            placement: sighting.data?.placement || '—',
          });
        }
      }
    });
    return Array.from(byBrand.values()).map((e) => {
      const venueCount = e.venues.size;
      const activePromo = e.sightings.find((s) => isActivePromo(s.data?.promo))?.data?.promo || null;
      return {
        ...e,
        venues: Array.from(e.venues.values()),
        count: e.sightings.length,
        venueCount,
        activePromo,
      };
    });
  }, [competitorSightings, venuesWithOwnBrand]);

  const submitterCounts = useMemo(() => {
    const counts = {};
    sightings.forEach((s) => {
      const id = s.submitted_by?.id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [sightings]);

  const tableRowsWithDates = useMemo(() => {
    const out = [];
    let lastDate = null;
    filteredSightings.forEach((s) => {
      const dateLabel = formatDateGroup(s.created_at);
      if (dateLabel !== lastDate) {
        lastDate = dateLabel;
        out.push({ type: 'date', dateLabel });
      }
      out.push({ type: 'row', sighting: s });
    });
    return out;
  }, [filteredSightings]);

  const lastSighting = useMemo(() => {
    if (!filteredSightings.length) return null;
    return filteredSightings.reduce((latest, s) =>
      new Date(s.created_at) > new Date(latest.created_at) ? s : latest
    );
  }, [filteredSightings]);

  const openDrawer = (id) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="dashboard-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <div className="dashboard-page-header">
        <div className="dashboard-view-tabs">
          <button
            type="button"
            className={`dashboard-view-tab ${page === 'sightings' ? 'active' : ''}`}
            onClick={() => { setPage('sightings'); closeDrawer(); }}
          >
            Sightings
          </button>
          <button
            type="button"
            className={`dashboard-view-tab ${page === 'competitors' ? 'active' : ''}`}
            onClick={() => { setPage('competitors'); closeDrawer(); }}
          >
            Competitors
          </button>
        </div>
        {page === 'sightings' && (
          <div className="dashboard-seg-control">
            <button
              type="button"
              className={`dashboard-seg-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`dashboard-seg-btn ${filter === 'own' ? 'active' : ''}`}
              onClick={() => setFilter('own')}
            >
              {ownBrandName}
            </button>
            <button
              type="button"
              className={`dashboard-seg-btn ${filter === 'comp' ? 'active' : ''}`}
              onClick={() => setFilter('comp')}
            >
              Competitors
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          {page === 'sightings' && (
            <div className="dashboard-sightings-view">
              <div className="dashboard-sightings-summary">
                <div className="dashboard-sightings-summary-stats">
                  <span className="dashboard-sightings-count">
                    {filteredSightings.length} sighting{filteredSightings.length !== 1 ? 's' : ''}
                  </span>
                  <span className="dashboard-sightings-last">
                    {lastSighting
                      ? `Last: ${formatDateGroup(lastSighting.created_at)} · ${formatTime(lastSighting.created_at)}`
                      : 'No sightings yet'}
                  </span>
                </div>
                <Link to="/log" className="dashboard-sightings-log-btn">Log a sighting</Link>
              </div>
              <div className="dashboard-table-wrap">
                <table className="dashboard-sightings-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Venue</th>
                      <th>Placement</th>
                      <th>Activity</th>
                      <th>Price</th>
                      <th>Logged by</th>
                      <th>When</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRowsWithDates.map((item, idx) =>
                      item.type === 'date' ? (
                        <tr key={`date-${idx}-${item.dateLabel}`} className="dashboard-date-row">
                          <td colSpan={8}>{item.dateLabel}</td>
                        </tr>
                      ) : (
                        (() => {
                          const s = item.sighting;
                          const isOwn = s.brand?.is_own_brand;
                          const d = s.data || {};
                          const placement = d.placement || '—';
                          const obs = d.obs || '—';
                          const promo = d.promo || '—';
                          const price = d.price != null && d.price !== '' ? d.price : '—';
                          const venueType = s.venue?.venue_type ? VENUE_TYPE_LABELS[s.venue.venue_type] || s.venue.venue_type : '';
                          return (
                            <tr
                              key={s.id}
                              className={selectedId === s.id && drawerOpen ? 'selected' : ''}
                              onClick={() => openDrawer(s.id)}
                            >
                              <td>
                                <div className="dashboard-cell-brand">
                                  <span className="dashboard-brand-name">{s.brand?.name || '—'}</span>
                                </div>
                              </td>
                              <td className="dashboard-cell-venue">
                                <div className="dashboard-venue-name">{s.venue?.name || '—'}</div>
                                <div className="dashboard-venue-type">{venueType}</div>
                              </td>
                              <td style={{ color: 'var(--grey-1)', fontSize: 13 }}>{placement}</td>
                              <td>
                                <div className="dashboard-cell-chips">
                                  {obs && obs !== '—' && (
                                    <span className={`dashboard-chip ${isOwn ? 'green' : 'amber'}`}>{obs}</span>
                                  )}
                                  {isActivePromo(promo) ? (
                                    <span className="dashboard-chip amber">{promo}</span>
                                  ) : promo && String(promo).trim().toLowerCase() === 'full price' ? (
                                    <span className="dashboard-chip dashboard-chip-neutral">Full price</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="dashboard-cell-price">{price}</td>
                              <td>
                                <div className="dashboard-cell-submitter">
                                  <span className="dashboard-sub-name">{s.submitted_by?.name || s.submitted_by?.email || '—'}</span>
                                </div>
                              </td>
                              <td className="dashboard-cell-time">{formatTime(s.created_at)}</td>
                              <td className="dashboard-row-arrow">&#8250;</td>
                            </tr>
                          );
                        })()
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'competitors' && (
            <div className="dashboard-comp-wrap">
              {gapVenues.length > 0 && (
                <div className="dashboard-comp-alert">
                  <div className="dashboard-comp-alert-text">
                    <div className="dashboard-comp-alert-title">
                      {gapVenues.length} venue{gapVenues.length !== 1 ? 's are' : ' is'} stocking competitors but not {ownBrandName}
                    </div>
                  </div>
                </div>
              )}

              <div className="dashboard-comp-stats">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{gapVenues.length}</div>
                  <div className="dashboard-stat-label">Venues stocking competitors</div>
                  <div className="dashboard-stat-sub">Gap opportunities</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{competitorSightings.length}</div>
                  <div className="dashboard-stat-label">Competitor sightings this month</div>
                  <div className="dashboard-stat-sub">Across {competitorBrands.length} brand{competitorBrands.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{activePromosCount}</div>
                  <div className="dashboard-stat-label">Active promos spotted in the wild</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{headToHeadCount}</div>
                  <div className="dashboard-stat-label">Venues where you're also stocked</div>
                  <div className="dashboard-stat-sub">Head-to-head</div>
                </div>
              </div>

              {gapVenues.length > 0 && (
                <>
                  <div className="dashboard-comp-section-label">
                    Gap venues <span className="dashboard-comp-label-count">{gapVenues.length}</span>
                  </div>
                  <div className="dashboard-comp-gap-table">
                    <div className="dashboard-comp-gap-header">
                      <div className="dashboard-comp-gap-title">Venues your competitors are in but you're not</div>
                      <div className="dashboard-comp-gap-sub">Sorted by most recent</div>
                    </div>
                    {gapVenues.map((g, i) => (
                      <div key={i} className="dashboard-comp-gap-row">
                        <div className="dashboard-comp-gap-left">
                          <div className="dashboard-comp-gap-venue-name">{g.venue.name}</div>
                          <div className="dashboard-comp-gap-venue-type">
                            {g.venue.venue_type ? VENUE_TYPE_LABELS[g.venue.venue_type] : ''}
                          </div>
                        </div>
                        <div className="dashboard-comp-gap-pills">
                          {g.competitors.map((c) => (
                            <span key={c.id} className="dashboard-comp-pill">{c.name}</span>
                          ))}
                        </div>
                        <div className="dashboard-comp-gap-last">
                          <div className="dashboard-cell-time">{formatTime(g.lastSighting?.when)}</div>
                          <div className="dashboard-comp-gap-who">{g.lastSighting?.who || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="dashboard-comp-section-label">By competitor</div>
              <div className="dashboard-comp-grid">
                {competitorBrands.map((b) => (
                  <div key={b.id} className="dashboard-comp-brand-card">
                    <div className="dashboard-comp-brand-header">
                      <div className="dashboard-comp-brand-name">{b.name}</div>
                      <div className="dashboard-comp-brand-meta">
                        {b.activePromo && <span className="dashboard-comp-promo-flag">{b.activePromo}</span>}
                        <span className="dashboard-comp-sightings-count">{b.count} sightings</span>
                      </div>
                    </div>
                    {b.venues.map((v, i) => (
                      <div key={i} className="dashboard-comp-venue-row">
                        <div className="dashboard-comp-venue-left">
                          <div className="dashboard-comp-venue-name">{v.name}</div>
                          <div className="dashboard-comp-venue-type">{VENUE_TYPE_LABELS[v.type] || v.type || ''}</div>
                        </div>
                        <div className="dashboard-comp-venue-right">
                          {isActivePromo(v.promo) && (
                            <span className="dashboard-chip amber">{v.promo}</span>
                          )}
                          {v.isGap && <span className="dashboard-chip">Gap</span>}
                          {!v.isGap && <span className="dashboard-chip green">You're here too</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="dashboard-comp-section-label">Recent sightings</div>
              <div className="dashboard-comp-table-wrap">
                <table className="dashboard-comp-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Venue</th>
                      <th>Placement</th>
                      <th>Promo</th>
                      <th>Logged by</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorSightings.map((s) => {
                      const d = s.data || {};
                      return (
                        <tr key={s.id} onClick={() => openDrawer(s.id)}>
                          <td>
                            <div className="dashboard-td-dot-name">{s.brand?.name || '—'}</div>
                          </td>
                          <td>
                            <div className="dashboard-venue-name">{s.venue?.name || '—'}</div>
                            <div className="dashboard-venue-type">
                              {s.venue?.venue_type ? VENUE_TYPE_LABELS[s.venue.venue_type] : ''}
                            </div>
                          </td>
                          <td>{d.placement || '—'}</td>
                          <td>
                            {isActivePromo(d.promo) ? (
                              <span className="dashboard-chip amber">{d.promo}</span>
                            ) : (
                              <span className="dashboard-activity-empty">—</span>
                            )}
                          </td>
                          <td>{s.submitted_by?.name || s.submitted_by?.email || '—'}</td>
                          <td className="dashboard-cell-time">{formatTime(s.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer overlay */}
      <div
        className={`dashboard-drawer-overlay ${drawerOpen ? 'show' : ''}`}
        onClick={closeDrawer}
        aria-hidden
      />

      {/* Drawer */}
      <div className={`dashboard-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="dashboard-drawer-header">
          <div>
            <div className="dashboard-drawer-brand">{selectedSighting?.brand?.name || '—'}</div>
            <div className="dashboard-drawer-venue">
              {selectedSighting?.venue?.name || '—'}
              {selectedSighting?.venue?.venue_type
                ? ` · ${VENUE_TYPE_LABELS[selectedSighting.venue.venue_type] || selectedSighting.venue.venue_type}`
                : ''}
            </div>
          </div>
          <button type="button" className="dashboard-drawer-close" onClick={closeDrawer} aria-label="Close">
            &#215;
          </button>
        </div>
        <div className="dashboard-drawer-body">
          {selectedSighting && (
            <>
              <div className="dashboard-drawer-photo">
                {drawerPhotoUrl ? (
                  <img src={drawerPhotoUrl} alt="" />
                ) : selectedSighting.photo_b64 ? (
                  <img src={`data:image/jpeg;base64,${String(selectedSighting.photo_b64).replace(/\s/g, '')}`} alt="" />
                ) : (
                  <span className="dashboard-drawer-photo-placeholder">Photo</span>
                )}
              </div>
              <div className="dashboard-drawer-badge-row">
                <span className={`dashboard-drawer-badge ${selectedSighting.brand?.is_own_brand ? 'own' : 'comp'}`}>
                  {selectedSighting.brand?.is_own_brand ? 'Your brand' : 'Competitor'}
                </span>
              </div>
              <div className="dashboard-drawer-fields">
                {['placement', 'price', 'obs', 'promo'].map((key) => {
                  const labels = { placement: 'Placement', price: 'Price', obs: 'Observation', promo: 'Promo' };
                  const val = selectedSighting.data?.[key] ?? '—';
                  const isOwn = selectedSighting.brand?.is_own_brand;
                  const cls = key === 'obs' ? (isOwn ? 'green' : 'amber') : '';
                  return (
                    <div key={key} className="dashboard-drawer-field">
                      <div className="dashboard-drawer-field-label">{labels[key]}</div>
                      <div className={`dashboard-drawer-field-value ${cls}`}>{val}</div>
                    </div>
                  );
                })}
              </div>
              <div className="dashboard-drawer-chips">
                {selectedSighting.data?.obs && (
                  <span className={`dashboard-chip ${selectedSighting.brand?.is_own_brand ? 'green' : 'amber'}`}>
                    {selectedSighting.data.obs}
                  </span>
                )}
                {selectedSighting.data?.placement && (
                  <span className="dashboard-chip navy">{selectedSighting.data.placement}</span>
                )}
                {isActivePromo(selectedSighting.data?.promo) && (
                  <span className="dashboard-chip amber">{selectedSighting.data.promo}</span>
                )}
              </div>
              <div className="dashboard-drawer-divider" />
              <div className="dashboard-drawer-section-label">Logged by</div>
              <div className="dashboard-drawer-submitter">
                <div>
                  <div className="dashboard-sub-detail-name">{selectedSighting.submitted_by?.name || selectedSighting.submitted_by?.email || '—'}</div>
                  <div className="dashboard-sub-detail-meta">Logged {formatDateFull(selectedSighting.created_at)}</div>
                </div>
                <div className="dashboard-sub-count">
                  <div className="dashboard-sub-count-num">{submitterCounts[selectedSighting.submitted_by?.id] ?? 0}</div>
                  <div className="dashboard-sub-count-label">sightings</div>
                </div>
              </div>
              {selectedSighting.data?.notes && (
                <>
                  <div className="dashboard-drawer-section-label">Notes</div>
                  <div className="dashboard-drawer-notes">{selectedSighting.data.notes}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
