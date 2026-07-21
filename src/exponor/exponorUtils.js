export const uid = () => Math.random().toString(36).slice(2,10);

export const parseExponorExcel = (file, onDone, onError) => {
  import('xlsx').then(XLSX => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'array', cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });
        const dataRows = rows.slice(1).filter(r => r[0] && String(r[0]).trim());
        const records = dataRows.map((r,i) => {
          const g = idx => r[idx] ? String(r[idx]).trim() : '';
          return {
            id: `ex${i+1}`,
            empresa: g(0), contacto: g(1), cargo: g(2),
            correo: g(3), telefono: g(4), division: g(5),
            reunion: g(6), producto: g(7), obs: g(8),
            responsable: g(9), estado: g(10) || 'CONTACTO EXPONOR',
            canal: g(11),
            fechaSeg1: g(12), comentSeg1: g(13),
            fechaSeg2: g(14), comentSeg2: g(15),
            fechaSeg3: g(16), comentSeg3: g(17),
            cotizacion: g(18), resultado: g(19) || 'PENDIENTE',
          };
        });
        onDone(records);
      } catch(e){ onError(e); }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const exportExponorXLSX = async records => {
  const XLSX = await import('xlsx');
  const headers = [
    'EMPRESA','CONTACTO','CARGO','CORREO','TELÉFONO','DIVISIÓN',
    'TIPO REUNIÓN','PRODUCTO INTERÉS','OBS FERIA',
    'RESPONSABLE','ESTADO PIPELINE','CANAL CONTACTO',
    'FECHA SEG 1','COMENTARIO SEG 1',
    'FECHA SEG 2','COMENTARIO SEG 2',
    'FECHA SEG 3','COMENTARIO SEG 3',
    'N° COTIZACIÓN','RESULTADO FINAL'
  ];
  const rows = records.map(r => [
    r.empresa, r.contacto, r.cargo, r.correo, r.telefono, r.division,
    r.reunion, r.producto, r.obs,
    r.responsable, r.estado, r.canal,
    r.fechaSeg1, r.comentSeg1,
    r.fechaSeg2, r.comentSeg2,
    r.fechaSeg3, r.comentSeg3,
    r.cotizacion, r.resultado,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols'] = headers.map((_,i) => ({ wch:[28,22,18,32,16,14,20,22,40,14,22,18,14,36,14,36,14,36,16,20][i]||14 }));
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'EXPONOR 2025');
  XLSX.writeFile(wb2, 'CRM_Exponor_Fulltent.xlsx');
};
