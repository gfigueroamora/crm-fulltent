import { useState } from 'react';
import { ESTADOS, ESTADO_CFG, FTBLUE } from '../constants';
import { uid } from '../utils';

const EMPTY = {
  empresa:'', nombre:'', rubro:'Sin clasificar', producto:'', medidas:'',
  m2:'', tipo:'COMPRA', contacto:'Correo', mail:'', telefono:'', nCot:'',
  pCierre:'', monto:'', fecha:'', mes:'', estado:'Por Cotizar', observacion:''
};

export default function Modal({ rec, onSave, onClose, rubroList }) {
  const [form, setForm] = useState({ ...EMPTY, ...(rec || {}) });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    if (!form.empresa.trim()) { alert('Empresa es obligatorio'); return; }
    const dt = form.fecha ? new Date(form.fecha) : null;
    onSave({
      ...form,
      id: rec?.id || uid(),
      m2: form.m2 ? parseFloat(form.m2) : null,
      pCierre: form.pCierre !== '' ? parseFloat(form.pCierre) : null,
      monto: form.monto ? parseFloat(String(form.monto).replace(/\./g, '')) : null,
      dia: dt ? dt.getDate() : rec?.dia || null,
      anio: dt ? dt.getFullYear() : rec?.anio || null,
    });
  };

  const inp = {
    padding: '7px 9px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 12, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const lbl = {
    fontSize: 10, fontWeight: 700, color: '#6b7280', display: 'block',
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: .3
  };
  const Row = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
      {children}
    </div>
  );
  const F = ({ label, k, type = 'text' }) => (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} style={inp} />
    </div>
  );
  const S = ({ label, k, opts }) => (
    <div>
      <label style={lbl}>{label}</label>
      <select value={form[k] || ''} onChange={e => set(k, e.target.value)} style={inp}>
        {opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 13, width: 580,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,.3)'
      }}>
        <div style={{
          background: FTBLUE, color: '#fff', padding: '14px 18px',
          borderRadius: '13px 13px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
            {rec?.id ? '✏️ Editar registro' : '➕ Nuevo prospecto'}
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
            borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 15
          }}>✕</button>
        </div>
        <div style={{ padding: 18 }}>
          <Row>
            <F label="Empresa *" k="empresa" />
            <F label="Nombre contacto" k="nombre" />
          </Row>
          <Row>
            <S label="Rubro" k="rubro" opts={rubroList} />
            <F label="Producto" k="producto" />
          </Row>
          <Row>
            <F label="Medidas" k="medidas" />
            <F label="M²" k="m2" type="number" />
          </Row>
          <Row>
            <S label="Tipo solicitud" k="tipo" opts={['COMPRA', 'ARRIENDO', 'ARRI/COMPRA']} />
            <S label="Canal contacto" k="contacto" opts={['Correo', 'Telefono', 'Llamada', 'Oficina', 'Whatsapp']} />
          </Row>
          <Row>
            <F label="Correo" k="mail" type="email" />
            <F label="Teléfono" k="telefono" />
          </Row>
          <Row>
            <F label="N° Cotización" k="nCot" />
            <F label="% Cierre (0–100)" k="pCierre" type="number" />
          </Row>
          <Row>
            <F label="Monto CLP" k="monto" type="number" />
            <F label="Fecha" k="fecha" type="date" />
          </Row>
          <Row>
            <S label="Mes" k="mes" opts={['','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']} />
            <div>
              <label style={lbl}>Estado</label>
              <select
                value={form.estado}
                onChange={e => set('estado', e.target.value)}
                style={{ ...inp, borderLeft: `4px solid ${(ESTADO_CFG[form.estado] || ESTADO_CFG['Sin estado']).c}` }}
              >
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </Row>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Observación</label>
            <textarea
              value={form.observacion} onChange={e => set('observacion', e.target.value)}
              rows={3} style={{ ...inp, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 12
            }}>Cancelar</button>
            <button onClick={save} style={{
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: FTBLUE, color: '#fff', cursor: 'pointer',
              fontWeight: 700, fontSize: 13
            }}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
