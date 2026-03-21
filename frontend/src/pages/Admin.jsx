import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const FIELD_LABELS = {
  brand: 'Brand',
  placement: 'Placement',
  price: 'Price',
  obs: 'Observations',
  promo: 'Promo',
  notes: 'Notes',
  unit: 'Multipack or Single unit',
};

const FIELD_DESCS = {
  brand: 'Which brand did you see?',
  placement: 'Where in store?',
  price: 'Retail price on shelf',
  obs: 'Type of activity spotted',
  promo: 'Any deal or campaign running?',
  notes: 'Anything else to capture?',
  unit: 'multipack or single unit',
};

const ALL_FIELDS = ['brand', 'placement', 'price', 'obs', 'promo', 'notes', 'unit'];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('team');
  const [team, setTeam] = useState([]);
  const [orgCode, setOrgCode] = useState('');
  const [fields, setFields] = useState([]);
  const [brands, setBrands] = useState([]);
  const [fieldDraft, setFieldDraft] = useState([]);
  const [brandDraft, setBrandDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const lastCompetitorRef = useRef(null);

  useEffect(() => {
    api.get('/auth/me/').then((res) => {
      if (res.data?.organisation?.unique_code) setOrgCode(res.data.organisation.unique_code);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'team') {
      api.get('/users/').then((res) => setTeam(res.data)).catch(() => setTeam([]));
    }
    if (tab === 'fields') {
      api.get('/config/fields/').then((res) => {
        setFields(res.data);
        const ordered = ALL_FIELDS.map((fid) => {
          const existing = res.data.find((f) => f.field_id === fid);
          return existing || { field_id: fid, is_active: false, display_order: 999 };
        });
        setFieldDraft(ordered.sort((a, b) => (a.display_order || 999) - (b.display_order || 999)));
      });
    }
    if (tab === 'brands') {
      api.get('/config/brands/').then((res) => {
        setBrands(res.data);
        setBrandDraft(res.data.map((b) => ({ ...b })));
      });
    }
  }, [tab]);

  const activeCount = fieldDraft.filter((f) => f.is_active).length;
  const maxActive = 5;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const copyInviteCode = () => {
    if (!orgCode) return;
    navigator.clipboard.writeText(orgCode).then(() => showToast('Code copied')).catch(() => showToast('Copy failed'));
  };

  const saveFields = () => {
    if (activeCount > maxActive) return;
    setSaving(true);
    const payload = fieldDraft
      .filter((f) => ALL_FIELDS.includes(f.field_id))
      .map((f, i) => ({
        field_id: f.field_id,
        is_active: f.is_active,
        display_order: i + 1,
      }));
    api
      .post('/config/fields/', payload)
      .then((res) => {
        setFields(res.data);
        setFieldDraft(res.data.map((f) => ({ ...f })));
        showToast('Fields saved');
      })
      .finally(() => setSaving(false));
  };

  const toggleField = (fieldId) => {
    setFieldDraft((d) => {
      const next = d.map((f) =>
        f.field_id === fieldId ? { ...f, is_active: !f.is_active } : f
      );
      const count = next.filter((f) => f.is_active).length;
      if (count > maxActive) return d;
      return next;
    });
  };

  const saveBrands = () => {
    setSaving(true);
    const payload = brandDraft.map((b) => ({ name: b.name, is_own_brand: b.is_own_brand }));
    api
      .post('/config/brands/', payload)
      .then((res) => {
        setBrands(res.data);
        setBrandDraft(res.data.map((b) => ({ ...b })));
        showToast('Brands saved');
      })
      .finally(() => setSaving(false));
  };

  const addCompetitor = () => {
    setBrandDraft((d) => [...d, { name: '', is_own_brand: false }]);
    setTimeout(() => lastCompetitorRef.current?.focus(), 50);
  };

  const removeCompetitor = (idx) => {
    setBrandDraft((d) => d.filter((_, i) => i !== idx || d[i].is_own_brand));
  };

  const updateBrandName = (idx, name) => {
    setBrandDraft((d) => d.map((b, i) => (i === idx ? { ...b, name } : b)));
  };

  const adminCount = team.filter((u) => u.role === 'admin').length;

  return (
    <div className="page admin-page">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Configure what your team tracks.</p>
      </div>

      <div className="admin-tab-bar">
        <button
          type="button"
          className={`admin-tab ${tab === 'team' ? 'active' : ''}`}
          onClick={() => setTab('team')}
        >
          Team
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'fields' ? 'active' : ''}`}
          onClick={() => setTab('fields')}
        >
          Fields
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'brands' ? 'active' : ''}`}
          onClick={() => setTab('brands')}
        >
          Brands
        </button>
      </div>

      {/* Team tab */}
      <div className={`admin-tab-panel ${tab === 'team' ? 'active' : ''}`} id="panel-team">
        <div className="admin-invite-code-card">
          <div className="admin-section-label">Invite code</div>
          <p className="admin-invite-code-desc">Share this code so others can join your team at the Join page.</p>
          <div className="admin-invite-code-row">
            <code className="admin-invite-code">{orgCode || '…'}</code>
            <button type="button" className="admin-invite-copy-btn" onClick={copyInviteCode} disabled={!orgCode}>
              Copy
            </button>
          </div>
        </div>
        <div className="admin-team-meta">
          {team.length} member{team.length !== 1 ? 's' : ''} · {adminCount} admin{adminCount !== 1 ? 's' : ''}
        </div>
        <div className="admin-table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</strong></td>
                  <td className="admin-email-cell">{u.email}</td>
                  <td>
                    <span className={`admin-role-badge ${u.role === 'admin' ? 'admin' : 'member'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </td>
                  <td className="admin-date-cell">
                    {u.date_joined ? new Date(u.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fields tab */}
      <div className={`admin-tab-panel ${tab === 'fields' ? 'active' : ''}`} id="panel-fields">
        <div className="admin-slot-card">
          <div className="admin-slot-dots">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`admin-slot-dot ${i < activeCount ? 'filled' : 'empty'}`} />
            ))}
          </div>
          <span className="admin-slot-text">
            {activeCount} of {maxActive} fields active
          </span>
        </div>
        <p className="admin-slot-note">
          Every additional field reduces how often your team logs — we recommend 3.
        </p>

        <div id="field-list">
          {fieldDraft.map((f) => (
            <div
              key={f.field_id}
              className={`admin-field-row ${f.is_active ? 'on' : 'off'}`}
            >
              <div className="admin-field-info">
                <div className="admin-field-name">{FIELD_LABELS[f.field_id] || f.field_id}</div>
                <div className="admin-field-desc">{FIELD_DESCS[f.field_id] || ''}</div>
              </div>
              <button
                type="button"
                className={`admin-toggle ${f.is_active ? 'on' : ''}`}
                onClick={() => toggleField(f.field_id)}
                disabled={!f.is_active && activeCount >= maxActive}
                title={!f.is_active && activeCount >= maxActive ? 'Max 5 fields reached' : ''}
              />
            </div>
          ))}
        </div>

        <button type="button" className="admin-save-btn" onClick={saveFields} disabled={saving}>
          {saving ? 'Saving…' : 'Save fields'}
        </button>
      </div>

      {/* Brands tab */}
      <div className={`admin-tab-panel ${tab === 'brands' ? 'active' : ''}`} id="panel-brands">
        <div className="admin-section-label">Your brand</div>
        {brandDraft.filter((b) => b.is_own_brand).map((b) => (
          <div key={b.id || 'own'} className="admin-own-brand-row">
            <span className="admin-yours-badge">Yours</span>
            <input
              type="text"
              className="admin-own-brand-input"
              value={b.name}
              readOnly
            />
          </div>
        ))}

        <div className="admin-section-label">Competitors</div>
        <div className="admin-competitor-list">
          {(() => {
            const lastCompIdx = brandDraft.reduce((last, x, i) => (!x.is_own_brand ? i : last), -1);
            return brandDraft.map((b, idx) =>
            !b.is_own_brand ? (
              <div key={b.id || `comp-${idx}`} className="admin-competitor-row">
                <input
                  ref={idx === lastCompIdx ? lastCompetitorRef : null}
                  type="text"
                  className="admin-competitor-input"
                  value={b.name}
                  onChange={(e) => updateBrandName(idx, e.target.value)}
                  placeholder="Brand name"
                />
                <button
                  type="button"
                  className="admin-delete-btn"
                  onClick={() => removeCompetitor(idx)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ) : null
          );
          })()}
        </div>

        <button type="button" className="admin-add-competitor-btn" onClick={addCompetitor}>
          <span className="admin-add-icon">+</span>
          Add competitor
        </button>

        <button type="button" className="admin-save-btn" onClick={saveBrands} disabled={saving}>
          {saving ? 'Saving…' : 'Save brands'}
        </button>
      </div>

      <div className={`admin-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
