import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import CRM from './components/CRM';
import CRMCarpas from './carpas/CRMCarpas';

const FTBLUE = '#1a3a6b';

function AppShell({ user }) {
  const [activeTab, setActiveTab] = useState('cobertores');

  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', minHeight:'100vh', background:'#f0f4f8' }}>
      {/* Header global */}
      <div style={{ background:FTBLUE, color:'#fff', padding:'10px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div>
            <div style={{ display:'flex', alignItems:'baseline' }}>
              <span style={{ fontWeight:900, fontSize:22, color:'#fff', letterSpacing:-.5 }}>Full</span>
              <span style={{ fontWeight:900, fontSize:22, color:'#93c5fd', letterSpacing:-.5 }}>Tent</span>
              <span style={{ fontSize:9, color:'#93c5fd', verticalAlign:'super', marginLeft:1 }}>®</span>
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', fontStyle:'italic' }}>Soluciones Modulares y Encarpados Industriales</div>
          </div>
          <div style={{ width:1, height:32, background:'rgba(255,255,255,.25)' }}/>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', letterSpacing:.3 }}>PLATAFORMA COMERCIAL</div>
        </div>

        {/* Tabs de CRM */}
        <div style={{ display:'flex', gap:4 }}>
          {[
            { key:'cobertores', label:'🏭 Cobertores' },
            { key:'carpas',     label:'⛺ Carpas' },
            { key:'exponor',    label:'🏔 Exponor', disabled:true },
          ].map(t=>(
            <button key={t.key} onClick={()=>!t.disabled&&setActiveTab(t.key)}
              disabled={t.disabled}
              style={{
                padding:'7px 16px', borderRadius:8, border:'none',
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                fontSize:12, fontWeight:700,
                background: activeTab===t.key
                  ? '#fff'
                  : t.disabled ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)',
                color: activeTab===t.key
                  ? FTBLUE
                  : t.disabled ? 'rgba(255,255,255,.3)' : '#fff',
                borderBottom: activeTab===t.key ? `3px solid #3b82f6` : '3px solid transparent',
                transition:'.15s', opacity: t.disabled ? .5 : 1,
              }}>
              {t.label}
              {t.disabled && <span style={{ fontSize:9, marginLeft:4, color:'rgba(255,255,255,.4)' }}>(próximo)</span>}
            </button>
          ))}
        </div>

        {/* Usuario */}
        <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>
          👤 {user?.email?.split('@')[0]}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ display: activeTab==='cobertores' ? 'block' : 'none' }}>
        <CRM user={user}/>
      </div>
      <div style={{ display: activeTab==='carpas' ? 'block' : 'none' }}>
        <CRMCarpas/>
      </div>
      {activeTab==='exponor' && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#6b7280', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:40 }}>🏔</div>
          <div style={{ fontWeight:700, fontSize:18 }}>CRM Exponor</div>
          <div style={{ fontSize:14 }}>Próximamente — en construcción</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{
      setUser(u); setLoading(false);
    });
    return unsub;
  },[]);

  if(loading) return(
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif',color:'#6b7280',fontSize:14 }}>
      Cargando...
    </div>
  );

  return user ? <AppShell user={user}/> : <Login/>;
}
