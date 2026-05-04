import { useState, useMemo } from 'react';
import { Pencil, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROW_ORDER = ['bonus','pf','esi','other'];

export const DEFAULT_COMPONENTS = {
  bonus: { label: 'Bonus',    rate: 8.33,  enabled: true  },
  pf:    { label: 'PF',       rate: 12,    enabled: true  },
  esi:   { label: 'Emp. ESI', rate: 0.75,  enabled: true  },
  other: { label: 'Other',    rate: 0,     enabled: false },
};

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

const ROW_META = {
  bonus: { fixed: true,  hint: '% of total monthly salary — accrued monthly' },
  pf:    { fixed: true,  hint: '% of total monthly salary' },
  esi:   { fixed: true,  hint: '% of total monthly salary' },
  other: { fixed: false, hint: '% of total monthly salary — custom component' },
};

export default function PayrollComponents({ employees, year, components, setComponents }) {
  const [editing, setEditing]   = useState(null);
  const [draft,   setDraft]     = useState({});

  const totalSalary = useMemo(
    () => employees.reduce((s, e) => s + (Number(e.salary) || 0), 0),
    [employees],
  );

  const monthlyAmt = (key) => {
    const c = components[key];
    if (!c.enabled || !Number(c.rate)) return null;
    return (totalSalary * Number(c.rate)) / 100;
  };

  const grandMonthly = ROW_ORDER.reduce((acc, k) => acc + (monthlyAmt(k) ?? 0), 0);
  const grandTotal   = grandMonthly * 12;

  const startEdit = (key) => { setEditing(key); setDraft({ ...components[key] }); };
  const cancelEdit = () => setEditing(null);
  const saveEdit = () => {
    setComponents(prev => ({
      ...prev,
      [editing]: {
        ...prev[editing],
        label: (ROW_META[editing].fixed ? prev[editing].label : (draft.label || prev[editing].label)),
        rate:  parseFloat(draft.rate) || 0,
      },
    }));
    setEditing(null);
  };

  const toggleRow = (key) => {
    setComponents(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  return (
    <div>
      {/* Header panel */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span>Payroll Components — {year}</span>
            <div className="panel-title-sub" style={{ marginTop: 4, fontWeight: 400 }}>
              Monthly statutory & custom salary component breakdown
            </div>
          </div>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-dim)',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
          }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Based on total monthly salary</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15 }}>{fmt(totalSalary)}</span>
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{employees.length} employees</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 1140, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 200, paddingLeft: 20 }}>Component</th>
                {MONTHS.map(m => (
                  <th key={m} style={{ textAlign: 'right', minWidth: 82, fontSize: 12 }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', minWidth: 110, paddingRight: 20 }}>
                  Annual Total
                </th>
              </tr>
            </thead>
            <tbody>
              {ROW_ORDER.map(key => {
                const c   = components[key];
                const amt = monthlyAmt(key);
                return (
                  <tr key={key} style={{ opacity: c.enabled ? 1 : 0.4 }}>
                    {/* Label cell */}
                    <td style={{ paddingLeft: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleRow(key)}
                          title={c.enabled ? 'Click to disable' : 'Click to enable'}
                          style={{ padding: 2, flexShrink: 0 }}
                        >
                          {c.enabled
                            ? <ToggleRight size={20} style={{ color: 'var(--accent)' }} />
                            : <ToggleLeft  size={20} style={{ color: 'var(--text-faint)' }} />}
                        </button>
                        <span style={{ fontWeight: 500 }}>{c.label}</span>
                        <span style={{
                          fontSize: 11, color: 'var(--accent)',
                          background: 'rgba(212,160,74,0.12)',
                          border: '1px solid rgba(212,160,74,0.25)',
                          borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                        }}>
                          {c.rate}%
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(key)}
                          title="Edit rate"
                          style={{ padding: 3, marginLeft: 2, flexShrink: 0 }}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </td>

                    {/* 12 month cells — same value each month since salary is fixed */}
                    {MONTHS.map(m => (
                      <td key={m} style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 13,
                        color: amt != null ? 'var(--text)' : 'var(--text-faint)',
                      }}>
                        {amt != null ? fmt(amt) : '—'}
                      </td>
                    ))}

                    {/* Annual total */}
                    <td style={{
                      textAlign: 'right', paddingRight: 20,
                      fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: amt != null ? 'var(--accent-2)' : 'var(--text-faint)',
                    }}>
                      {amt != null ? fmt(amt * 12) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-2)', borderTop: '2px solid var(--border-2)' }}>
                <td style={{ paddingLeft: 20, fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                  Grand Total
                </td>
                {MONTHS.map(m => (
                  <td key={m} style={{
                    textAlign: 'right', fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', fontSize: 13,
                    color: grandMonthly > 0 ? 'var(--text)' : 'var(--text-faint)',
                  }}>
                    {grandMonthly > 0 ? fmt(grandMonthly) : '—'}
                  </td>
                ))}
                <td style={{
                  textAlign: 'right', paddingRight: 20, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', fontSize: 13,
                  color: 'var(--accent)',
                }}>
                  {grandTotal > 0 ? fmt(grandTotal) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info note */}
      <div className="info-note" style={{ marginTop: 16, fontSize: 12 }}>
        All values are computed as a fixed percentage of the total monthly salary.
        Use the pencil icon on each row to adjust the rate. Toggle the switch to enable/disable a component.
        The "Other" row lets you define a custom component (e.g. HRA, LTA).
      </div>

      {/* Edit modal */}
      {editing && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}
            onClick={cancelEdit}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-1)', border: '1px solid var(--border-2)',
            borderRadius: 14, padding: '24px 28px', zIndex: 201, minWidth: 340,
            boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {ROW_META[editing].fixed ? `Edit ${components[editing].label}` : 'Edit Custom Component'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
                  {ROW_META[editing].hint}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit} style={{ padding: 4 }}>
                <X size={15} />
              </button>
            </div>

            {/* Label field — only for "other" row */}
            {!ROW_META[editing].fixed && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>
                  Component Name
                </label>
                <input
                  className="input"
                  value={draft.label}
                  onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. HRA, LTA, CCA…"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>
                Rate (% of total monthly salary)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draft.rate}
                  onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))}
                  style={{ width: '100%' }}
                  autoFocus={ROW_META[editing].fixed}
                />
                <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>%</span>
              </div>
              {totalSalary > 0 && Number(draft.rate) > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                  Monthly: {fmt((totalSalary * Number(draft.rate)) / 100)}
                  {' '}· Annual: {fmt((totalSalary * Number(draft.rate)) / 100 * 12)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-sm" onClick={saveEdit}>
                <Check size={13} /> Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
