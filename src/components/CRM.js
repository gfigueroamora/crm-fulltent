// CRM Cobertores v3
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import SEED_DATA from '../seedData';
import { ESTADOS, PIPE_STAGES, MESES_ORDER, RUBRO_LIST, ESTADO_CFG, PIE_COLORS, FTBLUE, getMesesRange } from '../constants';
import { fmtCLP, fmtM2, fmtDate, parseExcelFile, exportXLSX } from '../utils';
import Modal from './Modal';

const COLLECTION = 'solicitudes';
const INTER = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

// ── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_PAL=['#1a3a6b','#0891b2','#7c3aed','#16a34a','#ea580c','#d97706','#dc2626','#9333ea','#0284c7','#059669','#c2410c','#4f46e5'];
function avatarColor(s=''){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return AVATAR_PAL[Math.abs(h)%AVATAR_PAL.length];}
function getInitials(n=''){const w=n.trim().split(/\s+/).filter(Boolean);if(!w.length)return'??';if(w.length===1)return w[0].slice(0,2).toUpperCase();return(w[0][0]+w[1][0]).toUpperCase();}
function Avatar({name,size=38}){const r=Math.round(size*.26);return<div style={{width:size,height:size,borderRadius:r,background:avatarColor(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*.35),fontWeight:700,flexShrink:0,letterSpacing:-.5,userSelect:'none',fontFamily:INTER}}>{getInitials(name)}</div>;}

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({estado}){
  const cfg=ESTADO_CFG[estado]||{c:'#94a3b8',bg:'#f8fafc'};
  return<span style={{background:cfg.bg,color:cfg.c,padding:'3px 10px',borderRadius:999,fontSize:10,fontWeight:600,whiteSpace:'nowrap',letterSpacing:.2}}>{estado}</span>;
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({msg,type}){
  const cols={ok:'#16a34a',warn:'#d97706',err:'#dc2626'};
  return msg?<div style={{position:'fixed',top:16,right:16,zIndex:500,background:cols[type]||'#16a34a',color:'#fff',padding:'10px 18px',borderRadius:10,fontSize:12,fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,.15)',fontFamily:INTER}}>{msg}</div>:null;
}

// ── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({onReplace,onAdd,onCancel}){
  const card={border:'1.5px solid #e2e8f0',borderRadius:10,padding:'14px 16px',marginBottom:10,cursor:'pointer',background:'#fff',transition:'.15s'};
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
      <div style={{background:'#fff',borderRadius:14,width:420,boxShadow:'0 24px 64px rgba(0,0,0,.2)',overflow:'hidden',fontFamily:INTER}}>
        <div style={{background:FTBLUE,padding:'16px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#fff'}}>📥 Importar Excel</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:3}}>¿Cómo quieres importar este archivo?</div>
        </div>
        <div style={{padding:20}}>
          <div onClick={onReplace} style={{...card,borderColor:'#fecaca'}} onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{fontWeight:700,fontSize:13,color:'#dc2626',marginBottom:3}}>🔄 Reemplazar todo</div>
            <div style={{fontSize:12,color:'#64748b'}}>Borra todos los registros actuales y carga el Excel completo.</div>
          </div>
          <div onClick={onAdd} style={{...card,borderColor:'#bbf7d0'}} onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{fontWeight:700,fontSize:13,color:'#16a34a',marginBottom:3}}>➕ Solo agregar nuevos</div>
            <div style={{fontSize:12,color:'#64748b'}}>Compara por fecha + empresa y agrega solo los nuevos.</div>
          </div>
          <button onClick={onCancel} style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8f9fa',color:'#64748b',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:INTER}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── MultiSelect ──────────────────────────────────────────────────────────────
