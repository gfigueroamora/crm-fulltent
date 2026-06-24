import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { FTBLUE, FTGRAY } from '../constants';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#f0f4f8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ background: FTBLUE, padding: '28px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 36, color: '#fff', letterSpacing: -1 }}>Full</span>
            <span style={{ fontWeight: 900, fontSize: 36, color: '#93c5fd', letterSpacing: -1 }}>Tent</span>
            <span style={{ fontSize: 12, color: '#93c5fd', verticalAlign: 'super', marginLeft: 1 }}>®</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontStyle: 'italic', marginTop: 4 }}>
            Soluciones Modulares y Encarpados Industriales
          </div>
          <div style={{
            marginTop: 14, display: 'inline-block',
            background: 'rgba(255,255,255,.15)', borderRadius: 6,
            padding: '4px 12px', fontSize: 11, color: '#fff', letterSpacing: 1
          }}>
            CRM COMERCIAL
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ padding: '28px 32px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
              Correo electrónico
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box',
                outline: 'none'
              }}
              placeholder="tu@email.com"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
              Contraseña
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box',
                outline: 'none'
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', padding: '10px 12px',
              borderRadius: 7, fontSize: 12, marginBottom: 16, textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : FTBLUE, color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer',
              transition: '.15s'
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
