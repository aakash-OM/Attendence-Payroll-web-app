import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, FileText, Upload, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { formatINR } from '../payroll';
import { ESI_THRESHOLD } from '../seedData';

const EMPTY = {
  id: null, name: '', guardian: '', firm: '', salary: 15000, esi: true, bonus: false,
};

// empDocs = documents[emp.id] = { aadhar: { url, name, uploadedAt } | null, pan: ... } | undefined
function docIconStyle(empDocs) {
  const count = (empDocs?.aadhar ? 1 : 0) + (empDocs?.pan ? 1 : 0);
  if (count === 2) return { color: '#39ff14', filter: 'drop-shadow(0 0 6px #39ff14)' };
  if (count === 1) return { color: '#ff8c00', filter: 'drop-shadow(0 0 6px #ff8c00)' };
  return { color: 'var(--text-faint)', filter: 'none' };
}

function DocModal({ empId, employees, documents, setDocuments, onClose }) {
  const emp     = employees.find((e) => e.id === empId);
  const empDocs = documents?.[empId] || {};

  // pending: file selected by user but not yet uploaded
  const [pending,   setPending]   = useState({ aadhar: null, pan: null });
  const [uploading, setUploading] = useState({ aadhar: false, pan: false });
  const [saved,     setSaved]     = useState({ aadhar: false, pan: false });

  const aadharRef = useRef(null);
  const panRef    = useRef(null);
  const inputRefs = { aadhar: aadharRef, pan: panRef };

  if (!emp) return null;

  const docCount = (empDocs.aadhar ? 1 : 0) + (empDocs.pan ? 1 : 0);

  const selectFile = (type, file) => {
    if (!file) return;
    setPending((p) => ({ ...p, [type]: file }));
  };

  const uploadDoc = async (type) => {
    const file = pending[type];
    if (!file) return;

    setUploading((u) => ({ ...u, [type]: true }));
    try {
      const fileRef = sRef(storage, `documents/${empId}/${type}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const entry = { url, name: file.name, uploadedAt: new Date().toISOString() };
      const updatedMap = {
        ...documents,
        [empId]: { ...empDocs, [type]: entry },
      };
      await setDocuments(updatedMap);

      setPending((p) => ({ ...p, [type]: null }));
      setSaved((s) => ({ ...s, [type]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [type]: false })), 3000);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading((u) => ({ ...u, [type]: false }));
  };

  const removeDoc = async (type) => {
    if (!confirm('Remove this document?')) return;
    try {
      await deleteObject(sRef(storage, `documents/${empId}/${type}`));
    } catch { /* file may not exist in Storage */ }
    const updatedMap = {
      ...documents,
      [empId]: { ...empDocs, [type]: null },
    };
    await setDocuments(updatedMap);
  };

  const rows = [
    { type: 'aadhar', label: 'Aadhaar Card' },
    { type: 'pan',    label: 'PAN Card' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 440, maxWidth: 520 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={docIconStyle(empDocs)} />
            KYC Documents
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="panel-title-sub" style={{ marginBottom: 4 }}>{emp.name}</div>
        <div style={{
          fontSize: 11, marginBottom: 16,
          color: docCount === 2 ? '#39ff14' : docCount === 1 ? '#ff8c00' : 'var(--text-faint)',
        }}>
          {docCount === 2 ? '✓ Both documents on file' : docCount === 1 ? '⚠ 1 of 2 documents uploaded' : '✗ No documents uploaded yet'}
        </div>

        {/* Document rows */}
        {rows.map(({ type, label }) => {
          const stored      = empDocs[type];          // { url, name, uploadedAt } | null | undefined
          const pendingFile = pending[type];
          const busy        = uploading[type];
          const justSaved   = saved[type];

          return (
            <div key={type} style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 12,
            }}>
              {/* Doc label + status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13 }}>
                  <FileText
                    size={13}
                    style={{
                      color:  stored ? '#39ff14' : 'var(--text-faint)',
                      filter: stored ? 'drop-shadow(0 0 4px #39ff14)' : 'none',
                    }}
                  />
                  {label}
                </span>
                <span style={{ fontSize: 11, color: stored ? '#39ff14' : 'var(--text-faint)' }}>
                  {stored ? '✓ Uploaded' : '✗ Not uploaded'}
                </span>
              </div>

              {/* Stored file row */}
              {stored && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-1)', borderRadius: 6,
                  padding: '6px 10px', marginBottom: 10, gap: 8,
                }}>
                  <span style={{
                    fontSize: 11, color: 'var(--text-faint)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 220,
                  }}>
                    {stored.name}
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <a href={stored.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="View document">
                      <ExternalLink size={11} /> View
                    </a>
                    <button className="btn btn-sm btn-danger" onClick={() => removeDoc(type)} title="Remove document">
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>
              )}

              {/* File picker + upload button */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* "Choose file" area */}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => inputRefs[type].current?.click()}
                  disabled={busy}
                  style={{ flex: 1, justifyContent: 'flex-start', overflow: 'hidden' }}
                >
                  {pendingFile ? (
                    <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {pendingFile.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {stored ? 'Choose replacement…' : 'Choose file…'}
                    </span>
                  )}
                </button>

                {/* Confirm upload button */}
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => uploadDoc(type)}
                  disabled={!pendingFile || busy}
                  style={{ flexShrink: 0, minWidth: 155 }}
                >
                  {busy ? (
                    <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Uploading to Firebase…</>
                  ) : justSaved ? (
                    <><CheckCircle2 size={12} style={{ color: '#39ff14' }} /> Saved to Firebase!</>
                  ) : (
                    <><Upload size={12} /> Upload to Firebase</>
                  )}
                </button>

                <input
                  ref={inputRefs[type]}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => { selectFile(type, e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>

              {/* Upload hint */}
              {pendingFile && !busy && (
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>
                  Click "Upload to Firebase" to save this file to the database.
                </div>
              )}
            </div>
          );
        })}

        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Employees({ employees, setEmployees, attendance, setAttendance, documents, setDocuments }) {
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
    if (!editing.name.trim())                   { alert('Name is required');       return; }
    if (!editing.firm.trim())                   { alert('Firm is required');        return; }
    if (!editing.salary || editing.salary <= 0) { alert('Salary must be > 0');     return; }

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
          Edit an employee's salary, ESI/bonus eligibility, or remove them. Click the{' '}
          <FileText size={12} style={{ verticalAlign: 'middle' }} /> icon to upload KYC documents
          (Aadhaar &amp; PAN) — stored in Firebase.
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
                {list.map((emp, i) => {
                  const empDocs = documents?.[emp.id];
                  return (
                    <tr key={emp.id}>
                      <td className="faint mono">{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => setDocEmpId(emp.id)}
                            title={`KYC Documents — Aadhaar: ${empDocs?.aadhar ? '✓' : '✗'}  PAN: ${empDocs?.pan ? '✓' : '✗'}`}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <FileText size={13} style={{ flexShrink: 0, ...docIconStyle(empDocs) }} />
                          </button>
                          {emp.name}
                        </span>
                      </td>
                      <td className="muted">{emp.guardian}</td>
                      <td className="num">{formatINR(emp.salary)}</td>
                      <td>
                        <span className={`pill ${emp.salary <= ESI_THRESHOLD ? 'yes' : 'no'}`}>
                          {emp.salary <= ESI_THRESHOLD ? 'YES' : 'NO'}
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
                  );
                })}
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
          documents={documents}
          setDocuments={setDocuments}
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
                onChange={(e) => {
                  const salary = Number(e.target.value);
                  setEditing({ ...editing, salary, esi: salary <= ESI_THRESHOLD });
                }}
                min={0}
                step={100}
              />
            </div>

            <label className="switch-row" style={{ opacity: 0.7, cursor: 'default' }}>
              <input
                type="checkbox"
                checked={editing.salary <= ESI_THRESHOLD}
                readOnly
                style={{ pointerEvents: 'none' }}
              />
              <span>
                ESI applicable{' '}
                <span className="faint mono" style={{ fontSize: 11 }}>
                  (auto: salary ≤ ₹21,000 → 0.75% deducted)
                </span>
              </span>
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
