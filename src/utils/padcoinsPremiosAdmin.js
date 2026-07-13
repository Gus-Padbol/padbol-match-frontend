export const PREMIO_LIMITE_PERIODOS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'total', label: 'Total' },
];

export const PREMIO_IMAGEN_FALLBACK = '🎁';

export const EMPTY_PREMIO_FORM = () => ({
  nombre: '',
  descripcion: '',
  costo_padcoins: '',
  stock_total: '',
  stock_disponible: '',
  condiciones: '',
  fecha_inicio: '',
  fecha_fin: '',
  imagen_url: '',
  limite_usuario_cantidad: '',
  limite_usuario_periodo: '',
  limite_global_cantidad: '',
  limite_global_periodo: '',
  canje_validez_dias: '',
  activo: true,
});

function parseOptionalNonNegativeInt(value) {
  if (value === '' || value == null) return null;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function parseOptionalPositiveInt(value) {
  if (value === '' || value == null) return null;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function premioLimitePeriodoLabel(periodo) {
  const id = String(periodo || '').trim();
  return PREMIO_LIMITE_PERIODOS.find((row) => row.id === id)?.label || id || '—';
}

export function formatPremioLimite(cantidad, periodo) {
  const qty = cantidad != null && cantidad !== '' ? Number(cantidad) : null;
  if (qty == null || qty <= 0) return 'Sin límite';
  const per = premioLimitePeriodoLabel(periodo);
  return `${qty} / ${per}`;
}

export function parsePremiosList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.premios)) return data.premios;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function premioToForm(premio) {
  return {
    nombre: premio?.nombre || '',
    descripcion: premio?.descripcion || '',
    costo_padcoins: premio?.costo_padcoins != null ? String(premio.costo_padcoins) : '',
    stock_total: premio?.stock_total != null ? String(premio.stock_total) : '',
    stock_disponible: premio?.stock_disponible != null ? String(premio.stock_disponible) : '',
    condiciones: premio?.condiciones || '',
    fecha_inicio: premio?.fecha_inicio ? String(premio.fecha_inicio).slice(0, 10) : '',
    fecha_fin: premio?.fecha_fin ? String(premio.fecha_fin).slice(0, 10) : '',
    imagen_url: premio?.imagen_url || '',
    limite_usuario_cantidad: premio?.limite_usuario_cantidad != null
      ? String(premio.limite_usuario_cantidad)
      : '',
    limite_usuario_periodo: premio?.limite_usuario_periodo || '',
    limite_global_cantidad: premio?.limite_global_cantidad != null
      ? String(premio.limite_global_cantidad)
      : '',
    limite_global_periodo: premio?.limite_global_periodo || '',
    canje_validez_dias: premio?.canje_validez_dias != null ? String(premio.canje_validez_dias) : '',
    activo: premio?.activo !== false,
  };
}

function validateLimitePair(cantidadRaw, periodoRaw, label) {
  const hasQty = cantidadRaw !== '' && cantidadRaw != null;
  const hasPeriodo = String(periodoRaw || '').trim() !== '';
  const qty = hasQty ? parseOptionalNonNegativeInt(cantidadRaw) : null;

  if (qty === undefined) return `${label}: la cantidad debe ser un entero no negativo`;
  if (hasQty && qty > 0 && !hasPeriodo) {
    return `${label}: indicá el período cuando la cantidad es mayor a 0`;
  }
  if (hasPeriodo && (!hasQty || qty === 0)) {
    return `${label}: indicá una cantidad mayor a 0 cuando elegís período`;
  }
  if (hasPeriodo) {
    const periodo = String(periodoRaw).trim();
    if (!PREMIO_LIMITE_PERIODOS.some((row) => row.id === periodo)) {
      return `${label}: período inválido`;
    }
  }
  return null;
}

