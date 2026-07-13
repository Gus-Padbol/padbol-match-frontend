export const CANJE_ESTADOS_FILTRO = [
  { id: '', label: 'Todos' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'aprobado', label: 'Aprobado' },
  { id: 'entregado', label: 'Entregado' },
  { id: 'cancelado', label: 'Cancelado' },
  { id: 'vencido', label: 'Vencido' },
];

export const CANJE_ESTADO_BADGES = {
  pendiente: { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' },
  aprobado: { label: 'Aprobado', bg: '#dbeafe', color: '#1d4ed8' },
  entregado: { label: 'Entregado', bg: '#dcfce7', color: '#166534' },
  cancelado: { label: 'Cancelado', bg: '#f1f5f9', color: '#64748b' },
  vencido: { label: 'Vencido', bg: '#fee2e2', color: '#991b1b' },
};

export const CANJES_PAGE_SIZE = 25;

export function normalizeCanjeEstado(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'entregado' || s === 'entregada') return 'entregado';
  if (s === 'cancelado' || s === 'cancelada') return 'cancelado';
  if (s === 'aprobado' || s === 'aprobada') return 'aprobado';
  if (s === 'vencido' || s === 'vencida') return 'vencido';
  return 'pendiente';
}

export function canjeEstadoBadge(estadoRaw) {
  const key = normalizeCanjeEstado(estadoRaw);
  return CANJE_ESTADO_BADGES[key] || CANJE_ESTADO_BADGES.pendiente;
}

export function parseCanjesList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.canjes)) return data.canjes;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function parseCanjesPagination(data) {
  const pag = data?.paginacion || {};
  return {
    total: Number(data?.total ?? pag.total ?? 0),
    limit: Number(data?.limit ?? pag.limit ?? CANJES_PAGE_SIZE),
    offset: Number(data?.offset ?? pag.offset ?? 0),
    hasMore: Boolean(data?.has_more ?? pag.has_more),
  };
}

export function canjePerteneceASede(row, sedeId) {
  if (!sedeId) return false;
  const sid = String(sedeId);
  const rowSede = row?.sede_id ?? row?.premio_sede_id ?? row?.premio?.sede_id;
  if (rowSede == null || rowSede === '') return true;
  return String(rowSede) === sid;
}

export function canjeCodigoDisplay(row) {
  return String(row?.codigo ?? row?.codigo_canje ?? '').trim() || '—';
}

export function canjePremioNombre(row) {
  const nombre = row?.premio_nombre
    ?? row?.premio?.nombre
    ?? row?.nombre_premio
    ?? (typeof row?.premio === 'string' ? row.premio : null);
  return String(nombre || '—').trim() || '—';
}

export function canjePremioImagen(row) {
  return String(row?.premio_imagen_url ?? row?.premio?.imagen_url ?? row?.imagen_url ?? '').trim();
}

export function canjeJugadorDisplay(row) {
  const nombreCompleto = [row?.jugador?.nombre, row?.jugador?.apellido].filter(Boolean).join(' ').trim();
  const bits = [
    row?.jugador_nombre,
    row?.nombre_jugador,
    nombreCompleto,
    row?.usuario_nombre,
    row?.nombre,
    row?.alias,
    row?.email,
    row?.jugador_email,
    row?.usuario_email,
    row?.email_jugador,
  ].map((x) => String(x || '').trim()).filter(Boolean);
  if (bits[0]) return bits[0];
  const uid = String(row?.user_id || '').trim();
  if (uid) return `Jugador ${uid.slice(0, 8)}…`;
  return '—';
}

export function canjeCostoPadcoins(row) {
  const n = row?.monto_padcoins ?? row?.costo_padcoins ?? row?.padcoins ?? row?.premio?.costo_padcoins;
  return n != null && n !== '' ? Number(n) : null;
}

