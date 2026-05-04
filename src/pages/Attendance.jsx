import { useState } from 'react';
import { Check, RotateCcw, Zap, CalendarDays, X } from 'lucide-react';
import {
  computeMonthPayroll, daysInMonth, monthKey, MONTH_NAMES, formatINR, formatINRExact,
} from '../payroll';

function CalendarModal({ empId, empName, year, monthIdx, total, holidays, mKey, attendance, setAttendance, onClose }) {
  const absentKey = `d${empId}`;
  const otKey = `ot${empId}`;

  // Compute these before useState so they can be used in lazy initialisers
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay(); // 0=Sun … 6=Sat
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const holidayDayNums = new Set(
    holidays
      .filter((h) => {
        if (!h.observed) return false;
        const d = new Date(h.date);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
      })
      .map((h) => new Date(h.date).getDate()),
  );

  const [absentDays, setAbsentDays] = useState(() => {
    const saved = attendance[mKey]?.[absentKey] || [];
    // Strip any previously-saved Sundays / holidays from absent list
    return new Set(saved.filter((d) => {
      const dow = (firstDayOfWeek + d - 1) % 7;
      return dow !== 0 && !holidayDayNums.has(d);
    }));
  });

  // overtimeDays: Map<dayNum, 'half' | 'full'>  — only valid on Sun / holidays
  const [overtimeDays, setOvertimeDays] = useState(() => {
    const saved = attendance[mKey]?.[otKey];
    return saved ? new Map(saved) : new Map();
  });

  // Working days = all days minus Sundays minus observed holidays
  const workingDays = Array.from({ length: total }, (_, i) => i + 1).filter((day) => {
    const dow = (firstDayOfWeek + day - 1) % 7;
    return dow !== 0 && !holidayDayNums.has(day);
  }).length;

  const overtimeBonus = [...overtimeDays.values()].reduce((s, t) => s + (t === 'half' ? 0.5 : 1), 0);
  const presentCount = Math.max(0, workingDays - absentDays.size + overtimeBonus);

  const toggleDay = (day) => {
    setAbsentDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  // Cycles: none → half → full → none
  const toggleOvertime = (day) => {
    setOvertimeDays((prev) => {
      const next = new Map(prev);
      const cur = next.get(day);
      if (!cur) next.set(day, 'half');
      else if (cur === 'half') next.set(day, 'full');
      else next.delete(day);
      return next;
    });
  };

  const handleApply = () => {
    const absentArr = [...absentDays].sort((a, b) => a - b);
    const overtimeArr = [...overtimeDays.entries()];
    const daysPresent = Math.max(0, workingDays - absentArr.length + overtimeBonus);
    setAttendance((prev) => ({
      ...prev,
      [mKey]: {
        ...(prev[mKey] || {}),
        [empId]: daysPresent,
        [absentKey]: absentArr,
        [otKey]: overtimeArr,
      },
    }));
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '22px 20px', width: 370, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{empName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3, letterSpacing: '0.04em' }}>
              {MONTH_NAMES[monthIdx].toUpperCase()} {year} · CLICK DATE TO MARK ABSENT
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 11, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(111,174,106,0.35)', border: '1px solid rgba(111,174,106,0.55)', display: 'inline-block' }} />
            Present
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(212,106,90,0.38)', border: '1px solid rgba(212,106,90,0.6)', display: 'inline-block' }} />
            Absent
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(255,149,0,0.22)', border: '2px solid #ff9500', boxShadow: '0 0 5px rgba(255,149,0,0.55)', display: 'inline-block' }} />
            Holiday
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(212,106,90,0.38)', border: '2.5px solid #ff3b30', boxShadow: '0 0 6px rgba(255,59,48,0.65)', display: 'inline-block' }} />
            Sun (off)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(255,105,180,0.22)', borderTop: '2.5px solid #ff69b4', borderBottom: '2.5px solid #ff69b4', borderLeft: '2.5px solid transparent', borderRight: '2.5px solid transparent', boxShadow: '0 2px 6px rgba(255,105,180,0.5)', display: 'inline-block' }} />
            ½ OT
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(255,105,180,0.28)', border: '2.5px solid #ff69b4', boxShadow: '0 0 6px rgba(255,105,180,0.65)', display: 'inline-block' }} />
            1d OT
          </span>
        </div>

        {/* OT hint */}
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 12, letterSpacing: '0.02em' }}>
          Click Sun / Holiday to cycle overtime: none → ½ day → full day → none
        </div>

        {/* Day-of-week headers + Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 16 }}>
          {/* Day name row */}
          {DAY_NAMES.map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                paddingBottom: 5,
                color: i === 0 ? '#ff3b30' : 'var(--text-faint)',
                textShadow: i === 0 ? '0 0 8px rgba(255,59,48,0.7)' : 'none',
              }}
            >
              {d}
            </div>
          ))}

          {/* Offset blank cells */}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {/* Day buttons */}
          {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
            const absent = absentDays.has(day);
            const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
            const isSun = dayOfWeek === 0;
            const isHoliday = holidayDayNums.has(day);
            const ot = overtimeDays.get(day);

            let cellStyle, onClick, title;

            if (isSun || isHoliday) {
              const otNext = !ot ? '½ day' : ot === 'half' ? 'full day' : 'remove';
              title = `${isSun ? 'Sunday' : 'Holiday'} · click to mark OT: ${otNext}`;
              onClick = () => toggleOvertime(day);

              if (ot === 'half') {
                cellStyle = {
                  borderTop: '2.5px solid #ff69b4',
                  borderBottom: '2.5px solid #ff69b4',
                  borderLeft: '2.5px solid transparent',
                  borderRight: '2.5px solid transparent',
                  boxShadow: '0 3px 9px rgba(255,105,180,0.6), 0 -3px 9px rgba(255,105,180,0.6)',
                  background: 'rgba(255,105,180,0.22)',
                  color: '#ff69b4',
                  cursor: 'pointer',
                };
              } else if (ot === 'full') {
                cellStyle = {
                  border: '2.5px solid #ff69b4',
                  boxShadow: '0 0 11px rgba(255,105,180,0.75), inset 0 0 5px rgba(255,105,180,0.12)',
                  background: 'rgba(255,105,180,0.27)',
                  color: '#ff69b4',
                  cursor: 'pointer',
                };
              } else if (isSun) {
                cellStyle = {
                  border: '2.5px solid #ff3b30',
                  boxShadow: '0 0 9px rgba(255,59,48,0.7), inset 0 0 4px rgba(255,59,48,0.1)',
                  background: 'rgba(212,106,90,0.32)',
                  color: '#e0806e',
                  cursor: 'pointer',
                };
              } else {
                cellStyle = {
                  border: '2px solid #ff9500',
                  boxShadow: '0 0 8px rgba(255,149,0,0.65), inset 0 0 4px rgba(255,149,0,0.1)',
                  background: 'rgba(255,149,0,0.18)',
                  color: '#ffaa33',
                  cursor: 'pointer',
                };
              }
            } else {
              onClick = () => toggleDay(day);
              title = absent ? 'Click to mark present' : 'Click to mark absent';
              cellStyle = {
                border: absent ? '1.5px solid rgba(212,106,90,0.65)' : '1.5px solid rgba(111,174,106,0.5)',
                boxShadow: 'none',
                background: absent ? 'rgba(212,106,90,0.32)' : 'rgba(111,174,106,0.25)',
                color: absent ? '#e0806e' : '#7ec478',
                cursor: 'pointer',
              };
            }

            return (
              <button
                key={day}
                onClick={onClick}
                title={title}
                style={{
                  padding: '6px 0 5px',
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  transition: 'background 0.12s',
                  ...cellStyle,
                }}
              >
                <span>{day}</span>
                {ot && (
                  <span style={{ fontSize: 8, lineHeight: 1, fontWeight: 800, letterSpacing: '0.02em' }}>
                    {ot === 'half' ? '½' : '+1'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: '#e0806e', fontWeight: 600 }}>{absentDays.size} absent</span>
            <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>·</span>
            <span style={{ color: '#7ec478', fontWeight: 600 }}>{presentCount} present</span>
            {overtimeBonus > 0 && (
              <span style={{ color: '#ff69b4', fontWeight: 600, marginLeft: 5 }}>
                (+{overtimeBonus}d OT)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setAbsentDays(new Set()); setOvertimeDays(new Map()); }}
              style={{ fontSize: 11 }}
            >
              Clear all
            </button>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm" onClick={handleApply}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Attendance({ employees, holidays, attendance, setAttendance, year, monthIdx }) {
  const [filter, setFilter] = useState('all');
  const [calModal, setCalModal] = useState(null); // { empId, empName }
  const mKey = monthKey(year, monthIdx);
  const total = daysInMonth(year, monthIdx);
  const publicHols = holidays.filter((h) => {
    if (!h.observed) return false;
    const d = new Date(h.date);
    return d.getFullYear() === year && d.getMonth() === monthIdx;
  }).length;

  const summary = computeMonthPayroll({ employees, attendance, holidays, year, monthIdx });

  const firms = [...new Set(employees.map((e) => e.firm))];
  const visibleFirms = filter === 'all' ? firms : [filter];

  const updatePresent = (empId, value) => {
    const n = Math.max(0, Math.min(total, Number(value) || 0));
    setAttendance((prev) => ({
      ...prev,
      [mKey]: { ...(prev[mKey] || {}), [empId]: n },
    }));
  };

  const markAllFullAttendance = () => {
    const maxDays = total - publicHols;
    const next = {};
    employees.forEach((e) => { next[e.id] = maxDays; });
    setAttendance((prev) => ({ ...prev, [mKey]: next }));
  };

  const resetMonth = () => {
    if (!confirm(`Clear all attendance for ${MONTH_NAMES[monthIdx]} ${year}?`)) return;
    setAttendance((prev) => {
      const c = { ...prev };
      delete c[mKey];
      return c;
    });
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">
          <div>
            <h2>Attendance · {MONTH_NAMES[monthIdx]} {year}</h2>
            <div className="panel-title-sub">
              — {total} DAYS · {publicHols} HOLIDAYS · MAX WORKING = {total - publicHols}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All firms</option>
              {firms.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button className="btn btn-sm" onClick={markAllFullAttendance}>
              <Zap size={13} /> Mark all full
            </button>
            <button className="btn btn-sm btn-ghost" onClick={resetMonth}>
              <RotateCcw size={13} /> Reset month
            </button>
          </div>
        </div>

        <div className="info-note">
          Enter <strong>Days Present</strong> for each employee, or click the <CalendarDays size={12} style={{ verticalAlign: 'middle' }} /> calendar icon to mark individual days. Salary, ESI, bonus and net-payable
          recalculate instantly. Holidays are auto-counted from the Holiday Calendar; absent-days =
          <span className="mono"> total − present − holidays</span>.
        </div>
      </div>

      {visibleFirms.map((firm) => {
        const rows = summary.rows.filter((r) => r.employee.firm === firm);
        const firmTotals = rows.reduce(
          (a, r) => {
            a.gross += r.grossAfterAbsent;
            a.esi += r.esiDeduct;
            a.bonus += r.bonus;
            a.net += r.netPayable;
            a.absent += r.daysAbsent;
            return a;
          },
          { gross: 0, esi: 0, bonus: 0, net: 0, absent: 0 },
        );

        return (
          <div key={firm} className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ fontSize: 17 }}>{firm}</h2>
                <div className="panel-title-sub">
                  — {rows.length} EMPLOYEES · NET {formatINR(firmTotals.net)}
                </div>
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th>
                    <th>Employee</th>
                    <th className="num">Salary</th>
                    <th className="num">Per-day</th>
                    <th className="num" style={{ width: 110 }}>Days Present</th>
                    <th className="num">Absent</th>
                    <th className="num">Gross</th>
                    <th className="num">Employee ESI</th>
                    <th className="num">Bonus</th>
                    <th className="num">Net (Gross-Emp.ESI)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const hasCalDays = (attendance[mKey]?.[`d${r.employee.id}`] || []).length > 0
                      || (attendance[mKey]?.[`ot${r.employee.id}`] || []).length > 0;
                    return (
                      <tr key={r.employee.id}>
                        <td className="faint mono">{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <button
                              onClick={() => setCalModal({ empId: r.employee.id, empName: r.employee.name })}
                              title="Open attendance calendar"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 3,
                                cursor: 'pointer',
                                color: hasCalDays ? 'var(--accent)' : 'var(--text-faint)',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                                borderRadius: 4,
                              }}
                            >
                              <CalendarDays size={15} />
                            </button>
                            <div>
                              <div style={{ fontWeight: 500 }}>{r.employee.name}</div>
                              <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                                {r.employee.guardian}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="num">{formatINR(r.employee.salary)}</td>
                        <td className="num">{formatINRExact(r.perDay)}</td>
                        <td className="num">
                          <input
                            type="number"
                            className="cell-input"
                            min={0}
                            max={total}
                            value={r.daysPresent}
                            onChange={(e) => updatePresent(r.employee.id, e.target.value)}
                          />
                          <span className="faint mono" style={{ fontSize: 10, marginLeft: 4 }}>
                            /{total}
                          </span>
                        </td>
                        <td className="num" style={{ color: r.daysAbsent > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
                          {r.daysAbsent}
                        </td>
                        <td className="num">{formatINR(r.grossAfterAbsent)}</td>
                        <td className="num">{formatINR(r.esiDeduct)}</td>
                        <td className="num">{r.bonus > 0 ? formatINR(r.bonus) : '—'}</td>
                        <td className="num" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
                          {formatINR(r.netPayable)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="subtotal">
                    <td colSpan={5}>SUBTOTAL — {firm}</td>
                    <td className="num">{firmTotals.absent}</td>
                    <td className="num">{formatINR(firmTotals.gross)}</td>
                    <td className="num">{formatINR(firmTotals.esi)}</td>
                    <td className="num">{firmTotals.bonus > 0 ? formatINR(firmTotals.bonus) : '—'}</td>
                    <td className="num">{formatINR(firmTotals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {filter === 'all' && (
        <div className="panel" style={{ background: 'rgba(212,160,74,0.05)', borderColor: 'var(--accent-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="panel-title-sub" style={{ marginBottom: 4 }}>— GRAND TOTAL</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent-2)' }}>
                {formatINR(summary.totals.netPayable)}
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                Gross {formatINR(summary.totals.gross)} − ESI {formatINR(summary.totals.esiDeduct)}
                {summary.totals.bonus > 0 && <> + Bonus {formatINR(summary.totals.bonus)}</>}
              </div>
            </div>
            <div>
              <span className="pill yes" style={{ fontSize: 11 }}>
                <Check size={11} style={{ verticalAlign: 'middle' }} /> AUTO-SAVED
              </span>
            </div>
          </div>
        </div>
      )}

      {calModal && (
        <CalendarModal
          empId={calModal.empId}
          empName={calModal.empName}
          year={year}
          monthIdx={monthIdx}
          total={total}
          holidays={holidays}
          mKey={mKey}
          attendance={attendance}
          setAttendance={setAttendance}
          onClose={() => setCalModal(null)}
        />
      )}
    </div>
  );
}
