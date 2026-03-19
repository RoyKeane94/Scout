import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateFull(createdAt) {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
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
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('sightings');
  const [drawerPhotoUrl, setDrawerPhotoUrl] = useState(null);
  const [drawerPhotoError, setDrawerPhotoError] = useState(null);
  const [drawerPhotoErrorReason, setDrawerPhotoErrorReason] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [gapFilter, setGapFilter] = useState('all');
  const [gapPanelKey, setGapPanelKey] = useState(null);
  /** 'unreviewed' | 'actioned' — keeps panel rows aligned with the table that opened it */
  const [gapPanelContext, setGapPanelContext] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/sightings/').then((res) => setSightings(res.data || [])).catch(() => setSightings([])),
      api.get('/config/brands/').then((res) => setBrands(res.data || [])).catch(() => setBrands([])),
      api.get('/gaps/').then((res) => setGaps(res.data || [])).catch(() => setGaps([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (photoLightboxOpen) setPhotoLightboxOpen(false);
        else if (gapPanelKey) {
          setGapPanelKey(null);
          setGapPanelContext(null);
        }
        else closeDrawer();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [photoLightboxOpen, gapPanelKey]);

  useEffect(() => {
    document.body.style.overflow = photoLightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [photoLightboxOpen]);

  const drawerPhotoUrlRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  // Load photo from API when drawer opens (Postgres-backed; S3 uses photo_url from API)
  useEffect(() => {
    if (!selectedId || !drawerOpen) {
      if (drawerPhotoUrlRef.current) {
        URL.revokeObjectURL(drawerPhotoUrlRef.current);
        drawerPhotoUrlRef.current = null;
      }
      setDrawerPhotoUrl(null);
      setDrawerPhotoError(null);
      setDrawerPhotoErrorReason(null);
      return;
    }
    setDrawerPhotoUrl(null);
    setDrawerPhotoError(null);
    setDrawerPhotoErrorReason(null);
    if (drawerPhotoUrlRef.current) {
      URL.revokeObjectURL(drawerPhotoUrlRef.current);
      drawerPhotoUrlRef.current = null;
    }
    const controller = new AbortController();
    const id = selectedId;
    api.get(`sightings/${selectedId}/photo/`, { responseType: 'blob', signal: controller.signal })
      .then((res) => {
        if (selectedIdRef.current !== id) return;
        const blob = res.data;
        if (!blob || blob.size === 0) {
          setDrawerPhotoError('empty');
          setDrawerPhotoErrorReason('Empty response');
          return;
        }
        if (blob.type && blob.type.startsWith('application/json')) {
          setDrawerPhotoError('not_image');
          setDrawerPhotoErrorReason('Server returned JSON (not an image)');
          return;
        }
        const url = URL.createObjectURL(blob);
        drawerPhotoUrlRef.current = url;
        setDrawerPhotoUrl(url);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
        if (selectedIdRef.current !== id) return;
        const status = err.response?.status;
        const reason = status == null ? 'Network error' : `HTTP ${status}`;
        setDrawerPhotoError(status === 404 ? 'no_photo' : 'failed');
        setDrawerPhotoErrorReason(status === 404 ? 'No photo stored for this sighting' : reason);
        setDrawerPhotoUrl(null);
      });
    return () => {
      controller.abort();
      if (drawerPhotoUrlRef.current) {
        URL.revokeObjectURL(drawerPhotoUrlRef.current);
        drawerPhotoUrlRef.current = null;
      }
    };
  }, [selectedId, drawerOpen]);

  const ownBrandName = useMemo(() => brands.find((b) => b.is_own_brand)?.name || 'Your brand', [brands]);
  const { user } = useAuth();

  const ownBrandSightings = useMemo(() => sightings.filter((s) => s.brand?.is_own_brand), [sightings]);

  const ownBrandVenues = useMemo(() => {
    const byVenue = new Map();
    ownBrandSightings.forEach((s) => {
      if (!s.venue) return;
      const key = s.venue.id || s.venue.name;
      if (!byVenue.has(key)) {
        byVenue.set(key, {
          venue: { id: s.venue.id, name: s.venue.name, venue_type: s.venue.venue_type },
          sightings: [],
        });
      }
      byVenue.get(key).sightings.push(s);
    });
    return Array.from(byVenue.values()).sort((a, b) => {
      const aLatest = a.sightings.reduce((m, s) => (new Date(s.created_at) > new Date(m.created_at) ? s : m), a.sightings[0]);
      const bLatest = b.sightings.reduce((m, s) => (new Date(s.created_at) > new Date(m.created_at) ? s : m), b.sightings[0]);
      return new Date(bLatest?.created_at || 0) - new Date(aLatest?.created_at || 0);
    });
  }, [ownBrandSightings]);

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

  const gapsSorted = useMemo(
    () => [...gaps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [gaps]
  );
  const [expandedGapId, setExpandedGapId] = useState(null);
  const [expandedCompanyVenueKey, setExpandedCompanyVenueKey] = useState(null);

  const gapVenueCounts = useMemo(() => {
    const counts = {};
    gaps.forEach((g) => {
      const vid = g.venue?.id;
      if (vid) counts[vid] = (counts[vid] || 0) + 1;
    });
    return counts;
  }, [gaps]);

  const gapsUnreviewed = useMemo(() => gapsSorted.filter((g) => !g.status), [gapsSorted]);
  const gapsActioned = useMemo(() => gapsSorted.filter((g) => g.status), [gapsSorted]);
  const gapsFiltered = useMemo(() => {
    if (gapFilter === 'all') return gapsActioned;
    return gapsActioned.filter((g) => g.status === gapFilter);
  }, [gapsActioned, gapFilter]);

  const getGapGroupKey = (g) => (g?.venue?.id != null ? `venue:${g.venue.id}` : `gap:${g.id}`);

  const dedupeGapsByVenue = (gapList) => {
    const buckets = new Map();
    gapList.forEach((g) => {
      const k = getGapGroupKey(g);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(g);
    });
    const groups = Array.from(buckets.values()).map((arr) => {
      const sorted = [...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { key: getGapGroupKey(sorted[0]), gaps: sorted, primary: sorted[0] };
    });
    groups.sort((a, b) => new Date(b.primary.created_at) - new Date(a.primary.created_at));
    return groups;
  };

  const gapsUnreviewedGroups = useMemo(() => dedupeGapsByVenue(gapsUnreviewed), [gapsUnreviewed]);
  const gapsFilteredGroups = useMemo(() => dedupeGapsByVenue(gapsFiltered), [gapsFiltered]);

  const gapsForPanel = useMemo(() => {
    if (!gapPanelKey || !gapPanelContext) return [];
    let list;
    if (gapPanelKey.startsWith('venue:')) {
      const vid = Number(gapPanelKey.slice(6), 10);
      list = gaps.filter((g) => g.venue?.id === vid);
    } else {
      const gid = Number(gapPanelKey.slice(4), 10);
      list = gaps.filter((g) => g.id === gid);
    }
    if (gapPanelContext === 'unreviewed') list = list.filter((g) => !g.status);
    if (gapPanelContext === 'actioned') {
      list = list.filter((g) => g.status);
      if (gapFilter !== 'all') list = list.filter((g) => g.status === gapFilter);
    }
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [gapPanelKey, gapPanelContext, gapFilter, gaps]);

  useEffect(() => {
    if (gapPanelKey && gapPanelContext && gapsForPanel.length === 0) {
      setGapPanelKey(null);
      setGapPanelContext(null);
    }
  }, [gapPanelKey, gapPanelContext, gapsForPanel.length]);

  const gapPanelPrimary = gapsForPanel[0];
  const panelPursueGaps = useMemo(
    () => gapsForPanel.filter((g) => g.status === 'pursue'),
    [gapsForPanel],
  );
  const stageRefGap = panelPursueGaps[0] || gapPanelPrimary;

  const updateGapLocal = (id, fields) => {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, ...fields } : g)));
  };

  const patchGap = (id, fields) => {
    updateGapLocal(id, fields);
    api.patch(`gaps/${id}/`, fields).catch(() => {});
  };

  const handleGapDecisionGroup = (group, decision, e) => {
    if (e) e.stopPropagation();
    const allSame = group.gaps.every((g) => g.status === decision);
    const newStatus = allSame ? null : decision;
    group.gaps.forEach((g) => {
      const stage = newStatus === 'pursue' ? g.stage || null : null;
      patchGap(g.id, { status: newStatus, stage });
    });
  };

  const handleGapStageGroup = (group, stage) => {
    const pursueGaps = group.gaps.filter((g) => g.status === 'pursue');
    if (!pursueGaps.length) return;
    const ref = pursueGaps[0];
    const newStage = ref.stage === stage ? null : stage;
    pursueGaps.forEach((g) => patchGap(g.id, { stage: newStage }));
  };

  const handleGapDecisionPanel = (decision) => {
    if (!gapsForPanel.length) return;
    const allSame = gapsForPanel.every((g) => g.status === decision);
    const newStatus = allSame ? null : decision;
    gapsForPanel.forEach((g) => {
      const stage = newStatus === 'pursue' ? g.stage || null : null;
      patchGap(g.id, { status: newStatus, stage });
    });
  };

  const handleGapStagePanel = (stage) => {
    if (!panelPursueGaps.length) return;
    const ref = panelPursueGaps[0];
    const newStage = ref.stage === stage ? null : stage;
    panelPursueGaps.forEach((g) => patchGap(g.id, { stage: newStage }));
  };

  const openGapPanelFromGroup = (group, context) => {
    setGapPanelKey(group.key);
    setGapPanelContext(context);
  };
  const closeGapPanel = () => {
    setGapPanelKey(null);
    setGapPanelContext(null);
  };

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
    setPhotoLightboxOpen(false);
    setDeleteConfirmId(null);
  };

  const handleEditSighting = () => {
    if (!selectedSighting) return;
    closeDrawer();
    navigate('/log/sighting', { state: { editSighting: selectedSighting } });
  };

  const handleDeleteSighting = () => {
    if (!selectedId) return;
    setDeleteConfirmId(selectedId);
  };

  const confirmDeleteSighting = () => {
    if (!deleteConfirmId) return;
    api.delete(`sightings/${deleteConfirmId}/`).then(() => {
      setSightings((prev) => prev.filter((s) => s.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      closeDrawer();
    }).catch(() => setDeleteConfirmId(null));
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
            onClick={() => { setPage('sightings'); closeDrawer(); closeGapPanel(); }}
          >
            Sightings
            {sightings.length > 0 && <span className="dashboard-tab-count">{sightings.length}</span>}
          </button>
          <button
            type="button"
            className={`dashboard-view-tab ${page === 'competitors' ? 'active' : ''}`}
            onClick={() => { setPage('competitors'); closeDrawer(); closeGapPanel(); }}
          >
            Competitors
            {competitorSightings.length > 0 && <span className="dashboard-tab-count">{competitorSightings.length}</span>}
          </button>
          <button
            type="button"
            className={`dashboard-view-tab ${page === 'gaps' ? 'active' : ''}`}
            onClick={() => { setPage('gaps'); closeDrawer(); closeGapPanel(); }}
          >
            Gaps
            {gaps.length > 0 && <span className="dashboard-tab-count">{gaps.length}</span>}
          </button>
          <button
            type="button"
            className={`dashboard-view-tab ${page === 'company' ? 'active' : ''}`}
            onClick={() => { setPage('company'); closeDrawer(); closeGapPanel(); }}
          >
            {ownBrandName}
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
                    {lastSighting ? `Last: ${formatDateGroup(lastSighting.created_at)}` : 'No sightings yet'}
                  </span>
                </div>
                <div className="dashboard-sightings-log-actions">
                  <Link to="/log/sighting" className="dashboard-sightings-log-btn">Log a sighting</Link>
                  <Link to="/log/gap" className="dashboard-sightings-log-btn dashboard-sightings-log-btn-gap">Log a gap</Link>
                </div>
              </div>
              <div className="dashboard-table-wrap">
                <table className="dashboard-sightings-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Venue</th>
                      <th>Type</th>
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
                          <td colSpan={9}>{item.dateLabel}</td>
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
                                <div className="dashboard-venue-name">
                                  {s.venue?.name || '—'}
                                  {s.town?.name && (
                                    <span className="dashboard-comp-gap-venue-type-inline">
                                      {' '}
                                      ({s.town.name})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="dashboard-cell-type">{venueType || '—'}</td>
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
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{competitorSightings.length}</div>
                  <div className="dashboard-stat-label">Competitor sightings this month</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{activePromosCount}</div>
                  <div className="dashboard-stat-label">Active promos spotted in the wild</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{headToHeadCount}</div>
                  <div className="dashboard-stat-label">Venues where you're also stocked</div>
                </div>
              </div>

              {gapVenues.length > 0 && (
                <>
                  <div className="dashboard-comp-section-label">
                    Contested venues <span className="dashboard-comp-label-count">{gapVenues.length}</span>
                  </div>
                  <div className="dashboard-comp-gap-table">
                    <div className="dashboard-comp-gap-header">
                      <div className="dashboard-comp-gap-title">Venues your competitors are in but you're not</div>
                    </div>
                    {gapVenues.map((g, i) => (
                      <div key={i} className="dashboard-comp-gap-row">
                        <div className="dashboard-comp-gap-left">
                          <div className="dashboard-comp-gap-venue-name">
                            {g.venue.name}
                            {g.venue.venue_type && (
                              <span className="dashboard-comp-gap-venue-type-inline">
                                {' '}
                                ({VENUE_TYPE_LABELS[g.venue.venue_type] || g.venue.venue_type})
                              </span>
                            )}
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
                        <span className="dashboard-comp-sightings-count">{b.count} sightings</span>
                      </div>
                    </div>
                    {b.venues.map((v, i) => (
                      <div key={i} className="dashboard-comp-venue-row">
                        <div className="dashboard-comp-venue-left">
                          <div className="dashboard-comp-venue-name">
                            {v.name}
                            {(v.type && (VENUE_TYPE_LABELS[v.type] || v.type)) && (
                              <span className="dashboard-comp-gap-venue-type-inline">
                                {' '}
                                ({VENUE_TYPE_LABELS[v.type] || v.type})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="dashboard-comp-venue-right">
                          {isActivePromo(v.promo) && (
                            <span className="dashboard-chip amber">{v.promo}</span>
                          )}
                          {v.isGap && (
                            <span className="dashboard-chip green">
                              {ownBrandName} not stocked
                            </span>
                          )}
                          {!v.isGap && (
                            <span className="dashboard-chip orange">
                              {ownBrandName} stocked too
                            </span>
                          )}
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
                      <th>Type</th>
                      <th>Placement</th>
                      <th>Promo</th>
                      <th>Logged by</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorSightings.map((s) => {
                      const d = s.data || {};
                      const venueType = s.venue?.venue_type ? VENUE_TYPE_LABELS[s.venue.venue_type] || s.venue.venue_type : '';
                      return (
                        <tr key={s.id} onClick={() => openDrawer(s.id)}>
                          <td>
                            <div className="dashboard-td-dot-name">{s.brand?.name || '—'}</div>
                          </td>
                          <td>
                            <div className="dashboard-venue-name">
                              {s.venue?.name || '—'}
                              {s.town?.name && (
                                <span className="dashboard-comp-gap-venue-type-inline">
                                  {' '}
                                  ({s.town.name})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="dashboard-cell-type">{venueType || '—'}</td>
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

          {page === 'gaps' && (
            <div className="dashboard-comp-wrap">
              <div className="dashboard-gap-stats">
                <div className="dashboard-gap-stat stat-review">
                  <div className="dashboard-gap-stat-num">{gapsUnreviewed.length}</div>
                  <div className="dashboard-gap-stat-label">{gapsUnreviewed.length === 1 ? 'Needs' : 'Need'} review</div>
                </div>
                <div className="dashboard-gap-stat stat-pursue">
                  <div className="dashboard-gap-stat-num">{gapsActioned.filter((g) => g.status === 'pursue').length}</div>
                  <div className="dashboard-gap-stat-label">Pursuing</div>
                </div>
                <div className="dashboard-gap-stat stat-revisit">
                  <div className="dashboard-gap-stat-num">{gapsActioned.filter((g) => g.status === 'revisit').length}</div>
                  <div className="dashboard-gap-stat-label">Revisit</div>
                </div>
                <div className="dashboard-gap-stat stat-skip">
                  <div className="dashboard-gap-stat-num">{gapsActioned.filter((g) => g.status === 'skip').length}</div>
                  <div className="dashboard-gap-stat-label">Not pursuing</div>
                </div>
              </div>

              {/* Needs review */}
              <div className="dashboard-gap-section-head">
                <div className="dashboard-gap-section-title">
                  {gapsUnreviewed.length === 1 ? 'Needs' : 'Need'} review <span className="dashboard-gap-badge review">{gapsUnreviewed.length}</span>
                </div>
              </div>
              <div className="dashboard-comp-table-wrap">
                {gapsUnreviewed.length === 0 ? (
                  <div className="dashboard-gap-empty ok">All gaps reviewed</div>
                ) : (
                  <table className="dashboard-gap-triage-table">
                    <thead>
                      <tr>
                        <th>Venue</th>
                        <th>Type</th>
                        <th>Logged by</th>
                        <th>When</th>
                        <th>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapsUnreviewedGroups.map((group) => {
                        const g = group.primary;
                        const venueType = g.venue?.venue_type ? VENUE_TYPE_LABELS[g.venue.venue_type] || g.venue.venue_type : '';
                        const venueCount = g.venue?.id ? gapVenueCounts[g.venue.id] || group.gaps.length : group.gaps.length;
                        const hasNotesAny = group.gaps.some((x) => x.notes?.trim());
                        const showTownInline = group.gaps.length === 1 && g.town?.name;
                        return (
                          <tr
                            key={group.key}
                            className={gapPanelKey === group.key ? 'gap-row-selected' : ''}
                            onClick={() => openGapPanelFromGroup(group, 'unreviewed')}
                          >
                            <td>
                              <div className="dashboard-gap-venue-cell">
                                {g.venue?.name || '—'}
                                {showTownInline && (
                                  <span className="dashboard-comp-gap-venue-type-inline"> ({g.town.name})</span>
                                )}
                                <span className={`dashboard-gap-notes-dot${hasNotesAny ? ' has' : ''}`} title={hasNotesAny ? 'Has notes' : 'No notes'} />
                                {venueCount > 1 && <span className="dashboard-gap-venue-count">×{venueCount}</span>}
                              </div>
                            </td>
                            <td className="dashboard-cell-type">{venueType || '—'}</td>
                            <td>{g.submitted_by?.name || g.submitted_by?.email || '—'}</td>
                            <td className="dashboard-cell-time">{formatTime(g.created_at)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="dashboard-gap-triage-btns">
                                <button type="button" className="dashboard-gap-triage-btn pursue" onClick={(e) => handleGapDecisionGroup(group, 'pursue', e)}>
                                  <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  Pursue
                                </button>
                                <button type="button" className="dashboard-gap-triage-btn revisit" onClick={(e) => handleGapDecisionGroup(group, 'revisit', e)}>
                                  <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M7 3v4l2.5 2.5M12 7A5 5 0 1 1 2 7a5 5 0 0 1 10 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  Revisit
                                </button>
                                <button type="button" className="dashboard-gap-triage-btn skip" onClick={(e) => handleGapDecisionGroup(group, 'skip', e)}>
                                  <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                                  Pass
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Actioned */}
              <div className="dashboard-gap-section-head">
                <div className="dashboard-gap-section-title">
                  Actioned <span className="dashboard-gap-badge neutral">{gapsActioned.length}</span>
                </div>
                <div className="dashboard-gap-filter-chips">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'pursue', label: 'Pursue' },
                    { key: 'revisit', label: 'Revisit' },
                    { key: 'skip', label: 'Not pursuing' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`dashboard-gap-filter-chip${gapFilter === f.key ? ` active-${f.key}` : ''}`}
                      onClick={() => setGapFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dashboard-comp-table-wrap">
                {gapsFiltered.length === 0 ? (
                  <div className="dashboard-gap-empty">No actioned gaps yet</div>
                ) : (
                  <table className="dashboard-gap-triage-table">
                    <thead>
                      <tr>
                        <th>Venue</th>
                        <th>Type</th>
                        <th>Logged by</th>
                        <th>When</th>
                        <th>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapsFilteredGroups.map((group) => {
                        const g = group.primary;
                        const venueType = g.venue?.venue_type ? VENUE_TYPE_LABELS[g.venue.venue_type] || g.venue.venue_type : '';
                        const venueCount = g.venue?.id ? gapVenueCounts[g.venue.id] || group.gaps.length : group.gaps.length;
                        const isDeclined = g.status === 'pursue' && g.stage === 'declined';
                        const showStepper = g.status === 'pursue' && !isDeclined;
                        const progressStages = ['contacted', 'visit_booked', 'now_stocking'];
                        const activeIdx = g.stage ? progressStages.indexOf(g.stage) : -1;
                        const showTownInline = group.gaps.length === 1 && g.town?.name;

                        let badgeEl;
                        if (isDeclined) {
                          badgeEl = (
                            <span className="gap-badge-text gap-badge-declined" onClick={() => handleGapDecisionGroup(group, 'pursue')} title="Click to remove">
                              Declined
                            </span>
                          );
                        } else if (g.status === 'pursue') {
                          badgeEl = <span className="gap-badge-text gap-badge-pursue" onClick={() => handleGapDecisionGroup(group, 'pursue')} title="Click to remove">Pursue</span>;
                        } else if (g.status === 'revisit') {
                          badgeEl = <span className="gap-badge-text gap-badge-revisit" onClick={() => handleGapDecisionGroup(group, 'revisit')} title="Click to remove">Revisit</span>;
                        } else {
                          badgeEl = (
                            <span className="gap-badge-text gap-badge-skip" onClick={() => handleGapDecisionGroup(group, 'skip')} title="Click to remove">
                              Not pursuing
                            </span>
                          );
                        }

                        return (
                          <React.Fragment key={group.key}>
                            <tr
                              className={`${gapPanelKey === group.key ? 'gap-row-selected' : ''}${showStepper ? ' gap-row-has-stepper' : ''}`}
                              onClick={() => openGapPanelFromGroup(group, 'actioned')}
                            >
                              <td>
                                <div className="dashboard-gap-venue-cell" style={{ fontWeight: 400, opacity: 0.85 }}>
                                  {g.venue?.name || '—'}
                                  {showTownInline && (
                                    <span className="dashboard-comp-gap-venue-type-inline"> ({g.town.name})</span>
                                  )}
                                  {venueCount > 1 && <span className="dashboard-gap-venue-count">×{venueCount}</span>}
                                </div>
                              </td>
                              <td className="dashboard-cell-type">{venueType || '—'}</td>
                              <td>{g.submitted_by?.name || g.submitted_by?.email || '—'}</td>
                              <td className="dashboard-cell-time">{formatTime(g.created_at)}</td>
                              <td onClick={(e) => e.stopPropagation()}>{badgeEl}</td>
                            </tr>
                            {showStepper && (
                              <tr className="gap-stepper-row" onClick={(e) => e.stopPropagation()}>
                                <td colSpan={4} className="gap-stepper-row-spacer" aria-hidden="true" />
                                <td className="gap-stepper-row-decision">
                                  <div className="gap-stepper gap-stepper-table">
                                    {progressStages.map((s, i) => {
                                      const done = activeIdx >= 0 && i < activeIdx;
                                      const active = i === activeIdx;
                                      const stageLabel = { contacted: 'Contacted', visit_booked: 'Visit booked', now_stocking: 'Now stocking' }[s];
                                      return (
                                        <React.Fragment key={s}>
                                          {i > 0 && <div className={`gap-stepper-line${done || active ? ' done' : ''}`} />}
                                          <button type="button" className={`gap-stepper-step${active ? ' active' : ''}${done ? ' done' : ''}`} onClick={() => handleGapStageGroup(group, s)}>
                                            <span className="gap-stepper-circ">{done ? '✓' : (i + 1)}</span>
                                            <span className="gap-stepper-lbl">{stageLabel}</span>
                                          </button>
                                        </React.Fragment>
                                      );
                                    })}
                                    <div className="gap-stepper-sep" />
                                    <button type="button" className={`gap-stepper-declined${g.stage === 'declined' ? ' active' : ''}`} onClick={() => handleGapStageGroup(group, 'declined')}>
                                      <span className="gap-stepper-declined-circ" aria-hidden>×</span>
                                      <span className="gap-stepper-declined-lbl">Declined</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {page === 'company' && (
            <div className="dashboard-company-wrap">
              <div className="dashboard-comp-stats dashboard-comp-stats-company">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{ownBrandSightings.length}</div>
                  <div className="dashboard-stat-label">Total sightings</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{ownBrandVenues.length}</div>
                  <div className="dashboard-stat-label">Venues stocking {ownBrandName}</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">{user?.scout_count ?? '—'}</div>
                  <div className="dashboard-stat-label">Number of scouts</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-num">
                    {ownBrandSightings.filter((s) => isActivePromo(s.data?.promo)).length}
                  </div>
                  <div className="dashboard-stat-label">Active promos logged</div>
                </div>
              </div>

              {ownBrandVenues.length > 0 && (
                <>
                  <div className="dashboard-comp-section-label">Venues by {ownBrandName}</div>
                  <div className="dashboard-comp-gap-table">
                    <div className="dashboard-comp-gap-header">
                      <div className="dashboard-comp-gap-title">Where you're stocked</div>
                      <div className="dashboard-comp-gap-sub">Sorted by most recent sighting</div>
                    </div>
                    <table className="dashboard-comp-table">
                      <thead>
                        <tr>
                          <th>Venue</th>
                          <th>Locations</th>
                          <th>Type</th>
                          <th>Placement</th>
                          <th>Activity</th>
                          <th>Price</th>
                          <th>Logged by</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownBrandVenues.map((g, i) => {
                          const venueKey = g.venue?.id ?? g.venue?.name ?? i;
                          const latest = g.sightings.reduce(
                            (m, s) => (new Date(s.created_at) > new Date(m.created_at) ? s : m),
                            g.sightings[0],
                          );
                          const d = latest.data || {};
                          const venueType = g.venue?.venue_type
                            ? VENUE_TYPE_LABELS[g.venue.venue_type] || g.venue.venue_type
                            : '';
                          const areas = [...new Set(g.sightings.map((s) => s.town?.name).filter(Boolean))];
                          const isExpanded = expandedCompanyVenueKey === venueKey;
                          return (
                            <React.Fragment key={venueKey}>
                              <tr
                                className="dashboard-comp-venue-summary-row"
                                onClick={() => setExpandedCompanyVenueKey(isExpanded ? null : venueKey)}
                              >
                                <td>
                                  <div className="dashboard-venue-name">
                                    {g.venue.name}
                                    {areas[0] && (
                                      <span className="dashboard-comp-gap-venue-type-inline">
                                        {' '}
                                        ({areas[0]})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>{areas.length ? areas.join(', ') : '—'}</td>
                                <td className="dashboard-cell-type">{venueType || '—'}</td>
                                <td>{d.placement || '—'}</td>
                                <td>
                                  <div className="dashboard-cell-chips">
                                    {d.obs && d.obs !== '—' && (
                                      <span className="dashboard-chip green">{d.obs}</span>
                                    )}
                                    {isActivePromo(d.promo) ? (
                                      <span className="dashboard-chip amber">{d.promo}</span>
                                    ) : d.promo && String(d.promo).trim().toLowerCase() === 'full price' ? (
                                      <span className="dashboard-chip dashboard-chip-neutral">Full price</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="dashboard-cell-price">
                                  {d.price != null && d.price !== '' ? d.price : '—'}
                                </td>
                                <td>{latest.submitted_by?.name || latest.submitted_by?.email || '—'}</td>
                                <td className="dashboard-cell-time">{formatTime(latest.created_at)}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="dashboard-gap-notes-row">
                                  <td colSpan={8}>
                                    <div className="dashboard-comp-gap-areas">
                                      <span className="dashboard-comp-gap-areas-label">All locations:</span>
                                      {' '}
                                      {areas.length ? areas.join(', ') : '—'}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="dashboard-comp-section-label">Recent sightings</div>
              <div className="dashboard-comp-table-wrap">
                <table className="dashboard-comp-table">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Type</th>
                      <th>Placement</th>
                      <th>Activity</th>
                      <th>Price</th>
                      <th>Logged by</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownBrandSightings
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((s) => {
                        const d = s.data || {};
                        const venueType = s.venue?.venue_type ? VENUE_TYPE_LABELS[s.venue.venue_type] : '';
                        return (
                          <tr key={s.id} onClick={() => openDrawer(s.id)}>
                            <td>
                              <div className="dashboard-venue-name">
                                {s.venue?.name || '—'}
                                {s.town?.name && (
                                  <span className="dashboard-comp-gap-venue-type-inline">
                                    {' '}
                                    ({s.town.name})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="dashboard-cell-type">{venueType || '—'}</td>
                            <td>{d.placement || '—'}</td>
                            <td>
                              <div className="dashboard-cell-chips">
                                {d.obs && d.obs !== '—' && (
                                  <span className="dashboard-chip green">{d.obs}</span>
                                )}
                                {isActivePromo(d.promo) ? (
                                  <span className="dashboard-chip amber">{d.promo}</span>
                                ) : d.promo && String(d.promo).trim().toLowerCase() === 'full price' ? (
                                  <span className="dashboard-chip dashboard-chip-neutral">Full price</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="dashboard-cell-price">{d.price != null && d.price !== '' ? d.price : '—'}</td>
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

      {/* Gap panel overlay */}
      {gapPanelKey && (
        <div
          className={`dashboard-drawer-overlay ${gapPanelKey ? 'show' : ''}`}
          onClick={closeGapPanel}
          aria-hidden
        />
      )}

      {/* Gap side panel */}
      <div className={`dashboard-gap-panel ${gapPanelKey ? 'open' : ''}`}>
        <div className="dashboard-gap-panel-top">
          <div>
            <div className="dashboard-gap-panel-venue">{gapPanelPrimary?.venue?.name || '—'}</div>
            <div className="dashboard-gap-panel-meta">
              {gapPanelPrimary?.venue?.venue_type ? (VENUE_TYPE_LABELS[gapPanelPrimary.venue.venue_type] || gapPanelPrimary.venue.venue_type) : ''}
              {gapsForPanel.length === 1 && gapPanelPrimary?.town?.name ? ` · ${gapPanelPrimary.town.name}` : ''}
              {gapsForPanel.length > 1 ? ` · ${gapsForPanel.length} locations` : ''}
              {' · '}
              {gapPanelPrimary?.submitted_by?.name || gapPanelPrimary?.submitted_by?.email || '—'}
              {' · '}
              {formatTime(gapPanelPrimary?.created_at)}
            </div>
          </div>
          <button type="button" className="dashboard-gap-panel-close" onClick={closeGapPanel} aria-label="Close">
            <svg width="12" height="12" fill="none" viewBox="0 0 14 14"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="dashboard-gap-panel-body">
          <div className="dashboard-gap-panel-section">
            <div className="dashboard-gap-panel-label">{gapsForPanel.length > 1 ? 'Locations' : 'Location'}</div>
            <ul className="dashboard-gap-panel-locations">
              {gapsForPanel.map((loc) => (
                <li key={loc.id} className="dashboard-gap-panel-location-row">
                  <div className="dashboard-gap-panel-loc-main">
                    <span className="dashboard-gap-panel-loc-place">{loc.town?.name || '—'}</span>
                    <span className="dashboard-gap-panel-loc-when">{formatTime(loc.created_at)}</span>
                  </div>
                  {loc.notes?.trim() ? (
                    <div className="dashboard-gap-panel-loc-notes">{loc.notes.trim()}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="dashboard-gap-panel-section">
            <div className="dashboard-gap-panel-label">Decision</div>
            <div className="dashboard-gap-panel-triage">
              <button
                type="button"
                className={`dashboard-gap-panel-triage-btn pursue${gapsForPanel.length && gapsForPanel.every((x) => x.status === 'pursue') ? ' sel' : ''}`}
                onClick={() => gapPanelKey && handleGapDecisionPanel('pursue')}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Pursue
              </button>
              <button
                type="button"
                className={`dashboard-gap-panel-triage-btn revisit${gapsForPanel.length && gapsForPanel.every((x) => x.status === 'revisit') ? ' sel' : ''}`}
                onClick={() => gapPanelKey && handleGapDecisionPanel('revisit')}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M7 3v4l2.5 2.5M12 7A5 5 0 1 1 2 7a5 5 0 0 1 10 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Revisit
              </button>
              <button
                type="button"
                className={`dashboard-gap-panel-triage-btn skip${gapsForPanel.length && gapsForPanel.every((x) => x.status === 'skip') ? ' sel' : ''}`}
                onClick={() => gapPanelKey && handleGapDecisionPanel('skip')}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 14 14"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                Pass
              </button>
            </div>
          </div>
          {panelPursueGaps.length > 0 && (() => {
            const progressStages = ['contacted', 'visit_booked', 'now_stocking'];
            const stageLabels = { contacted: 'Contacted', visit_booked: 'Visit booked', now_stocking: 'Now stocking' };
            const ref = stageRefGap;
            const activeIdx = ref?.stage && progressStages.includes(ref.stage) ? progressStages.indexOf(ref.stage) : -1;
            return (
              <div className="dashboard-gap-panel-section">
                <div className="dashboard-gap-panel-label">Pursuit stage</div>
                <div className="gap-stepper gap-stepper-panel">
                  {progressStages.map((s, i) => {
                    const done = activeIdx >= 0 && i < activeIdx;
                    const active = i === activeIdx;
                    return (
                      <React.Fragment key={s}>
                        {i > 0 && <div className={`gap-stepper-line${done || active ? ' done' : ''}`} />}
                        <button type="button" className={`gap-stepper-step${active ? ' active' : ''}${done ? ' done' : ''}`} onClick={() => gapPanelKey && handleGapStagePanel(s)}>
                          <span className="gap-stepper-circ">{done ? '✓' : (i + 1)}</span>
                          <span className="gap-stepper-lbl">{stageLabels[s]}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                  <div className="gap-stepper-sep" />
                  <button type="button" className={`gap-stepper-declined${ref?.stage === 'declined' ? ' active' : ''}`} onClick={() => gapPanelKey && handleGapStagePanel('declined')}>
                    <span className="gap-stepper-declined-circ" aria-hidden>×</span>
                    <span className="gap-stepper-declined-lbl">Declined</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Drawer */}
      <div className={`dashboard-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="dashboard-drawer-header">
          <div>
            <div className="dashboard-drawer-brand">{selectedSighting?.brand?.name || '—'}</div>
            <div className="dashboard-drawer-venue">
              {selectedSighting?.venue?.name || '—'}
              {selectedSighting?.town?.name ? ` (${selectedSighting.town.name})` : ''}
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
              <div
                className="dashboard-drawer-photo"
                onClick={() => {
                  const url = drawerPhotoUrl || (selectedSighting.photo_url && !selectedSighting.photo_url.startsWith(window.location.origin) ? selectedSighting.photo_url : null);
                  if (url) setPhotoLightboxOpen(true);
                }}
                role={drawerPhotoUrl || (selectedSighting.photo_url && !selectedSighting.photo_url.startsWith(window.location.origin)) ? 'button' : undefined}
                tabIndex={drawerPhotoUrl || (selectedSighting.photo_url && !selectedSighting.photo_url.startsWith(window.location.origin)) ? 0 : undefined}
                onKeyDown={(e) => {
                  const url = drawerPhotoUrl || (selectedSighting.photo_url && !selectedSighting.photo_url.startsWith(window.location.origin) ? selectedSighting.photo_url : null);
                  if (url && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setPhotoLightboxOpen(true);
                  }
                }}
              >
                {drawerPhotoUrl ? (
                  <img
                    src={drawerPhotoUrl}
                    alt=""
                    onError={() => {
                      setDrawerPhotoError('failed');
                      setDrawerPhotoErrorReason('Image failed to load');
                      setDrawerPhotoUrl(null);
                    }}
                  />
                ) : (() => {
                  // Only use photo_url in img when it's external (e.g. S3). Our API photo endpoint
                  // requires auth; img tags don't send Authorization, so that would 401.
                  const url = selectedSighting.photo_url;
                  const isExternal = url && !url.startsWith(window.location.origin);
                  return isExternal ? <img src={url} alt="" /> : null;
                })() ?? (
                  <span className="dashboard-drawer-photo-placeholder" title={drawerPhotoErrorReason || (drawerPhotoError === 'no_photo' ? 'No photo for this sighting' : '')}>
                    {drawerPhotoError === 'no_photo' ? 'No photo' : drawerPhotoError ? (drawerPhotoErrorReason ? `Photo unavailable — ${drawerPhotoErrorReason}` : 'Photo unavailable') : 'Photo'}
                  </span>
                )}
              </div>
              {photoLightboxOpen && (
                <div
                  className="dashboard-photo-lightbox"
                  onClick={() => setPhotoLightboxOpen(false)}
                  role="dialog"
                  aria-modal="true"
                  aria-label="View full size photo"
                >
                  <button
                    type="button"
                    className="dashboard-photo-lightbox-close"
                    onClick={e => { e.stopPropagation(); setPhotoLightboxOpen(false); }}
                    aria-label="Close"
                  >
                    &#215;
                  </button>
                  <img
                    src={drawerPhotoUrl || (selectedSighting.photo_url && !selectedSighting.photo_url.startsWith(window.location.origin) ? selectedSighting.photo_url : '')}
                    alt="Sighting photo"
                  />
                </div>
              )}
              <div className="dashboard-drawer-badge-row">
                <span className={`dashboard-drawer-badge ${selectedSighting.brand?.is_own_brand ? 'own' : 'comp'}`}>
                  {selectedSighting.brand?.is_own_brand ? 'Your brand' : 'Competitor'}
                </span>
              </div>
              <div className="dashboard-drawer-fields">
                {['placement', 'price', 'obs', 'promo', 'unit'].map((key) => {
                  const labels = { placement: 'Placement', price: 'Price', obs: 'Observation', promo: 'Promo', unit: 'Unit' };
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
                {selectedSighting.data?.unit && (
                  <span className="dashboard-chip navy">{selectedSighting.data.unit}</span>
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
              {(selectedSighting.promo_details || selectedSighting.data?.promo_details) && (
                <>
                  <div className="dashboard-drawer-section-label">Promo details</div>
                  <div className="dashboard-drawer-notes">{selectedSighting.promo_details || selectedSighting.data?.promo_details}</div>
                </>
              )}
              {selectedSighting.data?.notes && (
                <>
                  <div className="dashboard-drawer-section-label">Notes</div>
                  <div className="dashboard-drawer-notes">{selectedSighting.data.notes}</div>
                </>
              )}
              <div className="dashboard-drawer-divider" />
              <div className="dashboard-drawer-actions">
                <button type="button" className="dashboard-drawer-btn dashboard-drawer-btn-edit" onClick={handleEditSighting}>
                  Edit
                </button>
                {deleteConfirmId === selectedSighting.id ? (
                  <div className="dashboard-drawer-delete-confirm">
                    <span>Delete this sighting?</span>
                    <div className="dashboard-drawer-delete-btns">
                      <button type="button" className="dashboard-drawer-btn dashboard-drawer-btn-cancel" onClick={() => setDeleteConfirmId(null)}>
                        Cancel
                      </button>
                      <button type="button" className="dashboard-drawer-btn dashboard-drawer-btn-delete" onClick={confirmDeleteSighting}>
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="dashboard-drawer-btn dashboard-drawer-btn-delete-outline" onClick={handleDeleteSighting}>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
