import { useState, useMemo, Fragment } from 'react';
import { Pencil, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROW_ORDER = ['bonus','pf','esi','other'];

export const DEFAULT_COMPONENTS = {
  bonus: { label: 'Bonus',    rate: 8.33,  enabled: true  },
  pf:    { label: 'PF',       rate: 12,    enabled: true  },
  esi:   { label: 'Emp. ESI', rate: 0.75,  enabled: true  },
  other: { label: 'Other',    rate: 0,     enabled: false },
};

const ROW_META = {
  bonus: { fixed: true,  hint: 'Applies to employees with Bonus enabled' },
  pf:    { fixed: true,  hint: 'Applies to all employees' },
  esi:   { fixed: true,  hint: 'Applies to employees with ESI enabled' },
  other: { fixed: false, hint: 'Custom component — applies to all employees' },
};

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// Whether a component applies to a given employee
function appliesToEmp(key, emp) {
  if (key === 'bonus') return !!emp.bonus;
  if (key === 'esi')   return !!emp.esi;
  return true;
}

export default function PayrollComponents({ employees, year, components, setComponents }) {
  const [view,        setView]        = useState('summary');
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [editing,     setEditing]     = useState(null);
  const [draft,       setDraft]       = useState({});

  // ── Derived data ───────────────────────────────────────────────────────────
  const firms = useMemo(() => {
    const s = new Set(employees.map(e => e.firm).filter(Boolean));
    return [...s].sort();
  }, [employees]);

  const filteredEmps = useMemo(() =>
    selectedFirm === 'all' ? employees : employees.filter(e => e.firm === selectedFirm),
    [employees, selectedFirm],
  );

  // Summary view: monthly amount per component (respects bonus/esi flags)
  const summaryMonthlyAmt = (key) => {
    const c = components[key];
    if (!c.enabled || !Number(c.rate)) return null;
    const applicable = employees.filter(e => appliesToEmp(key, e));
    const total = applicable.reduce((s, e) => s + (Number(e.salary) || 0), 0);
    return total > 0 ? (total * Number(c.rate)) / 100 : null;
  };

  // Detail view: monthly amount for one employee + component
  const empMonthlyAmt = (emp, key) => {
    const c = components[key];
    if (!c.enabled || !Number(c.rate) || !appliesToEmp(key, emp)) return null;
    const sal = Number(emp.salary) || 0;
    return sal > 0 ? (sal * Number(c.rate)) / 100 : null;
  };

  const empRowTotal = (emp) =>
    ROW_ORDER.reduce((s, k) => s + (empMonthlyAmt(emp, k) ?? 0), 0);

  const summaryGrandMonthly = ROW_ORDER.reduce((s, k) => s + (summaryMonthlyAmt(k) ?? 0), 0);

  const detailGrandMonthly = filteredEmps.reduce(
    (s, emp) => s + empRowTotal(emp), 0,
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const startEdit  = (key) => { setEditing(key); setDraft({ ...components[key] }); };
  const cancelEdit = () => setEditing(null);
  const saveEdit   = () => {
    setComponents(prev => ({
      ...prev,
      [editing]: {
        ...prev[editing],
        label: ROW_META[editing].fixed ? prev[editing].label : (draft.label || prev[editing].label),
        rate:  parseFloat(draft.rate) || 0,
      },
    }));
    setEditing(null);
  };
  const toggleRow = (key) =>
    setComponents(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));

  // ── Shared cell styles ─────────────────────────────────────────────────────
  const numCell   = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 };
  const faintCell = { ...numCell, color: 'var(--text-faint)' };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Page header ──────────────────────────────────────────────────── */}
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
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  background: view === v.id ? 'var(--accent)' : 'transparent',
                  color:      view === v.id ? '#0e0f11'       : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rate config cards — always visible so both views share the same controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {ROW_ORDER.map(key => {
            const c = components[key];
            return (
              <div key={key} style={{
                flex: '1 1 170px', display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-2)', border: `1px solid ${c.enabled ? 'var(--border-2)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', opacity: c.enabled ? 1 : 0.45,
                transition: 'opacity 0.2s',
              }}>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleRow(key)} style={{ padding: 2 }} title={c.enabled ? 'Disable' : 'Enable'}>
                  {c.enabled
                    ? <ToggleRight size={20} style={{ color: 'var(--accent)' }} />
                    : <ToggleLeft  size={20} style={{ color: 'var(--text-faint)' }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>{c.rate}% of salary</div>
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
              <table className="tbl" style={{ minWidth: 1160, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: 190, paddingLeft: 20 }}>Component</th>
                    {MONTHS.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 82, fontSize: 12 }}>{m}</th>)}
                    <th style={{ textAlign: 'right', minWidth: 110, paddingRight: 20 }}>Annual Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ROW_ORDER.map(key => {
                    const c   = components[key];
                    const amt = summaryMonthlyAmt(key);
                    return (
                      <tr key={key} style={{ opacity: c.enabled ? 1 : 0.38 }}>
                        <td style={{ paddingLeft: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>{c.label}</span>
                            <span style={{
                              fontSize: 11, color: 'var(--accent)',
                              background: 'rgba(212,160,74,0.12)', border: '1px solid rgba(212,160,74,0.22)',
                              borderRadius: 4, padding: '1px 5px',
                            }}>{c.rate}%</span>
                            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 2 }}>
                              {ROW_META[key].hint}
                            </span>
                          </div>
                        </td>
                        {MONTHS.map(m => (
                          <td key={m} style={amt != null ? numCell : faintCell}>
                            {amt != null ? fmt(amt) : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: amt != null ? 'var(--accent-2)' : 'var(--text-faint)' }}>
                          {amt != null ? fmt(amt * 12) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-2)', borderTop: '2px solid var(--border-2)' }}>
                    <td style={{ paddingLeft: 20, fontWeight: 700, fontSize: 13 }}>Grand Total</td>
                    {MONTHS.map(m => (
                      <td key={m} style={{ ...numCell, fontWeight: 700, color: summaryGrandMonthly > 0 ? 'var(--text)' : 'var(--text-faint)' }}>
                        {summaryGrandMonthly > 0 ? fmt(summaryGrandMonthly) : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--accent)' }}>
                      {summaryGrandMonthly > 0 ? fmt(summaryGrandMonthly * 12) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="info-note" style={{ marginTop: 14, fontSize: 12 }}>
            All monthly values are based on fixed salary × rate. Bonus &amp; ESI rows show only applicable employees' totals.
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
              <button
                key={f}
                onClick={() => setSelectedFirm(f)}
                style={{
                  padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                  borderColor: selectedFirm === f ? 'var(--accent)'   : 'var(--border)',
                  background:  selectedFirm === f ? 'rgba(212,160,74,0.14)' : 'var(--bg-1)',
                  color:       selectedFirm === f ? 'var(--accent)'   : 'var(--text-dim)',
                }}
              >
                {f === 'all' ? 'All Firms' : f}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
              {filteredEmps.length} employee{filteredEmps.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredEmps.length === 0 ? (
            <div className="info-note" style={{ textAlign: 'center', padding: 48 }}>
              No employees found for this firm.
            </div>
          ) : (
            <>
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl" style={{ minWidth: 1240, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', minWidth: 170, paddingLeft: 20 }}>Employee</th>
                        <th style={{ textAlign: 'left', minWidth: 120 }}>Component</th>
                        {MONTHS.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 78, fontSize: 12 }}>{m}</th>)}
                        <th style={{ textAlign: 'right', minWidth: 110, paddingRight: 20 }}>Annual Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmps.map((emp, empIdx) => {
                        const monthlyTotal = empRowTotal(emp);
                        const rowBg = empIdx % 2 === 1 ? 'rgba(255,255,255,0.016)' : 'transparent';
                        const empKey = emp.id || emp.name || empIdx;
                        return (
                          <Fragment key={empKey}>
                            {/* 4 component sub-rows */}
                            {ROW_ORDER.map((key, rowIdx) => {
                              const c          = components[key];
                              const amt        = empMonthlyAmt(emp, key);
                              const isFirst    = rowIdx === 0;
                              const isLast     = rowIdx === ROW_ORDER.length - 1;
                              const ptop       = isFirst ? 10 : 3;
                              const pbottom    = isLast  ? 6  : 3;
                              return (
                                <tr
                                  key={key}
                                  style={{
                                    background: rowBg,
                                    borderTop: isFirst ? '1px solid var(--border)' : 'none',
                                    opacity: c.enabled ? 1 : 0.38,
                                  }}
                                >
                                  {/* Employee name — shown only on first sub-row */}
                                  <td style={{ paddingLeft: 20, paddingTop: ptop, paddingBottom: pbottom, verticalAlign: 'top' }}>
                                    {isFirst && (
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                                          {emp.firm}{emp.salary ? ` · ${fmt(emp.salary)}/mo` : ''}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Component label + rate badge */}
                                  <td style={{ paddingTop: ptop, paddingBottom: pbottom, verticalAlign: 'middle' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.label}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 5 }}>{c.rate}%</span>
                                  </td>

                                  {/* Monthly cells — same value each month */}
                                  {MONTHS.map(m => (
                                    <td key={m} style={{ ...(amt != null ? numCell : faintCell), paddingTop: ptop, paddingBottom: pbottom }}>
                                      {amt != null ? fmt(amt) : '—'}
                                    </td>
                                  ))}

                                  {/* Annual for this component */}
                                  <td style={{ textAlign: 'right', paddingRight: 20, fontVariantNumeric: 'tabular-nums', paddingTop: ptop, paddingBottom: pbottom, color: amt != null ? 'var(--accent-2)' : 'var(--text-faint)', fontSize: 13 }}>
                                    {amt != null ? fmt(amt * 12) : '—'}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Employee subtotal row */}
                            <tr style={{ background: 'rgba(212,160,74,0.07)', borderTop: '1px solid rgba(212,160,74,0.18)' }}>
                              <td style={{ paddingLeft: 20, paddingTop: 5, paddingBottom: 6 }} colSpan={2}>
                                <span style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                                  {emp.name} — total
                                </span>
                              </td>
                              {MONTHS.map(m => (
                                <td key={m} style={{ ...numCell, fontWeight: 700, fontSize: 12, color: monthlyTotal > 0 ? 'var(--accent)' : 'var(--text-faint)', paddingTop: 5, paddingBottom: 6 }}>
                                  {monthlyTotal > 0 ? fmt(monthlyTotal) : '—'}
                                </td>
                              ))}
                              <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: monthlyTotal > 0 ? 'var(--accent)' : 'var(--text-faint)', paddingTop: 5, paddingBottom: 6 }}>
                                {monthlyTotal > 0 ? fmt(monthlyTotal * 12) : '—'}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>

                    {/* Grand total */}
                    <tfoot>
                      <tr style={{ background: 'var(--bg-2)', borderTop: '2px solid var(--border-2)' }}>
                        <td style={{ paddingLeft: 20, fontWeight: 700, fontSize: 13 }} colSpan={2}>
                          Grand Total{selectedFirm !== 'all' ? ` — ${selectedFirm}` : ''}
                        </td>
                        {MONTHS.map(m => (
                          <td key={m} style={{ ...numCell, fontWeight: 700, color: detailGrandMonthly > 0 ? 'var(--text)' : 'var(--text-faint)' }}>
                            {detailGrandMonthly > 0 ? fmt(detailGrandMonthly) : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', paddingRight: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--accent)' }}>
                          {detailGrandMonthly > 0 ? fmt(detailGrandMonthly * 12) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="info-note" style={{ marginTop: 14, fontSize: 12 }}>
                Each employee shows 4 component sub-rows. Rows marked "—" mean the component is disabled or doesn't apply to that employee.
              </div>
            </>
          )}
        </>
      )}

      {/* ── EDIT MODAL ───────────────────────────────────────────────────── */}
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
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
                  {ROW_META[editing].hint}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit} style={{ padding: 4 }}>
                <X size={15} />
              </button>
            </div>

            {/* Label — only for "other" */}
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
                Rate (% of employee's monthly salary)
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
