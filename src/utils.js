export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmtCLP = v => v ? '$' + Math.round(v).toLocaleString('es-CL') : '—';
export const fmtM2  = v => v ? Number(v).toLocaleString('es-CL') + ' m²' : '—';
export const fmtDate = r => {
  if (!r.dia && !r.mes) return '—';
  const d = r.dia ? String(r.dia).padStart(2, '0') : '??';
  const a = r.anio ? String(r.anio) : '??';
  return `${d}/${r.mes || '?'}/${a}`;
};

export const normEstado = s => {
  if (!s) return 'Sin estado';
  const m = {
    'RECIEN COTIZADO':'Recién Cotizado','RECIÉN COTIZADO':'Recién Cotizado',
    'POR COTIZAR':'Por Cotizar','EVALUACIÓN GENERAL':'Evaluación General',
    'EVALUACION GENERAL':'Evaluación General','GANADO':'Ganado','PERDIDO':'Perdido',
    'NEGOCIACIÓN':'Negociación','NEGOCIACION':'Negociación',
    'COMPARATIVO DE OFERTAS':'Comparativo de Ofertas',
    'COTIZADO':'Cotizado','cotizado':'Cotizado','Cotizado':'Cotizado',
    'NO SE COTIZA':'No se Cotiza','RECOTIZAR':'Recotizar',
  };
  return m[s.trim()] || s.trim();
};

export const normRubro = s => {
  if (!s) return 'Sin clasificar';
  const r = s.trim().toUpperCase();
  const m = {
    'SERVICIOS':'Servicios','SERVICIO':'Servicios','EDUCACION':'Educación',
    'EDUCACIÓN':'Educación','CONSTRUCCION':'Construcción','CONSTRUCCIÓN':'Construcción',
    'CONSTRUCTORA':'Construcción','MINERIA':'Minería','MINERO':'Minería','MINERÍA':'Minería',
    'TRANSPORTE':'Transporte','TRANSPORTES':'Transporte','AGRICOLA':'Agroindustria',
    'AGRÍCOLA':'Agroindustria','AGROINDUSTRIA':'Agroindustria','AGROINSDUSTRIA':'Agroindustria',
    'AGRO':'Agroindustria','ALIMENTACION':'Alimentación','ALIMENTACIÓN':'Alimentación',
    'ALIMENTOS':'Alimentación','GASTRONOMICO':'Alimentación','RESTORANT':'Alimentación',
    'INDUSTRIA':'Industrial','INDUSTRIAL':'Industrial','PARTICULAR':'Particular',
    'DEPORTIVO':'Deportivo','COMERCIAL':'Comercial','RETAIL':'Retail','SALUD':'Salud',
    'LOGISTICA':'Logística','LOGÍSTICA':'Logística','FORESTAL':'Forestal',
    'INMOBILIARIA':'Inmobiliaria','EVENTOS':'Eventos','MECANICA':'Mecánica/Taller',
    'TALLER':'Mecánica/Taller','FUERZA AÉREA':'Defensa','EJÉRCITO':'Defensa',
    'EJERCITO':'Defensa','INSUMOS MEDICOS':'Salud','GANADERA':'Agroindustria',
    'PUBLICO':'Público','FUNDACION':'Fundación','AGRUPACION':'Agrupación',
  };
  return m[r] || s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase();
};

export const parseExcelFile = (file, onDone, onError) => {
  import('xlsx').then(XLSX => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const dataRows = rows.slice(1).filter(r => r[3] && String(r[3]).trim() !== '');
        const records = dataRows.map((r, i) => {
          const fechaRaw = r[0];
          let fecha = '', dia = null, anio = null;
          if (fechaRaw instanceof Date) {
            fecha = fechaRaw.toISOString().slice(0, 10);
            dia = fechaRaw.getDate();
            anio = fechaRaw.getFullYear();
          }
          const pRaw = r[14];
          const pCierre = pRaw != null ? Math.round(parseFloat(pRaw) * 100) : null;
          const monto = r[15] ? parseFloat(r[15]) : null;
          const m2Raw = r[8];
          const m2 = m2Raw ? parseFloat(String(m2Raw).replace(',', '.')) : null;
          const tel = r[11] ? String(Math.round(parseFloat(r[11])) || r[11]) : '';
          const ncot = r[13] ? String(r[13]).trim() : '';
          const follow = r[20] ? String(r[20]).trim() : '';
          let mes = r[1] ? String(r[1]).trim().toUpperCase() : '';
          if (mes === 'sep') mes = 'SEP';
          return {
            id: `xl${i + 1}`,
            fecha, dia,
            mes, anio: r[2] ? parseInt(r[2]) : anio,
            empresa: String(r[3]).trim(),
            nombre: r[4] ? String(r[4]).trim() : '',
            rubro: normRubro(r[5]),
            producto: r[6] ? String(r[6]).trim() : '',
            medidas: r[7] ? String(r[7]).trim() : '',
            m2, tipo: r[9] ? String(r[9]).trim() : 'COMPRA',
            mail: r[10] ? String(r[10]).trim().replace(/\xa0/g, '') : '',
            telefono: tel,
            contacto: r[12] ? String(r[12]).trim() : '',
            nCot: ncot, pCierre, monto,
            estado: normEstado(r[21]),
            observacion: follow,
          };
        });
        onDone(records);
      } catch (e) { onError(e); }
    };
    reader.readAsArrayBuffer(file);
  });
};
