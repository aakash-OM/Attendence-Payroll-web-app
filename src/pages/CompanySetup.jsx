import { useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Zap } from 'lucide-react';

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function CompanySetup({ user, onComplete }) {
  const [companyName, setCompanyName] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const preview = slugify(companyName);

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!companyName.trim() || !preview) {
      setError('Please enter a valid company name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // companyId = user UID — guaranteed unique, no collision possible
      const companyId = user.uid;

      // Save user profile
      await setDoc(doc(db, 'users', user.uid), {
        companyId,
        companyName: companyName.trim(),
        email:       user.email || '',
        createdAt:   new Date().toISOString(),
        role:        'admin',
      });

      const base = (key) => doc(db, 'companies', companyId, 'payroll', key);

      // Initialise fresh workspace if this company has no data yet
      const empSnap = await getDoc(base('employees'));
      if (!empSnap.exists()) {
        await setDoc(base('employees'), { list: [] });
        await setDoc(base('holidays'),  { list: [] });
        await setDoc(base('attendance'), { map: {} });
        await setDoc(base('documents'),  { map: {} });
      }

      onComplete({ companyId, companyName: companyName.trim() });
    } catch (err) {
      setError('Setup failed: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.2em', color: 'var(--accent)',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            <Zap size={13} /> Payroll Dashboard
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28, fontWeight: 500, margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Set up your company
          </h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
            Signed in as{' '}
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {user.email || user.displayName}
            </span>
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: 32,
        }}>
          <form onSubmit={handleSetup}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Company name</label>
              <input
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                placeholder="e.g. ABC Industries Pvt. Ltd."
                required
                autoFocus
              />
            </div>

            {/* Live slug preview */}
            {companyName && (
              <div style={{
                fontSize: 11, color: 'var(--text-faint)',
                fontFamily: 'var(--font-mono)', marginBottom: 20,
                padding: '6px 10px', background: 'var(--bg-2)',
                borderRadius: 6, display: 'inline-block',
              }}>
                ID: <span style={{ color: 'var(--accent)' }}>{preview || '—'}</span>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(212,106,90,0.12)',
                border: '1px solid var(--danger)',
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: 'var(--danger)',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !companyName.trim()}
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                padding: '11px 16px', fontSize: 14,
                opacity: loading || !companyName.trim() ? 0.7 : 1,
              }}
            >
              {loading ? 'Setting up…' : 'Create Company Dashboard'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => signOut(auth)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-faint)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
