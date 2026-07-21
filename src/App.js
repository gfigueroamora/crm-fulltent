import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import CRM from './components/CRM';
import CRMCarpas from './carpas/CRMCarpas';
import CRMExponor from './exponor/CRMExponor';

const FTBLUE = '#1a3a6b';
const INTER = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

function AppShell({ user }) {
  const [activeTab, setActiveTab] = useState('cobertores');

  const tabs = [
    { key:'cobertores', label:'🏭 Cobertores' },
    { key:'carpas',     label:'⛺ Carpas' },
    { key:'exponor',    label:'🏔 Exponor' },
  ];

  return (
    <div style={{ fontFamily:INTER, minHeight:'100vh', background:'#f8f9fa' }}>
      <div style={{ background:FTBLUE, color:'#fff', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div>
            <div style={{ display:'flex', alignItems:'baseline' }}>
              <span style={{ fontWeight:900, fontSize:22, color:'#fff', letterSpacing:-.5 }}>Full</span>
              <span style={{ fontWeight:900, fontSize:22, color:'#93c5fd', letterSpacing:-.5 }}>Tent</span>
              <span style={{ fontSize:9, color:'#93c5fd', verticalAlign:'super', marginLeft:1 }}>®</span>
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', fontStyle:'italic' }}>Soluciones Modulares y Encarpados Industriales</div>
          </div>
          <div style={{ width:1, height:32, background:'rgba(255,255,255,.2)' }}/>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', letterSpacing:.3 }}>PLATAFORMA COMERCIAL</div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key)}
              style={{
                padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700, fontFamily:INTER,
                background: activeTab===t.key ? '#fff' : 'rgba(255,255,255,.12)',
                color: activeTab===t.key ? FTBLUE : '#fff',
                borderBottom: activeTab===t.key ? '3px solid #3b82f6' : '3px solid transparent',
                transition:'.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:INTER }}>
          👤 {user?.email?.split('@')[0]}
        </div>
      </div>

      {activeTab==='cobertores' && <CRM user={user}/>}
      {activeTab==='carpas'     && <CRMCarpas/>}
      {activeTab==='exponor'    && <CRMExponor/>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{ setUser(u); setLoading(false); });
    return unsub;
  },[]);
  if(loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:INTER,color:'#64748b',fontSize:14 }}>Cargando...</div>;
  return user ? <AppShell user={user}/> : <Login/>;
}
