import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import CARPAS_SEED from './carpasData';
import {
  ESTADOS_CARPAS, PIPE_STAGES_CARPAS, MESES_ORDER, MESES_CARPAS,
  MESES_LABELS_CARPAS, RUBRO_LIST_CARPAS, MOTIVOS, TIPOS_CARPAS,
  ESTADO_CFG_CARPAS, FTBLUE, PIE_COLORS
} from './carpasConstants';
import {
  uid, fmtUF, fmtCLP, fmtM2, fmtPct, fmtDate,
  calcMargen, parseExcelCarpas, exportXLSXCarpas
} from './carpasUtils';

const COLLECTION = 'carpas';

// ── Indicadores ─────────────────────────────────────────────────────────────
function Indicadores() {
  const [data, setData] = useState({});
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [minRes, fxRes] = await Promise.all([
          fetch('https://mindicador.cl/api').then(r=>r.json()),
          fetch('https://api.exchangerate-api.com/v4/latest/CLP').then(r=>r.json())
        ]);
        const uf  = minRes?.uf?.valor;
        const utm = minRes?.utm?.valor;
        const usd = minRes?.dolar?.valor;
        const eur = minRes?.euro?.valor;
        const rates = fxRes?.rates || {};
        const ars = rates.ARS ? (1/rates.ARS) : null;
        const uyu = rates.UYU ? (1/rates.UYU) : null;
        setData({ uf, utm, usd, eur, ars, uyu });
      } catch(e) { console.log('Indicadores no disponibles'); }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 3600000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    { label:'UF', val: data.uf ? `$${Math.round(data.uf).toLocaleString('es-CL')}` : '—' },
    { label:'UTM', val: data.utm ? `$${Math.round(data.utm).toLocaleString('es-CL')}` : '—' },
    { label:'USD', val: data.usd ? `$${Math.round(data.usd).toLocaleString('es-CL')}` : '—' },
    { label:'ARS/CLP', val: data.ars ? `$${data.ars.toFixed(2)}` : '—' },
    { label:'UYU/CLP', val: data.uyu ? `$${data.uyu.toFixed(2)}` : '—' },
  ];

  return (
    <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
      {items.map(it => (
        <div key={it.label} style={{ textAlign:'center' }}>
          <div style={{ fontSize:8, color:'rgba(255,255,255,.55)', textTransform:'uppercase', letterSpacing:.5 }}>{it.label}</div>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{it.val}</div>
        </div>
      ))}
    </div>
  );
}