export function validatePremioForm(form) {
  if (!(form?.nombre || '').trim()) return 'El nombre es obligatorio';

  const costo = parseInt(form.costo_padcoins, 10);
  if (!Number.isFinite(costo) || costo <= 0) return 'El costo en PadCoins debe ser mayor a 0';

  const stockTotal = form.stock_total !== '' && form.stock_total != null
    ? parseOptionalNonNegativeInt(form.stock_total)
    : null;
  const stockDisp = form.stock_disponible !== '' && form.stock_disponible != null
    ? parseOptionalNonNegativeInt(form.stock_disponible)
    : null;

  if (stockTotal === undefined) return 'El stock total no puede ser negativo';
  if (stockDisp === undefined) return 'El stock disponible no puede ser negativo';
  if (stockTotal !== null && stockDisp !== null && stockDisp > stockTotal) {
    return 'El stock disponible no puede superar el stock total';
  }

  const fi = String(form.fecha_inicio || '').trim();
  const ff = String(form.fecha_fin || '').trim();
  if (fi && ff && fi > ff) return 'La vigencia: la fecha de inicio no puede ser posterior a la de fin';

  const limiteUsuarioErr = validateLimitePair(
    form.limite_usuario_cantidad,
    form.limite_usuario_periodo,
    'Límite por usuario',
  );
  if (limiteUsuarioErr) return limiteUsuarioErr;

  const limiteGlobalErr = validateLimitePair(
    form.limite_global_cantidad,
    form.limite_global_periodo,
    'Límite global',
  );
  if (limiteGlobalErr) return limiteGlobalErr;

  if (form.canje_validez_dias !== '' && form.canje_validez_dias != null) {
    const validez = parseOptionalPositiveInt(form.canje_validez_dias);
    if (validez === undefined) return 'La validez del canje debe ser un entero mayor a 0';
  }

  return null;
}

function optionalLimitPayload(cantidadRaw, periodoRaw) {
  const qty = parseOptionalNonNegativeInt(cantidadRaw);
  if (qty == null || qty <= 0) {
    return { cantidad: null, periodo: null };
  }
  const periodo = String(periodoRaw || '').trim() || null;
  return { cantidad: qty, periodo };
}

export function buildPremioPayload(form, sede_id) {
  const payload = {
    sede_id: parseInt(sede_id, 10),
    nombre: form.nombre.trim(),
    descripcion: (form.descripcion || '').trim() || null,
    costo_padcoins: parseInt(form.costo_padcoins, 10),
    condiciones: (form.condiciones || '').trim() || null,
    activo: !!form.activo,
    imagen_url: (form.imagen_url || '').trim() || null,
  };

  if (form.stock_total !== '' && form.stock_total != null) {
    payload.stock_total = parseInt(form.stock_total, 10);
  }
  if (form.stock_disponible !== '' && form.stock_disponible != null) {
    payload.stock_disponible = parseInt(form.stock_disponible, 10);
  }

  const fi = String(form.fecha_inicio || '').trim();
  const ff = String(form.fecha_fin || '').trim();
  if (fi) payload.fecha_inicio = fi;
  if (ff) payload.fecha_fin = ff;

  const limiteUsuario = optionalLimitPayload(form.limite_usuario_cantidad, form.limite_usuario_periodo);
  payload.limite_usuario_cantidad = limiteUsuario.cantidad;
  payload.limite_usuario_periodo = limiteUsuario.periodo;

  const limiteGlobal = optionalLimitPayload(form.limite_global_cantidad, form.limite_global_periodo);
  payload.limite_global_cantidad = limiteGlobal.cantidad;
  payload.limite_global_periodo = limiteGlobal.periodo;

  if (form.canje_validez_dias !== '' && form.canje_validez_dias != null) {
    const validez = parseOptionalPositiveInt(form.canje_validez_dias);
    if (validez != null) payload.canje_validez_dias = validez;
  } else {
    payload.canje_validez_dias = null;
  }

  return payload;
}
