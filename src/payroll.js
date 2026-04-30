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

/**
 * Compute payroll for a single employee for a given month.
 * Logic mirrors the original Excel workbook:
 *  - Per-day salary = monthly_salary / total_days_in_month
 *  - Days absent   = total_days − days_present − public_holidays (floored at 0)
 *  - Gross after absent deduction = per_day * (total_days − days_absent)
 *  - ESI (if applicable) deducted at 0.75%
 *  - Bonus (if applicable) added at 8.33%
 */
export function computeEmployeePayroll({ employee, daysPresent, totalDays, publicHolidays }) {
  const perDay = employee.salary / totalDays;
  const daysAbsent = Math.max(0, totalDays - daysPresent - publicHolidays);
  const paidDays = totalDays - daysAbsent;
  const grossAfterAbsent = perDay * paidDays;

  const esiEligible = employee.salary <= ESI_THRESHOLD;
  const esiDeduct = esiEligible ? grossAfterAbsent * ESI_EMPLOYEE_RATE : 0;
  const afterEsi = grossAfterAbsent - esiDeduct;

  const bonus = employee.bonus ? grossAfterAbsent * BONUS_RATE : 0;
  const netPayable = afterEsi + bonus;

  const employerEsi = esiEligible ? grossAfterAbsent * ESI_EMPLOYER_RATE : 0;

  return {
    perDay,
    daysAbsent,
    paidDays,
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
    const daysPresent = monthAtt[emp.id] != null
      ? monthAtt[emp.id]
      : (totalDays - publicHolidays); // default = present every working day
    const calc = computeEmployeePayroll({ employee: emp, daysPresent, totalDays, publicHolidays });
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
