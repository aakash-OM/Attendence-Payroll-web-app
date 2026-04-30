import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, CalendarCheck, Users, CalendarRange,
  Download, Upload, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from './firebase';
import { SEED_EMPLOYEES, SEED_HOLIDAYS, SEED_ATTENDANCE, COMPANY_NAME } from './seedData';
import { MONTH_NAMES, computeMonthPayroll } from './payroll';
import Overview from './pages/Overview';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import Holidays from './pages/Holidays';

// Only UI navigation (month/year) stays local — each user can browse independently
const UI_KEY = 'anushree-payroll-ui';
function loadUI() {
  try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; }
}

export default function App() {
  const ui = loadUI();
  const [employees,  setEmployees]  = useState(null);
  const [holidays,   setHolidays]   = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [documents,  setDocuments]  = useState(null);
  const [year,     setYear]     = useState(ui.year     || 2026);
  const [monthIdx, setMonthIdx] = useState(ui.monthIdx ?? 2);
  const [loading,  setLoading]  = useState(true);
  const [tab, setTab] = useState('overview');
  const fileInput = useRef(null);

  // Persist navigation state per-browser (not shared)
  useEffect(() => {
    localStorage.setItem(UI_KEY, JSON.stringify({ year, monthIdx }));
  }, [year, monthIdx]);

  // Real-time Firestore listeners — all team members see the same data instantly
  useEffect(() => {
    const loaded = { emp: false, hol: false, att: false, doc: false };
    const check = () => {
      if (loaded.emp && loaded.hol && loaded.att && loaded.doc) setLoading(false);
    };

    const unsubs = [
      onSnapshot(doc(db, 'payroll', 'employees'), async (snap) => {
        if (snap.exists()) {
          setEmployees(snap.data().list);
        } else {
          await setDoc(doc(db, 'payroll', 'employees'), { list: SEED_EMPLOYEES });
        }
        loaded.emp = true;
        check();
      }),

      onSnapshot(doc(db, 'payroll', 'holidays'), async (snap) => {
        if (snap.exists()) {
          setHolidays(snap.data().list);
        } else {
          await setDoc(doc(db, 'payroll', 'holidays'), { list: SEED_HOLIDAYS });
        }
        loaded.hol = true;
        check();
      }),

      onSnapshot(doc(db, 'payroll', 'attendance'), async (snap) => {
        if (snap.exists()) {
          setAttendance(snap.data().map);
        } else {
          await setDoc(doc(db, 'payroll', 'attendance'), { map: SEED_ATTENDANCE });
        }
        loaded.att = true;
        check();
      }),

      onSnapshot(doc(db, 'payroll', 'documents'), async (snap) => {
        if (snap.exists()) {
          setDocuments(snap.data().map);
        } else {
          await setDoc(doc(db, 'payroll', 'documents'), { map: {} });
        }
        loaded.doc = true;
        check();
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);

  // Wrappers: update local state immediately + write to Firestore
  const saveEmployees = async (val) => {
    const next = typeof val === 'function' ? val(employees) : val;
    setEmployees(next);
    await setDoc(doc(db, 'payroll', 'employees'), { list: next });
  };

  const saveHolidays = async (val) => {
    const next = typeof val === 'function' ? val(holidays) : val;
    setHolidays(next);
    await setDoc(doc(db, 'payroll', 'holidays'), { list: next });
  };

  const saveAttendance = async (val) => {
    const next = typeof val === 'function' ? val(attendance) : val;
    setAttendance(next);
    await setDoc(doc(db, 'payroll', 'attendance'), { map: next });
  };

  const saveDocuments = async (val) => {
    const next = typeof val === 'function' ? val(documents) : val;
    setDocuments(next);
    await setDoc(doc(db, 'payroll', 'documents'), { map: next });
  };

  const shiftMonth = (delta) => {
    let m = monthIdx + delta;
    let y = year;
    while (m < 0)  { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonthIdx(m);
    setYear(y);
  };

  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ employees, holidays, attendance, year, monthIdx }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anushree-payroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.employees) await saveEmployees(data.employees);
        if (data.holidays)  await saveHolidays(data.holidays);
        if (data.attendance) await saveAttendance(data.attendance);
        if (data.year)     setYear(data.year);
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
    const wb = XLSX.utils.book_new();

    if (tab === 'overview') {
      const summary = computeMonthPayroll({ employees, attendance, holidays, year, monthIdx });
      const overviewSheet = [
        [`${COMPANY_NAME} — ${MONTH_NAMES[monthIdx]} ${year} Payroll Summary`],
        [],
        ['Metric', 'Value'],
        ['Total Employees', summary.headcount],
        ['Public Holidays', summary.publicHolidays],
        ['Total Days in Month', summary.totalDays],
        ['Gross Salary (₹)', Number(summary.totals.gross.toFixed(2))],
        ['Employee ESI Deducted (₹)', Number(summary.totals.esiDeduct.toFixed(2))],
        ['Employer ESI (₹)', Number(summary.totals.employerEsi.toFixed(2))],
        ['Bonus (₹)', Number(summary.totals.bonus.toFixed(2))],
        ['Net Payable (₹)', Number(summary.totals.netPayable.toFixed(2))],
        [],
        ['Firm Breakdown'],
        ['Firm', 'Headcount', 'Gross (₹)', 'Employee ESI (₹)', 'Employer ESI (₹)', 'Bonus (₹)', 'Net Payable (₹)'],
        ...summary.firmBreakdown.map((f) => [
          f.firm, f.headcount,
          Number(f.gross.toFixed(2)), Number(f.esiDeduct.toFixed(2)),
          Number(f.employerEsi.toFixed(2)), Number(f.bonus.toFixed(2)),
          Number(f.netPayable.toFixed(2)),
        ]),
        ['GRAND TOTAL', summary.headcount,
         Number(summary.totals.gross.toFixed(2)), Number(summary.totals.esiDeduct.toFixed(2)),
         Number(summary.totals.employerEsi.toFixed(2)), Number(summary.totals.bonus.toFixed(2)),
         Number(summary.totals.netPayable.toFixed(2))],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewSheet), 'Overview');
      XLSX.writeFile(wb, `Anushree_Overview_${MONTH_NAMES[monthIdx]}_${year}.xlsx`);

    } else if (tab === 'attendance') {
      const summary = computeMonthPayroll({ employees, attendance, holidays, year, monthIdx });
      const n = summary.rows.length;
      // Data rows occupy Excel rows 4 … (3+n); grand total is at (5+n)
      const attSheet = [
        [`${COMPANY_NAME} — ${MONTH_NAMES[monthIdx]} ${year} Payroll`],
        [],
        ['S.No', 'Name', 'Firm', 'Salary', 'Per-Day', 'Days Present', 'Days Absent', 'Holidays',
         'Gross After Absent', 'ESI Deducted (0.75%)', 'Bonus', 'Net Payable'],
        ...summary.rows.map((r, i) => [
          i + 1, r.employee.name, r.employee.firm, r.employee.salary,
          Number(r.perDay.toFixed(2)), r.daysPresent, r.daysAbsent, summary.publicHolidays,
          Number(r.grossAfterAbsent.toFixed(2)),
          0, // placeholder — replaced below with IF formula
          Number(r.bonus.toFixed(2)), Number(r.netPayable.toFixed(2)),
        ]),
        [],
        ['GRAND TOTAL', '', '', summary.totals.grossBase, '', '', summary.totals.daysAbsent, '',
         Number(summary.totals.gross.toFixed(2)),
         0, // placeholder — replaced below with SUM formula
         Number(summary.totals.bonus.toFixed(2)), Number(summary.totals.netPayable.toFixed(2))],
      ];
      const ws = XLSX.utils.aoa_to_sheet(attSheet);
      // Column J = ESI Deducted. Replace each data cell with an Excel IF formula:
      // =IF(D{row}<=21000, I{row}*0.0075, 0)
      for (let i = 0; i < n; i++) {
        const r = i + 4; // Excel row numbers start at 4 for first data row
        ws[`J${r}`] = { t: 'n', f: `IF(D${r}<=21000,I${r}*0.0075,0)` };
      }
      // Grand total ESI = SUM of all data ESI cells
      ws[`J${n + 5}`] = { t: 'n', f: `SUM(J4:J${n + 3})` };
      XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES[monthIdx].slice(0, 3)}_${year}`);
      XLSX.writeFile(wb, `Anushree_Attendance_${MONTH_NAMES[monthIdx]}_${year}.xlsx`);

    } else if (tab === 'employees') {
      const empSheet = [
        ['S.No', 'Name', 'Guardian', 'Firm', 'Monthly Salary (₹)', 'ESI Applicable', 'Bonus Applicable'],
        ...employees.map((e, i) => [i + 1, e.name, e.guardian, e.firm, e.salary, e.esi ? 'YES' : 'NO', e.bonus ? 'YES' : 'NO']),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empSheet), 'Employees');
      XLSX.writeFile(wb, `Anushree_Employees_${MONTH_NAMES[monthIdx]}_${year}.xlsx`);

    } else if (tab === 'holidays') {
      const holSheet = [
        ['Date', 'Holiday', 'Type', 'Observed'],
        ...holidays.map((h) => [h.date, h.name, h.type, h.observed ? 'YES' : 'NO']),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(holSheet), 'Holidays');
      XLSX.writeFile(wb, `Anushree_Holidays_${year}.xlsx`);
    }
  };

  const tabs = [
    { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={14} /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={14} /> },
    { id: 'employees',  label: 'Employees',  icon: <Users size={14} /> },
    { id: 'holidays',   label: 'Calendar',   icon: <CalendarRange size={14} /> },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, color: 'var(--text-faint)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--amber)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span>Loading payroll data…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
        <Attendance employees={employees} holidays={holidays} attendance={attendance} setAttendance={saveAttendance} year={year} monthIdx={monthIdx} />
      )}
      {tab === 'employees' && (
        <Employees employees={employees} setEmployees={saveEmployees} attendance={attendance} setAttendance={saveAttendance} documents={documents} setDocuments={saveDocuments} />
      )}
      {tab === 'holidays' && (
        <Holidays holidays={holidays} setHolidays={saveHolidays} year={year} />
      )}

      <footer style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-faint)', fontSize: 12, flexWrap: 'wrap', gap: 12 }}>
        <span>
          <Zap size={11} style={{ verticalAlign: 'middle' }} /> Data synced in real-time via Firebase ·{' '}
          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11 }} onClick={async () => {
            if (confirm('Reset all data to original Excel values? This cannot be undone.')) {
              await saveEmployees(SEED_EMPLOYEES);
              await saveHolidays(SEED_HOLIDAYS);
              await saveAttendance(SEED_ATTENDANCE);
            }
          }}>Reset to original</button>
        </span>
        <span className="mono">ESI 0.75%/3.25% · BONUS 8.33%</span>
      </footer>
    </div>
  );
}
