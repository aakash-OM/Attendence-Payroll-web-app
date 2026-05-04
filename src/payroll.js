import { ESI_THRESHOLD, ESI_EMPLOYEE_RATE, ESI_EMPLOYER_RATE, BONUS_RATE } from './seedData';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const daysInMonth = (year, monthIdx /* 0-11 */) =>
  new Date(year, monthIdx + 1, 0).getDate();

export const monthKey = (year, monthIdx) =>
  `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

export const parseMonthKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthIdx: m - 1 };
};

export const holidaysInMonth = (holidays, year, monthIdx) =>
  holidays.filter((h) => {
    if (!h.observed) return false;
    const d = new Date(h.date);
    return d.getFullYear() === year && d.getMonth() === monthIdx;
  });

export const formatINR = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

export const formatINRExact = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '₹0.00';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// AEEPL policy: fixed 26-day divisor every month.
// Per-day = salary / 26.
// Gross   = per-day × (26 − absentDays + otDays).
// Observed company holidays are paid (not counted as absent).
// Sundays are unpaid rest — excluded from both absent count and paid days.
// OT on Sundays / holidays is paid at the same per-day rate (full day only).
export const AEEPL_DIVISOR = 26;

export function computeEmployeePayroll({ employee, daysPresent, daysAbsent }) {
  const perDay = employee.salary / AEEPL_DIVISOR;
  const grossAfterAbsent = perDay * daysPresent;

  const esiEligible = employee.salary <= ESI_THRESHOLD;
  const esiDeduct = esiEligible ? grossAfterAbsent * ESI_EMPLOYEE_RATE : 0;
  const afterEsi = grossAfterAbsent - esiDeduct;

  const bonus = employee.bonus ? grossAfterAbsent * BONUS_RATE : 0;
  const netPayable = afterEsi + bonus;

  const employerEsi = esiEligible ? grossAfterAbsent * ESI_EMPLOYER_RATE : 0;

  return {
    perDay,
    daysAbsent,
    paidDays: daysPresent,
    grossAfterAbsent,
    esiDeduct,
    afterEsi,
    bonus,
    netPayable,
    employerEsi,
  };
}

/** Aggregate payroll for a full month across all employees. */
export function computeMonthPayroll({ employees, attendance, holidays, year, monthIdx }) {
  const totalDays = daysInMonth(year, monthIdx);
  const mKey = monthKey(year, monthIdx);
  const holidayList = holidaysInMonth(holidays, year, monthIdx);
  const publicHolidays = holidayList.length;
  const monthAtt = attendance[mKey] || {};

  const rows = employees.map((emp) => {
    const absentArr = monthAtt[`d${emp.id}`];          // set when calendar was used
    const otArr     = monthAtt[`ot${emp.id}`] || [];   // [[dayNum, 'full'], ...]

    // Full-day OT entries only (AEEPL has no half-day OT)
    const otCount = otArr.filter(([, t]) => t === 'full').length;

    let daysPresent, daysAbsent;
    if (absentArr !== undefined) {
      // Calendar path: derive directly from the stored absent list
      daysAbsent  = absentArr.length;
      daysPresent = Math.max(0, AEEPL_DIVISOR - daysAbsent + otCount);
    } else if (monthAtt[emp.id] != null) {
      // Manual input path: user typed a number directly
      daysPresent = monthAtt[emp.id];
      daysAbsent  = Math.max(0, AEEPL_DIVISOR - daysPresent);
    } else {
      // No data yet: default to full salary (zero absences)
      daysPresent = AEEPL_DIVISOR;
      daysAbsent  = 0;
    }

    const calc = computeEmployeePayroll({ employee: emp, daysPresent, daysAbsent });
    return { employee: emp, daysPresent, ...calc };
  });

  const firmBreakdown = {};
  rows.forEach((r) => {
    if (!firmBreakdown[r.employee.firm]) {
      firmBreakdown[r.employee.firm] = {
        firm: r.employee.firm,
        headcount: 0,
        grossBase: 0,
        gross: 0,
        esiDeduct: 0,
        bonus: 0,
        netPayable: 0,
        employerEsi: 0,
      };
    }
    const f = firmBreakdown[r.employee.firm];
    f.headcount += 1;
    f.grossBase += r.employee.salary;
    f.gross += r.grossAfterAbsent;
    f.esiDeduct += r.esiDeduct;
    f.bonus += r.bonus;
    f.netPayable += r.netPayable;
    f.employerEsi += r.employerEsi;
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.grossBase += r.employee.salary;
      acc.gross += r.grossAfterAbsent;
      acc.esiDeduct += r.esiDeduct;
      acc.bonus += r.bonus;
      acc.netPayable += r.netPayable;
      acc.employerEsi += r.employerEsi;
      acc.daysAbsent += r.daysAbsent;
      return acc;
    },
    { grossBase: 0, gross: 0, esiDeduct: 0, bonus: 0, netPayable: 0, employerEsi: 0, daysAbsent: 0 },
  );

  return {
    totalDays,
    publicHolidays,
    holidayList,
    rows,
    firmBreakdown: Object.values(firmBreakdown),
    totals,
    headcount: employees.length,
  };
}
