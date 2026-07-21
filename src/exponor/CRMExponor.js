import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import EXPONOR_SEED from './exponorData';
import {
  ESTADOS_EXPONOR, PIPE_STAGES_EXPONOR, PRODUCTOS_EXPONOR,
  CANALES_EXPONOR, RESPONSABLES_EXPONOR, RESULTADOS_EXPONOR,
  ESTADO_CFG_EXPONOR, RESP_CFG, FTBLUE
} from './exponorConstants';
import { uid, parseExponorExcel, exportExponorXLSX } from './exponorUtils';

const COLLECTION = 'exponor';
const INTER = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_PAL=['#1a3a6b','#0891b2','#7c3aed','#16a34a','#ea580c','#d97706','#dc2626','#9333ea','#0284c7','#059669'];
function avatarColor(s=''){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return AVATAR_PAL[Math.abs(h)%AVATAR_PAL.length];}
function getInitials(n=''){const w=n.trim().split(/\s+/).filter(Boolean);if(!w.length)return'??';if(w.length===1)return w[0].slice(0,2).toUpperCase();return(w[0][0]+w[1][0]).toUpperCase();}
function Avatar({name,size=36}){const r=Math.round(size*.26);return<div style={{width:size,height:size,borderRadius:r,background:avatarColor(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*.35),fontWeight:700,flexShrink:0,letterSpacing:-.5,userSelect:'none',fontFamily:INTER}}>{getInitials(name)}</div>;}

// ── Badge estado ──────────────────────────────────────────────────────────────
function Badge({estado}){
  const cfg=ESTADO_CFG_EXPONOR[estado]||{c:'#94a3b8',bg:'#f8fafc'};
  return<span style={{background:cfg.bg,color:cfg.c,padding:'3px 10px',borderRadius:999,fontSize:10,fontWeight:600,whiteSpace:'nowrap',letterSpacing:.2}}>{estado}</span>;
}

