export const RESERVA_DURACIONES_MIN = [60, 90, 120];

const PRECIO_COL = {
  60: 'precio_60min',
  90: 'precio_90min',
  120: 'precio_120min',
};

export function parsePrecioDuracionField(raw) {
  if (raw === '' || raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\./g, '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function precioDuracionInputDisplay(raw) {
  const n = parsePrecioDuracionField(raw);
  return n != null ? Number(n).toLocaleString('es-AR') : '';
}

export function buildPreciosDuracionPatch(form) {
  const patch = {};
  for (const min of RESERVA_DURACIONES_MIN) {
    const col = PRECIO_COL[min];
    const val = parsePrecioDuracionField(form?.[col]);
    patch[col] = val;
  }
  const p90 = patch.precio_90min ?? parsePrecioDuracionField(form?.precio_turno);
  if (p90 != null) {
    patch.precio_turno = p90;
    patch.precio_90min = p90;
  } else if (form?.precio_turno === '' || form?.precio_turno == null) {
    patch.precio_turno = null;
  }
  const dur = parseInt(String(form?.duracion_reserva_minutos ?? ''), 10);
  patch.duracion_reserva_minutos = RESERVA_DURACIONES_MIN.includes(dur) ? dur : 90;
  return patch;
}

export function duracionesReservaDisponiblesDesdeForm(form) {
  return RESERVA_DURACIONES_MIN.filter((min) => {
    const col = PRECIO_COL[min];
    if (min === 90) {
      return parsePrecioDuracionField(form?.[col]) != null
        || parsePrecioDuracionField(form?.precio_turno) != null;
    }
    return parsePrecioDuracionField(form?.[col]) != null;
  });
}
