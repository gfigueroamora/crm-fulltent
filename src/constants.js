export const ESTADOS = [
  'NUEVA SOLICITUD','POR COTIZAR','COTIZADO',
  '1° SEGUIMIENTO','2° SEGUIMIENTO','ESPERANDO OC',
  'GANADO','PERDIDO','NO SE COTIZA'
];

export const PIPE_STAGES = [
  'NUEVA SOLICITUD','POR COTIZAR','COTIZADO',
  '1° SEGUIMIENTO','2° SEGUIMIENTO','ESPERANDO OC',
  'GANADO','PERDIDO','NO SE COTIZA'
];
export const getMesesRange = (records) => {
  const pairs = {};
  records.forEach(r => {
    if (r.mes && r.anio) {
      const m = String(r.mes).trim().toUpperCase();
      const a = parseInt(r.anio);
      const key = `${a}-${String(MESES_ORDER.indexOf(m)).padStart(2,'0')}`;
      pairs[key] = { mes: m, anio: a };
    }
  });
  const keys = Object.keys(pairs).sort().map(k => pairs[k]);
  const labels = keys.map(k => `${k.mes} ${String(k.anio).slice(2)}`);
  return { keys, labels };
};

export const MESES_LABELS = [
  'JUN 25','JUL 25','AGO 25','SEP 25','OCT 25','NOV 25','DIC 25',
  'ENE 26','FEB 26','MAR 26','ABR 26','MAY 26','JUN 26'
];

export const RUBRO_LIST = [
  'Sin clasificar','Agroindustria','Agrupación','Alimentación','Comercial',
  'Construcción','Defensa','Deportivo','Educación','Eventos','Forestal',
  'Fundación','Industrial','Inmobiliaria','Logística','Mecánica/Taller',
  'Minería','Particular','Público','Recreativo','Retail','Salud',
  'Servicios','Telecomunicaciones','Transporte'
];

export const ESTADO_CFG = {
  'NUEVA SOLICITUD': { c:'#6366f1', bg:'#eef2ff' },
  'POR COTIZAR':     { c:'#6b7280', bg:'#f3f4f6' },
  'COTIZADO':        { c:'#0284c7', bg:'#e0f2fe' },
  '1° SEGUIMIENTO':  { c:'#ea580c', bg:'#ffedd5' },
  '2° SEGUIMIENTO':  { c:'#d97706', bg:'#fef3c7' },
  'ESPERANDO OC':    { c:'#0891b2', bg:'#cffafe' },
  'GANADO':          { c:'#16a34a', bg:'#dcfce7' },
  'PERDIDO':         { c:'#dc2626', bg:'#fee2e2' },
  'NO SE COTIZA':    { c:'#9ca3af', bg:'#f9fafb' },
};

export const PIE_COLORS = [
  '#6366f1','#6b7280','#0284c7','#ea580c','#d97706',
  '#0891b2','#16a34a','#dc2626','#9ca3af','#8b5cf6',
  '#10b981','#f97316'
];

export const FTBLUE = '#1a3a6b';
export const FTGRAY = '#4a4a4a';
