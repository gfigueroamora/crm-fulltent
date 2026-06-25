import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import SEED_DATA from '../seedData';
import { ESTADOS, PIPE_STAGES, MESES_KEYS, MESES_LABELS, MESES_ORDER, RUBRO_LIST, ESTADO_CFG, PIE_COLORS, FTBLUE } from '../constants';
import { fmtCLP, fmtM2, fmtDate, parseExcelFile, exportXLSX } from '../utils';
import Modal from './Modal';

const COLLECTION = 'solicitudes';

function Badge({ estado }) {
  const cfg = ESTADO_CFG[estado] || { c:'#9ca3af', bg:'#f9fafb' };
  return <span style={{ background:cfg.bg, color:cfg.c, padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:600, whiteSpace:'nowrap' }}>{estado}</span>;
}
function Toast({ msg, type }) {
  const cols = { ok:'#16a34a', warn:'#f59e0b', err:'#dc2626' };
  return msg ? <div style={{ position:'fixed',top:14,right:14,zIndex:500,background:cols[type]||'#16a34a',color:'#fff',padding:'10px 18px',borderRadius:9,fontSize:12,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,.25)' }}>{msg}</div> : null;
}

function ImportModal({ onReplace, onAdd, onCancel }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#fff',borderRadius:13,width:420,boxShadow:'0 24px 64px rgba(0,0,0,.3)',overflow:'hidden' }}>
        <div style={{ background:FTBLUE,padding:'14px 18px' }}>
          <div style={{ fontWeight:700,fontSize:14,color:'#fff' }}>📥 Importar Excel</div>
          <div style={{ fontSize:11,color:'rgba(255,255,255,.7)',marginTop:3 }}>¿Cómo quieres importar este archivo?</div>
        </div>
        <div style={{ padding:20 }}>
          <div onClick={onReplace} style={{ border:'1.5px solid #fee2e2',borderRadius:9,padding:'14px 16px',marginBottom:10,cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{ fontWeight:700,fontSize:13,color:'#dc2626',marginBottom:3 }}>🔄 Reemplazar todo</div>
            <div style={{ fontSize:11,color:'#6b7280' }}>Borra todos los registros actuales y carga el Excel completo.</div>
          </div>
          <div onClick={onAdd} style={{ border:'1.5px solid #dcfce7',borderRadius:9,padding:'14px 16px',marginBottom:10,cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{ fontWeight:700,fontSize:13,color:'#16a34a',marginBottom:3 }}>➕ Solo agregar nuevos</div>
            <div style={{ fontSize:11,color:'#6b7280' }}>Compara por fecha + empresa y agrega solo los registros nuevos.</div>
          </div>
          <button onClick={onCancel} style={{ width:'100%',padding:'9px',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',cursor:'pointer',fontSize:12,fontWeight:600 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Dropdown multi-select con checkboxes
function MultiSelect({ label, options, selected, onChange, orderFn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const ordered = orderFn ? [...options].sort(orderFn) : options;
  const count = selected.length;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = val => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding:'5px 10px', borderRadius:6, border:'1px solid #e5e7eb',
        fontSize:12, background:'#fff', color:'#374151', cursor:'pointer',
        display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap'
      }}>
        {label}{count > 0 && <span style={{ background:FTBLUE,color:'#fff',borderRadius:99,fontSize:10,fontWeight:700,padding:'1px 6px' }}>{count}</span>}
        <span style={{ fontSize:10, color:'#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:100,
          background:'#fff', borderRadius:9, boxShadow:'0 4px 20px rgba(0,0,0,.15)',
          border:'1px solid #e5e7eb', minWidth:200, padding:'8px 0', maxHeight:280, overflowY:'auto'
        }}>
          {count > 0 && (
            <div onClick={() => onChange([])} style={{ padding:'4px 12px 8px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>
              ✕ Limpiar selección
            </div>
          )}
          {ordered.map(opt => (
            <label key={opt} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                style={{ width:13, height:13, accentColor:FTBLUE, cursor:'pointer' }}/>
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CRM({ user }) {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [fMeses, setFMeses]         = useState([]); // multi
  const [fAnio, setFAnio]           = useState('');
  const [fEstados, setFEstados]     = useState([]); // multi
  const [fRubro, setFRubro]         = useState('');
  const [sortCol, setSortCol]       = useState('fecha');
  const [sortDir, setSortDir]       = useState(-1);
  const [page, setPage]             = useState(1);
  const PAGE = 50;
  const [view, setView]             = useState('lista');
  const [statsTab, setStatsTab]     = useState('resumen');
  const [modal, setModal]           = useState(null);
  const [detail, setDetail]         = useState(null);
  const [delTarget, setDelTarget]   = useState(null);
  const [toast, setToast]           = useState(null);
  const [dragId, setDragId]         = useState(null);
  const [importFile, setImportFile] = useState(null);
  const xlsxRef = useRef();

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2800); };

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const snap = await getDocs(collection(db,COLLECTION));
        if (snap.empty) {
          setSaving(true);
          const batch = writeBatch(db);
          SEED_DATA.forEach(r=>{ const ref=doc(collection(db,COLLECTION)); batch.set(ref,{...r,_id:ref.id}); });
          await batch.commit();
          const snap2 = await getDocs(collection(db,COLLECTION));
          setRecords(snap2.docs.map(d=>({...d.data(),_fireId:d.id})));
          setSaving(false);
        } else {
          setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        }
      } catch(e){ console.error(e); showToast('Error al cargar datos','err'); }
      finally { setLoading(false); }
    })();
  },[]);

  const saveRecord = useCallback(async rec=>{
    setSaving(true);
    try {
      const existing = records.find(r=>r.id===rec.id);
      if (existing) {
        await updateDoc(doc(db,COLLECTION,existing._fireId),rec);
        setRecords(prev=>prev.map(r=>r.id===rec.id?{...rec,_fireId:existing._fireId}:r));
        showToast('Registro actualizado ✓');
      } else {
        const ref = await addDoc(collection(db,COLLECTION),rec);
        setRecords(prev=>[{...rec,_fireId:ref.id},...prev]);
        showToast('Prospecto creado ✓');
      }
    } catch(e){ showToast('Error al guardar','err'); }
    finally { setSaving(false); setModal(null); }
  },[records]);

  const deleteRecord = useCallback(async id=>{
    const rec = records.find(r=>r.id===id); if(!rec) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db,COLLECTION,rec._fireId));
      setRecords(prev=>prev.filter(r=>r.id!==id));
      if(detail?.id===id) setDetail(null);
      showToast('Registro eliminado','warn');
    } catch(e){ showToast('Error al eliminar','err'); }
    finally { setSaving(false); setDelTarget(null); }
  },[records,detail]);

  const updateEstado = useCallback(async(id,newEstado)=>{
    const rec = records.find(r=>r.id===id);
    if(!rec||rec.estado===newEstado) return;
    try {
      await updateDoc(doc(db,COLLECTION,rec._fireId),{estado:newEstado});
      setRecords(prev=>prev.map(r=>r.id===id?{...r,estado:newEstado}:r));
      showToast('→ '+newEstado);
    } catch(e){ showToast('Error al actualizar','err'); }
  },[records]);

  const exportCSV = ()=>{
    const cols=['empresa','nombre','rubro','producto','medidas','m2','tipo','mail','telefono','contacto','nCot','pCierre','monto','estado','dia','mes','anio','fecha','comentarioSeg','observacion'];
    const rows=records.map(r=>cols.map(c=>`"${(r[c]??'').toString().replace(/"/g,'""')}"`).join(','));
    const blob=new Blob([cols.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='crm_fulltent.csv';a.click();
  };

  const handleXLSXSelect = e=>{ const file=e.target.files[0];if(!file)return;setImportFile(file);e.target.value=''; };

  const doImportReplace = ()=>{
    if(!importFile)return;
    parseExcelFile(importFile,async data=>{
      setSaving(true);setImportFile(null);
      try {
        const snapAll=await getDocs(collection(db,COLLECTION));
        const delBatch=writeBatch(db);snapAll.docs.forEach(d=>delBatch.delete(d.ref));await delBatch.commit();
        for(let i=0;i<data.length;i+=400){
          const batch=writeBatch(db);
          data.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`Base reemplazada — ${data.length} registros ✓`);
      } catch(err){ showToast('Error al importar','err'); }
      finally { setSaving(false); }
    },()=>{ showToast('Error al leer Excel','err');setImportFile(null); });
  };

  const doImportAddNew = ()=>{
    if(!importFile)return;
    parseExcelFile(importFile,async data=>{
      setSaving(true);setImportFile(null);
      try {
        const existingKeys=new Set(records.map(r=>`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        const nuevos=data.filter(r=>!existingKeys.has(`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        if(nuevos.length===0){showToast('No hay registros nuevos','warn');setSaving(false);return;}
        for(let i=0;i<nuevos.length;i+=400){
          const batch=writeBatch(db);
          nuevos.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`${nuevos.length} registros nuevos agregados ✓`);
      } catch(err){ showToast('Error al importar','err'); }
      finally { setSaving(false); }
    },()=>{ showToast('Error al leer Excel','err');setImportFile(null); });
  };

  const allMeses = useMemo(()=>[...new Set(records.map(r=>r.mes).filter(Boolean))].sort((a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)),[records]);
  const allAnios = useMemo(()=>[...new Set(records.map(r=>r.anio).filter(Boolean))].sort(),[records]);
  const allRubros = useMemo(()=>[...new Set(records.map(r=>r.rubro).filter(Boolean))].sort(),[records]);
  const rubroList = useMemo(()=>{const ex=allRubros.filter(r=>!RUBRO_LIST.includes(r));return[...RUBRO_LIST,...ex];},[allRubros]);

  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return records.filter(r=>{
      if(q&&![r.empresa,r.nombre,r.nCot,r.producto,r.rubro].join(' ').toLowerCase().includes(q))return false;
      if(fMeses.length>0&&!fMeses.includes(r.mes))return false;
      if(fAnio&&String(r.anio)!==String(fAnio))return false;
      if(fEstados.length>0&&!fEstados.includes(r.estado))return false;
      if(fRubro&&r.rubro!==fRubro)return false;
      return true;
    }).sort((a,b)=>{
      let va=a[sortCol]??'',vb=b[sortCol]??'';
      if(typeof va==='number'&&typeof vb==='number')return sortDir*(va-vb);
      return sortDir*String(va).localeCompare(String(vb),'es');
    });
  },[records,search,fMeses,fAnio,fEstados,fRubro,sortCol,sortDir]);

  const hasFilter = !!(search||fMeses.length>0||fAnio||fEstados.length>0||fRubro);
  const base = hasFilter ? filtered : records;
  const ganados  = useMemo(()=>base.filter(r=>r.estado==='GANADO'),[base]);
  const perdidos = useMemo(()=>base.filter(r=>r.estado==='PERDIDO'),[base]);
  const pipeline = useMemo(()=>base.filter(r=>!['GANADO','PERDIDO','NO SE COTIZA'].includes(r.estado)),[base]);
  const montoGan  = ganados.reduce((a,r)=>a+(r.monto||0),0);
  const montoPipe = pipeline.reduce((a,r)=>a+(r.monto||0),0);
  const tasaConv  = ganados.length+perdidos.length>0?Math.round(ganados.length/(ganados.length+perdidos.length)*100):0;

  const doSort = col=>{ if(sortCol===col)setSortDir(d=>d*-1);else{setSortCol(col);setSortDir(-1);}setPage(1); };
  const onDrop = (e,stage)=>{ e.preventDefault();if(dragId)updateEstado(dragId,stage);setDragId(null); };
  const clearFilters = ()=>{ setSearch('');setFMeses([]);setFAnio('');setFEstados([]);setFRubro('');setPage(1); };
  const pageData = filtered.slice((page-1)*PAGE,page*PAGE);
  const totalPages = Math.ceil(filtered.length/PAGE)||1;

  // Stats
  const byEstado = ESTADOS.map(e=>({ label:e, value:base.filter(r=>r.estado===e).length, color:(ESTADO_CFG[e]||{c:'#9ca3af'}).c })).filter(d=>d.value>0);
  const byRubroArr = Object.entries(base.reduce((acc,r)=>{if(r.rubro){acc[r.rubro]=acc[r.rubro]||{count:0,monto:0};acc[r.rubro].count++;acc[r.rubro].monto+=r.monto||0;}return acc;},{})).sort((a,b)=>b[1].count-a[1].count).slice(0,10);
  const maxRubro = byRubroArr[0]?.[1].count||1;
  const mesData = MESES_KEYS.map((mk,i)=>{
    const items=base.filter(r=>r.mes===mk.mes&&r.anio===mk.anio);
    return{label:MESES_LABELS[i],total:items.length,ganados:items.filter(r=>r.estado==='GANADO').length};
  });
  const forecast = PIPE_STAGES.filter(s=>!['GANADO','PERDIDO','NO SE COTIZA'].includes(s)).map(s=>{
    const items=base.filter(r=>r.estado===s&&r.monto&&r.pCierre!=null);
    return{stage:s,count:items.length,pond:items.reduce((a,r)=>a+r.monto*(r.pCierre/100),0),cfg:ESTADO_CFG[s]||{c:'#9ca3af',bg:'#f9fafb'}};
  }).filter(f=>f.pond>0);
  const totalForecast = forecast.reduce((a,f)=>a+f.pond,0);
  const maxForecast = forecast[0]?.pond||1;

  const ss = {fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',background:'#f0f4f8',minHeight:'100vh',fontSize:13,color:'#111827'};
  const sel = {padding:'5px 8px',borderRadius:6,border:'1px solid #e5e7eb',fontSize:12,background:'#fff',color:'#374151'};
  const Th = ({col,label})=>(
    <th onClick={()=>doSort(col)} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:11,background:'#f8fafc',borderBottom:'2px solid #e5e7eb',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none'}}>
      {label}{sortCol===col?(sortDir>0?' ↑':' ↓'):''}
    </th>
  );

  if(loading) return(
    <div style={{...ss,display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div style={{textAlign:'center',color:'#6b7280'}}><div style={{fontSize:32,marginBottom:12}}>⚙</div><div style={{fontWeight:600}}>Cargando CRM Fulltent...</div></div>
    </div>
  );

  return(
    <div style={ss}>
      {toast&&<Toast {...toast}/>}
      {importFile&&<ImportModal onReplace={doImportReplace} onAdd={doImportAddNew} onCancel={()=>setImportFile(null)}/>}
      {modal!==null&&<Modal rec={modal} onSave={saveRecord} onClose={()=>setModal(null)} rubroList={rubroList}/>}

      {delTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:12,padding:26,width:320,textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑️</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>¿Eliminar registro?</div>
            <div style={{color:'#6b7280',fontSize:12,marginBottom:18}}>Se eliminará <b>{delTarget.empresa}</b>. No se puede deshacer.</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={()=>setDelTarget(null)} style={{padding:'8px 18px',borderRadius:7,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={()=>deleteRecord(delTarget.id)} style={{padding:'8px 18px',borderRadius:7,border:'none',background:'#dc2626',color:'#fff',cursor:'pointer',fontWeight:700}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:FTBLUE,color:'#fff',padding:'10px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,borderBottom:'3px solid #4a4a4a'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div>
            <div style={{display:'flex',alignItems:'baseline'}}>
              <span style={{fontWeight:900,fontSize:22,color:'#fff',letterSpacing:-.5}}>Full</span>
              <span style={{fontWeight:900,fontSize:22,color:'#93c5fd',letterSpacing:-.5}}>Tent</span>
              <span style={{fontSize:9,color:'#93c5fd',verticalAlign:'super',marginLeft:1}}>®</span>
            </div>
            <div style={{fontSize:9,color:'rgba(255,255,255,.5)',fontStyle:'italic'}}>Soluciones Modulares y Encarpados Industriales</div>
          </div>
          <div style={{width:1,height:32,background:'rgba(255,255,255,.25)'}}/>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'#fff',letterSpacing:.3}}>CRM COMERCIAL</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{records.length} registros totales{saving?' · Guardando...':''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {[['lista','📋 Lista'],['pipeline','📊 Pipeline'],['stats','📈 Estadísticas']].map(([v,lbl])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'6px 13px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:view===v?'rgba(255,255,255,.25)':'rgba(255,255,255,.1)',color:'#fff',borderBottom:view===v?'2px solid #fff':'2px solid transparent'}}>{lbl}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={()=>setModal({})} style={{padding:'6px 13px',borderRadius:7,border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:12}}>＋ Nuevo</button>
          <button onClick={exportCSV} style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'#fff',cursor:'pointer',fontSize:12}}>↓ CSV</button>
          <button onClick={()=>exportXLSX(records)} style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>↓ Excel</button>
          <label style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>
            ↑ Excel<input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSXSelect} style={{display:'none'}}/>
          </label>
          <button onClick={()=>signOut(auth)} style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'#fff',cursor:'pointer',fontSize:12}}>
            👤 {user?.email?.split('@')[0]}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{padding:'12px 16px'}}>
        {hasFilter&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 14px',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{background:FTBLUE,color:'#fff',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99}}>FILTRADO</span>
              <span style={{fontSize:12,color:'#1e40af',fontWeight:500}}>Mostrando <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
            </div>
            <button onClick={clearFilters} style={{padding:'4px 12px',borderRadius:6,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>Ver todos</button>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {label:'Total solicitudes',val:base.length,sub:hasFilter?`de ${records.length} totales`:'Todos los registros',c:FTBLUE},
            {label:'Ganados',val:ganados.length,sub:fmtCLP(montoGan),c:'#16a34a'},
            {label:'Pipeline activo',val:pipeline.length,sub:fmtCLP(montoPipe),c:'#ea580c'},
            {label:'Tasa conversión',val:tasaConv+'%',sub:`${perdidos.length} perdidos`,c:'#7c3aed'},
          ].map(k=>(
            <div key={k.label} style={{background:'#fff',borderRadius:10,padding:'12px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',borderLeft:`4px solid ${k.c}`,position:'relative'}}>
              {hasFilter&&<span style={{position:'absolute',top:8,right:8,background:'#eff6ff',color:FTBLUE,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99}}>filtrado</span>}
              <div style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5}}>{k.label}</div>
              <div style={{fontSize:24,fontWeight:800,color:'#111827',marginTop:3}}>{k.val}</div>
              <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      {view!=='stats'&&(
        <div style={{padding:'0 16px 12px',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="🔍 Empresa, nombre, N° cotización..."
            style={{...sel,flex:'1 1 200px',padding:'6px 10px'}}/>
          <select value={fAnio} onChange={e=>{setFAnio(e.target.value);setPage(1);}} style={sel}>
            <option value="">Todos los años</option>
            {allAnios.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <MultiSelect label="Meses" options={allMeses} selected={fMeses} onChange={v=>{setFMeses(v);setPage(1);}}
            orderFn={(a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)}/>
          <MultiSelect label="Estados" options={ESTADOS} selected={fEstados} onChange={v=>{setFEstados(v);setPage(1);}}/>
          <select value={fRubro} onChange={e=>{setFRubro(e.target.value);setPage(1);}} style={sel}>
            <option value="">Todos los rubros</option>
            {allRubros.map(r=><option key={r}>{r}</option>)}
          </select>
          {hasFilter&&<button onClick={clearFilters} style={{padding:'6px 11px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12}}>✕ Limpiar</button>}
        </div>
      )}

      {/* LISTA */}
      {view==='lista'&&(
        <div style={{padding:'0 16px 16px'}}>
          <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>
                  <Th col="fecha" label="Fecha"/><Th col="empresa" label="Empresa"/>
                  <Th col="rubro" label="Rubro"/><Th col="producto" label="Producto"/>
                  <Th col="m2" label="M²"/><Th col="tipo" label="Tipo"/>
                  <Th col="nCot" label="N° Cot"/><Th col="monto" label="Monto"/>
                  <Th col="pCierre" label="% Cierre"/><Th col="estado" label="Estado"/>
                  <th style={{padding:'8px 10px',background:'#f8fafc',borderBottom:'2px solid #e5e7eb'}}></th>
                </tr></thead>
                <tbody>
                  {pageData.map((r,i)=>(
                    <tr key={r.id} onClick={()=>setDetail(r)}
                      style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',background:detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa'}}
                      onMouseEnter={e=>{if(detail?.id!==r.id)e.currentTarget.style.background='#f0f9ff';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa';}}>
                      <td style={{padding:'7px 10px',whiteSpace:'nowrap',color:'#6b7280',fontSize:11}}>{fmtDate(r)}</td>
                      <td style={{padding:'7px 10px',maxWidth:180}}>
                        <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.empresa}</div>
                        <div style={{fontSize:10,color:'#9ca3af'}}>{r.nombre||''}</div>
                      </td>
                      <td style={{padding:'7px 10px',fontSize:11}}>{r.rubro||'—'}</td>
                      <td style={{padding:'7px 10px',fontSize:11}}>{r.producto||'—'}</td>
                      <td style={{padding:'7px 10px',fontSize:11}}>{fmtM2(r.m2)}</td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{fontSize:10,background:r.tipo==='ARRIENDO'?'#fef3c7':'#f0fdf4',color:r.tipo==='ARRIENDO'?'#92400e':'#166534',padding:'2px 6px',borderRadius:4,fontWeight:600}}>{r.tipo||'—'}</span>
                      </td>
                      <td style={{padding:'7px 10px',fontSize:11,color:'#6b7280'}}>{r.nCot||'—'}</td>
                      <td style={{padding:'7px 10px',fontSize:12,fontWeight:r.monto?600:400,color:r.monto?'#111827':'#d1d5db'}}>{fmtCLP(r.monto)}</td>
                      <td style={{padding:'7px 10px',fontSize:11}}>{r.pCierre!=null?r.pCierre+'%':'—'}</td>
                      <td style={{padding:'7px 10px'}}><Badge estado={r.estado}/></td>
                      <td style={{padding:'7px 8px',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setModal(r)} style={{background:'#e0f2fe',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',color:'#0369a1',fontWeight:700,marginRight:3,fontSize:11}}>✏</button>
                        <button onClick={()=>setDelTarget(r)} style={{background:'#fee2e2',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',color:'#dc2626',fontWeight:700,fontSize:11}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {pageData.length===0&&<tr><td colSpan={11} style={{padding:40,textAlign:'center',color:'#9ca3af'}}>Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#6b7280'}}>
            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{padding:'3px 10px',borderRadius:5,border:'1px solid #e5e7eb',background:'#fff',cursor:page===1?'default':'pointer',opacity:page===1?.4:1,fontSize:11}}>‹ Anterior</button>
            <span>Pág {page} de {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{padding:'3px 10px',borderRadius:5,border:'1px solid #e5e7eb',background:'#fff',cursor:page>=totalPages?'default':'pointer',opacity:page>=totalPages?.4:1,fontSize:11}}>Siguiente ›</button>
            <span style={{marginLeft:4}}>{filtered.length} de {records.length} registros</span>
          </div>
        </div>
      )}

      {/* PIPELINE */}
      {view==='pipeline'&&(
        <div style={{padding:'0 16px 16px',overflowX:'auto'}}>
          <div style={{display:'flex',gap:8,minWidth:1100}}>
            {PIPE_STAGES.map(stage=>{
              const items=filtered.filter(r=>r.estado===stage);
              const cfg=ESTADO_CFG[stage]||{c:'#9ca3af',bg:'#f9fafb'};
              const total=items.reduce((a,r)=>a+(r.monto||0),0);
              return(
                <div key={stage} style={{flex:1,minWidth:115}} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,stage)}>
                  <div style={{background:cfg.bg,borderRadius:8,padding:'8px 9px',marginBottom:7,borderTop:`3px solid ${cfg.c}`}}>
                    <div style={{fontWeight:700,fontSize:10,color:cfg.c,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{stage}</div>
                    <div style={{fontSize:10,color:'#6b7280'}}>{items.length} negocios</div>
                    {total>0&&<div style={{fontSize:10,fontWeight:700,color:cfg.c}}>{fmtCLP(total)}</div>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,minHeight:50,padding:2,borderRadius:6,border:dragId?'1.5px dashed #93c5fd':'1.5px dashed transparent',transition:'.15s'}}>
                    {items.map(r=>(
                      <div key={r.id} draggable
                        onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDragId(r.id);}}
                        onDragEnd={()=>setDragId(null)}
                        onClick={()=>setDetail(r)}
                        style={{background:'#fff',borderRadius:7,padding:'8px 9px',cursor:'grab',borderLeft:`3px solid ${cfg.c}`,boxShadow:'0 1px 3px rgba(0,0,0,.08)',opacity:dragId===r.id?.3:1,transition:'.1s'}}>
                        <div style={{fontWeight:600,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.empresa}</div>
                        <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{r.producto||r.rubro||'—'}</div>
                        {r.monto&&<div style={{fontSize:11,fontWeight:700,color:cfg.c,marginTop:3}}>{fmtCLP(r.monto)}</div>}
                        {r.pCierre!=null&&<div style={{fontSize:9,color:'#9ca3af'}}>{r.pCierre}% cierre</div>}
                        {r.comentarioSeg&&<div style={{fontSize:9,color:'#0891b2',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💬 {r.comentarioSeg}</div>}
                        <div style={{display:'flex',gap:3,marginTop:4}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setModal(r)} style={{fontSize:10,background:'#e0f2fe',border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',color:'#0369a1'}}>✏</button>
                          <button onClick={()=>setDelTarget(r)} style={{fontSize:10,background:'#fee2e2',border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',color:'#dc2626'}}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:8}}>💡 Arrastra las tarjetas para cambiar de etapa · Los filtros aplican aquí también</div>
        </div>
      )}

      {/* STATS */}
      {view==='stats'&&(
        <div style={{padding:'0 16px 16px'}}>
          {hasFilter&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 14px',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{background:FTBLUE,color:'#fff',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99}}>FILTRADO</span>
                <span style={{fontSize:12,color:'#1e40af',fontWeight:500}}>Estadísticas basadas en <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
              </div>
              <button onClick={clearFilters} style={{padding:'4px 12px',borderRadius:6,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>Ver todos</button>
            </div>
          )}
          <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:'2px solid #e5e7eb'}}>
            {[['resumen','📊 Resumen'],['distribucion','🏭 Distribución'],['tendencia','📈 Tendencia']].map(([t,lbl])=>(
              <button key={t} onClick={()=>setStatsTab(t)} style={{padding:'7px 16px',border:'none',background:'transparent',cursor:'pointer',fontSize:12,fontWeight:600,color:statsTab===t?FTBLUE:'#6b7280',borderBottom:statsTab===t?`2px solid ${FTBLUE}`:'2px solid transparent',marginBottom:-2}}>{lbl}</button>
            ))}
          </div>

          {statsTab==='resumen'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
                {[
                  {label:'Total solicitudes',val:base.length,sub:hasFilter?`de ${records.length} totales`:'Desde JUN 2025',c:FTBLUE,icon:'📋'},
                  {label:'Negocios ganados',val:ganados.length,sub:fmtCLP(montoGan),c:'#16a34a',icon:'✅'},
                  {label:'Tasa de conversión',val:tasaConv+'%',sub:`${ganados.length} ganados / ${perdidos.length} perdidos`,c:'#7c3aed',icon:'🎯'},
                  {label:'Pipeline activo',val:pipeline.length,sub:fmtCLP(montoPipe),c:'#ea580c',icon:'🔥'},
                  {label:'Forecast ponderado',val:fmtCLP(Math.round(totalForecast)),sub:'Monto × % cierre',c:'#0891b2',icon:'💰'},
                  {label:'Negocios perdidos',val:perdidos.length,sub:fmtCLP(perdidos.reduce((a,r)=>a+(r.monto||0),0)),c:'#dc2626',icon:'❌'},
                ].map(k=>(
                  <div key={k.label} style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',borderLeft:`4px solid ${k.c}`,display:'flex',alignItems:'flex-start',gap:12}}>
                    <div style={{fontSize:28,lineHeight:1}}>{k.icon}</div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4}}>{k.label}</div>
                      <div style={{fontSize:22,fontWeight:800,color:'#111827',marginTop:3}}>{k.val}</div>
                      <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{k.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Embudo de conversión</div>
                <div style={{display:'flex',gap:3,height:32,borderRadius:8,overflow:'hidden'}}>
                  {PIPE_STAGES.map(stage=>{
                    const n=base.filter(r=>r.estado===stage).length;
                    const pct=base.length>0?n/base.length*100:0;
                    const cfg=ESTADO_CFG[stage]||{c:'#9ca3af'};
                    return pct>0?(
                      <div key={stage} title={`${stage}: ${n}`}
                        style={{width:pct+'%',background:cfg.c,display:'flex',alignItems:'center',justifyContent:'center',minWidth:24}}>
                        {pct>5&&<span style={{fontSize:9,color:'#fff',fontWeight:700}}>{n}</span>}
                      </div>
                    ):null;
                  })}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
                  {PIPE_STAGES.map(stage=>{
                    const n=base.filter(r=>r.estado===stage).length;
                    const cfg=ESTADO_CFG[stage]||{c:'#9ca3af'};
                    return(
                      <span key={stage} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#374151'}}>
                        <span style={{width:10,height:10,borderRadius:2,background:cfg.c,flexShrink:0}}/>
                        {stage} <span style={{color:'#9ca3af'}}>({n})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {statsTab==='distribucion'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Por estado</div>
                {byEstado.map(d=>(
                  <div key={d.label} onClick={()=>{setFEstados([d.label]);setView('lista');}}
                    style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer',padding:'4px 6px',borderRadius:5}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{width:10,height:10,borderRadius:2,background:d.color,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:11,color:'#374151'}}>{d.label}</span>
                    <div style={{flex:1,background:'#f3f4f6',borderRadius:99,height:6}}>
                      <div style={{width:Math.round(d.value/base.length*100)+'%',height:6,borderRadius:99,background:d.color}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,color:d.color,minWidth:20,textAlign:'right'}}>{d.value}</span>
                    <span style={{fontSize:10,color:'#9ca3af'}}>{Math.round(d.value/base.length*100)}%</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Top rubros</div>
                {byRubroArr.map(([rubro,d],i)=>(
                  <div key={rubro} onClick={()=>{setFRubro(rubro);setView('lista');}}
                    style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer',padding:'4px 6px',borderRadius:5}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{width:10,height:10,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:500}}>{rubro}</span>
                    <div style={{width:60,background:'#f3f4f6',borderRadius:99,height:6}}>
                      <div style={{width:Math.round(d.count/maxRubro*100)+'%',height:6,borderRadius:99,background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,minWidth:20,textAlign:'right'}}>{d.count}</span>
                    {d.monto>0&&<span style={{fontSize:10,color:'#16a34a',minWidth:80,textAlign:'right'}}>{fmtCLP(d.monto)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsTab==='tendencia'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>Solicitudes por mes — JUN 2025 → JUN 2026</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:4,height:120}}>
                  {mesData.map((d,i)=>{
                    const maxV=Math.max(...mesData.map(x=>x.total),1);
                    return(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                        <div style={{fontSize:8,color:'#6b7280'}}>{d.total||''}</div>
                        <div style={{width:'100%',background:FTBLUE,borderRadius:'3px 3px 0 0',height:Math.max((d.total/maxV)*90,d.total?3:0)+'px'}}/>
                        <div style={{width:'100%',background:'#16a34a',borderRadius:'3px 3px 0 0',height:Math.max((d.ganados/maxV)*90,d.ganados?2:0)+'px'}}/>
                        <div style={{fontSize:8,color:'#6b7280',textAlign:'center'}}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'flex',gap:12,marginTop:8,fontSize:10}}>
                  <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:4,background:FTBLUE,borderRadius:1,display:'inline-block'}}/>Solicitudes</span>
                  <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:4,background:'#16a34a',borderRadius:1,display:'inline-block'}}/>Ganados</span>
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Forecast ponderado por etapa</div>
                <div style={{fontSize:11,color:'#9ca3af',marginBottom:12}}>Solo aparecen etapas con monto y % cierre completados</div>
                {forecast.length===0?(
                  <div style={{color:'#9ca3af',fontSize:12,padding:'20px 0',textAlign:'center'}}>
                    Sin datos — completa monto y % cierre en los registros para ver el forecast
                  </div>
                ):forecast.map(f=>(
                  <div key={f.stage} style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:11,color:'#374151',display:'flex',alignItems:'center',gap:4}}>
                        <span style={{width:8,height:8,borderRadius:2,background:f.cfg.c,flexShrink:0}}/>
                        {f.stage} <span style={{fontSize:10,color:'#9ca3af'}}>({f.count})</span>
                      </span>
                      <span style={{fontSize:11,fontWeight:700,color:'#16a34a'}}>{fmtCLP(Math.round(f.pond))}</span>
                    </div>
                    <div style={{background:'#f3f4f6',borderRadius:99,height:8,overflow:'hidden'}}>
                      <div style={{width:Math.min(Math.round(f.pond/maxForecast*100),100)+'%',height:8,borderRadius:99,background:f.cfg.c,transition:'.3s'}}/>
                    </div>
                  </div>
                ))}
                {forecast.length>0&&(
                  <div style={{borderTop:'2px solid #f3f4f6',paddingTop:10,marginTop:8,display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,fontWeight:700}}>Total forecast</span>
                    <span style={{fontSize:14,fontWeight:800,color:'#16a34a'}}>{fmtCLP(Math.round(totalForecast))}</span>
                  </div>
                )}
              </div>
              <div style={{background:'#fff',borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',gridColumn:'1 / -1'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Detalle mensual</div>
                <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:'2px solid #e5e7eb'}}>
                    {['Mes','Solicitudes','Ganados','% Conv.','Monto ganado'].map(h=>(
                      <th key={h} style={{padding:'4px 8px',textAlign:h==='Mes'?'left':'right',fontWeight:600,color:'#6b7280',fontSize:10}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {mesData.filter(d=>d.total>0).map((d,i)=>{
                      const mk=MESES_KEYS[MESES_LABELS.indexOf(d.label)];
                      const items=mk?base.filter(r=>r.mes===mk.mes&&r.anio===mk.anio):[];
                      const montoMes=items.filter(r=>r.estado==='GANADO').reduce((a,r)=>a+(r.monto||0),0);
                      return(
                        <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                          <td style={{padding:'5px 8px',fontWeight:500}}>{d.label}</td>
                          <td style={{padding:'5px 8px',textAlign:'right'}}>{d.total}</td>
                          <td style={{padding:'5px 8px',textAlign:'right',color:'#16a34a',fontWeight:600}}>{d.ganados}</td>
                          <td style={{padding:'5px 8px',textAlign:'right',color:'#7c3aed',fontWeight:600}}>{d.total>0?Math.round(d.ganados/d.total*100)+'%':'—'}</td>
                          <td style={{padding:'5px 8px',textAlign:'right',color:'#16a34a',fontWeight:600}}>{montoMes>0?fmtCLP(montoMes):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL PANEL */}
      {detail&&(
        <div style={{position:'fixed',right:0,top:0,bottom:0,width:355,background:'#fff',boxShadow:'-4px 0 24px rgba(0,0,0,.14)',zIndex:100,overflowY:'auto',display:'flex',flexDirection:'column'}}>
          <div style={{background:FTBLUE,color:'#fff',padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail.empresa}</div>
              <div style={{fontSize:11,color:'#93c5fd',marginTop:2}}>{detail.nombre||''}</div>
            </div>
            <button onClick={()=>setDetail(null)} style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',borderRadius:6,padding:'4px 9px',cursor:'pointer',marginLeft:8}}>✕</button>
          </div>
          <div style={{padding:16,flex:1}}>
            <div style={{marginBottom:12}}><Badge estado={detail.estado}/></div>
            {[
              ['Rubro',detail.rubro],['Producto',detail.producto],['Medidas',detail.medidas],
              ['M²',fmtM2(detail.m2)],['Tipo',detail.tipo],
              ['N° Cotización',detail.nCot||'—'],
              ['% Cierre',detail.pCierre!=null?detail.pCierre+'%':'—'],
              ['Monto',fmtCLP(detail.monto)],
              ['Fecha',fmtDate(detail)+(detail.anio?` (${detail.anio})`:'')],
              ['Canal',detail.contacto],['Teléfono',detail.telefono||'—'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',borderBottom:'1px solid #f3f4f6',padding:'6px 0'}}>
                <div style={{width:120,fontSize:11,color:'#9ca3af',fontWeight:600,flexShrink:0}}>{k}</div>
                <div style={{fontSize:12,fontWeight:500,flex:1}}>{v||'—'}</div>
              </div>
            ))}
            {detail.mail&&(
              <a href={`mailto:${detail.mail}`} style={{display:'block',margin:'12px 0 4px',textAlign:'center',background:FTBLUE,color:'#fff',padding:'9px',borderRadius:8,textDecoration:'none',fontWeight:700,fontSize:12}}>
                ✉ {detail.mail}
              </a>
            )}
            {detail.comentarioSeg&&(
              <div style={{marginTop:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,fontWeight:700,color:'#1e40af',marginBottom:3}}>💬 Comentarios seguimiento</div>
                <div style={{fontSize:12,color:'#1e3a5f'}}>{detail.comentarioSeg}</div>
              </div>
            )}
            {detail.observacion&&(
              <div style={{marginTop:8,background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,fontWeight:700,color:'#92400e',marginBottom:3}}>📝 Observación</div>
                <div style={{fontSize:12,color:'#78350f'}}>{detail.observacion}</div>
              </div>
            )}
          </div>
          <div style={{padding:'12px 16px',borderTop:'1px solid #f3f4f6',display:'flex',gap:8,flexShrink:0}}>
            <button onClick={()=>setModal(detail)} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:FTBLUE,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:12}}>✏ Editar</button>
            <button onClick={()=>setDelTarget(detail)} style={{padding:'8px 14px',borderRadius:8,border:'none',background:'#fee2e2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12}}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