export function formatCanjeDateTime(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildCanjesQueryParams({
  sedeId,
  estado,
  limit = CANJES_PAGE_SIZE,
  offset = 0,
}) {
  const params = new URLSearchParams();
  if (sedeId) params.set('sede_id', String(sedeId));
  if (estado) params.set('estado', String(estado));
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params;
}

export function filterCanjesClient(rows, filters = {}) {
  const beneficio = String(filters.beneficioId || '').trim();
  const jugador = String(filters.jugador || '').trim().toLowerCase();
  const codigo = String(filters.codigo || '').trim().toLowerCase();
  const desde = String(filters.desde || '').trim();
  const hasta = String(filters.hasta || '').trim();

  return (rows || []).filter((row) => {
    if (beneficio && String(row?.premio_id ?? '') !== beneficio) return false;

    if (jugador) {
      const hay = [
        canjeJugadorDisplay(row),
        row?.user_id,
        row?.email,
        row?.jugador_email,
      ].map((x) => String(x || '').toLowerCase()).join(' ');
      if (!hay.includes(jugador)) return false;
    }

    if (codigo) {
      const code = canjeCodigoDisplay(row).toLowerCase();
      if (!code.includes(codigo)) return false;
    }

    if (desde || hasta) {
      const created = String(row?.created_at || '').slice(0, 10);
      if (!created) return false;
      if (desde && created < desde) return false;
      if (hasta && created > hasta) return false;
    }

    return true;
  });
}

export function canjeOperacionesFlags(row, validation = null) {
  const estado = normalizeCanjeEstado(row?.estado);
  return {
    aprobable: validation?.aprobable ?? estado === 'pendiente',
    entregable: validation?.entregable ?? (estado === 'pendiente' || estado === 'aprobado'),
    cancelable: validation?.cancelable ?? (estado === 'pendiente' || estado === 'aprobado'),
    final: validation?.final ?? ['entregado', 'cancelado', 'vencido'].includes(estado),
  };
}

export function buildCanjeHistorial(canje) {
  const items = [];
  if (canje?.created_at) {
    items.push({ key: 'created', label: 'Canje creado', at: canje.created_at });
  }
  if (canje?.aprobado_at) {
    items.push({ key: 'aprobado', label: 'Aprobado', at: canje.aprobado_at });
  }
  if (canje?.entregado_at) {
    items.push({ key: 'entregado', label: 'Entregado', at: canje.entregado_at });
  }
  if (canje?.vencido_at) {
    items.push({ key: 'vencido', label: 'Vencido', at: canje.vencido_at });
  }
  if (normalizeCanjeEstado(canje?.estado) === 'cancelado' && canje?.updated_at) {
    items.push({ key: 'cancelado', label: 'Cancelado', at: canje.updated_at });
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function resolveCanjeQrValue(canje) {
  if (!canje) return '';
  if (canje.qr_data) return String(canje.qr_data);
  if (canje.qr_payload) {
    try {
      return JSON.stringify(canje.qr_payload);
    } catch {
      return String(canje.codigo || '');
    }
  }
  return String(canje.codigo || '');
}

export function extractCodigoFromScanValue(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^PC-[0-9A-F]{12}$/i.test(text)) return text.toUpperCase();

  try {
    const decoded = JSON.parse(text);
    if (decoded?.codigo) return String(decoded.codigo).trim().toUpperCase();
    if (decoded?.type === 'padcoins_canje' && decoded?.codigo) {
      return String(decoded.codigo).trim().toUpperCase();
    }
  } catch {
    /* not JSON */
  }

  try {
    const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
    const json = JSON.parse(
      decodeURIComponent(escape(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))),
    );
    if (json?.codigo) return String(json.codigo).trim().toUpperCase();
  } catch {
    /* not base64url payload */
  }

  const match = text.match(/PC-[0-9A-F]{12}/i);
  return match ? match[0].toUpperCase() : text.toUpperCase();
}

export function isBarcodeDetectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}