function Badge({ estado }) {
  const cfg = ESTADO_CFG_CARPAS[estado] || { c:'#9ca3af', bg:'#f9fafb' };
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
          <div style={{ fontWeight:700,fontSize:14,color:'#fff' }}>📥 Importar Excel — Carpas</div>
          <div style={{ fontSize:11,color:'rgba(255,255,255,.7)',marginTop:3 }}>¿Cómo quieres importar este archivo?</div>
        </div>
        <div style={{ padding:20 }}>
          <div onClick={onReplace} style={{ border:'1.5px solid #fee2e2',borderRadius:9,padding:'14px 16px',marginBottom:10,cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{ fontWeight:700,fontSize:13,color:'#dc2626',marginBottom:3 }}>🔄 Reemplazar todo</div>
            <div style={{ fontSize:11,color:'#6b7280' }}>Borra todos los registros y carga el Excel completo.</div>
          </div>
          <div onClick={onAdd} style={{ border:'1.5px solid #dcfce7',borderRadius:9,padding:'14px 16px',marginBottom:10,cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <div style={{ fontWeight:700,fontSize:13,color:'#16a34a',marginBottom:3 }}>➕ Solo agregar nuevos</div>
            <div style={{ fontSize:11,color:'#6b7280' }}>Compara por fecha + empresa y agrega solo los nuevos.</div>
          </div>
          <button onClick={onCancel} style={{ width:'100%',padding:'9px',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',cursor:'pointer',fontSize:12,fontWeight:600 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, orderFn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const ordered = orderFn ? [...options].sort(orderFn) : options;
  const count = selected.length;
  useEffect(() => {
    const h = e => { if(ref.current&&!ref.current.contains(e.target))setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const toggle = val => onChange(selected.includes(val)?selected.filter(v=>v!==val):[...selected,val]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ padding:'5px 10px',borderRadius:6,border:'1px solid #e5e7eb',fontSize:12,background:'#fff',color:'#374151',cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap' }}>
        {label}{count>0&&<span style={{ background:FTBLUE,color:'#fff',borderRadius:99,fontSize:10,fontWeight:700,padding:'1px 6px' }}>{count}</span>}
        <span style={{ fontSize:10,color:'#9ca3af' }}>{open?'▲':'▼'}</span>
      </button>
      {open&&(
        <div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:100,background:'#fff',borderRadius:9,boxShadow:'0 4px 20px rgba(0,0,0,.15)',border:'1px solid #e5e7eb',minWidth:200,padding:'8px 0',maxHeight:280,overflowY:'auto' }}>
          {count>0&&<div onClick={()=>onChange([])} style={{ padding:'4px 12px 8px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,borderBottom:'1px solid #f3f4f6' }}>✕ Limpiar selección</div>}
          {ordered.map(opt=>(
            <label key={opt} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 12px',cursor:'pointer',fontSize:12 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={()=>toggle(opt)} style={{ width:13,height:13,accentColor:FTBLUE,cursor:'pointer' }}/>
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal formulario ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  empresa:'', nombre:'', rubro:'Sin clasificar', producto:'CARPA C/ESTRUCTURA',
  medidas:'', m2:'', cantidad:'', tipo:'VENTA', contacto:'Correo',
  mail:'', telefono:'', nCot:'', uf:'', pCierre:'', estado:'NUEVA SOLICITUD',
  fecha:'', mes:'', comentarios:'', motivo:'', fechaSeg:'', proxSeg:'',
  precioCLP:'', costoCLP:''
};

function ModalCarpas({ rec, onSave, onClose, rubroList }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(rec||{}) });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const margenCalc = calcMargen(parseFloat(form.precioCLP)||null, parseFloat(form.costoCLP)||null);

  const save = () => {
    if (!form.empresa.trim()) { alert('Empresa es obligatorio'); return; }
    const dt = form.fecha ? new Date(form.fecha) : null;
    const precio = form.precioCLP ? parseFloat(form.precioCLP) : null;
    const costo  = form.costoCLP  ? parseFloat(form.costoCLP)  : null;
    onSave({
      ...form, id: rec?.id||uid(),
      m2: form.m2 ? parseFloat(form.m2) : null,
      cantidad: form.cantidad ? parseFloat(form.cantidad) : null,
      uf: form.uf ? parseFloat(form.uf) : null,
      pCierre: form.pCierre!=='' ? parseFloat(form.pCierre) : null,
      dia: dt?dt.getDate():rec?.dia||null,
      anio: dt?dt.getFullYear():rec?.anio||null,
      precioCLP: precio, costoCLP: costo,
      margen: calcMargen(precio, costo),
    });
  };

  const inp = { padding:'7px 9px',borderRadius:6,border:'1px solid #d1d5db',fontSize:12,width:'100%',boxSizing:'border-box',fontFamily:'inherit' };
  const lbl = { fontSize:10,fontWeight:700,color:'#6b7280',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:.3 };
  const Row = ({children}) => <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>{children}</div>;
  const F = ({label,k,type='text',placeholder=''}) => <div><label style={lbl}>{label}</label><input type={type} value={form[k]??''} onChange={e=>set(k,e.target.value)} style={inp} placeholder={placeholder}/></div>;
  const S = ({label,k,opts}) => <div><label style={lbl}>{label}</label><select value={form[k]||''} onChange={e=>set(k,e.target.value)} style={inp}>{opts.map(o=><option key={o} value={o}>{o||'—'}</option>)}</select></div>;

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#fff',borderRadius:13,width:600,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.3)' }}>
        <div style={{ background:FTBLUE,color:'#fff',padding:'14px 18px',borderRadius:'13px 13px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontWeight:700,fontSize:14,color:'#fff' }}>{rec?.id?'✏️ Editar cotización':'➕ Nueva cotización'}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)',border:'none',color:'#fff',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:15 }}>✕</button>
        </div>
        <div style={{ padding:18 }}>
          <Row><F label="Empresa *" k="empresa"/><F label="Nombre contacto" k="nombre"/></Row>
          <Row><S label="Rubro" k="rubro" opts={rubroList}/><F label="Producto" k="producto"/></Row>
          <Row><F label="Medidas" k="medidas"/><F label="M²" k="m2" type="number"/></Row>
          <Row><F label="Cantidad" k="cantidad" type="number"/><S label="Tipo solicitud" k="tipo" opts={TIPOS_CARPAS}/></Row>
          <Row><S label="Canal contacto" k="contacto" opts={['Correo','Telefono','Llamada','Oficina','Whatsapp']}/><F label="N° Cotización" k="nCot"/></Row>
          <Row><F label="Correo" k="mail" type="email"/><F label="Teléfono" k="telefono"/></Row>
          <Row><F label="UF (precio venta)" k="uf" type="number" placeholder="Ej: 1500"/><F label="% Cierre (0–100)" k="pCierre" type="number"/></Row>
          <Row><F label="Fecha" k="fecha" type="date"/><S label="Mes" k="mes" opts={['','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']}/></Row>
          <Row>
            <div><label style={lbl}>Estado</label>
              <select value={form.estado} onChange={e=>set('estado',e.target.value)}
                style={{...inp,borderLeft:`4px solid ${(ESTADO_CFG_CARPAS[form.estado]||{c:'#6b7280'}).c}`}}>
                {ESTADOS_CARPAS.map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
            <S label="Motivo pérdida" k="motivo" opts={['','SIN RESPUESTA','NO EJECUTA','FUERA DE PRESUPUESTO','DIFERENTE MEDIDA - ARRIENDO','PRECIO - OTRA EMPRESA','PROYECTO NO VIABLE','PRECIO - OTRO PRODUCTO','PLAZO DE ARRIENDO','TIEMPO DE RESPUESTA']}/>
          </Row>
          <Row><F label="Fecha seguimiento" k="fechaSeg" type="date"/><F label="Próx. seguimiento" k="proxSeg" type="date"/></Row>

          {/* Sección financiera */}
          <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:9,padding:14,marginBottom:12 }}>
            <div style={{ fontWeight:700,fontSize:12,color:'#166534',marginBottom:10 }}>💰 Datos financieros</div>
            <Row>
              <F label="Precio CLP (neto)" k="precioCLP" type="number" placeholder="Ingresa precio en CLP"/>
              <F label="Costo CLP" k="costoCLP" type="number" placeholder="Ingresa costo en CLP"/>
            </Row>
            <div style={{ background:'#fff',borderRadius:7,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontSize:12,color:'#6b7280',fontWeight:600 }}>Margen calculado automáticamente:</span>
              <span style={{ fontSize:16,fontWeight:800,color:margenCalc!=null?(margenCalc>30?'#16a34a':margenCalc>15?'#d97706':'#dc2626'):'#9ca3af' }}>
                {margenCalc!=null?fmtPct(margenCalc):'—'}
              </span>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Comentarios</label>
            <textarea value={form.comentarios} onChange={e=>set('comentarios',e.target.value)} rows={3} style={{...inp,resize:'vertical'}}/>
          </div>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button onClick={onClose} style={{ padding:'8px 18px',borderRadius:7,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:12 }}>Cancelar</button>
            <button onClick={save} style={{ padding:'8px 20px',borderRadius:7,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontWeight:700,fontSize:13 }}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main CRM Carpas ──────────────────────────────────────────────────────────
export default function CRMCarpas() {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [fMeses, setFMeses]         = useState([]);
  const [fAnio, setFAnio]           = useState('');
  const [fEstados, setFEstados]     = useState([]);
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

  const showToast = (msg,type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2800); };

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const snap = await getDocs(collection(db,COLLECTION));
        if (snap.empty) {
          setSaving(true);
          const batch = writeBatch(db);
          CARPAS_SEED.forEach(r=>{ const ref=doc(collection(db,COLLECTION)); batch.set(ref,{...r,_id:ref.id}); });
          await batch.commit();
          const snap2 = await getDocs(collection(db,COLLECTION));
          setRecords(snap2.docs.map(d=>({...d.data(),_fireId:d.id})));
          setSaving(false);
        } else {
          setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        }
      } catch(e){ showToast('Error al cargar datos','err'); }
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
        showToast('Cotización actualizada ✓');
      } else {
        const ref = await addDoc(collection(db,COLLECTION),rec);
        setRecords(prev=>[{...rec,_fireId:ref.id},...prev]);
        showToast('Cotización creada ✓');
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
      showToast('Eliminado','warn');
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
    } catch(e){ showToast('Error','err'); }
  },[records]);

  const handleXLSXSelect = e=>{ const file=e.target.files[0];if(!file)return;setImportFile(file);e.target.value=''; };

  const doImportReplace = ()=>{
    if(!importFile)return;
    parseExcelCarpas(importFile, async data=>{
      setSaving(true); setImportFile(null);
      try {
        const snapAll=await getDocs(collection(db,COLLECTION));
        const delBatch=writeBatch(db); snapAll.docs.forEach(d=>delBatch.delete(d.ref)); await delBatch.commit();
        for(let i=0;i<data.length;i+=400){
          const batch=writeBatch(db);
          data.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`${data.length} registros cargados ✓`);
      } catch(err){ showToast('Error al importar','err'); }
      finally { setSaving(false); }
    },()=>{ showToast('Error al leer Excel','err'); setImportFile(null); });
  };

  const doImportAddNew = ()=>{
    if(!importFile)return;
    parseExcelCarpas(importFile, async data=>{
      setSaving(true); setImportFile(null);
      try {
        const keys=new Set(records.map(r=>`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        const nuevos=data.filter(r=>!keys.has(`${r.fecha}__${r.empresa?.toLowerCase().trim()}`));
        if(nuevos.length===0){showToast('Sin registros nuevos','warn');setSaving(false);return;}
        for(let i=0;i<nuevos.length;i+=400){
          const batch=writeBatch(db);
          nuevos.slice(i,i+400).forEach(r=>{const ref=doc(collection(db,COLLECTION));batch.set(ref,{...r,_id:ref.id});});
          await batch.commit();
        }
        const snap=await getDocs(collection(db,COLLECTION));
        setRecords(snap.docs.map(d=>({...d.data(),_fireId:d.id})));
        showToast(`${nuevos.length} nuevos agregados ✓`);
      } catch(err){ showToast('Error','err'); }
      finally { setSaving(false); }
    },()=>{ showToast('Error al leer Excel','err'); setImportFile(null); });
  };

  const allMeses  = useMemo(()=>[...new Set(records.map(r=>r.mes).filter(Boolean))].sort((a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)),[records]);
  const allAnios  = useMemo(()=>[...new Set(records.map(r=>r.anio).filter(Boolean))].sort(),[records]);
  const allRubros = useMemo(()=>[...new Set(records.map(r=>r.rubro).filter(Boolean))].sort(),[records]);
  const rubroList = useMemo(()=>{const ex=allRubros.filter(r=>!RUBRO_LIST_CARPAS.includes(r));return[...RUBRO_LIST_CARPAS,...ex];},[allRubros]);

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
  const ufPipe   = pipeline.reduce((a,r)=>a+(r.uf||0),0);
  const clpGan   = ganados.reduce((a,r)=>a+(r.precioCLP||0),0);
  const tasaConv = ganados.length+perdidos.length>0?Math.round(ganados.length/(ganados.length+perdidos.length)*100):0;
  const m2Pipe   = pipeline.reduce((a,r)=>a+(r.m2||0),0);
  const m2Gan    = ganados.reduce((a,r)=>a+(r.m2||0),0);
  const margenProm = ()=>{
    const withMargen = ganados.filter(r=>r.margen!=null);
    if(!withMargen.length) return null;
    return Math.round(withMargen.reduce((a,r)=>a+r.margen,0)/withMargen.length*10)/10;
  };

  const doSort = col=>{ if(sortCol===col)setSortDir(d=>d*-1);else{setSortCol(col);setSortDir(-1);}setPage(1); };
  const onDrop  = (e,stage)=>{ e.preventDefault();if(dragId)updateEstado(dragId,stage);setDragId(null); };
  const clearFilters = ()=>{ setSearch('');setFMeses([]);setFAnio('');setFEstados([]);setFRubro('');setPage(1); };
  const pageData = filtered.slice((page-1)*PAGE,page*PAGE);
  const totalPages = Math.ceil(filtered.length/PAGE)||1;

  // Stats
  const byEstado = ESTADOS_CARPAS.map(e=>({ label:e, value:base.filter(r=>r.estado===e).length, color:(ESTADO_CFG_CARPAS[e]||{c:'#9ca3af'}).c })).filter(d=>d.value>0);
  const byRubroArr = Object.entries(base.reduce((acc,r)=>{ if(r.rubro){acc[r.rubro]=acc[r.rubro]||{count:0,uf:0};acc[r.rubro].count++;acc[r.rubro].uf+=r.uf||0;} return acc; },{})).sort((a,b)=>b[1].count-a[1].count).slice(0,10);
  const maxRubro = byRubroArr[0]?.[1].count||1;
  const byMotivo = Object.entries(base.filter(r=>r.motivo).reduce((acc,r)=>{ acc[r.motivo]=(acc[r.motivo]||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1]);
  const maxMotivo = byMotivo[0]?.[1]||1;
  const mesData = MESES_CARPAS.map((mk,i)=>{
    const items=base.filter(r=>r.mes===mk.mes&&r.anio===mk.anio);
    return{ label:MESES_LABELS_CARPAS[i], total:items.length, ganados:items.filter(r=>r.estado==='GANADO').length,
      ufTotal:items.reduce((a,r)=>a+(r.uf||0),0), m2Total:items.reduce((a,r)=>a+(r.m2||0),0) };
  });
  const byMargenRubro = Object.entries(base.reduce((acc,r)=>{
    if(r.rubro&&r.margen!=null){ acc[r.rubro]=acc[r.rubro]||{sum:0,count:0}; acc[r.rubro].sum+=r.margen; acc[r.rubro].count++; }
    return acc;
  },{})).map(([r,d])=>([r,Math.round(d.sum/d.count*10)/10])).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxMargenRubro = byMargenRubro[0]?.[1]||1;
  const ticketProm = Object.entries(base.filter(r=>r.uf&&r.m2).reduce((acc,r)=>{
    const ticket=r.uf/r.m2;
    acc[r.mes+'_'+r.anio]=acc[r.mes+'_'+r.anio]||{sum:0,count:0,label:r.mes+' '+r.anio};
    acc[r.mes+'_'+r.anio].sum+=ticket; acc[r.mes+'_'+r.anio].count++;
    return acc;
  },{})).map(([k,d])=>({label:d.label,val:Math.round(d.sum/d.count*100)/100})).slice(-12);

  const ss = { fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',background:'#f0f4f8',minHeight:'100vh',fontSize:13,color:'#111827' };
  const sel = { padding:'5px 8px',borderRadius:6,border:'1px solid #e5e7eb',fontSize:12,background:'#fff',color:'#374151' };
  const Th = ({col,label}) => <th onClick={()=>doSort(col)} style={{ padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:11,background:'#f8fafc',borderBottom:'2px solid #e5e7eb',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none' }}>{label}{sortCol===col?(sortDir>0?' ↑':' ↓'):''}</th>;

  if(loading) return <div style={{...ss,display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{textAlign:'center',color:'#6b7280'}}><div style={{fontSize:32,marginBottom:12}}>⛺</div><div style={{fontWeight:600}}>Cargando CRM Carpas...</div></div></div>;

  return (
    <div style={ss}>
      {toast&&<Toast {...toast}/>}
      {importFile&&<ImportModal onReplace={doImportReplace} onAdd={doImportAddNew} onCancel={()=>setImportFile(null)}/>}
      {modal!==null&&<ModalCarpas rec={modal} onSave={saveRecord} onClose={()=>setModal(null)} rubroList={rubroList}/>}

      {delTarget&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ background:'#fff',borderRadius:12,padding:26,width:320,textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🗑️</div>
            <div style={{ fontWeight:700,fontSize:15,marginBottom:6 }}>¿Eliminar cotización?</div>
            <div style={{ color:'#6b7280',fontSize:12,marginBottom:18 }}>Se eliminará <b>{delTarget.empresa}</b>.</div>
            <div style={{ display:'flex',gap:8,justifyContent:'center' }}>
              <button onClick={()=>setDelTarget(null)} style={{ padding:'8px 18px',borderRadius:7,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:12 }}>Cancelar</button>
              <button onClick={()=>deleteRecord(delTarget.id)} style={{ padding:'8px 18px',borderRadius:7,border:'none',background:'#dc2626',color:'#fff',cursor:'pointer',fontWeight:700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-header específico de Carpas */}
      <div style={{ background:'#0f2744',borderBottom:'2px solid #1e3a6b',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8 }}>
        <div style={{ display:'flex',gap:5 }}>
          {[['lista','📋 Lista'],['pipeline','📊 Pipeline'],['stats','📈 Estadísticas']].map(([v,lbl])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px',borderRadius:7,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:view===v?'rgba(255,255,255,.25)':'rgba(255,255,255,.1)',color:'#fff',borderBottom:view===v?'2px solid #fff':'2px solid transparent' }}>{lbl}</button>
          ))}
        </div>
        <Indicadores/>
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
          <button onClick={()=>setModal({})} style={{ padding:'5px 12px',borderRadius:7,border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:11 }}>＋ Nueva</button>
          <button onClick={()=>exportXLSXCarpas(records)} style={{ padding:'5px 9px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',cursor:'pointer',fontSize:11 }}>↓ Excel</button>
          <label style={{ padding:'5px 9px',borderRadius:7,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600 }}>↑ Excel<input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSXSelect} style={{ display:'none' }}/></label>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding:'10px 16px' }}>
        {hasFilter&&(
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'7px 12px',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ background:FTBLUE,color:'#fff',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99 }}>FILTRADO</span>
              <span style={{ fontSize:12,color:'#1e40af',fontWeight:500 }}>Mostrando <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
            </div>
            <button onClick={clearFilters} style={{ padding:'3px 10px',borderRadius:6,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700 }}>Ver todos</button>
          </div>
        )}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8 }}>
          {[
            { label:'Total cotizaciones', val:base.length, sub:hasFilter?`de ${records.length}`:records.length+' total', c:FTBLUE },
            { label:'Ganadas', val:ganados.length, sub:fmtCLP(clpGan), c:'#16a34a' },
            { label:'Pipeline activo', val:pipeline.length, sub:fmtUF(ufPipe)+' en UF', c:'#ea580c' },
            { label:'Tasa conversión', val:tasaConv+'%', sub:`${perdidos.length} perdidas`, c:'#7c3aed' },
            { label:'Margen prom. ganadas', val:margenProm()!=null?fmtPct(margenProm()):'—', sub:'Solo con datos', c:'#0891b2' },
            { label:'M² en pipeline', val:fmtM2(m2Pipe), sub:`${fmtM2(m2Gan)} ganados`, c:'#d97706' },
          ].map(k=>(
            <div key={k.label} style={{ background:'#fff',borderRadius:9,padding:'10px 12px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',borderLeft:`3px solid ${k.c}`,position:'relative' }}>
              {hasFilter&&<span style={{ position:'absolute',top:6,right:6,background:'#eff6ff',color:FTBLUE,fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:99 }}>filtrado</span>}
              <div style={{ fontSize:9,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4 }}>{k.label}</div>
              <div style={{ fontSize:18,fontWeight:800,color:'#111827',marginTop:2 }}>{k.val}</div>
              <div style={{ fontSize:10,color:'#9ca3af',marginTop:1 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      {view!=='stats'&&(
        <div style={{ padding:'0 16px 10px',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="🔍 Empresa, nombre, N° cotización..."
            style={{...sel,flex:'1 1 180px',padding:'6px 10px'}}/>
          <select value={fAnio} onChange={e=>{setFAnio(e.target.value);setPage(1);}} style={sel}>
            <option value="">Todos los años</option>
            {allAnios.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <MultiSelect label="Meses" options={allMeses} selected={fMeses} onChange={v=>{setFMeses(v);setPage(1);}} orderFn={(a,b)=>MESES_ORDER.indexOf(a)-MESES_ORDER.indexOf(b)}/>
          <MultiSelect label="Estados" options={ESTADOS_CARPAS} selected={fEstados} onChange={v=>{setFEstados(v);setPage(1);}}/>
          <select value={fRubro} onChange={e=>{setFRubro(e.target.value);setPage(1);}} style={sel}>
            <option value="">Todos los rubros</option>
            {allRubros.map(r=><option key={r}>{r}</option>)}
          </select>
          {hasFilter&&<button onClick={clearFilters} style={{ padding:'6px 11px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12 }}>✕ Limpiar</button>}
        </div>
      )}

      {/* LISTA */}
      {view==='lista'&&(
        <div style={{ padding:'0 16px 16px' }}>
          <div style={{ background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                <thead><tr>
                  <Th col="fecha" label="Fecha"/><Th col="empresa" label="Empresa"/>
                  <Th col="rubro" label="Rubro"/><Th col="producto" label="Producto"/>
                  <Th col="m2" label="M²"/><Th col="tipo" label="Tipo"/>
                  <Th col="uf" label="UF"/><Th col="precioCLP" label="CLP"/>
                  <Th col="margen" label="Margen"/><Th col="pCierre" label="% Cierre"/>
                  <Th col="estado" label="Estado"/>
                  <th style={{ padding:'8px 10px',background:'#f8fafc',borderBottom:'2px solid #e5e7eb' }}></th>
                </tr></thead>
                <tbody>
                  {pageData.map((r,i)=>(
                    <tr key={r.id} onClick={()=>setDetail(r)}
                      style={{ borderBottom:'1px solid #f3f4f6',cursor:'pointer',background:detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa' }}
                      onMouseEnter={e=>{if(detail?.id!==r.id)e.currentTarget.style.background='#f0f9ff';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=detail?.id===r.id?'#eff6ff':i%2===0?'#fff':'#fafafa';}}>
                      <td style={{ padding:'7px 10px',whiteSpace:'nowrap',color:'#6b7280',fontSize:11 }}>{fmtDate(r)}</td>
                      <td style={{ padding:'7px 10px',maxWidth:170 }}>
                        <div style={{ fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.empresa}</div>
                        <div style={{ fontSize:10,color:'#9ca3af' }}>{r.nombre||''}</div>
                      </td>
                      <td style={{ padding:'7px 10px',fontSize:11 }}>{r.rubro||'—'}</td>
                      <td style={{ padding:'7px 10px',fontSize:11 }}>{r.producto||'—'}</td>
                      <td style={{ padding:'7px 10px',fontSize:11 }}>{fmtM2(r.m2)}</td>
                      <td style={{ padding:'7px 10px' }}>
                        <span style={{ fontSize:10,background:r.tipo==='ARRIENDO'?'#fef3c7':r.tipo==='EVALUA AMBAS'?'#ede9fe':'#f0fdf4',color:r.tipo==='ARRIENDO'?'#92400e':r.tipo==='EVALUA AMBAS'?'#7c3aed':'#166534',padding:'2px 6px',borderRadius:4,fontWeight:600 }}>{r.tipo||'—'}</span>
                      </td>
                      <td style={{ padding:'7px 10px',fontSize:12,fontWeight:r.uf?600:400,color:r.uf?'#111827':'#d1d5db' }}>{fmtUF(r.uf)}</td>
                      <td style={{ padding:'7px 10px',fontSize:11,color:r.precioCLP?'#111827':'#d1d5db' }}>{fmtCLP(r.precioCLP)}</td>
                      <td style={{ padding:'7px 10px',fontSize:12,fontWeight:r.margen!=null?700:400,color:r.margen!=null?(r.margen>30?'#16a34a':r.margen>15?'#d97706':'#dc2626'):'#d1d5db' }}>{fmtPct(r.margen)}</td>
                      <td style={{ padding:'7px 10px',fontSize:11 }}>{r.pCierre!=null?r.pCierre+'%':'—'}</td>
                      <td style={{ padding:'7px 10px' }}><Badge estado={r.estado}/></td>
                      <td style={{ padding:'7px 8px',whiteSpace:'nowrap' }} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setModal(r)} style={{ background:'#e0f2fe',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',color:'#0369a1',fontWeight:700,marginRight:3,fontSize:11 }}>✏</button>
                        <button onClick={()=>setDelTarget(r)} style={{ background:'#fee2e2',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',color:'#dc2626',fontWeight:700,fontSize:11 }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {pageData.length===0&&<tr><td colSpan={12} style={{ padding:40,textAlign:'center',color:'#9ca3af' }}>Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop:8,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#6b7280' }}>
            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} style={{ padding:'3px 10px',borderRadius:5,border:'1px solid #e5e7eb',background:'#fff',cursor:page===1?'default':'pointer',opacity:page===1?.4:1,fontSize:11 }}>‹ Anterior</button>
            <span>Pág {page} de {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{ padding:'3px 10px',borderRadius:5,border:'1px solid #e5e7eb',background:'#fff',cursor:page>=totalPages?'default':'pointer',opacity:page>=totalPages?.4:1,fontSize:11 }}>Siguiente ›</button>
            <span style={{ marginLeft:4 }}>{filtered.length} de {records.length} registros</span>
          </div>
        </div>
      )}

      {/* PIPELINE */}
      {view==='pipeline'&&(
        <div style={{ padding:'0 16px 16px',overflowX:'auto' }}>
          <div style={{ display:'flex',gap:8,minWidth:1000 }}>
            {PIPE_STAGES_CARPAS.map(stage=>{
              const items=filtered.filter(r=>r.estado===stage);
              const cfg=ESTADO_CFG_CARPAS[stage]||{c:'#9ca3af',bg:'#f9fafb'};
              const totalUF=items.reduce((a,r)=>a+(r.uf||0),0);
              const totalM2=items.reduce((a,r)=>a+(r.m2||0),0);
              return(
                <div key={stage} style={{ flex:1,minWidth:110 }} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,stage)}>
                  <div style={{ background:cfg.bg,borderRadius:8,padding:'8px 9px',marginBottom:7,borderTop:`3px solid ${cfg.c}` }}>
                    <div style={{ fontWeight:700,fontSize:10,color:cfg.c,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{stage}</div>
                    <div style={{ fontSize:10,color:'#6b7280' }}>{items.length} cotiz.</div>
                    {totalUF>0&&<div style={{ fontSize:10,fontWeight:700,color:cfg.c }}>{fmtUF(totalUF)}</div>}
                    {totalM2>0&&<div style={{ fontSize:9,color:'#9ca3af' }}>{fmtM2(totalM2)}</div>}
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:5,minHeight:50,padding:2,borderRadius:6,border:dragId?'1.5px dashed #93c5fd':'1.5px dashed transparent',transition:'.15s' }}>
                    {items.map(r=>(
                      <div key={r.id} draggable
                        onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDragId(r.id);}}
                        onDragEnd={()=>setDragId(null)} onClick={()=>setDetail(r)}
                        style={{ background:'#fff',borderRadius:7,padding:'8px 9px',cursor:'grab',borderLeft:`3px solid ${cfg.c}`,boxShadow:'0 1px 3px rgba(0,0,0,.08)',opacity:dragId===r.id?.3:1 }}>
                        <div style={{ fontWeight:600,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.empresa}</div>
                        <div style={{ fontSize:10,color:'#9ca3af',marginTop:1 }}>{r.medidas||r.producto||'—'}</div>
                        {r.m2&&<div style={{ fontSize:10,color:'#6b7280' }}>{fmtM2(r.m2)}</div>}
                        {r.uf&&<div style={{ fontSize:11,fontWeight:700,color:cfg.c,marginTop:2 }}>{fmtUF(r.uf)}</div>}
                        {r.margen!=null&&<div style={{ fontSize:9,fontWeight:700,color:r.margen>30?'#16a34a':r.margen>15?'#d97706':'#dc2626' }}>Margen: {fmtPct(r.margen)}</div>}
                        {r.comentarios&&<div style={{ fontSize:9,color:'#0891b2',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>💬 {r.comentarios}</div>}
                        <div style={{ display:'flex',gap:3,marginTop:4 }} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setModal(r)} style={{ fontSize:10,background:'#e0f2fe',border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',color:'#0369a1' }}>✏</button>
                          <button onClick={()=>setDelTarget(r)} style={{ fontSize:10,background:'#fee2e2',border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',color:'#dc2626' }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:11,color:'#9ca3af',marginTop:8 }}>💡 Arrastra para cambiar etapa · Filtros aplican aquí también</div>
        </div>
      )}

      {/* STATS */}
      {view==='stats'&&(
        <div style={{ padding:'0 16px 16px' }}>
          {hasFilter&&(
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'7px 12px',marginBottom:12 }}>
              <span style={{ fontSize:12,color:'#1e40af' }}>📊 Estadísticas de <b>{filtered.length}</b> de <b>{records.length}</b> registros</span>
              <button onClick={clearFilters} style={{ padding:'3px 10px',borderRadius:6,border:'none',background:FTBLUE,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700 }}>Ver todos</button>
            </div>
          )}
          <div style={{ display:'flex',gap:4,marginBottom:14,borderBottom:'2px solid #e5e7eb' }}>
            {[['resumen','📊 Resumen'],['distribucion','🏭 Distribución'],['tendencia','📈 Tendencia'],['margen','💰 Margen']].map(([t,lbl])=>(
              <button key={t} onClick={()=>setStatsTab(t)} style={{ padding:'7px 14px',border:'none',background:'transparent',cursor:'pointer',fontSize:12,fontWeight:600,color:statsTab===t?FTBLUE:'#6b7280',borderBottom:statsTab===t?`2px solid ${FTBLUE}`:'2px solid transparent',marginBottom:-2 }}>{lbl}</button>
            ))}
          </div>

          {statsTab==='resumen'&&(
            <div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:14 }}>
                {[
                  { label:'Total cotizaciones', val:base.length, sub:hasFilter?`de ${records.length}`:'AGO 2024 → JUL 2026', c:FTBLUE, icon:'⛺' },
                  { label:'Ganadas', val:ganados.length, sub:fmtCLP(clpGan)+' CLP neto', c:'#16a34a', icon:'✅' },
                  { label:'Tasa conversión', val:tasaConv+'%', sub:`${ganados.length} ganadas / ${perdidos.length} perdidas`, c:'#7c3aed', icon:'🎯' },
                  { label:'UF en pipeline', val:fmtUF(ufPipe), sub:`${pipeline.length} cotizaciones activas`, c:'#ea580c', icon:'🔥' },
                  { label:'Margen prom. ganadas', val:margenProm()!=null?fmtPct(margenProm()):'Sin datos', sub:'Requiere precio y costo CLP', c:'#0891b2', icon:'💰' },
                  { label:'M² cotizados', val:fmtM2(m2Pipe+m2Gan), sub:`${fmtM2(m2Gan)} ganados`, c:'#d97706', icon:'📐' },
                ].map(k=>(
                  <div key={k.label} style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',borderLeft:`4px solid ${k.c}`,display:'flex',gap:10,alignItems:'flex-start' }}>
                    <div style={{ fontSize:26 }}>{k.icon}</div>
                    <div>
                      <div style={{ fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4 }}>{k.label}</div>
                      <div style={{ fontSize:20,fontWeight:800,color:'#111827',marginTop:2 }}>{k.val}</div>
                      <div style={{ fontSize:11,color:'#9ca3af',marginTop:1 }}>{k.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Embudo de conversión</div>
                <div style={{ display:'flex',gap:3,height:28,borderRadius:8,overflow:'hidden' }}>
                  {PIPE_STAGES_CARPAS.map(stage=>{
                    const n=base.filter(r=>r.estado===stage).length;
                    const pct=base.length>0?n/base.length*100:0;
                    const cfg=ESTADO_CFG_CARPAS[stage]||{c:'#9ca3af'};
                    return pct>0?<div key={stage} title={`${stage}: ${n}`} style={{ width:pct+'%',background:cfg.c,display:'flex',alignItems:'center',justifyContent:'center',minWidth:20 }}>{pct>5&&<span style={{ fontSize:9,color:'#fff',fontWeight:700 }}>{n}</span>}</div>:null;
                  })}
                </div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginTop:8 }}>
                  {PIPE_STAGES_CARPAS.map(stage=>{ const n=base.filter(r=>r.estado===stage).length; const cfg=ESTADO_CFG_CARPAS[stage]||{c:'#9ca3af'};
                    return <span key={stage} style={{ display:'flex',alignItems:'center',gap:4,fontSize:11 }}><span style={{ width:10,height:10,borderRadius:2,background:cfg.c,flexShrink:0 }}/>{stage} <span style={{ color:'#9ca3af' }}>({n})</span></span>;
                  })}
                </div>
              </div>
            </div>
          )}

          {statsTab==='distribucion'&&(
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Por estado</div>
                {byEstado.map(d=>(
                  <div key={d.label} onClick={()=>{setFEstados([d.label]);setView('lista');}} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7,cursor:'pointer',padding:'3px 6px',borderRadius:5 }} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ width:10,height:10,borderRadius:2,background:d.color,flexShrink:0 }}/>
                    <span style={{ flex:1,fontSize:11 }}>{d.label}</span>
                    <div style={{ flex:1,background:'#f3f4f6',borderRadius:99,height:6 }}><div style={{ width:Math.round(d.value/base.length*100)+'%',height:6,borderRadius:99,background:d.color }}/></div>
                    <span style={{ fontSize:11,fontWeight:600,color:d.color,minWidth:20,textAlign:'right' }}>{d.value}</span>
                    <span style={{ fontSize:10,color:'#9ca3af' }}>{Math.round(d.value/base.length*100)}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Top rubros (por UF)</div>
                {byRubroArr.map(([rubro,d],i)=>(
                  <div key={rubro} onClick={()=>{setFRubro(rubro);setView('lista');}} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7,cursor:'pointer',padding:'3px 6px',borderRadius:5 }} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ width:10,height:10,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0 }}/>
                    <span style={{ flex:1,fontSize:11,fontWeight:500 }}>{rubro}</span>
                    <div style={{ width:60,background:'#f3f4f6',borderRadius:99,height:6 }}><div style={{ width:Math.round(d.count/maxRubro*100)+'%',height:6,borderRadius:99,background:PIE_COLORS[i%PIE_COLORS.length] }}/></div>
                    <span style={{ fontSize:11,fontWeight:600,minWidth:20,textAlign:'right' }}>{d.count}</span>
                    {d.uf>0&&<span style={{ fontSize:10,color:'#0284c7',minWidth:70,textAlign:'right' }}>{fmtUF(Math.round(d.uf))}</span>}
                  </div>
                ))}
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',gridColumn:'1 / -1' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Motivos de pérdida</div>
                {byMotivo.length===0?<div style={{ color:'#9ca3af',fontSize:12 }}>Sin datos de motivo</div>:byMotivo.map(([motivo,n])=>(
                  <div key={motivo} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                    <span style={{ fontSize:11,minWidth:240,color:'#374151' }}>{motivo}</span>
                    <div style={{ flex:1,background:'#f3f4f6',borderRadius:99,height:8 }}><div style={{ width:Math.round(n/maxMotivo*100)+'%',height:8,borderRadius:99,background:'#dc2626' }}/></div>
                    <span style={{ fontSize:11,fontWeight:700,color:'#dc2626',minWidth:24,textAlign:'right' }}>{n}</span>
                    <span style={{ fontSize:10,color:'#9ca3af' }}>{perdidos.length>0?Math.round(n/perdidos.length*100):'—'}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsTab==='tendencia'&&(
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',gridColumn:'1 / -1' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>Solicitudes por mes</div>
                <div style={{ fontSize:11,color:'#9ca3af',marginBottom:10 }}>AGO 2024 → JUL 2026</div>
                <div style={{ display:'flex',alignItems:'flex-end',gap:3,height:120,overflowX:'auto' }}>
                  {mesData.filter(d=>d.total>0).map((d,i)=>{
                    const maxV=Math.max(...mesData.map(x=>x.total),1);
                    return(
                      <div key={i} style={{ flex:'0 0 auto',width:38,display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
                        <div style={{ fontSize:8,color:'#6b7280' }}>{d.total}</div>
                        <div style={{ width:'100%',background:FTBLUE,borderRadius:'3px 3px 0 0',height:Math.max((d.total/maxV)*90,3)+'px' }}/>
                        <div style={{ width:'100%',background:'#16a34a',borderRadius:'3px 3px 0 0',height:Math.max((d.ganados/maxV)*90,d.ganados?2:0)+'px' }}/>
                        <div style={{ fontSize:7,color:'#6b7280',textAlign:'center' }}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex',gap:12,marginTop:8,fontSize:10 }}>
                  <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{ width:10,height:4,background:FTBLUE,display:'inline-block',borderRadius:1 }}/>Cotizaciones</span>
                  <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{ width:10,height:4,background:'#16a34a',display:'inline-block',borderRadius:1 }}/>Ganadas</span>
                </div>
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Ticket promedio UF/m²</div>
                {ticketProm.length===0?<div style={{ color:'#9ca3af',fontSize:12 }}>Sin datos suficientes</div>:
                  ticketProm.map((d,i)=>{
                    const maxT=Math.max(...ticketProm.map(x=>x.val),1);
                    return(
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7 }}>
                        <span style={{ fontSize:11,minWidth:60,color:'#374151' }}>{d.label}</span>
                        <div style={{ flex:1,background:'#f3f4f6',borderRadius:99,height:7 }}><div style={{ width:Math.round(d.val/maxT*100)+'%',height:7,borderRadius:99,background:'#0891b2' }}/></div>
                        <span style={{ fontSize:11,fontWeight:600,color:'#0891b2',minWidth:50,textAlign:'right' }}>{d.val.toFixed(2)} UF</span>
                      </div>
                    );
                  })
                }
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Detalle mensual</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%',fontSize:11,borderCollapse:'collapse' }}>
                    <thead><tr style={{ borderBottom:'2px solid #e5e7eb' }}>
                      {['Mes','Cotiz.','Gan.','% Conv.','UF total','M² total'].map(h=><th key={h} style={{ padding:'4px 8px',textAlign:h==='Mes'?'left':'right',fontWeight:600,color:'#6b7280',fontSize:10 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {mesData.filter(d=>d.total>0).map((d,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                          <td style={{ padding:'4px 8px',fontWeight:500 }}>{d.label}</td>
                          <td style={{ padding:'4px 8px',textAlign:'right' }}>{d.total}</td>
                          <td style={{ padding:'4px 8px',textAlign:'right',color:'#16a34a',fontWeight:600 }}>{d.ganados}</td>
                          <td style={{ padding:'4px 8px',textAlign:'right',color:'#7c3aed',fontWeight:600 }}>{d.total>0?Math.round(d.ganados/d.total*100)+'%':'—'}</td>
                          <td style={{ padding:'4px 8px',textAlign:'right',color:'#0284c7' }}>{d.ufTotal>0?fmtUF(Math.round(d.ufTotal)):'—'}</td>
                          <td style={{ padding:'4px 8px',textAlign:'right',color:'#d97706' }}>{d.m2Total>0?fmtM2(d.m2Total):'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {statsTab==='margen'&&(
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>Margen promedio por rubro</div>
                <div style={{ fontSize:11,color:'#9ca3af',marginBottom:12 }}>Solo registros con precio y costo CLP</div>
                {byMargenRubro.length===0?<div style={{ color:'#9ca3af',fontSize:12,padding:'20px 0',textAlign:'center' }}>Completa precio y costo CLP en los registros para ver este análisis</div>:
                  byMargenRubro.map(([rubro,prom],i)=>(
                    <div key={rubro} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                        <span style={{ fontSize:11,color:'#374151' }}>{rubro}</span>
                        <span style={{ fontSize:11,fontWeight:700,color:prom>30?'#16a34a':prom>15?'#d97706':'#dc2626' }}>{fmtPct(prom)}</span>
                      </div>
                      <div style={{ background:'#f3f4f6',borderRadius:99,height:8 }}>
                        <div style={{ width:Math.min(Math.round(prom/maxMargenRubro*100),100)+'%',height:8,borderRadius:99,background:prom>30?'#16a34a':prom>15?'#d97706':'#dc2626',transition:'.3s' }}/>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:4 }}>Venta neta CLP por mes</div>
                <div style={{ fontSize:11,color:'#9ca3af',marginBottom:10 }}>Solo registros ganados con precio CLP</div>
                {mesData.filter(d=>{ const mk=MESES_CARPAS[MESES_LABELS_CARPAS.indexOf(d.label)]; return mk&&base.filter(r=>r.mes===mk.mes&&r.anio===mk.anio&&r.estado==='GANADO'&&r.precioCLP).length>0; }).length===0
                  ?<div style={{ color:'#9ca3af',fontSize:12,padding:'20px 0',textAlign:'center' }}>Completa precio CLP en los registros ganados</div>
                  :mesData.filter(d=>d.total>0).map((d,i)=>{
                    const mk=MESES_CARPAS[MESES_LABELS_CARPAS.indexOf(d.label)];
                    const clpMes=mk?base.filter(r=>r.mes===mk.mes&&r.anio===mk.anio&&r.estado==='GANADO').reduce((a,r)=>a+(r.precioCLP||0),0):0;
                    const maxCLP=Math.max(...mesData.filter(d2=>d2.total>0).map(d2=>{const mk2=MESES_CARPAS[MESES_LABELS_CARPAS.indexOf(d2.label)];return mk2?base.filter(r=>r.mes===mk2.mes&&r.anio===mk2.anio&&r.estado==='GANADO').reduce((a,r)=>a+(r.precioCLP||0),0):0;}),1);
                    return clpMes>0?(
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7 }}>
                        <span style={{ fontSize:11,minWidth:55,color:'#374151' }}>{d.label}</span>
                        <div style={{ flex:1,background:'#f3f4f6',borderRadius:99,height:7 }}><div style={{ width:Math.round(clpMes/maxCLP*100)+'%',height:7,borderRadius:99,background:'#16a34a' }}/></div>
                        <span style={{ fontSize:10,fontWeight:600,color:'#16a34a',minWidth:90,textAlign:'right' }}>{fmtCLP(clpMes)}</span>
                      </div>
                    ):null;
                  })
                }
              </div>
              <div style={{ background:'#fff',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',gridColumn:'1 / -1' }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Resumen financiero — registros con datos completos</div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
                  {[
                    { label:'Con precio CLP', val:base.filter(r=>r.precioCLP).length, color:'#0284c7' },
                    { label:'Con costo CLP', val:base.filter(r=>r.costoCLP).length, color:'#7c3aed' },
                    { label:'Con margen calc.', val:base.filter(r=>r.margen!=null).length, color:'#16a34a' },
                    { label:'Margen > 30%', val:base.filter(r=>r.margen!=null&&r.margen>30).length, color:'#d97706' },
                  ].map(k=>(
                    <div key={k.label} style={{ background:'#f8fafc',borderRadius:8,padding:'10px 12px',borderLeft:`3px solid ${k.color}` }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.3 }}>{k.label}</div>
                      <div style={{ fontSize:20,fontWeight:800,color:k.color,marginTop:2 }}>{k.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL PANEL */}
      {detail&&(
        <div style={{ position:'fixed',right:0,top:0,bottom:0,width:370,background:'#fff',boxShadow:'-4px 0 24px rgba(0,0,0,.14)',zIndex:100,overflowY:'auto',display:'flex',flexDirection:'column' }}>
          <div style={{ background:FTBLUE,color:'#fff',padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0 }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{detail.empresa}</div>
              <div style={{ fontSize:11,color:'#93c5fd',marginTop:2 }}>{detail.nombre||''}</div>
            </div>
            <button onClick={()=>setDetail(null)} style={{ background:'rgba(255,255,255,.15)',border:'none',color:'#fff',borderRadius:6,padding:'4px 9px',cursor:'pointer',marginLeft:8 }}>✕</button>
          </div>
          <div style={{ padding:14,flex:1 }}>
            <div style={{ marginBottom:12,display:'flex',gap:6,flexWrap:'wrap' }}>
              <Badge estado={detail.estado}/>
              {detail.motivo&&<span style={{ background:'#fee2e2',color:'#dc2626',padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:600 }}>⚠ {detail.motivo}</span>}
            </div>
            {/* Sección financiera destacada */}
            {(detail.uf||detail.precioCLP||detail.costoCLP)&&(
              <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:9,padding:12,marginBottom:12 }}>
                <div style={{ fontWeight:700,fontSize:11,color:'#166534',marginBottom:8 }}>💰 Financiero</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#6b7280',fontWeight:700,textTransform:'uppercase' }}>Precio UF</div>
                    <div style={{ fontSize:14,fontWeight:800,color:'#0284c7' }}>{fmtUF(detail.uf)}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#6b7280',fontWeight:700,textTransform:'uppercase' }}>Precio CLP</div>
                    <div style={{ fontSize:14,fontWeight:800,color:'#111827' }}>{fmtCLP(detail.precioCLP)}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:9,color:'#6b7280',fontWeight:700,textTransform:'uppercase' }}>Margen</div>
                    <div style={{ fontSize:16,fontWeight:800,color:detail.margen!=null?(detail.margen>30?'#16a34a':detail.margen>15?'#d97706':'#dc2626'):'#9ca3af' }}>{fmtPct(detail.margen)}</div>
                  </div>
                </div>
                {detail.costoCLP&&<div style={{ marginTop:8,fontSize:11,color:'#6b7280',textAlign:'center' }}>Costo: {fmtCLP(detail.costoCLP)}</div>}
              </div>
            )}
            {[
              ['Rubro',detail.rubro],['Producto',detail.producto],['Medidas',detail.medidas],
              ['M²',fmtM2(detail.m2)],['Cantidad',detail.cantidad||'—'],['Tipo',detail.tipo],
              ['N° Cotización',detail.nCot||'—'],['% Cierre',detail.pCierre!=null?detail.pCierre+'%':'—'],
              ['Fecha',fmtDate(detail)+(detail.anio?` (${detail.anio})`:'')],
              ['Canal',detail.contacto],['Teléfono',detail.telefono||'—'],
            ].map(([k,v])=>(
              <div key={k} style={{ display:'flex',borderBottom:'1px solid #f3f4f6',padding:'5px 0' }}>
                <div style={{ width:110,fontSize:11,color:'#9ca3af',fontWeight:600,flexShrink:0 }}>{k}</div>
                <div style={{ fontSize:12,fontWeight:500,flex:1 }}>{v||'—'}</div>
              </div>
            ))}
            {detail.mail&&<a href={`mailto:${detail.mail}`} style={{ display:'block',margin:'10px 0 4px',textAlign:'center',background:FTBLUE,color:'#fff',padding:'8px',borderRadius:8,textDecoration:'none',fontWeight:700,fontSize:12 }}>✉ {detail.mail}</a>}
            {detail.comentarios&&(
              <div style={{ marginTop:8,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:10 }}>
                <div style={{ fontSize:10,fontWeight:700,color:'#1e40af',marginBottom:3 }}>💬 Comentarios</div>
                <div style={{ fontSize:12,color:'#1e3a5f' }}>{detail.comentarios}</div>
              </div>
            )}
          </div>
          <div style={{ padding:'10px 14px',borderTop:'1px solid #f3f4f6',display:'flex',gap:8,flexShrink:0 }}>
            <button onClick={()=>setModal(detail)} style={{ flex:1,padding:'8px',borderRadius:8,border:'none',background:FTBLUE,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:12 }}>✏ Editar</button>
            <button onClick={()=>setDelTarget(detail)} style={{ padding:'8px 12px',borderRadius:8,border:'none',background:'#fee2e2',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:12 }}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
