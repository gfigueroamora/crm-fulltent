export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmtUF  = v => v ? `UF ${Number(v).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}` : '—';
export const fmtCLP = v => v ? '$' + Math.round(v).toLocaleString('es-CL') : '—';
export const fmtM2  = v => v ? Number(v).toLocaleString('es-CL') + ' m²' : '—';
export const fmtPct = v => v != null ? v.toFixed(1) + '%' : '—';
export const fmtDate = r => {
  if (!r.dia && !r.mes) return '—';
  const d = r.dia ? String(r.dia).padStart(2,'0') : '??';
  return `${d}/${r.mes||'?'}/${r.anio||'??'}`;
};
export const calcMargen = (precio, costo) => {
  if (!precio || !costo || precio <= 0) return null;
  return Math.round((precio - costo) / precio * 100 * 10) / 10;
};

export const normEstadoCarpas = s => {
  if (!s) return 'NUEVA SOLICITUD';
  const m = {
    'NUEVA SOLICITUD':'NUEVA SOLICITUD','POR COTIZAR':'POR COTIZAR',
    'COTIZADO':'COTIZADO','1° SEGUIMIENTO':'1° SEGUIMIENTO',
    '2° SEGUIMIENTO':'2° SEGUIMIENTO','ESPERANDO OC':'ESPERANDO OC',
    'GANADO':'GANADO','PERDIDO':'PERDIDO','NO SE COTIZA':'NO SE COTIZA',
    'EVALUACIÓN GENERAL':'NUEVA SOLICITUD','EVALUACION GENERAL':'NUEVA SOLICITUD',
    'NEGOCIACIÓN':'2° SEGUIMIENTO','NEGOCIACION':'2° SEGUIMIENTO',
    'STAND BY':'ESPERANDO OC','RECOTIZAR':'POR COTIZAR',
    'RECIEN COTIZADO':'COTIZADO','RECIÉN COTIZADO':'COTIZADO',
    'COMPARATIVO DE OFERTAS':'2° SEGUIMIENTO',
  };
  return m[s.trim().toUpperCase()] || 'NUEVA SOLICITUD';
};

export const normRubroCarpas = s => {
  if (!s) return 'Sin clasificar';
  const r = s.trim().toUpperCase();
  const m = {
    'INDUSTRIA':'Industrial','CONSTRUCCIÓN':'Construcción','CONSTRUCCION':'Construcción',
    'SERVICIOS':'Servicios','SERVICIO':'Servicios','AGROINDUSTRIA':'Agroindustria',
    'AGRÍCOLA':'Agrícola','AGRICOLA':'Agrícola','MINERIA':'Minería','MINERÍA':'Minería',
    'PARTICULAR':'Particular','TRANSPORTE':'Transporte','TRANSPORTES':'Transporte',
    'COMERCIAL':'Comercial','DEPORTIVO':'Deportivo','EDUCACION':'Educación',
    'EDUCACIÓN':'Educación','SALUD':'Salud','RETAIL':'Retail','EVENTOS':'Eventos',
    'LOGISTICA':'Logística','LOGÍSTICA':'Logística','ALIMENTACION':'Alimentación',
    'ALIMENTACIÓN':'Alimentación','DEFENSA':'Defensa','FORESTAL':'Forestal',
    'INMOBILIARIA':'Inmobiliaria','PUERTOS':'Puertos','ENERGÍA':'Energía',
    'ENERGIA':'Energía','MUNICIPAL':'Municipal','GOBIERNO':'Gobierno',
  };
  return m[r] || s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase();
};

export const normTipoCarpas = s => {
  if (!s) return 'VENTA';
  const m = {'VENTA':'VENTA','COMPRA':'VENTA','ARRIENDO':'ARRIENDO',
    'EVALUA AMBAS':'EVALUA AMBAS','MONTAJE':'MONTAJE','-':'VENTA'};
  return m[s.trim().toUpperCase()] || 'VENTA';
};

