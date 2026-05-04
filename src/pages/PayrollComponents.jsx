import { useState, useMemo, Fragment } from 'react';
import { Pencil, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { AEEPL_DIVISOR, monthKey } from '../payroll';
import { ESI_THRESHOLD } from '../seedData';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROW_ORDER = ['bonus','pf','esi','other'];

export const DEFAULT_COMPONENTS = {
  bonus: { label: 'Bonus',    type: 'per_day',    rate: 151.35, enabled: true  },
  pf:    { label: 'PF',       type: 'percentage', rate: 12,     enabled: true  },
  esi:   { label: 'Emp. ESI', type: 'percentage', rate: 0.75,   enabled: true  },
  other: { label: 'Other',    type: 'percentage', rate: 0,      enabled: false },
};

// Migrate stored data that may be in the old format (rate: 8.33, no type field)
function normalizeComponents(raw) {
  if (!raw) return DEFAULT_COMPONENTS;
  const out = {};
  for (const key of ROW_ORDER) {
    const def = DEFAULT_COMPONENTS[key];
    out[key] = { ...def, ...(raw[key] || {}) };
    if (!out[key].type) out[key].type = def.type;
  }
  return out;
}

const ROW_META = {
  bonus: { fixed: true,  hint: 'Bonus flag ON + salary ≤ ₹21,000' },
  pf:    { fixed: true,  hint: 'Applies to all employees'           },
  esi:   { fixed: true,  hint: 'ESI flag ON + salary ≤ ₹21,000'    },
  other: { fixed: false, hint: 'Custom — applies to all employees'  },
};

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// Mirror of computeMonthPayroll's attendance logic (single employee, single month)
function getDaysPresentForMonth(emp, attendance, year, mi) {
  const mKey    = monthKey(year, mi);
  const monthAtt = attendance?.[mKey] || {};
  const absentArr = monthAtt[`d${emp.id}`];
  const otArr     = monthAtt[`ot${emp.id}`] || [];
  const otCount   = otArr.filter(([, t]) => t === 'full').length;
  if (absentArr !== undefined) return Math.max(0, AEEPL_DIVISOR - absentArr.length + otCount);
  if (monthAtt[emp.id] != null) return Number(monthAtt[emp.id]);
  return AEEPL_DIVISOR;
}

function appliesToEmp(key, emp) {
  if (key === 'bonus') return !!emp.bonus && Number(emp.salary) <= ESI_THRESHOLD;
  if (key === 'esi')   return !!emp.esi   && Number(emp.salary) <= ESI_THRESHOLD;
  return true;
}

// ── Sticky column styles ────────────────────────────────────────────────────
const STICKY1_W = 172;  // px — width of first column (Employee or Component in summary)
const STICKY2_W = 122;  // px — width of second column (Component in detail)

function stickyTh1(extra = {}) {
  return { position: 'sticky', left: 0, zIndex: 4, background: 'var(--bg-2)', ...extra };
}
function stickyTh2(extra = {}) {
  return { position: 'sticky', left: STICKY1_W, zIndex: 4, background: 'var(--bg-2)', ...extra };
}
function stickyTd1(bg = 'var(--bg-1)', extra = {}) {
  return { position: 'sticky', left: 0, zIndex: 2, background: bg, ...extra };
}
function stickyTd2(bg = 'var(--bg-1)', extra = {}) {
  return { position: 'sticky', left: STICKY1_W, zIndex: 2, background: bg, ...extra };
}

// Sticky tfoot
const STICKY_FOOT = { position: 'sticky', bottom: 0, zIndex: 3, background: 'var(--bg-2)' };

export default function PayrollComponents({ employees, year, attendance, components: rawComponents, setComponents }) {
  const components = useMemo(() => normalizeComponents(rawComponents), [rawComponents]);

  const [view,         setView]         = useState('summary');
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [editing,      setEditing]      = useState(null);
  const [draft,        setDraft]        = useState({});

  // ── Derived ──────────────────────────────────────────────────────────────
  const firms = useMemo(() => {
    const s = new Set(employees.map(e => e.firm).filter(Boolean));
    return [...s].sort();
  }, [employees]);

  const filteredEmps = useMemo(() =>
    selectedFirm === 'all' ? employees : employees.filter(e => e.firm === selectedFirm),
    [employees, selectedFirm],
  );

  // Pre-compute summary monthly amounts [12 months] per component
  const summaryValues = useMemo(() => {
    const out = {};
    for (const key of ROW_ORDER) {
      const c = components[key];
      out[key] = MONTHS.map((_, mi) => {
        if (!c.enabled || !Number(c.rate)) return null;
        if (c.type === 'per_day') {
          const applicable = employees.filter(e => appliesToEmp(key, e));
          if (!applicable.length) return null;
          const total = applicable.reduce((s, emp) =>
            s + getDaysPresentForMonth(emp, attendance, year, mi) * Number(c.rate), 0);
          return total > 0 ? total : null;
        } else {
          const applicable = employees.filter(e => appliesToEmp(key, e));
          const totalSal = applicable.reduce((s, e) => s + (Number(e.salary) || 0), 0);
          return totalSal > 0 ? (totalSal * Number(c.rate)) / 100 : null;
        }
      });
    }
    return out;
  }, [components, employees, attendance, year]);

  // Pre-compute per-employee monthly amounts [ROW_ORDER][12 months]
  const empValues = useMemo(() =>
    filteredEmps.map(emp => ({
      emp,
      rows: ROW_ORDER.map(key => {
        const c = components[key];
        return MONTHS.map((_, mi) => {
          if (!c.enabled || !Number(c.rate) || !appliesToEmp(key, emp)) return null;
          if (c.type === 'per_day') {
            const dp = getDaysPresentForMonth(emp, attendance, year, mi);
            return dp * Number(c.rate);
          }
          const sal = Number(emp.salary) || 0;
          return sal > 0 ? (sal * Number(c.rate)) / 100 : null;
        });
      }),
    })),
    [components, filteredEmps, attendance, year],
  );

  // Grand totals
  const summaryGrandByMonth = MONTHS.map((_, mi) =>
    ROW_ORDER.reduce((s, k) => s + (summaryValues[k]?.[mi] ?? 0), 0),
  );
  const summaryGrandAnnual = summaryGrandByMonth.reduce((s, v) => s + v, 0);

  const detailGrandByMonth = MONTHS.map((_, mi) =>
    empValues.reduce((s, { rows }) =>
      s + ROW_ORDER.reduce((rs, _, ki) => rs + (rows[ki][mi] ?? 0), 0), 0),
  );
  const detailGrandAnnual = detailGrandByMonth.reduce((s, v) => s + v, 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const startEdit  = (key) => { setEditing(key); setDraft({ ...components[key] }); };
  const cancelEdit = () => setEditing(null);
  const saveEdit   = () => {
    setComponents(prev => {
      const current = normalizeComponents(prev);
      return {
        ...current,
        [editing]: {
          ...current[editing],
          label: ROW_META[editing].fixed ? current[editing].label : (draft.label || current[editing].label),
          rate: parseFloat(draft.rate) || 0,
        },
      };
    });
    setEditing(null);
  };
  const toggleRow = (key) =>
    setComponents(prev => {
      const current = normalizeComponents(prev);
      return { ...current, [key]: { ...current[key], enabled: !current[key].enabled } };
    });

  // ── Shared cell styles ────────────────────────────────────────────────────
  const numCell   = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 };
  const faintNum  = { ...numCell, color: 'var(--text-faint)' };

  const rateLabel = (key) => {
    const c = components[key];
    return c.type === 'per_day' ? `₹${c.rate}/day` : `${c.rate}%`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="panel-title">Payroll Components — {year}</div>
            <div className="panel-title-sub" style={{ marginTop: 4, fontWeight: 400 }}>
              Statutory &amp; custom salary components, month-wise
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2, padding: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            {[{ id: 'summary', label: 'Summary' }, { id: 'detail', label: 'Employee Detail' }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                background: view === v.id ? 'var(--accent)' : 'transparent',
                color:      view === v.id ? '#0e0f11'       : 'var(--text-dim)',
              }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rate cards */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {ROW_ORDER.map(key => {
            const c = components[key];
            return (
              <div key={key} style={{
                flex: '1 1 170px', display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-2)', border: `1px solid ${c.enabled ? 'var(--border-2)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', opacity: c.enabled ? 1 : 0.45, transition: 'opacity 0.2s',
              }}>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleRow(key)} style={{ padding: 2 }} title={c.enabled ? 'Disable' : 'Enable'}>
                  {c.enabled
                    ? <ToggleRight size={20} style={{ color: 'var(--accent)' }} />
                    : <ToggleLeft  size={20} style={{ color: 'var(--text-faint)' }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>
                    {c.type === 'per_day' ? `₹${c.rate} per present day` : `${c.rate}% of salary`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{ROW_META[key].hint}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(key)} style={{ padding: 4 }} title="Edit rate">
                  <Pencil size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SUMMARY VIEW ─────────────────────────────────────────────────── */}
      {view === 'summary' && (
        <>
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 1160, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={stickyTh1({ textAlign: 'left', minWidth: STICKY1_W, paddingLeft: 20 })}>Component</th>
                    {MONTHS.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 80, fontSize: 12 }}>{m}</th>)}
                    <th style={{ textAlign: 'right', minWidth: 110, paddingRight: 20 }}>Annual Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ROW_ORDER.map(key => {
                    const c    = components[key];
                    const vals = summaryValues[key];
                    const annual = vals.reduce((s, v) => s + (v ?? 0), 0);
                    return (
                      <tr key={key} style={{ opacity: c.enabled ? 1 : 0.38 }}>
                        <td style={stickyTd1('var(--bg-1)', { paddingLeft: 20 })}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>{c.label}</span>
                            <span style={{
                              fontSize: 11, color: 'var(--accent)',
                              background: 'rgba(212,160,74,0.12)', border: '1px solid rgba(212,160,74,0.22)',
                              borderRadius: 4, padding: '1px 5px',
                            }}>{rateLabel(key)}</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => startEdit(key)}
                              title={`Edit ${c.label} rate`}
                              style={{ padding: 3, marginLeft: 2 }}
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{ROW_META[key].hint}</div>
                        </td>
                        {vals.map((amt, mi) => (
                          <td key={mi} style={amt != null ? numCell : faintNum}>
                            {amt != null ? fmt(amt) : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: annual > 0 ? 'var(--accent-2)' : 'var(--text-faint)' }}>
                          {annual > 0 ? fmt(annual) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                    <td style={stickyTd1('var(--bg-2)', { paddingLeft: 20, fontWeight: 700, fontSize: 13, ...STICKY_FOOT })}>
                      Grand Total
                    </td>
                    {summaryGrandByMonth.map((v, mi) => (
                      <td key={mi} style={{ ...numCell, fontWeight: 700, color: v > 0 ? 'var(--text)' : 'var(--text-faint)', ...STICKY_FOOT }}>
                        {v > 0 ? fmt(v) : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--accent)', ...STICKY_FOOT }}>
                      {summaryGrandAnnual > 0 ? fmt(summaryGrandAnnual) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="info-note" style={{ marginTop: 14, fontSize: 12 }}>
            Bonus: ₹{components.bonus.rate}/present-day for eligible employees (Bonus flag ON, salary ≤ ₹{ESI_THRESHOLD.toLocaleString('en-IN')}).
            ESI: {components.esi.rate}% of salary for eligible employees (ESI flag ON, salary ≤ ₹{ESI_THRESHOLD.toLocaleString('en-IN')}).
            Bonus values vary month-to-month based on actual attendance.
          </div>
        </>
      )}

      {/* ── EMPLOYEE DETAIL VIEW ─────────────────────────────────────────── */}
      {view === 'detail' && (
        <>
          {/* Firm filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginRight: 2 }}>Firm:</span>
            {['all', ...firms].map(f => (
              <button key={f} onClick={() => setSelectedFirm(f)} style={{
                padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                borderColor: selectedFirm === f ? 'var(--accent)'        : 'var(--border)',
                background:  selectedFirm === f ? 'rgba(212,160,74,0.14)' : 'var(--bg-1)',
                color:       selectedFirm === f ? 'var(--accent)'        : 'var(--text-dim)',
              }}>
                {f === 'all' ? 'All Firms' : f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
              {filteredEmps.length} employee{filteredEmps.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredEmps.length === 0 ? (
            <div className="info-note" style={{ textAlign: 'center', padding: 48 }}>No employees in this firm.</div>
          ) : (
            <>
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Fixed-height container: both axes scroll, scrollbars always visible */}
                <div style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 320px)',
                }}>
                  <table className="tbl" style={{ minWidth: 1280, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={stickyTh1({ textAlign: 'left', minWidth: STICKY1_W, paddingLeft: 20 })}>Employee</th>
                        <th style={stickyTh2({ textAlign: 'left', minWidth: STICKY2_W })}>Component</th>
                        {MONTHS.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 78, fontSize: 12 }}>{m}</th>)}
                        <th style={{ textAlign: 'right', minWidth: 110, paddingRight: 20 }}>Annual Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empValues.map(({ emp, rows }, empIdx) => {
                        const monthlyTotals = MONTHS.map((_, mi) =>
                          rows.reduce((s, mVals) => s + (mVals[mi] ?? 0), 0),
                        );
                        const empAnnual = monthlyTotals.reduce((s, v) => s + v, 0);
                        const rowBg = empIdx % 2 === 1 ? 'var(--bg-2)' : 'var(--bg-1)';
                        const empKey = emp.id || emp.name || empIdx;

                        return (
                          <Fragment key={empKey}>
                            {/* 4 component sub-rows */}
                            {ROW_ORDER.map((key, rowIdx) => {
                              const c       = components[key];
                              const mVals   = rows[rowIdx];
                              const annual  = mVals.reduce((s, v) => s + (v ?? 0), 0);
                              const isFirst = rowIdx === 0;
                              const isLast  = rowIdx === ROW_ORDER.length - 1;
                              const pt = isFirst ? 10 : 3;
                              const pb = isLast  ? 6  : 3;
                              return (
                                <tr key={key} style={{
                                  background: rowBg,
                                  borderTop: isFirst ? '1px solid var(--border)' : 'none',
                                  opacity: c.enabled ? 1 : 0.38,
                                }}>
                                  {/* Sticky col 1: employee name (first sub-row only) */}
                                  <td style={stickyTd1(rowBg, { paddingLeft: 20, paddingTop: pt, paddingBottom: pb, verticalAlign: 'top' })}>
                                    {isFirst && (
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                          {emp.firm}{emp.salary ? ` · ${fmt(emp.salary)}/mo` : ''}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Sticky col 2: component label */}
                                  <td style={stickyTd2(rowBg, { paddingTop: pt, paddingBottom: pb })}>
                                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.label}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 4 }}>{rateLabel(key)}</span>
                                  </td>

                                  {/* Monthly cells */}
                                  {mVals.map((amt, mi) => (
                                    <td key={mi} style={{ ...(amt != null ? numCell : faintNum), paddingTop: pt, paddingBottom: pb }}>
                                      {amt != null ? fmt(amt) : '—'}
                                    </td>
                                  ))}

                                  {/* Annual for this component */}
                                  <td style={{ textAlign: 'right', paddingRight: 20, fontVariantNumeric: 'tabular-nums', paddingTop: pt, paddingBottom: pb, color: annual > 0 ? 'var(--accent-2)' : 'var(--text-faint)', fontSize: 13 }}>
                                    {annual > 0 ? fmt(annual) : '—'}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Employee subtotal */}
                            <tr style={{ borderTop: '1px solid rgba(212,160,74,0.2)' }}>
                              <td colSpan={2} style={stickyTd1('rgba(36,30,18,0.7)', { paddingLeft: 20, paddingTop: 5, paddingBottom: 6 })}>
                                <span style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                                  {emp.name} — total
                                </span>
                              </td>
                              {monthlyTotals.map((v, mi) => (
                                <td key={mi} style={{ ...numCell, fontWeight: 700, fontSize: 12, color: v > 0 ? 'var(--accent)' : 'var(--text-faint)', paddingTop: 5, paddingBottom: 6, background: 'rgba(212,160,74,0.06)' }}>
                                  {v > 0 ? fmt(v) : '—'}
                                </td>
                              ))}
                              <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: empAnnual > 0 ? 'var(--accent)' : 'var(--text-faint)', paddingTop: 5, paddingBottom: 6, background: 'rgba(212,160,74,0.06)' }}>
                                {empAnnual > 0 ? fmt(empAnnual) : '—'}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>

                    {/* Sticky grand total footer */}
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-2)' }}>
                        <td colSpan={2} style={stickyTd1('var(--bg-2)', { paddingLeft: 20, fontWeight: 700, fontSize: 13, ...STICKY_FOOT })}>
                          Grand Total{selectedFirm !== 'all' ? ` — ${selectedFirm}` : ''}
                        </td>
                        {detailGrandByMonth.map((v, mi) => (
                          <td key={mi} style={{ ...numCell, fontWeight: 700, color: v > 0 ? 'var(--text)' : 'var(--text-faint)', ...STICKY_FOOT }}>
                            {v > 0 ? fmt(v) : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--accent)', ...STICKY_FOOT }}>
                          {detailGrandAnnual > 0 ? fmt(detailGrandAnnual) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="info-note" style={{ marginTop: 14, fontSize: 12 }}>
                Scroll horizontally inside the table. First two columns (Employee, Component) stay frozen.
                Bonus values reflect actual attendance per month. "—" means component doesn't apply or is disabled.
              </div>
            </>
          )}
        </>
      )}

      {/* ── EDIT MODAL ────────────────────────────────────────────────────── */}
      {editing && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }} onClick={cancelEdit} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--bg-1)', border: '1px solid var(--border-2)',
            borderRadius: 14, padding: '24px 28px', zIndex: 201, minWidth: 340,
            boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {ROW_META[editing].fixed ? `Edit ${components[editing].label}` : 'Edit Custom Component'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>{ROW_META[editing].hint}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit} style={{ padding: 4 }}><X size={15} /></button>
            </div>

            {/* Label — only for "other" */}
            {!ROW_META[editing].fixed && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>Component Name</label>
                <input className="input" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="e.g. HRA, LTA, CCA…" style={{ width: '100%' }} autoFocus />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginBottom: 6 }}>
                {components[editing].type === 'per_day'
                  ? 'Rate (₹ per present day)'
                  : 'Rate (% of monthly salary)'}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="input" type="number" step="0.01" min="0" value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))} style={{ width: '100%' }} autoFocus={ROW_META[editing].fixed} />
                <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
                  {components[editing].type === 'per_day' ? '₹/day' : '%'}
                </span>
              </div>
              {/* Preview */}
              {Number(draft.rate) > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {components[editing].type === 'per_day'
                    ? `Example: 22 days present → ${fmt(22 * Number(draft.rate))}/month`
                    : (() => {
                        const applicable = employees.filter(e => appliesToEmp(editing, e));
                        const totalSal   = applicable.reduce((s, e) => s + (Number(e.salary) || 0), 0);
                        if (!totalSal) return null;
                        const monthly = (totalSal * Number(draft.rate)) / 100;
                        return `Total monthly: ${fmt(monthly)} · Annual: ${fmt(monthly * 12)}`;
                      })()
                  }
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-sm" onClick={saveEdit}><Check size={13} /> Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
