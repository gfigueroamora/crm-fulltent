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
  if (!s) return 'NUEVA SOLICITUD';
  const m = {
    'NUEVA SOLICITUD':'NUEVA SOLICITUD','POR COTIZAR':'POR COTIZAR',
    'COTIZADO':'COTIZADO','Cotizado':'COTIZADO','cotizado':'COTIZADO',
    '1° SEGUIMIENTO':'1° SEGUIMIENTO','2° SEGUIMIENTO':'2° SEGUIMIENTO',
    'ESPERANDO OC':'ESPERANDO OC','GANADO':'GANADO','PERDIDO':'PERDIDO',
    'NO SE COTIZA':'NO SE COTIZA',
    // estados viejos → nuevos
    'RECIEN COTIZADO':'COTIZADO','RECIÉN COTIZADO':'COTIZADO',
    'EVALUACIÓN GENERAL':'COTIZADO','EVALUACION GENERAL':'COTIZADO',
    'COMPARATIVO DE OFERTAS':'COTIZADO','NEGOCIACIÓN':'COTIZADO',
    'NEGOCIACION':'COTIZADO','RECOTIZAR':'POR COTIZAR',
    'SIN ESTADO':'NUEVA SOLICITUD',
  };
  return m[s.trim()] || 'NUEVA SOLICITUD';
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

// ── Excel export → .xlsx idéntico al original ──────────────────────────────
export const exportXLSX = async (records) => {
  const XLSX = await import('xlsx');
  const ESTADOS_LIST = [
    'NUEVA SOLICITUD','POR COTIZAR','COTIZADO',
    '1° SEGUIMIENTO','2° SEGUIMIENTO','ESPERANDO OC',
    'GANADO','PERDIDO','NO SE COTIZA'
  ];
  const headers = [
    'FECHA','MES','AÑO','EMPRESA','NOMBRE','RUBRO',
    'PRODUCTO COTIZADO','MEDIDAS','M2','TIPO SOLICITUD',
    'MAIL','TELÉFONO','CONTACTO','N° DE COTIZACION',
    '% CIERRE','MONTO','FECHA SEGUIMIENTO',
    'FECHA PROXIMO SEGUIMIENTO','COMENTARIOS SEGUIMIENTO',
    '','FOLLOW','ESTADO','MENSAJE'
  ];
  const rows = records.map(r => [
    r.fecha||'', r.mes||'', r.anio||'',
    r.empresa||'', r.nombre||'', r.rubro||'',
    r.producto||'', r.medidas||'', r.m2||'',
    r.tipo||'', r.mail||'', r.telefono||'',
    r.contacto||'', r.nCot||'',
    r.pCierre!=null ? r.pCierre/100 : '',
    r.monto||'',
    r.fechaSeg||'', r.fechaProxSeg||'',
    r.comentarioSeg||'',
    '', // col T vacía
    r.observacion||'',
    r.estado||'',
    ''  // MENSAJE
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Lista desplegable en col V (estado)
  ws['!dataValidation'] = ws['!dataValidation'] || [];
  const lastRow = records.length + 1;
  ws['!dataValidation'].push({
    type: 'list',
    allowBlank: true,
    sqref: `V2:V${lastRow}`,
    formula1: `"${ESTADOS_LIST.join(',')}"`,
  });
  // Ancho de columnas
  ws['!cols'] = [
    {wch:12},{wch:6},{wch:6},{wch:30},{wch:25},{wch:15},
    {wch:20},{wch:18},{wch:8},{wch:12},
    {wch:28},{wch:14},{wch:10},{wch:14},
    {wch:10},{wch:14},{wch:14},{wch:18},{wch:30},
    {wch:4},{wch:40},{wch:18},{wch:20}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BASE ');
  XLSX.writeFile(wb, 'Base_Solicitudes_Fulltent.xlsx');
};

// ── Excel import parser ─────────────────────────────────────────────────────
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
          const m2 = r[8] ? parseFloat(String(r[8]).replace(',', '.')) : null;
          const tel = r[11] ? String(Math.round(parseFloat(r[11])) || r[11]) : '';
          const ncot = r[13] ? String(r[13]).trim() : '';
          const follow = r[20] ? String(r[20]).trim() : '';
          const comentarioSeg = r[18] ? String(r[18]).trim() : '';
          let mes = r[1] ? String(r[1]).trim().toUpperCase() : '';
          if (mes === 'SEPT') mes = 'SEP';
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
            telefono: tel, contacto: r[12] ? String(r[12]).trim() : '',
            nCot: ncot, pCierre, monto,
            fechaSeg: r[16] ? String(r[16]).trim() : '',
            fechaProxSeg: r[17] ? String(r[17]).trim() : '',
            comentarioSeg,
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
