import { useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { SEED_HOLIDAYS } from '../seedData';
import { Zap, ChevronLeft } from 'lucide-react';

const COUNT_PRESETS = [1, 2, 3, 4];

export default function CompanySetup({ user, onComplete }) {
  const [step,        setStep]        = useState(1);
  const [firmCount,   setFirmCount]   = useState(null);
  const [customCount, setCustomCount] = useState(5);
  const [showCustom,  setShowCustom]  = useState(false);
  const [firmNames,   setFirmNames]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const goToNames = (count) => {
    setFirmCount(count);
    setFirmNames(Array(count).fill(''));
    setStep(2);
    setError('');
  };

  const updateName = (i, val) => {
    const next = [...firmNames];
    next[i] = val;
    setFirmNames(next);
    setError('');
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (firmNames.some((n) => !n.trim())) {
      setError('Please fill in all firm names.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const firms = firmNames.map((name, i) => ({
        id:   `${user.uid}_${i}`,
        name: name.trim(),
      }));

      await setDoc(doc(db, 'users', user.uid), {
        firms,
        email:     user.email || '',
        createdAt: new Date().toISOString(),
        role:      'admin',
      });

      for (const firm of firms) {
        const base    = (key) => doc(db, 'companies', firm.id, 'payroll', key);
        const empSnap = await getDoc(base('employees'));
        if (!empSnap.exists()) {
          await setDoc(base('employees'),  { list: [] });
          await setDoc(base('holidays'),   { list: SEED_HOLIDAYS });
          await setDoc(base('attendance'), { map: {} });
          await setDoc(base('documents'),  { map: {} });
        }
      }

      onComplete({ firms });
    } catch (err) {
      setError('Setup failed: ' + err.message);
    }

    setLoading(false);
  };

  const signOutBtn = (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <button
        onClick={() => signOut(auth)}
        style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
      >
        Sign out and use a different account
      </button>
    </div>
  );

  const brandHeader = (title) => (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.2em', color: 'var(--accent)',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        <Zap size={13} /> Payroll Dashboard
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
        {title}
      </h1>
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
        Signed in as{' '}
        <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {user.email || user.displayName}
        </span>
      </p>
    </div>
  );

  const cardStyle = {
    background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 32,
  };

  const wrap = (children) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {children}
        {signOutBtn}
      </div>
    </div>
  );

  /* ── Step 1: choose number of firms ─────────────────────────────────────── */
  if (step === 1) return wrap(
    <>
      {brandHeader('Set up your workspace')}
      <div style={cardStyle}>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 24px', textAlign: 'center' }}>
          How many firms do you manage?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {COUNT_PRESETS.map((n) => (
            <button
              key={n}
              className="btn"
              onClick={() => goToNames(n)}
              style={{ justifyContent: 'center', flexDirection: 'column', gap: 4, padding: '14px 8px', height: 72 }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{n}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{n === 1 ? 'Firm' : 'Firms'}</span>
            </button>
          ))}
        </div>

        {!showCustom ? (
          <button
            className="btn btn-ghost"
            onClick={() => setShowCustom(true)}
            style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 13 }}
          >
            5 or more firms…
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number" min={5} max={20}
              value={customCount}
              onChange={(e) => setCustomCount(Math.max(5, Math.min(20, Number(e.target.value))))}
              style={{ width: 72, textAlign: 'center' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => goToNames(customCount)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Continue with {customCount} firms
            </button>
          </div>
        )}
      </div>
    </>
  );

  /* ── Step 2: enter firm names ────────────────────────────────────────────── */
  return wrap(
    <>
      {brandHeader('Name your firms')}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setStep(1); setShowCustom(false); }}>
            <ChevronLeft size={14} /> Back
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {firmCount} {firmCount === 1 ? 'firm' : 'firms'}
          </span>
        </div>

        <form onSubmit={handleSetup}>
          {firmNames.map((name, i) => (
            <div key={i} className="field" style={{ marginBottom: 14 }}>
              <label>Firm {i + 1}</label>
              <input
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
                placeholder={i === 0 ? 'e.g. ABC Industries Pvt. Ltd.' : i === 1 ? 'e.g. XYZ Enterprises' : `Firm ${i + 1} name`}
                required
                autoFocus={i === 0}
              />
            </div>
          ))}

          {error && (
            <div style={{ background: 'rgba(212,106,90,0.12)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || firmNames.some((n) => !n.trim())}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14, marginTop: 8, opacity: loading || firmNames.some((n) => !n.trim()) ? 0.7 : 1 }}
          >
            {loading ? 'Setting up…' : firmCount === 1 ? 'Create Dashboard' : `Create ${firmCount} Firm Workspaces`}
          </button>
        </form>
      </div>
    </>
  );
}
