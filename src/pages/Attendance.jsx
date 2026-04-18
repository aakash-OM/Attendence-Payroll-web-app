import { useState, useMemo } from 'react';
import { Check, RotateCcw, Zap } from 'lucide-react';
import {
  computeMonthPayroll, daysInMonth, monthKey, MONTH_NAMES, formatINR, formatINRExact,
} from '../payroll';

export default function Attendance({ employees, holidays, attendance, setAttendance, year, monthIdx }) {
  const [filter, setFilter] = useState('all');
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
          Enter <strong>Days Present</strong> for each employee. Salary, ESI, bonus and net-payable
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
                    <th className="num">ESI</th>
                    <th className="num">Bonus</th>
                    <th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.employee.id}>
                      <td className="faint mono">{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.employee.name}</div>
                        <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                          {r.employee.guardian}
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
                  ))}
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
    </div>
  );
}
