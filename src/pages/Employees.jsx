import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, FileText, Upload, ExternalLink, Loader2 } from 'lucide-react';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { formatINR } from '../payroll';

const EMPTY = {
  id: null, name: '', guardian: '', firm: '', salary: 15000, esi: true, bonus: false,
  docs: { aadhar: null, pan: null },
};

function docIconStyle(emp) {
  const count = (emp.docs?.aadhar ? 1 : 0) + (emp.docs?.pan ? 1 : 0);
  if (count === 2) return { color: '#39ff14', filter: 'drop-shadow(0 0 6px #39ff14)' };
  if (count === 1) return { color: '#ff8c00', filter: 'drop-shadow(0 0 6px #ff8c00)' };
  return { color: 'var(--text-faint)', filter: 'none' };
}

function DocModal({ empId, employees, setEmployees, onClose }) {
  const emp = employees.find((e) => e.id === empId);
  const [uploading, setUploading] = useState({ aadhar: false, pan: false });
  const aadharRef = useRef(null);
  const panRef    = useRef(null);
  const inputRefs = { aadhar: aadharRef, pan: panRef };

  if (!emp) return null;

  const handleUpload = async (type, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [type]: true }));
    try {
      const fileRef = sRef(storage, `documents/${emp.id}/${type}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setEmployees(employees.map((e) =>
        e.id === emp.id ? { ...e, docs: { ...(e.docs || {}), [type]: url } } : e,
      ));
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading((u) => ({ ...u, [type]: false }));
  };

  const handleRemove = async (type) => {
    if (!confirm('Remove this document?')) return;
    try {
      await deleteObject(sRef(storage, `documents/${emp.id}/${type}`));
    } catch { /* file may not exist */ }
    setEmployees(employees.map((e) =>
      e.id === emp.id ? { ...e, docs: { ...(e.docs || {}), [type]: null } } : e,
    ));
  };

  const rows = [
    { type: 'aadhar', label: 'Aadhaar Card' },
    { type: 'pan',    label: 'PAN Card' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={docIconStyle(emp)} />
            Documents
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="panel-title-sub" style={{ marginBottom: 16 }}>{emp.name}</div>

        <div className="info-note" style={{ marginBottom: 14 }}>
          Upload Aadhaar and PAN cards (image or PDF). Files are stored securely in Firebase Storage.
        </div>

        {rows.map(({ type, label }) => {
          const url = emp.docs?.[type] || null;
          const busy = uploading[type];
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText
                  size={14}
                  style={{
                    color: url ? '#39ff14' : 'var(--text-faint)',
                    filter: url ? 'drop-shadow(0 0 4px #39ff14)' : 'none',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 11, color: url ? '#39ff14' : 'var(--text-faint)' }}>
                  {url ? 'Uploaded' : 'Not uploaded'}
                </span>
              </span>

              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-ghost"
                    title="View document"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {url && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemove(type)}
                    title="Remove document"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => inputRefs[type].current?.click()}
                  title={url ? 'Replace document' : 'Upload document'}
                >
                  {busy
                    ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : <Upload size={12} />}
                  {url ? 'Replace' : 'Upload'}
                </button>
                <input
                  ref={inputRefs[type]}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => { handleUpload(type, e.target.files?.[0]); e.target.value = ''; }}
                />
              </span>
            </div>
          );
        })}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Employees({ employees, setEmployees, attendance, setAttendance }) {
  const [editing,  setEditing]  = useState(null);
  const [creating, setCreating] = useState(false);
  const [docEmpId, setDocEmpId] = useState(null);

  const firms = [...new Set(employees.map((e) => e.firm))];

  const byFirm = firms.map((f) => ({
    firm: f,
    list: employees.filter((e) => e.firm === f),
    totalSalary: employees.filter((e) => e.firm === f).reduce((s, e) => s + e.salary, 0),
  }));

  const openNew  = () => { setEditing({ ...EMPTY, firm: firms[0] || 'New Firm' }); setCreating(true); };
  const openEdit = (emp) => { setEditing({ ...emp }); setCreating(false); };
  const close    = () => { setEditing(null); setCreating(false); };

  const save = () => {
    if (!editing.name.trim())               { alert('Name is required');       return; }
    if (!editing.firm.trim())               { alert('Firm is required');        return; }
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
          immediately to attendance, payroll, and all dashboards. Click the{' '}
          <FileText size={12} style={{ verticalAlign: 'middle' }} /> icon to manage KYC documents.
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
                        <button
                          onClick={() => setDocEmpId(emp.id)}
                          title={`Documents — Aadhaar: ${emp.docs?.aadhar ? '✓' : '✗'}  PAN: ${emp.docs?.pan ? '✓' : '✗'}`}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <FileText size={13} style={{ flexShrink: 0, ...docIconStyle(emp) }} />
                        </button>
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

      {/* Document upload modal */}
      {docEmpId !== null && (
        <DocModal
          empId={docEmpId}
          employees={employees}
          setEmployees={setEmployees}
          onClose={() => setDocEmpId(null)}
        />
      )}

      {/* Add / Edit employee modal */}
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
