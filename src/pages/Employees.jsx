import { useState } from 'react';
import { Plus, Pencil, Trash2, X, FileText } from 'lucide-react';
import { formatINR } from '../payroll';

const EMPTY = {
  id: null, name: '', guardian: '', firm: '', salary: 15000, esi: true, bonus: false,
  docs: { aadhar: false, pan: false },
};

function docIconStyle(emp) {
  const count = (emp.docs?.aadhar ? 1 : 0) + (emp.docs?.pan ? 1 : 0);
  if (count === 2) return { color: '#39ff14', filter: 'drop-shadow(0 0 5px #39ff14)' };
  if (count === 1) return { color: '#ff8c00', filter: 'drop-shadow(0 0 5px #ff8c00)' };
  return { color: 'var(--text-faint)', filter: 'none' };
}

export default function Employees({ employees, setEmployees, attendance, setAttendance }) {
  const [editing, setEditing] = useState(null); // employee or null
  const [creating, setCreating] = useState(false);

  const firms = [...new Set(employees.map((e) => e.firm))];

  const byFirm = firms.map((f) => ({
    firm: f,
    list: employees.filter((e) => e.firm === f),
    totalSalary: employees.filter((e) => e.firm === f).reduce((s, e) => s + e.salary, 0),
  }));

  const openNew = () => { setEditing({ ...EMPTY, firm: firms[0] || 'New Firm' }); setCreating(true); };
  const openEdit = (emp) => { setEditing({ ...emp }); setCreating(false); };
  const close = () => { setEditing(null); setCreating(false); };

  const save = () => {
    if (!editing.name.trim()) { alert('Name is required'); return; }
    if (!editing.firm.trim()) { alert('Firm is required'); return; }
    if (!editing.salary || editing.salary <= 0) { alert('Salary must be > 0'); return; }

    if (creating) {
      const nextId = Math.max(0, ...employees.map((e) => e.id)) + 1;
      setEmployees([...employees, { ...editing, id: nextId }]);
    } else {
      setEmployees(employees.map((e) => (e.id === editing.id ? editing : e)));
    }
    close();
  };

  const remove = (emp) => {
    if (!confirm(`Remove ${emp.name}? All attendance records for this employee will also be deleted.`)) return;
    setEmployees(employees.filter((e) => e.id !== emp.id));
    // Remove attendance for this employee across all months
    setAttendance((prev) => {
      const next = {};
      for (const mk of Object.keys(prev)) {
        const { [emp.id]: _drop, ...rest } = prev[mk];
        next[mk] = rest;
      }
      return next;
    });
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Employee Master</h2>
            <div className="panel-title-sub">
              — {employees.length} EMPLOYEES · {firms.length} FIRMS ·{' '}
              TOTAL PAYROLL BASE {formatINR(employees.reduce((s, e) => s + e.salary, 0))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} /> Add employee
          </button>
        </div>

        <div className="info-note">
          Edit an employee's salary, ESI/bonus eligibility, or remove them. Changes flow through
          immediately to attendance, payroll, and all dashboards.
        </div>
      </div>

      {byFirm.map(({ firm, list, totalSalary }) => (
        <div key={firm} className="panel">
          <div className="panel-title">
            <div>
              <h2 style={{ fontSize: 17 }}>{firm}</h2>
              <div className="panel-title-sub">
                — {list.length} EMPLOYEES · BASE {formatINR(totalSalary)}
              </div>
            </div>
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Name</th>
                  <th>Guardian</th>
                  <th className="num">Salary</th>
                  <th>ESI</th>
                  <th>Bonus</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((emp, i) => (
                  <tr key={emp.id}>
                    <td className="faint mono">{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={13} style={{ flexShrink: 0, ...docIconStyle(emp) }} title={`Aadhaar: ${emp.docs?.aadhar ? '✓' : '✗'}  PAN: ${emp.docs?.pan ? '✓' : '✗'}`} />
                        {emp.name}
                      </span>
                    </td>
                    <td className="muted">{emp.guardian}</td>
                    <td className="num">{formatINR(emp.salary)}</td>
                    <td>
                      <span className={`pill ${emp.esi ? 'yes' : 'no'}`}>
                        {emp.esi ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${emp.bonus ? 'yes' : 'no'}`}>
                        {emp.bonus ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(emp)}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(emp)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{creating ? 'New Employee' : 'Edit Employee'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={close}><X size={14} /></button>
            </div>

            <div className="field">
              <label>Employee name</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Rahul Kumar"
                autoFocus
              />
            </div>

            <div className="field">
              <label>Father / Husband name</label>
              <input
                value={editing.guardian}
                onChange={(e) => setEditing({ ...editing, guardian: e.target.value })}
                placeholder="e.g. Mr. Ram Kumar"
              />
            </div>

            <div className="field">
              <label>Firm</label>
              <input
                value={editing.firm}
                onChange={(e) => setEditing({ ...editing, firm: e.target.value })}
                list="firm-suggestions"
                placeholder="Firm name"
              />
              <datalist id="firm-suggestions">
                {firms.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>

            <div className="field">
              <label>Monthly salary (₹)</label>
              <input
                type="number"
                value={editing.salary}
                onChange={(e) => setEditing({ ...editing, salary: Number(e.target.value) })}
                min={0}
                step={100}
              />
            </div>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={editing.esi}
                onChange={(e) => setEditing({ ...editing, esi: e.target.checked })}
              />
              <span>ESI applicable <span className="faint mono" style={{ fontSize: 11 }}>(0.75% deducted)</span></span>
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={editing.bonus}
                onChange={(e) => setEditing({ ...editing, bonus: e.target.checked })}
              />
              <span>Bonus applicable <span className="faint mono" style={{ fontSize: 11 }}>(8.33% added)</span></span>
            </label>

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 8px', paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documents</div>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={editing.docs?.aadhar || false}
                  onChange={(e) => setEditing({ ...editing, docs: { ...(editing.docs || {}), aadhar: e.target.checked } })}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={13} style={{ color: editing.docs?.aadhar ? '#39ff14' : 'var(--text-faint)', filter: editing.docs?.aadhar ? 'drop-shadow(0 0 5px #39ff14)' : 'none' }} />
                  Aadhaar Card uploaded
                </span>
              </label>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={editing.docs?.pan || false}
                  onChange={(e) => setEditing({ ...editing, docs: { ...(editing.docs || {}), pan: e.target.checked } })}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={13} style={{ color: editing.docs?.pan ? '#39ff14' : 'var(--text-faint)', filter: editing.docs?.pan ? 'drop-shadow(0 0 5px #39ff14)' : 'none' }} />
                  PAN Card uploaded
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={close}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>
                {creating ? 'Add employee' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