// ── Badge responsable ─────────────────────────────────────────────────────────
function RespBadge({resp}){
  const cfg=RESP_CFG[resp]||{c:'#64748b',bg:'#f1f5f9'};
  return resp?<span style={{background:cfg.bg,color:cfg.c,padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700}}>{resp}</span>:null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({msg,type}){
  const cols={ok:'#16a34a',warn:'#d97706',err:'#dc2626'};
  return msg?<div style={{position:'fixed',top:16,right:16,zIndex:500,background:cols[type]||'#16a34a',color:'#fff',padding:'10px 18px',borderRadius:10,fontSize:12,fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,.15)',fontFamily:INTER}}>{msg}</div>:null;
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({onReplace,onAdd,onCancel}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
      <div style={{background:'#fff',borderRadius:14,width:420,boxShadow:'0 24px 64px rgba(0,0,0,.2)',overflow:'hidden',fontFamily:INTER}}>
        <div style={{background:FTBLUE,padding:'16px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#fff'}}>📥 Importar Excel — Exponor</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:3}}>¿Cómo quieres importar?</div>
        </div>
        <div style={{padding:20}}>
          {[
            {fn:onReplace,border:'#fecaca',bg:'#fef2f2',c:'#dc2626',label:'🔄 Reemplazar todo',desc:'Borra todos los contactos y carga el Excel completo.'},
            {fn:onAdd,border:'#bbf7d0',bg:'#f0fdf4',c:'#16a34a',label:'➕ Solo agregar nuevos',desc:'Compara por empresa + contacto y agrega solo los nuevos.'},
          ].map((b,i)=>(
            <div key={i} onClick={b.fn} style={{border:`1.5px solid ${b.border}`,borderRadius:10,padding:'14px 16px',marginBottom:10,cursor:'pointer',background:'#fff',transition:'.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background=b.bg} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              <div style={{fontWeight:700,fontSize:13,color:b.c,marginBottom:3}}>{b.label}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{b.desc}</div>
            </div>
          ))}
          <button onClick={onCancel} style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8f9fa',color:'#64748b',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:INTER}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal formulario ──────────────────────────────────────────────────────────
const EMPTY = {
  empresa:'',contacto:'',cargo:'',correo:'',telefono:'',division:'',
  reunion:'',producto:'',obs:'',responsable:'GUSTAVO',
  estado:'CONTACTO EXPONOR',canal:'Correo',
  fechaSeg1:'',comentSeg1:'',fechaSeg2:'',comentSeg2:'',
  fechaSeg3:'',comentSeg3:'',cotizacion:'',resultado:'PENDIENTE',
};

function ModalExponor({rec,onSave,onClose}){
  const[form,setForm]=useState({...EMPTY,...(rec||{})});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=()=>{
    if(!form.empresa.trim()){alert('Empresa es obligatorio');return;}
    onSave({...form,id:rec?.id||uid()});
  };
  const inp={padding:'8px 10px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,width:'100%',boxSizing:'border-box',fontFamily:INTER,color:'#0f172a',outline:'none'};
  const lbl={fontSize:10,fontWeight:600,color:'#64748b',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.5};
  const Row=({children})=><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>{children}</div>;
  const F=({label,k,type='text',placeholder=''})=><div><label style={lbl}>{label}</label><input type={type} value={form[k]??''} onChange={e=>set(k,e.target.value)} style={inp} placeholder={placeholder} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/></div>;
  const S=({label,k,opts})=><div><label style={lbl}>{label}</label><select value={form[k]||''} onChange={e=>set(k,e.target.value)} style={{...inp,cursor:'pointer'}}>{opts.map(o=><option key={o} value={o}>{o||'—'}</option>)}</select></div>;
  const TA=({label,k,rows=2})=><div style={{marginBottom:12}}><label style={lbl}>{label}</label><textarea value={form[k]||''} onChange={e=>set(k,e.target.value)} rows={rows} style={{...inp,resize:'vertical'}}/></div>;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
      <div style={{background:'#fff',borderRadius:16,width:620,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.2)',fontFamily:INTER}}>
        <div style={{background:FTBLUE,color:'#fff',padding:'16px 20px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Avatar name={form.empresa||'Nuevo'} size={36}/>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:'#fff'}}>{rec?.id?'Editar contacto':'Nuevo contacto'}</div>
              {form.empresa&&<div style={{fontSize:11,color:'rgba(255,255,255,.6)',marginTop:1}}>{form.empresa}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.12)',border:'none',color:'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:16}}>✕</button>
        </div>
        <div style={{padding:20}}>
          {/* Datos contacto */}
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid #f1f5f9'}}>👤 Datos del contacto</div>
          <Row><F label="Empresa *" k="empresa"/><F label="Nombre contacto" k="contacto"/></Row>
          <Row><F label="Cargo" k="cargo"/><F label="División" k="division"/></Row>
          <Row><F label="Correo" k="correo" type="email"/><F label="Teléfono" k="telefono"/></Row>

          {/* Contexto feria */}
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid #f1f5f9',marginTop:4}}>🏔 Contexto Exponor</div>
          <Row>
            <F label="Tipo reunión" k="reunion" placeholder="Ej: STAND, reunión programada"/>
            <S label="Producto de interés" k="producto" opts={['','Venta carpa','Arriendo carpa','Cobertor o funda','Otro']}/>
          </Row>
          <TA label="Observaciones feria" k="obs"/>

          {/* Gestión */}
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid #f1f5f9',marginTop:4}}>⚙️ Gestión</div>
          <Row>
            <S label="Responsable" k="responsable" opts={RESPONSABLES_EXPONOR}/>
            <S label="Canal contacto" k="canal" opts={CANALES_EXPONOR}/>
          </Row>
          <Row>
            <div><label style={lbl}>Estado pipeline</label>
              <select value={form.estado} onChange={e=>set('estado',e.target.value)}
                style={{...inp,borderLeft:`4px solid ${(ESTADO_CFG_EXPONOR[form.estado]||{c:'#94a3b8'}).c}`,cursor:'pointer'}}>
                {ESTADOS_EXPONOR.map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
            <F label="N° Cotización" k="cotizacion" placeholder="Si aplica"/>
          </Row>

          {/* Seguimientos */}
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid #f1f5f9',marginTop:4}}>📅 Seguimientos</div>
          <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:10,padding:14,marginBottom:12}}>
            <Row><F label="Fecha Seg 1" k="fechaSeg1" type="date"/><F label="Fecha Seg 2" k="fechaSeg2" type="date"/></Row>
            <TA label="Comentario Seg 1" k="comentSeg1"/>
            <TA label="Comentario Seg 2" k="comentSeg2"/>
            <F label="Fecha Seg 3" k="fechaSeg3" type="date"/>
            <div style={{marginTop:8}}><TA label="Comentario Seg 3" k="comentSeg3"/></div>
          </div>

          <S label="Resultado final" k="resultado" opts={RESULTADOS_EXPONOR}/>

          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
            <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13,fontFamily:INTER}}>Cancelar</button>
            <button onClick={save} style={{padding:'9px 22px',borderRadius:9,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:INTER,boxShadow:'0 4px 12px rgba(26,58,107,.3)'}}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main CRM Exponor ──────────────────────────────────────────────────────────
export default function CRMExponor(){
  const[records,setRecords]=useState([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState('');
  const[fEstado,setFEstado]=useState('');
  const[fResp,setFResp]=useState('');
  const[fProducto,setFProducto]=useState('');
  const[view,setView]=useState('lista');
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
          EXPONOR_SEED.forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
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
        showToast('Contacto actualizado ✓');
      }else{
        const ref=await addDoc(collection(db,COLLECTION),rec);
        setRecords(prev=>[{...rec,_fireId:ref.id},...prev]);
        showToast('Contacto creado ✓');
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
    parseExponorExcel(importFile,async data=>{
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
        showToast(`${data.length} contactos cargados ✓`);
      }catch(err){showToast('Error al importar','err');}
      finally{setSaving(false);}
    },()=>{showToast('Error al leer Excel','err');setImportFile(null);});
  };
  const doImportAddNew=()=>{
    if(!importFile)return;
    parseExponorExcel(importFile,async data=>{
      setSaving(true);setImportFile(null);
      try{
        const keys=new Set(records.map(r=>`${r.empresa?.toLowerCase().trim()}__${r.contacto?.toLowerCase().trim()}`));
        const nuevos=data.filter(r=>!keys.has(`${r.empresa?.toLowerCase().trim()}__${r.contacto?.toLowerCase().trim()}`));
        if(!nuevos.length){showToast('Sin contactos nuevos','warn');setSaving(false);return;}
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

  const filtered=useMemo(()=>{
    const q=search.toLowerCase();
    return records.filter(r=>{
      if(q&&![r.empresa,r.contacto,r.correo,r.obs].join(' ').toLowerCase().includes(q))return false;
      if(fEstado&&r.estado!==fEstado)return false;
      if(fResp&&r.responsable!==fResp)return false;
      if(fProducto&&r.producto!==fProducto)return false;
      return true;
    });
  },[records,search,fEstado,fResp,fProducto]);

  const hasFilter=!!(search||fEstado||fResp||fProducto);
  const clearFilters=()=>{setSearch('');setFEstado('');setFResp('');setFProducto('');};

  // Stats
  const byEstado=ESTADOS_EXPONOR.map(e=>({label:e,n:records.filter(r=>r.estado===e).length,cfg:ESTADO_CFG_EXPONOR[e]||{c:'#94a3b8',bg:'#f8fafc'}}));
  const byResp=RESPONSABLES_EXPONOR.map(r=>({label:r,n:records.filter(x=>x.responsable===r).length,cfg:RESP_CFG[r]||{c:'#64748b',bg:'#f1f5f9'}}));
  const byProducto=PRODUCTOS_EXPONOR.map(p=>({label:p,n:records.filter(r=>r.producto===p).length}));
  const ganados=records.filter(r=>r.estado==='GANADO').length;
  const perdidos=records.filter(r=>r.estado==='PERDIDO').length;
  const conCot=records.filter(r=>r.cotizacion).length;
  const tasaConv=ganados+perdidos>0?Math.round(ganados/(ganados+perdidos)*100):0;
  const tasaCot=records.length>0?Math.round(conCot/records.length*100):0;

  const ss={fontFamily:INTER,background:'#f8f9fa',minHeight:'100vh',fontSize:13,color:'#0f172a'};
  const selStyle={padding:'6px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,background:'#fff',color:'#334155',fontFamily:INTER,fontWeight:500,outline:'none'};

  if(loading)return<div style={{...ss,display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{textAlign:'center',color:'#64748b'}}><div style={{fontSize:40,marginBottom:12}}>🏔</div><div style={{fontWeight:600,fontSize:15}}>Cargando CRM Exponor...</div></div></div>;

  return(
    <div style={ss}>
      {toast&&<Toast {...toast}/>}
      {importFile&&<ImportModal onReplace={doImportReplace} onAdd={doImportAddNew} onCancel={()=>setImportFile(null)}/>}
      {modal!==null&&<ModalExponor rec={modal} onSave={saveRecord} onClose={()=>setModal(null)}/>}

      {delTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,width:340,textAlign:'center',boxShadow:'0 24px 64px rgba(0,0,0,.2)',fontFamily:INTER}}>
            <div style={{fontSize:36,marginBottom:10}}>🗑️</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>¿Eliminar contacto?</div>
            <div style={{color:'#64748b',fontSize:13,marginBottom:20}}>Se eliminará <b>{delTarget.empresa}</b> — <b>{delTarget.contacto}</b>.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>setDelTarget(null)} style={{padding:'9px 20px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13,fontFamily:INTER}}>Cancelar</button>
              <button onClick={()=>deleteRecord(delTarget.id)} style={{padding:'9px 20px',borderRadius:9,border:'none',background:'#dc2626',color:'#fff',cursor:'pointer',fontWeight:700,fontFamily:INTER}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-header */}
      <div style={{background:'#0f2744',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:4}}>
          {[['lista','📋 Lista'],['pipeline','📊 Pipeline'],['stats','📈 Estadísticas']].map(([v,lbl])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:INTER,background:view===v?'rgba(255,255,255,.18)':'transparent',color:view===v?'#fff':'rgba(255,255,255,.5)',borderBottom:view===v?'2px solid #3b82f6':'2px solid transparent',transition:'.15s'}}>{lbl}</button>
          ))}
        </div>
        {/* KPI rápidos en header */}
        <div style={{display:'flex',gap:10}}>
          {[
            {label:'Total',val:records.length,c:'#93c5fd'},
            {label:'Ganados',val:ganados,c:'#86efac'},
            {label:'Con cotiz.',val:conCot,c:'#fcd34d'},
          ].map(k=>(
            <div key={k.label} style={{textAlign:'center'}}>
              <div style={{fontSize:8,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:.5}}>{k.label}</div>
              <div style={{fontSize:14,fontWeight:800,color:k.c}}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          {saving&&<span style={{fontSize:11,color:'rgba(255,255,255,.5)',fontFamily:INTER}}>Guardando...</span>}
          <button onClick={()=>setModal({})} style={{padding:'6px 14px',borderRadius:8,border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:INTER}}>＋ Nuevo</button>
          <button onClick={()=>exportExponorXLSX(records)} style={{padding:'6px 11px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'#fff',cursor:'pointer',fontSize:12,fontFamily:INTER}}>↓ Excel</button>
          <label style={{padding:'6px 11px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'#fff',cursor:'pointer',fontSize:12,fontFamily:INTER,fontWeight:600}}>↑ Excel<input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSXSelect} style={{display:'none'}}/></label>
        </div>
      </div>

      {/* KPIs */}
      <div style={{padding:'16px 20px'}}>
        {hasFilter&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'9px 16px',marginBottom:12}}>
            <span style={{fontSize:12,color:'#1e40af',fontWeight:500}}>Mostrando <b>{filtered.length}</b> de <b>{records.length}</b> contactos</span>
            <button onClick={clearFilters} style={{padding:'4px 12px',borderRadius:7,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:INTER}}>Ver todos</button>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
          {[
            {label:'Total contactos',val:records.length,sub:'Exponor 2025',c:FTBLUE},
            {label:'Ganados',val:ganados,sub:`${tasaConv}% conversión`,c:'#16a34a'},
            {label:'Perdidos',val:perdidos,sub:'Sin interés',c:'#dc2626'},
            {label:'Con cotización',val:conCot,sub:`${tasaCot}% del total`,c:'#d97706'},
            {label:'En proceso',val:records.filter(r=>!['GANADO','PERDIDO','CONTACTO EXPONOR'].includes(r.estado)).length,sub:'Pipeline activo',c:'#7c3aed'},
          ].map(k=>(
            <div key={k.label} style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',borderLeft:`3px solid ${k.c}`,fontFamily:INTER}}>
              <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.6,marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:'#0f172a',letterSpacing:-.5}}>{k.val}</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      {view!=='stats'&&(
        <div style={{padding:'0 20px 14px',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',flex:'1 1 200px'}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#94a3b8'}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Empresa, contacto, correo..."
              style={{...selStyle,width:'100%',paddingLeft:32,boxSizing:'border-box'}}/>
          </div>
          <select value={fEstado} onChange={e=>setFEstado(e.target.value)} style={selStyle}>
            <option value="">Todos los estados</option>
            {ESTADOS_EXPONOR.map(e=><option key={e}>{e}</option>)}
          </select>
          <select value={fResp} onChange={e=>setFResp(e.target.value)} style={selStyle}>
            <option value="">Todos los responsables</option>
            {RESPONSABLES_EXPONOR.map(r=><option key={r}>{r}</option>)}
          </select>
          <select value={fProducto} onChange={e=>setFProducto(e.target.value)} style={selStyle}>
            <option value="">Todos los productos</option>
            {PRODUCTOS_EXPONOR.map(p=><option key={p}>{p}</option>)}
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
                  {['Empresa','Contacto','Producto','Responsable','Canal','Estado','Cotización',''].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#64748b',fontSize:11,background:'#f8f9fa',borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:.3}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((r,i)=>(
                    <tr key={r.id} onClick={()=>setDetail(r)}
                      style={{borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa',transition:'.1s'}}
                      onMouseEnter={e=>{if(detail?.id!==r.id)e.currentTarget.style.background='#f8faff';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa';}}>
                      <td style={{padding:'10px 12px',maxWidth:180}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <Avatar name={r.empresa} size={30}/>
                          <div>
                            <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130,color:'#0f172a'}}>{r.empresa}</div>
                            {r.division&&<div style={{fontSize:10,color:'#94a3b8'}}>{r.division}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{fontWeight:500,color:'#334155',fontSize:12}}>{r.contacto||'—'}</div>
                        {r.cargo&&<div style={{fontSize:10,color:'#94a3b8'}}>{r.cargo}</div>}
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        {r.producto?<span style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:6,background:'#f0fdf4',color:'#16a34a'}}>{r.producto}</span>:<span style={{color:'#cbd5e1'}}>—</span>}
                      </td>
                      <td style={{padding:'10px 12px'}}><RespBadge resp={r.responsable}/></td>
                      <td style={{padding:'10px 12px',fontSize:11,color:'#64748b'}}>{r.canal||'—'}</td>
                      <td style={{padding:'10px 12px'}}><Badge estado={r.estado}/></td>
                      <td style={{padding:'10px 12px',fontSize:11,color:r.cotizacion?'#d97706':'#cbd5e1',fontWeight:r.cotizacion?600:400}}>{r.cotizacion||'—'}</td>
                      <td style={{padding:'10px 8px',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setModal(r)} style={{background:'#eff6ff',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#1d4ed8',fontWeight:700,marginRight:4,fontSize:11}}>✏</button>
                        <button onClick={()=>setDelTarget(r)} style={{background:'#fff1f2',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#dc2626',fontWeight:700,fontSize:11}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length===0&&<tr><td colSpan={8} style={{padding:48,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:32,marginBottom:8}}>🔍</div>Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:'#64748b',fontFamily:INTER}}>{filtered.length} de {records.length} contactos</div>
        </div>
      )}

      {/* PIPELINE */}
      {view==='pipeline'&&(
        <div style={{padding:'0 20px 20px',overflowX:'auto'}}>
          {/* Vista por responsable */}
          <div style={{display:'flex',gap:6,marginBottom:14}}>
            <span style={{fontSize:12,color:'#64748b',fontWeight:600,alignSelf:'center'}}>Ver por responsable:</span>
            {['',  ...RESPONSABLES_EXPONOR].map(r=>(
              <button key={r} onClick={()=>setFResp(r)} style={{padding:'4px 12px',borderRadius:7,border:'1.5px solid',borderColor:fResp===r?FTBLUE:'#e2e8f0',background:fResp===r?FTBLUE:'#fff',color:fResp===r?'#fff':'#334155',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:INTER}}>
                {r||'Todos'}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:10,minWidth:1100}}>
            {PIPE_STAGES_EXPONOR.map(stage=>{
              const items=filtered.filter(r=>r.estado===stage);
              const cfg=ESTADO_CFG_EXPONOR[stage]||{c:'#94a3b8',bg:'#f8fafc'};
              const isOver=dragOver===stage;
              return(
                <div key={stage} style={{flex:1,minWidth:105,display:'flex',flexDirection:'column'}}
                  onDragOver={e=>{e.preventDefault();setDragOver(stage);}}
                  onDragLeave={()=>setDragOver(null)}
                  onDrop={e=>{e.preventDefault();setDragOver(null);if(dragId)updateEstado(dragId,stage);setDragId(null);}}>
                  <div style={{borderRadius:'10px 10px 0 0',padding:'8px 10px',background:cfg.bg,borderTop:`3px solid ${cfg.c}`}}>
                    <div style={{fontWeight:700,fontSize:9,color:cfg.c,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:.3,textTransform:'uppercase'}}>{stage}</div>
                    <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginTop:2}}>{items.length}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,padding:'5px 3px',minHeight:80,background:isOver?`${cfg.c}08`:'transparent',borderRadius:'0 0 10px 10px',border:`1px solid ${isOver?cfg.c:'#e2e8f0'}`,borderTop:'none',transition:'.15s'}}>
                    {items.map(r=>(
                      <div key={r.id} draggable
                        onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDragId(r.id);}}
                        onDragEnd={()=>{setDragId(null);setDragOver(null);}}
                        onClick={()=>setDetail(r)}
                        style={{background:'#fff',borderRadius:9,padding:'9px 10px',cursor:'grab',boxShadow:'0 1px 4px rgba(0,0,0,.07)',opacity:dragId===r.id?.3:1,border:'1px solid #f1f5f9',fontFamily:INTER}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
                          <Avatar name={r.empresa} size={28}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#0f172a'}}>{r.empresa}</div>
                            <div style={{fontSize:10,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.contacto||'—'}</div>
                          </div>
                        </div>
                        {r.producto&&<div style={{fontSize:9,fontWeight:600,color:'#16a34a',marginBottom:4}}>🏷 {r.producto}</div>}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                          <RespBadge resp={r.responsable}/>
                          {r.cotizacion&&<span style={{fontSize:9,color:'#d97706',fontWeight:600}}>📄 {r.cotizacion}</span>}
                        </div>
                        {r.comentSeg1&&<div style={{fontSize:9,color:'#0891b2',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💬 {r.comentSeg1}</div>}
                        <div style={{display:'flex',gap:3,marginTop:5}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setModal(r)} style={{flex:1,fontSize:10,background:'#eff6ff',border:'none',borderRadius:5,padding:'3px',cursor:'pointer',color:'#1d4ed8',fontWeight:600}}>✏</button>
                          <button onClick={()=>setDelTarget(r)} style={{fontSize:10,background:'#fff1f2',border:'none',borderRadius:5,padding:'3px 6px',cursor:'pointer',color:'#dc2626',fontWeight:600}}>🗑</button>
                        </div>
                      </div>
                    ))}
                    {isOver&&dragId&&<div style={{border:`2px dashed ${cfg.c}`,borderRadius:9,padding:'10px',textAlign:'center',fontSize:10,color:cfg.c,fontWeight:600}}>Soltar aquí</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:10,fontFamily:INTER}}>💡 Arrastra para cambiar etapa · Filtra por responsable arriba</div>
        </div>
      )}

      {/* STATS */}
      {view==='stats'&&(
        <div style={{padding:'0 20px 20px',fontFamily:INTER}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:16}}>
            {/* Por estado */}
            <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Por etapa del pipeline</div>
              {byEstado.filter(d=>d.n>0).map(d=>(
                <div key={d.label} onClick={()=>{setFEstado(d.label);setView('lista');}} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer',padding:'3px 6px',borderRadius:7}} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{width:8,height:8,borderRadius:2,background:d.cfg.c,flexShrink:0}}/>
                  <span style={{flex:1,fontSize:11,color:'#334155'}}>{d.label}</span>
                  <div style={{width:60,background:'#f1f5f9',borderRadius:99,height:5}}><div style={{width:Math.round(d.n/records.length*100)+'%',height:5,borderRadius:99,background:d.cfg.c}}/></div>
                  <span style={{fontSize:11,fontWeight:700,color:d.cfg.c,minWidth:20,textAlign:'right'}}>{d.n}</span>
                </div>
              ))}
            </div>

            {/* Por responsable */}
            <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Por responsable</div>
              {byResp.map(d=>(
                <div key={d.label} onClick={()=>{setFResp(d.label);setView('lista');}} style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,cursor:'pointer',padding:'8px 10px',borderRadius:9,border:'1px solid #f1f5f9'}} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <Avatar name={d.label} size={36}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>{d.label}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{d.n} contactos</div>
                    <div style={{background:'#f1f5f9',borderRadius:99,height:4,marginTop:4}}><div style={{width:records.length?Math.round(d.n/records.length*100)+'%':'0%',height:4,borderRadius:99,background:d.cfg.c}}/></div>
                  </div>
                  <div style={{fontSize:18,fontWeight:800,color:d.cfg.c}}>{d.n}</div>
                </div>
              ))}
              {/* Detalle ganados por responsable */}
              <div style={{borderTop:'1px solid #f1f5f9',paddingTop:10,marginTop:4}}>
                <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:6}}>GANADOS POR RESPONSABLE</div>
                {RESPONSABLES_EXPONOR.map(r=>{
                  const n=records.filter(x=>x.responsable===r&&x.estado==='GANADO').length;
                  return<div key={r} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                    <span style={{color:'#334155'}}>{r}</span>
                    <span style={{fontWeight:700,color:'#16a34a'}}>{n}</span>
                  </div>;
                })}
              </div>
            </div>

            {/* Por producto */}
            <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Por producto de interés</div>
              {byProducto.filter(d=>d.n>0).map((d,i)=>(
                <div key={d.label} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,color:'#334155',fontWeight:500}}>{d.label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:FTBLUE}}>{d.n}</span>
                  </div>
                  <div style={{background:'#f1f5f9',borderRadius:99,height:7}}><div style={{width:records.length?Math.round(d.n/records.length*100)+'%':'0%',height:7,borderRadius:99,background:['#1a3a6b','#16a34a','#d97706','#7c3aed'][i%4]}}/></div>
                </div>
              ))}
              <div style={{marginTop:16,borderTop:'1px solid #f1f5f9',paddingTop:12}}>
                <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:8}}>RESUMEN</div>
                {[
                  {label:'Sin producto asignado',val:records.filter(r=>!r.producto).length,c:'#94a3b8'},
                  {label:'Con cotización',val:conCot,c:'#d97706'},
                  {label:'Tasa feria → cotiz.',val:tasaCot+'%',c:'#0891b2'},
                ].map(k=>(
                  <div key={k.label} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                    <span style={{color:'#64748b'}}>{k.label}</span>
                    <span style={{fontWeight:700,color:k.c}}>{k.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Embudo */}
          <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',boxShadow:'0 1px 6px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'#0f172a'}}>Embudo feria → cierre</div>
            <div style={{display:'flex',gap:3,height:32,borderRadius:10,overflow:'hidden'}}>
              {PIPE_STAGES_EXPONOR.map(stage=>{
                const n=records.filter(r=>r.estado===stage).length;
                const pct=records.length>0?n/records.length*100:0;
                const cfg=ESTADO_CFG_EXPONOR[stage]||{c:'#94a3b8'};
                return pct>0?<div key={stage} title={`${stage}: ${n}`} style={{width:pct+'%',background:cfg.c,display:'flex',alignItems:'center',justifyContent:'center',minWidth:20}}>{pct>5&&<span style={{fontSize:9,color:'#fff',fontWeight:700}}>{n}</span>}</div>:null;
              })}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:12}}>
              {PIPE_STAGES_EXPONOR.map(stage=>{
                const n=records.filter(r=>r.estado===stage).length;
                const cfg=ESTADO_CFG_EXPONOR[stage]||{c:'#94a3b8'};
                return<span key={stage} onClick={()=>{setFEstado(stage);setView('lista');}} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#334155',cursor:'pointer'}}>
                  <span style={{width:10,height:10,borderRadius:3,background:cfg.c,flexShrink:0}}/>{stage} <span style={{color:'#94a3b8'}}>({n})</span>
                </span>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL PANEL */}
      {detail&&(
        <div style={{position:'fixed',right:0,top:0,bottom:0,width:380,background:'#fff',boxShadow:'-4px 0 32px rgba(0,0,0,.12)',zIndex:100,overflowY:'auto',display:'flex',flexDirection:'column',fontFamily:INTER}}>
          <div style={{background:FTBLUE,padding:'16px 18px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
              <Avatar name={detail.empresa} size={44}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail.empresa}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.7)',marginTop:2}}>{detail.contacto}</div>
                {detail.cargo&&<div style={{fontSize:10,color:'rgba(255,255,255,.5)',marginTop:1}}>{detail.cargo}</div>}
              </div>
            </div>
            <button onClick={()=>setDetail(null)} style={{background:'rgba(255,255,255,.12)',border:'none',color:'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',marginLeft:8,fontSize:16}}>✕</button>
          </div>
          <div style={{padding:18,flex:1}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
              <Badge estado={detail.estado}/>
              <RespBadge resp={detail.responsable}/>
              {detail.producto&&<span style={{background:'#f0fdf4',color:'#16a34a',padding:'3px 10px',borderRadius:999,fontSize:10,fontWeight:600}}>{detail.producto}</span>}
            </div>
            {[
              ['División',detail.division],['Tipo reunión',detail.reunion],
              ['Canal',detail.canal],['N° Cotización',detail.cotizacion||'—'],
              ['Resultado',detail.resultado],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',borderBottom:'1px solid #f1f5f9',padding:'7px 0'}}>
                <div style={{width:110,fontSize:11,color:'#94a3b8',fontWeight:600,flexShrink:0}}>{k}</div>
                <div style={{fontSize:12,fontWeight:500,flex:1,color:'#334155'}}>{v||'—'}</div>
              </div>
            ))}
            {detail.obs&&(
              <div style={{marginTop:12,background:'#f8f9fa',borderRadius:9,padding:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:.3}}>📝 Obs. feria</div>
                <div style={{fontSize:12,color:'#334155',lineHeight:1.5}}>{detail.obs}</div>
              </div>
            )}
            {detail.correo&&<a href={`mailto:${detail.correo}`} style={{display:'block',margin:'12px 0 4px',textAlign:'center',background:FTBLUE,color:'#fff',padding:'10px',borderRadius:9,textDecoration:'none',fontWeight:700,fontSize:12,boxShadow:'0 4px 12px rgba(26,58,107,.3)'}}>✉ {detail.correo}</a>}
            {(detail.comentSeg1||detail.comentSeg2||detail.comentSeg3)&&(
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:.3,marginBottom:8}}>📅 Seguimientos</div>
                {[
                  {fecha:detail.fechaSeg1,coment:detail.comentSeg1,label:'Seg 1'},
                  {fecha:detail.fechaSeg2,coment:detail.comentSeg2,label:'Seg 2'},
                  {fecha:detail.fechaSeg3,coment:detail.comentSeg3,label:'Seg 3'},
                ].filter(s=>s.coment).map(s=>(
                  <div key={s.label} style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#92400e',marginBottom:3}}>{s.label} {s.fecha&&`— ${s.fecha}`}</div>
                    <div style={{fontSize:12,color:'#78350f'}}>{s.coment}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{padding:'12px 18px',borderTop:'1px solid #f1f5f9',display:'flex',gap:8,flexShrink:0}}>
            <button onClick={()=>setModal(detail)} style={{flex:1,padding:'9px',borderRadius:9,border:'none',background:FTBLUE,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:INTER}}>✏ Editar</button>
            <button onClick={()=>setDelTarget(detail)} style={{padding:'9px 14px',borderRadius:9,border:'1.5px solid #fecaca',background:'#fff1f2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:INTER}}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