function MultiSelect({label,options,selected,onChange,orderFn}){
  const[open,setOpen]=useState(false);const ref=useRef();
  const ordered=orderFn?[...options].sort(orderFn):options;
  const count=selected.length;
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const toggle=val=>onChange(selected.includes(val)?selected.filter(v=>v!==val):[...selected,val]);
  return(
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{padding:'6px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,background:'#fff',color:'#334155',cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',fontFamily:INTER,fontWeight:500,boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
        {label}{count>0&&<span style={{background:FTBLUE,color:'#fff',borderRadius:99,fontSize:10,fontWeight:700,padding:'1px 7px'}}>{count}</span>}
        <span style={{fontSize:9,color:'#94a3b8'}}>{open?'▲':'▼'}</span>
      </button>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:100,background:'#fff',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,.12)',border:'1px solid #e2e8f0',minWidth:210,padding:'6px 0',maxHeight:280,overflowY:'auto',fontFamily:INTER}}>
          {count>0&&<div onClick={()=>onChange([])} style={{padding:'5px 14px 8px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,borderBottom:'1px solid #f1f5f9'}}>✕ Limpiar selección</div>}
          {ordered.map(opt=>(
            <label key={opt} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 14px',cursor:'pointer',fontSize:12,color:'#334155'}} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={()=>toggle(opt)} style={{width:13,height:13,accentColor:FTBLUE,cursor:'pointer'}}/>
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main CRM Cobertores ──────────────────────────────────────────────────────
export default function CRM({user}){
  const[records,setRecords]=useState([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState('');
  const[fMeses,setFMeses]=useState([]);
  const[fAnio,setFAnio]=useState('');
  const[fEstados,setFEstados]=useState([]);
  const[fRubro,setFRubro]=useState('');
  const[sortCol,setSortCol]=useState('fecha');
  const[sortDir,setSortDir]=useState(-1);
  const[page,setPage]=useState(1);
  const PAGE=50;
  const[view,setView]=useState('lista');
  const[statsTab,setStatsTab]=useState('resumen');
  const[modal,setModal]=useState(null);
  const[detail,setDetail]=useState(null);
  const[delTarget,setDelTarget]=useState(null);
  const[toast,setToast]=useState(null);
  const[dragId,setDragId]=useState(null);
  const[dragOver,setDragOver]=useState(null);
  const[importFile,setImportFile]=useState(null);
  const xlsxRef=useRef();

  const showToast=(msg,type='ok')=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);};

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const snap=await getDocs(collection(db,COLLECTION));
        if(snap.empty){
          setSaving(true);
          const batch=writeBatch(db);
          SEED_DATA.forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
          const snap2=await getDocs(collection(db,COLLECTION));
          setRecords(snap2.docs.map(d=>({...d.data(),_fireId:d.id})));
          setSaving(false);
        }else{
          setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        }
      }catch(e){showToast('Error al cargar datos','err');}
      finally{setLoading(false);}
    })();
  },[]);

  const saveRecord=useCallback(async rec=>{
    setSaving(true);
    try{
      const existing=records.find(r=>r.id===rec.id);
      if(existing){
        await updateDoc(doc(db,COLLECTION,existing._fireId),rec);
        setRecords(prev=>prev.map(r=>r.id===rec.id?{...rec,_fireId:existing._fireId}:r));
        showToast('Registro actualizado ✓');
      }else{
        const ref=await addDoc(collection(db,COLLECTION),rec);
        setRecords(prev=>[{...rec,_fireId:ref.id},...prev]);
        showToast('Prospecto creado ✓');
      }
    }catch(e){showToast('Error al guardar','err');}
    finally{setSaving(false);setModal(null);}
  },[records]);

  const deleteRecord=useCallback(async id=>{
    const rec=records.find(r=>r.id===id);if(!rec)return;
    setSaving(true);
    try{
      await deleteDoc(doc(db,COLLECTION,rec._fireId));
      setRecords(prev=>prev.filter(r=>r.id!==id));
      if(detail?.id===id)setDetail(null);
      showToast('Eliminado','warn');
    }catch(e){showToast('Error','err');}
    finally{setSaving(false);setDelTarget(null);}
  },[records,detail]);

  const updateEstado=useCallback(async(id,newEstado)=>{
    const rec=records.find(r=>r.id===id);
    if(!rec||rec.estado===newEstado)return;
    try{
      await updateDoc(doc(db,COLLECTION,rec._fireId),{estado:newEstado});
      setRecords(prev=>prev.map(r=>r.id===id?{...r,estado:newEstado}:r));
      showToast('→ '+newEstado);
    }catch(e){showToast('Error','err');}
  },[records]);

  const handleXLSXSelect=e=>{const file=e.target.files[0];if(!file)return;setImportFile(file);e.target.value='';};
  const doImportReplace=()=>{
    if(!importFile)return;
    parseExcelFile(importFile,async data=>{
      setSaving(true);setImportFile(null);
      try{
        const snapAll=await getDocs(collection(db,COLLECTION));
        const delBatch=writeBatch(db);snapAll.docs.forEach(d=>delBatch.delete(d.ref));await delBatch.commit();
        for(let i=0;i<data.length;i+=400){
          const batch=writeBatch(db);
          data.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`Base reemplazada ✓`);
      }catch(err){showToast('Error al importar','err');}
      finally{setSaving(false);}
    },()=>{showToast('Error al leer Excel','err');setImportFile(null);});
  };
  const doImportAddNew=()=>{
    if(!importFile)return;
    parseExcelFile(importFile,async data=>{
      setSaving(true);setImportFile(null);
      try{
        const keys=new Set(records.map(r=>`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        const nuevos=data.filter(r=>!keys.has(`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        if(!nuevos.length){showToast('Sin registros nuevos','warn');setSaving(false);return;}
        for(let i=0;i<nuevos.length;i+=400){
          const batch=writeBatch(db);
          nuevos.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`${nuevos.length} nuevos agregados ✓`);
      }catch(err){showToast('Error','err');}
      finally{setSaving(false);}
    },()=>{showToast('Error al leer Excel','err');setImportFile(null);});
  };

  const allMeses=useMemo(()=>[...new Set(records.map(r=>r.mes).filter(Boolean))].sort((a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)),[records]);
  const allAnios=useMemo(()=>[...new Set(records.map(r=>r.anio).filter(Boolean))].sort(),[records]);
  const allRubros=useMemo(()=>[...new Set(records.map(r=>r.rubro).filter(Boolean))].sort(),[records]);
  const rubroList=useMemo(()=>{const ex=allRubros.filter(r=>!RUBRO_LIST.includes(r));return[...RUBRO_LIST,...ex];},[allRubros]);

  const filtered=useMemo(()=>{
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

  const hasFilter=!!(search||fMeses.length>0||fAnio||fEstados.length>0||fRubro);
  const base=hasFilter?filtered:records;
  const ganados=useMemo(()=>base.filter(r=>r.estado==='GANADO'||r.estado==='Ganado'),[base]);
  const perdidos=useMemo(()=>base.filter(r=>r.estado==='PERDIDO'||r.estado==='Perdido'),[base]);
  const pipeline=useMemo(()=>base.filter(r=>!['GANADO','Ganado','PERDIDO','Perdido','Sin estado','No se Cotiza'].includes(r.estado)),[base]);
  const montoGan=ganados.reduce((a,r)=>a+(r.monto||0),0);
  const montoPipe=pipeline.reduce((a,r)=>a+(r.monto||0),0);
  const tasaConv=ganados.length+perdidos.length>0?Math.round(ganados.length/(ganados.length+perdidos.length)*100):0;

  const doSort=col=>{if(sortCol===col)setSortDir(d=>d*-1);else{setSortCol(col);setSortDir(-1);}setPage(1);};
  const clearFilters=()=>{setSearch('');setFMeses([]);setFAnio('');setFEstados([]);setFRubro('');setPage(1);};
  const pageData=filtered.slice((page-1)*PAGE,page*PAGE);
  const totalPages=Math.ceil(filtered.length/PAGE)||1;

  // Stats
  const byEstado=ESTADOS.map(e=>({label:e,value:base.filter(r=>r.estado===e).length,color:(ESTADO_CFG[e]||{c:'#94a3b8'}).c})).filter(d=>d.value>0);
  const byRubroArr=Object.entries(base.reduce((acc,r)=>{if(r.rubro){acc[r.rubro]=acc[r.rubro]||{count:0,monto:0};acc[r.rubro].count++;acc[r.rubro].monto+=r.monto||0;}return acc;},{})).sort((a,b)=>b[1].count-a[1].count).slice(0,10);
  const maxRubro=byRubroArr[0]?.[1].count||1;
  const {keys:MESES_KEYS,labels:MESES_LABELS}=useMemo(()=>getMesesRange(base),[base]);
  const mesData=MESES_KEYS.map((mk,i)=>{const items=base.filter(r=>String(r.mes||'').toUpperCase()===mk.mes&&r.anio===mk.anio);return{label:MESES_LABELS[i],total:items.length,ganados:items.filter(r=>r.estado==='GANADO'||r.estado==='Ganado').length};});
  const forecast=PIPE_STAGES.filter(s=>!['Ganado','Perdido'].includes(s)).map(s=>{const items=base.filter(r=>r.estado===s&&r.monto&&r.pCierre!=null);return{stage:s,count:items.length,pond:items.reduce((a,r)=>a+r.monto*(r.pCierre/100),0),cfg:ESTADO_CFG[s]||{c:'#94a3b8',bg:'#f9fafb'}};}).filter(f=>f.pond>0);
  const totalForecast=forecast.reduce((a,f)=>a+f.pond,0);
  const maxForecast=forecast[0]?.pond||1;

  const ss={fontFamily:INTER,background:'#f8f9fa',minHeight:'100vh',fontSize:13,color:'#0f172a'};
  const selStyle={padding:'6px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,background:'#fff',color:'#334155',fontFamily:INTER,fontWeight:500,boxShadow:'0 1px 2px rgba(0,0,0,.04)',outline:'none'};
  const Th=({col,label})=><th onClick={()=>doSort(col)} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#64748b',fontSize:11,background:'#f8f9fa',borderBottom:'2px solid #e2e8f0',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none',letterSpacing:.3,textTransform:'uppercase'}}>{label}{sortCol===col?(sortDir>0?' ↑':' ↓'):''}</th>;

  if(loading)return<div style={{...ss,display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{textAlign:'center',color:'#64748b'}}><div style={{fontSize:40,marginBottom:12}}>🏭</div><div style={{fontWeight:600,fontSize:15}}>Cargando CRM Cobertores...</div></div></div>;

  return(
    <div style={ss}>
      {toast&&<Toast {...toast}/>}
      {importFile&&<ImportModal onReplace={doImportReplace} onAdd={doImportAddNew} onCancel={()=>setImportFile(null)}/>}
      {modal!==null&&<Modal rec={modal} onSave={saveRecord} onClose={()=>setModal(null)} rubroList={rubroList}/>}

      {delTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,width:340,textAlign:'center',boxShadow:'0 24px 64px rgba(0,0,0,.2)',fontFamily:INTER}}>
            <div style={{fontSize:36,marginBottom:10}}>🗑️</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>¿Eliminar registro?</div>
            <div style={{color:'#64748b',fontSize:13,marginBottom:20}}>Se eliminará <b style={{color:'#0f172a'}}>{delTarget.empresa}</b>.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>setDelTarget(null)} style={{padding:'9px 20px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13,fontFamily:INTER}}>Cancelar</button>
              <button onClick={()=>deleteRecord(delTarget.id)} style={{padding:'9px 20px',borderRadius:9,border:'none',background:'#dc2626',color:'#fff',cursor:'pointer',fontWeight:700,fontFamily:INTER}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      {/* Sub-header navegación */}
      <div style={{background:'#0f2744',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:4}}>
          {[['lista','📋 Lista'],['pipeline','📊 Pipeline'],['stats','📈 Estadísticas']].map(([v,lbl])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:INTER,background:view===v?'rgba(255,255,255,.18)':'transparent',color:view===v?'#fff':'rgba(255,255,255,.5)',borderBottom:view===v?'2px solid #3b82f6':'2px solid transparent',transition:'.15s'}}>{lbl}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {saving&&<span style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>Guardando...</span>}
          <button onClick={()=>setModal({})} style={{padding:'6px 14px',borderRadius:8,border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:INTER}}>＋ Nuevo</button>
          <button onClick={()=>exportXLSX(records)} style={{padding:'6px 11px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'#fff',cursor:'pointer',fontSize:12,fontFamily:INTER}}>↓ Excel</button>
          <label style={{padding:'6px 11px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'#fff',cursor:'pointer',fontSize:12,fontFamily:INTER,fontWeight:600}}>↑ Excel<input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSXSelect} style={{display:'none'}}/></label>
        </div>
      </div>
      <div style={{padding:'16px 20px'}}>
        {hasFilter&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'9px 16px',marginBottom:12,fontFamily:INTER}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{background:FTBLUE,color:'#fff',fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:99,letterSpacing:.3}}>FILTRADO</span>
              <span style={{fontSize:12,color:'#1e40af',fontWeight:500}}>Mostrando <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
            </div>
            <button onClick={clearFilters} style={{padding:'4px 12px',borderRadius:7,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:INTER}}>Ver todos</button>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {label:'Total solicitudes',val:base.length,sub:hasFilter?`de ${records.length} total`:'Todos los registros',c:FTBLUE},
            {label:'Ganados',val:ganados.length,sub:fmtCLP(montoGan),c:'#16a34a'},
            {label:'Pipeline activo',val:pipeline.length,sub:fmtCLP(montoPipe),c:'#ea580c'},
            {label:'Tasa conversión',val:tasaConv+'%',sub:`${perdidos.length} perdidos`,c:'#7c3aed'},
          ].map(k=>(
            <div key={k.label} style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',borderLeft:`3px solid ${k.c}`,position:'relative',fontFamily:INTER}}>
              {hasFilter&&<span style={{position:'absolute',top:8,right:8,background:'#eff6ff',color:FTBLUE,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99}}>filtrado</span>}
              <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.6,marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:'#0f172a',letterSpacing:-.5}}>{k.val}</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      {view!=='stats'&&(
        <div style={{padding:'0 20px 14px',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',flex:'1 1 200px'}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#94a3b8'}}>🔍</span>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Empresa, nombre, N° cotización..."
              style={{...selStyle,width:'100%',paddingLeft:32,boxSizing:'border-box'}}/>
          </div>
          <select value={fAnio} onChange={e=>{setFAnio(e.target.value);setPage(1);}} style={selStyle}>
            <option value="">Todos los años</option>
            {allAnios.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <MultiSelect label="Meses" options={allMeses} selected={fMeses} onChange={v=>{setFMeses(v);setPage(1);}} orderFn={(a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)}/>
          <MultiSelect label="Estados" options={ESTADOS} selected={fEstados} onChange={v=>{setFEstados(v);setPage(1);}}/>
          <select value={fRubro} onChange={e=>{setFRubro(e.target.value);setPage(1);}} style={selStyle}>
            <option value="">Todos los rubros</option>
            {allRubros.map(r=><option key={r}>{r}</option>)}
          </select>
          {hasFilter&&<button onClick={clearFilters} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'#fee2e2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:INTER}}>✕ Limpiar</button>}
        </div>
      )}

      {/* LISTA */}
      {view==='lista'&&(
        <div style={{padding:'0 20px 20px'}}>
          <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.07)',border:'1px solid #e2e8f0'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:INTER}}>
                <thead><tr>
                  <Th col="fecha" label="Fecha"/>
                  <Th col="empresa" label="Empresa"/>
                  <Th col="rubro" label="Rubro"/>
                  <Th col="producto" label="Producto"/>
                  <Th col="m2" label="M²"/>
                  <Th col="tipo" label="Tipo"/>
                  <Th col="nCot" label="N° Cot"/>
                  <Th col="monto" label="Monto"/>
                  <Th col="pCierre" label="% Cierre"/>
                  <Th col="estado" label="Estado"/>
                  <th style={{padding:'10px 12px',background:'#f8f9fa',borderBottom:'2px solid #e2e8f0'}}></th>
                </tr></thead>
                <tbody>
                  {pageData.map((r,i)=>(
                    <tr key={r.id} onClick={()=>setDetail(r)}
                      style={{borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa',transition:'.1s'}}
                      onMouseEnter={e=>{if(detail?.id!==r.id)e.currentTarget.style.background='#f8faff';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa';}}>
                      <td style={{padding:'10px 12px',whiteSpace:'nowrap',color:'#64748b',fontSize:11}}>{fmtDate(r)}</td>
                      <td style={{padding:'10px 12px',maxWidth:190}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <Avatar name={r.empresa} size={30}/>
                          <div>
                            <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:140,color:'#0f172a'}}>{r.empresa}</div>
                            <div style={{fontSize:10,color:'#94a3b8'}}>{r.nombre||''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#334155'}}>{r.rubro||'—'}</td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#334155'}}>{r.producto||'—'}</td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#334155'}}>{fmtM2(r.m2)}</td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:6,background:r.tipo==='ARRIENDO'?'#fef3c7':'#f0fdf4',color:r.tipo==='ARRIENDO'?'#92400e':'#166534'}}>{r.tipo||'—'}</span>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#64748b'}}>{r.nCot||'—'}</td>
                      <td style={{padding:'10px 12px',fontSize:12,fontWeight:r.monto?700:400,color:r.monto?'#0f172a':'#cbd5e1'}}>{fmtCLP(r.monto)}</td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#64748b'}}>{r.pCierre!=null?r.pCierre+'%':'—'}</td>
                      <td style={{padding:'10px 12px'}}><Badge estado={r.estado}/></td>
                      <td style={{padding:'10px 8px',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setModal(r)} style={{background:'#eff6ff',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#1d4ed8',fontWeight:700,marginRight:4,fontSize:11}}>✏</button>
                        <button onClick={()=>setDelTarget(r)} style={{background:'#fff1f2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#dc2626',fontWeight:700,fontSize:11}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {pageData.length===0&&<tr><td colSpan={11} style={{padding:48,textAlign:'center',color:'#94a3b8',fontFamily:INTER}}><div style={{fontSize:32,marginBottom:8}}>🔍</div>Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#64748b',fontFamily:INTER}}>
            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{padding:'4px 12px',borderRadius:7,border:'1.5px solid #e2e8f0',background:'#fff',cursor:page===1?'default':'pointer',opacity:page===1?.4:1,fontSize:11,fontFamily:INTER}}>‹ Anterior</button>
            <span>Pág {page} de {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{padding:'4px 12px',borderRadius:7,border:'1.5px solid #e2e8f0',background:'#fff',cursor:page>=totalPages?'default':'pointer',opacity:page>=totalPages?.4:1,fontSize:11,fontFamily:INTER}}>Siguiente ›</button>
            <span style={{marginLeft:6}}>{filtered.length} de {records.length} registros</span>
          </div>
        </div>
      )}

      {/* PIPELINE — Rediseñado */}
      {view==='pipeline'&&(
        <div style={{padding:'0 20px 20px',overflowX:'auto'}}>
          <div style={{display:'flex',gap:10,minWidth:1050}}>
            {PIPE_STAGES.map(stage=>{
              const items=filtered.filter(r=>r.estado===stage);
              const cfg=ESTADO_CFG[stage]||{c:'#94a3b8',bg:'#f8fafc'};
              const total=items.reduce((a,r)=>a+(r.monto||0),0);
              const isOver=dragOver===stage;
              return(
                <div key={stage} style={{flex:1,minWidth:115,display:'flex',flexDirection:'column'}}
                  onDragOver={e=>{e.preventDefault();setDragOver(stage);}}
                  onDragLeave={()=>setDragOver(null)}
                  onDrop={e=>{e.preventDefault();setDragOver(null);if(dragId)updateEstado(dragId,stage);setDragId(null);}}>
                  <div style={{borderRadius:'10px 10px 0 0',padding:'10px 12px',background:cfg.bg,borderTop:`3px solid ${cfg.c}`,borderLeft:`1px solid ${cfg.c}20`,borderRight:`1px solid ${cfg.c}20`}}>
                    <div style={{fontWeight:700,fontSize:10,color:cfg.c,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:.3,textTransform:'uppercase'}}>{stage}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                      <span style={{fontSize:11,color:'#64748b',fontWeight:500}}>{items.length} neg.</span>
                      {total>0&&<span style={{fontSize:10,fontWeight:700,color:cfg.c}}>{fmtCLP(total)}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,padding:'6px 4px',minHeight:100,background:isOver?`${cfg.c}08`:'transparent',borderRadius:'0 0 10px 10px',border:`1px solid ${isOver?cfg.c:'#e2e8f0'}`,borderTop:'none',transition:'.15s'}}>
                    {items.map(r=>{
                      const pct=r.pCierre||0;
                      return(
                        <div key={r.id} draggable
                          onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDragId(r.id);}}
                          onDragEnd={()=>{setDragId(null);setDragOver(null);}}
                          onClick={()=>setDetail(r)}
                          style={{background:'#fff',borderRadius:10,padding:'10px 12px',cursor:'grab',boxShadow:dragId===r.id?'none':'0 1px 4px rgba(0,0,0,.07)',opacity:dragId===r.id?.3:1,transition:'opacity .1s',border:'1px solid #f1f5f9',fontFamily:INTER}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:7}}>
                            <Avatar name={r.empresa} size={32}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#0f172a'}}>{r.empresa}</div>
                              <div style={{fontSize:10,color:'#94a3b8',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.producto||r.rubro||'—'}</div>
                            </div>
                          </div>
                          {r.m2&&<div style={{fontSize:10,color:'#64748b',marginBottom:5}}>📐 {fmtM2(r.m2)}</div>}
                          {r.monto&&(
                            <div style={{background:`${cfg.c}10`,borderRadius:7,padding:'5px 8px',marginBottom:5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontSize:10,color:'#64748b',fontWeight:500}}>Monto</span>
                              <span style={{fontSize:12,fontWeight:800,color:cfg.c}}>{fmtCLP(r.monto)}</span>
                            </div>
                          )}
                          {r.pCierre!=null&&(
                            <div style={{marginBottom:5}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                                <span style={{fontSize:9,color:'#94a3b8'}}>% Cierre</span>
                                <span style={{fontSize:9,fontWeight:700,color:'#64748b'}}>{pct}%</span>
                              </div>
                              <div style={{width:'100%',height:4,borderRadius:99,background:'#e2e8f0',overflow:'hidden'}}>
                                <div style={{width:`${Math.min(pct,100)}%`,height:4,borderRadius:99,background:pct>=70?'#16a34a':pct>=40?'#d97706':'#3b82f6',transition:'.3s'}}/>
                              </div>
                            </div>
                          )}
                          {r.observacion&&<div style={{fontSize:9,color:'#0891b2',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:5}}>💬 {r.observacion}</div>}
                          <div style={{display:'flex',gap:4,marginTop:4}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>setModal(r)} style={{flex:1,fontSize:10,background:'#eff6ff',border:'none',borderRadius:6,padding:'4px',cursor:'pointer',color:'#1d4ed8',fontWeight:600,fontFamily:INTER}}>✏ Editar</button>
                            <button onClick={()=>setDelTarget(r)} style={{fontSize:10,background:'#fff1f2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#dc2626',fontWeight:600}}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                    {isOver&&dragId&&<div style={{border:`2px dashed ${cfg.c}`,borderRadius:10,padding:'12px',textAlign:'center',fontSize:11,color:cfg.c,fontWeight:600,background:`${cfg.c}05`}}>Soltar aquí</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:10,fontFamily:INTER}}>💡 Arrastra las tarjetas para cambiar de etapa</div>
        </div>
      )}

      {/* STATS */}
      {view==='stats'&&(
        <div style={{padding:'0 20px 20px',fontFamily:INTER}}>
          {hasFilter&&(
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'9px 16px',marginBottom:14}}>
              <span style={{fontSize:12,color:'#1e40af',fontWeight:500}}>📊 Estadísticas de <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
              <button onClick={clearFilters} style={{padding:'4px 12px',borderRadius:7,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:INTER}}>Ver todos</button>
            </div>
          )}
          <div style={{display:'flex',gap:6,marginBottom:16,borderBottom:'2px solid #e2e8f0'}}>
            {[['resumen','📊 Resumen'],['distribucion','🏭 Distribución'],['tendencia','📈 Tendencia']].map(([t,lbl])=>(
              <button key={t} onClick={()=>setStatsTab(t)} style={{padding:'8px 16px',border:'none',background:'transparent',cursor:'pointer',fontSize:12,fontWeight:600,color:statsTab===t?FTBLUE:'#64748b',borderBottom:statsTab===t?`2px solid ${FTBLUE}`:'2px solid transparent',marginBottom:-2,fontFamily:INTER}}>{lbl}</button>
            ))}
          </div>

          {statsTab==='resumen'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16}}>
                {[
                  {label:'Total solicitudes',val:base.length,sub:hasFilter?`de ${records.length}`:'Desde JUN 2025',c:FTBLUE,icon:'📋'},
                  {label:'Negocios ganados',val:ganados.length,sub:fmtCLP(montoGan),c:'#16a34a',icon:'✅'},
                  {label:'Tasa de conversión',val:tasaConv+'%',sub:`${ganados.length} ganados / ${perdidos.length} perdidos`,c:'#7c3aed',icon:'🎯'},
                  {label:'Pipeline activo',val:pipeline.length,sub:fmtCLP(montoPipe),c:'#ea580c',icon:'🔥'},
                  {label:'Forecast ponderado',val:fmtCLP(Math.round(totalForecast)),sub:'Monto × % cierre',c:'#0891b2',icon:'💰'},
                  {label:'Negocios perdidos',val:perdidos.length,sub:fmtCLP(perdidos.reduce((a,r)=>a+(r.monto||0),0)),c:'#dc2626',icon:'❌'},
                ].map(k=>(
                  <div key={k.label} style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0',display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{fontSize:28,lineHeight:1,marginTop:2}}>{k.icon}</div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{k.label}</div>
                      <div style={{fontSize:22,fontWeight:800,color:'#0f172a',letterSpacing:-.5}}>{k.val}</div>
                      <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{k.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Embudo de conversión</div>
                <div style={{display:'flex',gap:3,height:32,borderRadius:10,overflow:'hidden'}}>
                  {PIPE_STAGES.map(stage=>{
                    const n=base.filter(r=>r.estado===stage).length;
                    const pct=base.length>0?n/base.length*100:0;
                    const cfg=ESTADO_CFG[stage]||{c:'#94a3b8'};
                    return pct>0?<div key={stage} title={`${stage}: ${n}`} style={{width:pct+'%',background:cfg.c,display:'flex',alignItems:'center',justifyContent:'center',minWidth:20}}>{pct>5&&<span style={{fontSize:9,color:'#fff',fontWeight:700}}>{n}</span>}</div>:null;
                  })}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:12}}>
                  {PIPE_STAGES.map(stage=>{
                    const n=base.filter(r=>r.estado===stage).length;
                    const cfg=ESTADO_CFG[stage]||{c:'#94a3b8'};
                    return<span key={stage} onClick={()=>{setFEstados([stage]);setView('lista');}} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#334155',cursor:'pointer'}}>
                      <span style={{width:10,height:10,borderRadius:3,background:cfg.c,flexShrink:0}}/>{stage} <span style={{color:'#94a3b8'}}>({n})</span>
                    </span>;
                  })}
                </div>
              </div>
            </div>
          )}

          {statsTab==='distribucion'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Por estado</div>
                {byEstado.map(d=>(
                  <div key={d.label} onClick={()=>{setFEstados([d.label]);setView('lista');}} style={{display:'flex',alignItems:'center',gap:8,marginBottom:9,cursor:'pointer',padding:'4px 6px',borderRadius:7}} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{width:10,height:10,borderRadius:3,background:d.color,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12,color:'#334155'}}>{d.label}</span>
                    <div style={{width:80,background:'#f1f5f9',borderRadius:99,height:6}}><div style={{width:Math.round(d.value/base.length*100)+'%',height:6,borderRadius:99,background:d.color}}/></div>
                    <span style={{fontSize:11,fontWeight:700,color:d.color,minWidth:20,textAlign:'right'}}>{d.value}</span>
                    <span style={{fontSize:10,color:'#94a3b8'}}>{Math.round(d.value/base.length*100)}%</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Top rubros</div>
                {byRubroArr.map(([rubro,d],i)=>(
                  <div key={rubro} onClick={()=>{setFRubro(rubro);setView('lista');}} style={{display:'flex',alignItems:'center',gap:8,marginBottom:9,cursor:'pointer',padding:'4px 6px',borderRadius:7}} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{width:10,height:10,borderRadius:3,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12,fontWeight:500,color:'#334155'}}>{rubro}</span>
                    <div style={{width:60,background:'#f1f5f9',borderRadius:99,height:6}}><div style={{width:Math.round(d.count/maxRubro*100)+'%',height:6,borderRadius:99,background:PIE_COLORS[i%PIE_COLORS.length]}}/></div>
                    <span style={{fontSize:11,fontWeight:600,minWidth:20,textAlign:'right',color:'#334155'}}>{d.count}</span>
                    {d.monto>0&&<span style={{fontSize:10,color:'#16a34a',minWidth:80,textAlign:'right'}}>{fmtCLP(d.monto)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsTab==='tendencia'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Solicitudes por mes</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:4,height:120}}>
                  {mesData.map((d,i)=>{
                    const maxV=Math.max(...mesData.map(x=>x.total),1);
                    return(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                        <div style={{fontSize:8,color:'#94a3b8',fontWeight:600}}>{d.total||''}</div>
                        <div style={{width:'100%',background:FTBLUE,borderRadius:'4px 4px 0 0',height:Math.max((d.total/maxV)*100,d.total?3:0)+'px'}}/>
                        <div style={{width:'100%',background:'#16a34a',borderRadius:'4px 4px 0 0',height:Math.max((d.ganados/maxV)*100,d.ganados?2:0)+'px'}}/>
                        <div style={{fontSize:8,color:'#94a3b8',textAlign:'center'}}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'flex',gap:14,marginTop:10,fontSize:11}}>
                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:12,height:4,background:FTBLUE,display:'inline-block',borderRadius:2}}/>Solicitudes</span>
                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:12,height:4,background:'#16a34a',display:'inline-block',borderRadius:2}}/>Ganados</span>
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'#0f172a'}}>Forecast ponderado</div>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:14}}>Solo etapas con monto y % cierre</div>
                {forecast.length===0?<div style={{color:'#94a3b8',fontSize:12,padding:'20px 0',textAlign:'center'}}>Sin datos suficientes</div>:
                  forecast.map(f=>(
                    <div key={f.stage} style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:11,color:'#334155',display:'flex',alignItems:'center',gap:5}}>
                          <span style={{width:8,height:8,borderRadius:2,background:f.cfg.c,flexShrink:0}}/>{f.stage} <span style={{fontSize:10,color:'#94a3b8'}}>({f.count})</span>
                        </span>
                        <span style={{fontSize:11,fontWeight:700,color:'#16a34a'}}>{fmtCLP(Math.round(f.pond))}</span>
                      </div>
                      <div style={{background:'#f1f5f9',borderRadius:99,height:8,overflow:'hidden'}}>
                        <div style={{width:Math.min(Math.round(f.pond/maxForecast*100),100)+'%',height:8,borderRadius:99,background:f.cfg.c,transition:'.3s'}}/>
                      </div>
                    </div>
                  ))
                }
                {forecast.length>0&&(
                  <div style={{borderTop:'2px solid #f1f5f9',paddingTop:10,marginTop:8,display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>Total forecast</span>
                    <span style={{fontSize:14,fontWeight:800,color:'#16a34a'}}>{fmtCLP(Math.round(totalForecast))}</span>
                  </div>
                )}
              </div>
              <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0',gridColumn:'1 / -1'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12,color:'#0f172a'}}>Detalle mensual</div>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead><tr style={{borderBottom:'2px solid #e2e8f0'}}>
                    {['Mes','Solicitudes','Ganados','% Conv.','Monto ganado'].map(h=><th key={h} style={{padding:'6px 10px',textAlign:h==='Mes'?'left':'right',fontWeight:600,color:'#94a3b8',fontSize:10,textTransform:'uppercase',letterSpacing:.4}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {mesData.filter(d=>d.total>0).map((d,i)=>{
                      const mk=MESES_KEYS[MESES_LABELS.indexOf(d.label)];
                      const items=mk?base.filter(r=>String(r.mes||'').toUpperCase()===mk.mes&&r.anio===mk.anio):[];
                      const montoMes=items.filter(r=>r.estado==='GANADO'||r.estado==='Ganado').reduce((a,r)=>a+(r.monto||0),0);
                      return(
                        <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{padding:'6px 10px',fontWeight:600,color:'#334155'}}>{d.label}</td>
                          <td style={{padding:'6px 10px',textAlign:'right',color:'#334155'}}>{d.total}</td>
                          <td style={{padding:'6px 10px',textAlign:'right',color:'#16a34a',fontWeight:700}}>{d.ganados}</td>
                          <td style={{padding:'6px 10px',textAlign:'right',color:'#7c3aed',fontWeight:600}}>{d.total>0?Math.round(d.ganados/d.total*100)+'%':'—'}</td>
                          <td style={{padding:'6px 10px',textAlign:'right',color:'#16a34a',fontWeight:600}}>{montoMes>0?fmtCLP(montoMes):'—'}</td>
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
        <div style={{position:'fixed',right:0,top:0,bottom:0,width:370,background:'#fff',boxShadow:'-4px 0 32px rgba(0,0,0,.12)',zIndex:100,overflowY:'auto',display:'flex',flexDirection:'column',fontFamily:INTER}}>
          <div style={{background:FTBLUE,padding:'16px 18px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
              <Avatar name={detail.empresa} size={42}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail.empresa}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginTop:2}}>{detail.nombre||''}</div>
              </div>
            </div>
            <button onClick={()=>setDetail(null)} style={{background:'rgba(255,255,255,.12)',border:'none',color:'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',marginLeft:8,fontSize:16}}>✕</button>
          </div>
          <div style={{padding:18,flex:1}}>
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
              <div key={k} style={{display:'flex',borderBottom:'1px solid #f1f5f9',padding:'7px 0'}}>
                <div style={{width:115,fontSize:11,color:'#94a3b8',fontWeight:600,flexShrink:0}}>{k}</div>
                <div style={{fontSize:12,fontWeight:500,flex:1,color:'#334155'}}>{v||'—'}</div>
              </div>
            ))}
            {detail.mail&&<a href={`mailto:${detail.mail}`} style={{display:'block',margin:'14px 0 4px',textAlign:'center',background:FTBLUE,color:'#fff',padding:'10px',borderRadius:9,textDecoration:'none',fontWeight:700,fontSize:12,boxShadow:'0 4px 12px rgba(26,58,107,.3)'}}>✉ {detail.mail}</a>}
            {detail.observacion&&(
              <div style={{marginTop:10,background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'#1e40af',marginBottom:4,textTransform:'uppercase',letterSpacing:.3}}>📝 Observación</div>
                <div style={{fontSize:12,color:'#1e3a5f',lineHeight:1.5}}>{detail.observacion}</div>
              </div>
            )}
          </div>
          <div style={{padding:'12px 18px',borderTop:'1px solid #f1f5f9',display:'flex',gap:8,flexShrink:0}}>
            <button onClick={()=>setModal(detail)} style={{flex:1,padding:'9px',borderRadius:9,border:'none',background:FTBLUE,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:INTER,boxShadow:'0 4px 12px rgba(26,58,107,.25)'}}>✏ Editar</button>
            <button onClick={()=>setDelTarget(detail)} style={{padding:'9px 14px',borderRadius:9,border:'1.5px solid #fecaca',background:'#fff1f2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:INTER}}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
// v2