export const parseExcelCarpas = (file, onDone, onError) => {
  import('xlsx').then(XLSX => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array', cellDates:true });
        const ws = wb.Sheets['BASE'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });
        const dataRows = rows.slice(1).filter(r => r[0] && String(r[0]).trim());
        const records = dataRows.map((r,i) => {
          const fechaRaw = r[1];
          let fecha='', dia=null, anio=null;
          if (fechaRaw instanceof Date) {
            fecha = fechaRaw.toISOString().slice(0,10);
            dia = fechaRaw.getDate(); anio = fechaRaw.getFullYear();
          }
          const sf = v => { if(v==null)return null; if(typeof v==='number')return v; try{return parseFloat(String(v).replace(',','.'))}catch{return null}};
          const pRaw = r[18];
          const pCierre = pRaw!=null ? Math.round(parseFloat(pRaw)*100) : null;
          const tel = r[14] ? String(Math.round(parseFloat(r[14]))||r[14]) : '';
          const ncot = r[16] ? String(r[16]).trim() : '';
          const precio = sf(r[25]);
          const costo = sf(r[26]);
          const margen = precio&&costo&&precio>0 ? Math.round((precio-costo)/precio*100*10)/10 : null;
          let mes = r[2] ? String(r[2]).trim().toUpperCase() : '';
          if (mes==='SEPT') mes='SEP';
          return {
            id:`xl${i+1}`, num: r[0]?parseInt(r[0]):i+1,
            fecha, dia, mes,
            anio: r[3]?parseInt(r[3]):anio,
            empresa: String(r[4]).trim(),
            nombre: r[5]?String(r[5]).trim():'',
            rubro: normRubroCarpas(r[6]),
            producto: r[8]?String(r[8]).trim():'CARPA C/ESTRUCTURA',
            medidas: r[9]?String(r[9]).trim():'',
            m2: sf(r[10]), cantidad: sf(r[12]),
            tipo: normTipoCarpas(r[11]),
            mail: r[13]?String(r[13]).trim().replace(/\xa0/g,''):'',
            telefono: tel, contacto: r[15]?String(r[15]).trim():'',
            nCot: ncot, uf: sf(r[17]), pCierre,
            estado: normEstadoCarpas(r[19]),
            fechaSeg: r[20]?String(r[20]).trim():'',
            proxSeg: r[21]?String(r[21]).trim():'',
            comentarios: r[22]?String(r[22]).trim():'',
            motivo: r[23]?String(r[23]).trim():'',
            precioCLP: precio, costoCLP: costo, margen,
          };
        });
        onDone(records);
      } catch(e){ onError(e); }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const exportXLSXCarpas = async records => {
  const XLSX = await import('xlsx');
  const ESTADOS = ['NUEVA SOLICITUD','POR COTIZAR','COTIZADO','1° SEGUIMIENTO',
    '2° SEGUIMIENTO','ESPERANDO OC','GANADO','PERDIDO','NO SE COTIZA'];
  const MOTIVOS = ['SIN RESPUESTA','NO EJECUTA','FUERA DE PRESUPUESTO',
    'DIFERENTE MEDIDA - ARRIENDO','PRECIO - OTRA EMPRESA','PROYECTO NO VIABLE',
    'PRECIO - OTRO PRODUCTO','PLAZO DE ARRIENDO','TIEMPO DE RESPUESTA'];
  const headers = ['Num','FECHA','MES','YEAR','EMPRESA','NOMBRE','RUBRO','CLASIFICACIÓN',
    'PRODUCTO COTIZADO','MEDIDAS','M2','TIPO SOLICITUD','CANTIDAD','MAIL','TELÉFONO',
    'CONTACTO','N° DE COTIZACION','UF','% CIERRE','ESTADO','FECHA SEGUIMIENTO',
    'PROX. SEGUIMIENTO','COMENTARIOS','MOTIVO','MENSAJE','PRECIO CLP','COSTO CLP','MARGEN %'];
  const rows = records.map((r,i) => [
    r.num||i+1, r.fecha||'', r.mes||'', r.anio||'',
    r.empresa||'', r.nombre||'', r.rubro||'', '',
    r.producto||'', r.medidas||'', r.m2||'', r.tipo||'',
    r.cantidad||'', r.mail||'', r.telefono||'', r.contacto||'',
    r.nCot||'', r.uf||'',
    r.pCierre!=null ? r.pCierre/100 : '',
    r.estado||'', r.fechaSeg||'', r.proxSeg||'',
    r.comentarios||'', r.motivo||'', '',
    r.precioCLP||'', r.costoCLP||'',
    r.margen!=null ? r.margen/100 : ''
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols'] = headers.map((_,i)=>({wch:[6,12,6,6,30,25,15,12,20,18,8,14,8,28,14,10,14,10,10,18,14,14,40,25,20,14,14,10][i]||12}));
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'BASE');
  XLSX.writeFile(wb2, 'Solicitudes_Carpas_Fulltent.xlsx');
};
