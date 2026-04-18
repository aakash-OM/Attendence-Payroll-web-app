import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, CalendarCheck, Users, CalendarRange,
  Download, Upload, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { SEED_EMPLOYEES, SEED_HOLIDAYS, SEED_ATTENDANCE, COMPANY_NAME } from './seedData';
import { MONTH_NAMES, computeMonthPayroll } from './payroll';
import Overview from './pages/Overview';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import Holidays from './pages/Holidays';

const STORAGE_KEY = 'anushree-payroll-v1';

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export default function App() {
  const saved = loadState();

  const [employees,   setEmployees]   = useState(saved?.employees   || SEED_EMPLOYEES);
  const [holidays,    setHolidays]    = useState(saved?.holidays    || SEED_HOLIDAYS);
  const [attendance,  setAttendance]  = useState(saved?.attendance  || SEED_ATTENDANCE);
  const [year,  setYear]  = useState(saved?.year  || 2026);
  const [monthIdx, setMonthIdx] = useState(saved?.monthIdx ?? 2);
  const [tab, setTab] = useState('overview');
  const fileInput = useRef(null);

  useEffect(() => {
    saveState({ employees, holidays, attendance, year, monthIdx });
  }, [employees, holidays, attendance, year, monthIdx]);

  const shiftMonth = (delta) => {
    let m = monthIdx + delta;
    let y = year;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonthIdx(m);
    setYear(y);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ employees, holidays, attendance, year, monthIdx }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anushree-payroll-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.employees) setEmployees(data.employees);
        if (data.holidays) setHolidays(data.holidays);
        if (data.attendance) setAttendance(data.attendance);
        if (data.year) setYear(data.year);
        if (data.monthIdx != null) setMonthIdx(data.monthIdx);
        alert('Backup imported successfully.');
      } catch (err) {
        alert('Invalid backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportExcel = () => {
    const summary = computeMonthPayroll({ employees, attendance, holidays, year, monthIdx });
    const wb = XLSX.utils.book_new();

    const empSheet = [
      ['S.No', 'Name', 'Guardian', 'Firm', 'Monthly Salary (₹)', 'ESI Applicable', 'Bonus Applicable'],
      ...employees.map((e, i) => [i + 1, e.name, e.guardian, e.firm, e.salary, e.esi ? 'YES' : 'NO', e.bonus ? 'YES' : 'NO']),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empSheet), 'Employees');

    const attSheet = [
      [`${COMPANY_NAME} — ${MONTH_NAMES[monthIdx]} ${year} Payroll`],
      [],
      ['S.No', 'Name', 'Firm', 'Salary', 'Per-Day', 'Days Present', 'Days Absent', 'Holidays',
       'Gross After Absent', 'ESI Deducted', 'Bonus', 'Net Payable'],
      ...summary.rows.map((r, i) => [
        i + 1, r.employee.name, r.employee.firm, r.employee.salary,
        Number(r.perDay.toFixed(2)), r.daysPresent, r.daysAbsent, summary.publicHolidays,
        Number(r.grossAfterAbsent.toFixed(2)), Number(r.esiDeduct.toFixed(2)),
        Number(r.bonus.toFixed(2)), Number(r.netPayable.toFixed(2)),
      ]),
      [],
      ['GRAND TOTAL', '', '', summary.totals.grossBase, '', '', summary.totals.daysAbsent, '',
       Number(summary.totals.gross.toFixed(2)), Number(summary.totals.esiDeduct.toFixed(2)),
       Number(summary.totals.bonus.toFixed(2)), Number(summary.totals.netPayable.toFixed(2))],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attSheet), `${MONTH_NAMES[monthIdx].slice(0,3)}_${year}`);

    const holSheet = [
      ['Date', 'Holiday', 'Type', 'Observed'],
      ...holidays.map((h) => [h.date, h.name, h.type, h.observed ? 'YES' : 'NO']),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(holSheet), 'Holidays');

    XLSX.writeFile(wb, `Anushree_Payroll_${MONTH_NAMES[monthIdx]}_${year}.xlsx`);
  };

  const tabs = [
    { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={14} /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={14} /> },
    { id: 'employees',  label: 'Employees',  icon: <Users size={14} /> },
    { id: 'holidays',   label: 'Calendar',   icon: <CalendarRange size={14} /> },
  ];

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">Anushree Electrical Pvt. Ltd.</div>
          <h1>Payroll & <em>Attendance</em></h1>
          <div className="brand-sub">Interactive payroll dashboard · {employees.length} employees · {MONTH_NAMES[monthIdx]} {year}</div>
        </div>

        <div className="topbar-actions">
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)} title="Previous month">
              <ChevronLeft size={14} />
            </button>
            <select className="select" value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))} style={{ border: 'none', background: 'transparent' }}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ border: 'none', background: 'transparent', width: 80 }}>
              {Array.from({ length: 7 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)} title="Next month">
              <ChevronRight size={14} />
            </button>
          </div>

          <button className="btn btn-sm" onClick={exportExcel}>
            <Download size={13} /> Excel
          </button>
          <button className="btn btn-sm" onClick={exportJSON}>
            <Download size={13} /> Backup
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => fileInput.current?.click()}>
            <Upload size={13} /> Restore
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={importJSON}
          />
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-dot"></span>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Overview employees={employees} holidays={holidays} attendance={attendance} year={year} monthIdx={monthIdx} />
      )}
      {tab === 'attendance' && (
        <Attendance employees={employees} holidays={holidays} attendance={attendance} setAttendance={setAttendance} year={year} monthIdx={monthIdx} />
      )}
      {tab === 'employees' && (
        <Employees employees={employees} setEmployees={setEmployees} attendance={attendance} setAttendance={setAttendance} />
      )}
      {tab === 'holidays' && (
        <Holidays holidays={holidays} setHolidays={setHolidays} year={year} />
      )}

      <footer style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-faint)', fontSize: 12, flexWrap: 'wrap', gap: 12 }}>
        <span>
          <Zap size={11} style={{ verticalAlign: 'middle' }} /> Data auto-saved to your browser ·{' '}
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => {
            if (confirm('Reset all data to original Excel values? This cannot be undone.')) {
              localStorage.removeItem(STORAGE_KEY);
              location.reload();
            }
          }}>Reset to original</button>
        </span>
        <span className="mono">ESI 0.75%/3.25% · BONUS 8.33%</span>
      </footer>
    </div>
  );
}
