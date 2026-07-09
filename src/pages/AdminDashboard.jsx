import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { createPartido, getAuthHeaders } from '../utils/scoreboardApi';
import { useSafeTranslation } from '../i18n/tSafe';

const EMPTY_JUGADORES = () => ([
  { numero: 1, nombre: '' },
  { numero: 2, nombre: '' },
  { numero: 3, nombre: '' },
  { numero: 4, nombre: '' },
]);

const EMPTY_PREMIO_FORM = () => ({
  nombre: '',
  descripcion: '',
  costo_padcoins: '',
  stock_total: '',
  stock_disponible: '',
  condiciones: '',
  activo: true,
});

function validatePremioForm(form) {
  if (!(form.nombre || '').trim()) return 'El nombre es obligatorio';

  const costo = parseInt(form.costo_padcoins, 10);
  if (!Number.isFinite(costo) || costo <= 0) return 'El costo en PadCoins debe ser mayor a 0';

  const hasStockTotal = form.stock_total !== '' && form.stock_total != null;
  const hasStockDisp = form.stock_disponible !== '' && form.stock_disponible != null;
  const stockTotal = hasStockTotal ? parseInt(form.stock_total, 10) : null;
  const stockDisp = hasStockDisp ? parseInt(form.stock_disponible, 10) : null;

  if (stockTotal !== null && (!Number.isFinite(stockTotal) || stockTotal < 0)) {
    return 'El stock total no puede ser negativo';
  }
  if (stockDisp !== null && (!Number.isFinite(stockDisp) || stockDisp < 0)) {
    return 'El stock disponible no puede ser negativo';
  }
  if (stockTotal !== null && stockDisp !== null && stockDisp > stockTotal) {
    return 'El stock disponible no puede superar el stock total';
  }

  return null;
}

function buildPremioPayload(form, sede_id) {
  const payload = {
    sede_id: parseInt(sede_id, 10),
    nombre: form.nombre.trim(),
    descripcion: (form.descripcion || '').trim() || null,
    costo_padcoins: parseInt(form.costo_padcoins, 10),
    condiciones: (form.condiciones || '').trim() || null,
    activo: !!form.activo,
  };
  if (form.stock_total !== '' && form.stock_total != null) {
    payload.stock_total = parseInt(form.stock_total, 10);
  }
  if (form.stock_disponible !== '' && form.stock_disponible != null) {
    payload.stock_disponible = parseInt(form.stock_disponible, 10);
  }
  return payload;
}

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

// "2026-02-26" → "26 Feb 2026"
function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// "2026-04-10" → "Viernes 10 de Abril"
function formatFechaDia(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
}

// "18:00" + 90 → "18:00 - 19:30"
function horaRango(hora, duracion) {
  if (!hora) return '—';
  if (hora.includes(' - ')) return hora; // already stored as a range — return as-is
  const dur = parseInt(duracion) || 90;  // default 90 min when not stored
  const [hh, mm] = hora.split(':').map(Number);
  const mins = (mm || 0) + dur;
  const endH = String(hh + Math.floor(mins / 60)).padStart(2, '0');
  const endM = String(mins % 60).padStart(2, '0');
  return `${hora} - ${endH}:${endM}`;
}

// Returns a JSX status badge for a reserva
function EstadoBadge({ reserva }) {
  if (reserva.estado === 'cancelada' || reserva.cancelada) {
    return <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>❌ Cancelada</span>;
  }
  if (reserva.estado === 'reservada') {
    return <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>📋 Reservada</span>;
  }
  if (reserva.estado === 'completada' || !esFutura(reserva)) {
    return <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>✅ Completada</span>;
  }
  return <span style={{ background: '#ede9fe', color: '#3b2f6e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>🟢 Confirmada</span>;
}

// Returns true if the reserva's fecha+hora is in the future.
// Both sides are built as Argentina wall-clock Dates (no offset arithmetic), so the
// comparison is correct regardless of the browser's local timezone.
function esFutura(reserva) {
  if (!reserva.fecha) return false;
  // hora may be stored as "18:00" or "18:00 - 19:30" — use start time only
  const startHora = (reserva.hora || '23:59').split(' - ')[0].trim();
  const timePart = /^\d{1,2}:\d{2}/.test(startHora) ? startHora.substring(0, 5) : '23:59';
  // Current moment expressed as an Argentina wall-clock Date (parsed as local, no tz offset)
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  // Reservation datetime expressed the same way — use the date-only part of fecha to avoid
  // any embedded time/timezone that could be on the raw DB value
  const fechaSolo = reserva.fecha.substring(0, 10); // "YYYY-MM-DD"
  const reservaDate = new Date(`${fechaSolo} ${timePart}`);
  return reservaDate > ahora;
}

// Build a lookup: country name (lowercase) → flag emoji
const FLAG_MAP = {};
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach(p => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});

function sedeFlag(sede) {
  if (!sede?.pais) return '';
  const pais = sede.pais.trim();
  // Already starts with a flag emoji (multi-char emoji code point)
  if ([...pais][0]?.match(/\p{Emoji_Presentation}/u)) return [...pais][0];
  // Plain country name — look it up
  return FLAG_MAP[pais.toLowerCase()] || '';
}

const SETUP_CHECKLIST_DEFS = [
  { key: 'admin_sede_configurado', label: 'Administrador de sede asignado' },
  { key: 'padcoins_activado', label: 'PadCoins activado en la sede' },
  { key: 'padcoins_default_5_configurado', label: 'Fidelización 5% configurada' },
  { key: 'beneficios_iniciales_configurados', label: 'Beneficios iniciales configurados' },
  { key: 'campanas_habilitadas', label: 'Campañas habilitadas' },
  { key: 'reserva_visible_para_jugador', label: 'Reserva visible para jugador' },
];

function setupChecklistDetailForKey(key, ok, meta) {
  if (key === 'padcoins_default_5_configurado') {
    return ok
      ? 'Fidelización al 5% (punto de partida recomendado)'
      : `Porcentaje efectivo: ${meta?.effective_porcentaje_devolucion_reserva ?? '—'}%`;
  }
  if (key === 'beneficios_iniciales_configurados') {
    return ok
      ? `${meta?.premios_count ?? 0} beneficio(s) cargado(s)`
      : 'Sin beneficios canjeables en la sede';
  }
  if (key === 'reserva_visible_para_jugador') {
    return ok
      ? `${meta?.canchas_count ?? 0} cancha(s) disponible(s)`
      : 'Falta perfil de sede o canchas para reservar';
  }
  if (key === 'campanas_habilitadas') {
    return ok
      ? 'PadCoins activo — la sede puede operar campañas'
      : 'Activar PadCoins antes de campañas';
  }
  return ok ? 'Completo' : 'Pendiente';
}

function buildSetupChecklistFromLive(live, meta) {
  const checklist = SETUP_CHECKLIST_DEFS.map(({ key, label }) => {
    const ok = live?.[key] === true;
    return {
      key,
      label,
      status: ok ? 'ok' : 'missing',
      detail: setupChecklistDetailForKey(key, ok, meta),
    };
  });
  const allOk = checklist.every((item) => item.status === 'ok');
  return {
    checklist,
    checklist_completo: allOk || live?.checklist_completo === true,
  };
}

function parseSetupStatusResponse(data) {
  const live = data?.live || {};
  const meta = data?.meta || {};
  const built = buildSetupChecklistFromLive(live, meta);
  const phase2 = mergeSetupPhase2Fields(data, built);
  return {
    sede_id: data?.sede_id,
    checklist: phase2.checklist,
    checklist_completo: phase2.checklist_completo,
    readiness_level: phase2.readiness_level,
    sections: phase2.sections,
    meta,
    next_actions: phase2.next_actions,
    status: data?.status,
  };
}

function parseSetupValidateResponse(data) {
  const built = Array.isArray(data?.checklist) && data.checklist.length > 0
    ? { checklist: data.checklist, checklist_completo: data?.checklist_completo === true }
    : null;
  const phase2 = mergeSetupPhase2Fields(data, built);
  return {
    ok: data?.ok === true,
    checklist: phase2.checklist,
    checklist_completo: phase2.checklist_completo,
    readiness_level: phase2.readiness_level,
    sections: phase2.sections,
    missing: Array.isArray(data?.missing) ? data.missing : [],
    next_actions: phase2.next_actions,
  };
}

function parseSetupInitResponse(data) {
  const summary = data?.summary || {};
  return {
    created: Array.isArray(summary.created) ? summary.created : [],
    already_existed: Array.isArray(summary.already_existed) ? summary.already_existed : [],
    updated: Array.isArray(summary.updated) ? summary.updated : [],
    skipped: Array.isArray(summary.skipped) ? summary.skipped : [],
    missing: Array.isArray(summary.missing) ? summary.missing : [],
    padcoins: data?.padcoins || null,
    validation: data?.validation || null,
  };
}

const SETUP_READINESS_CONFIG = {
  incomplete: {
    label: 'Incompleta',
    help: 'Faltan datos mínimos o canchas.',
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '#fecaca',
  },
  basic: {
    label: 'Básica',
    help: 'La sede tiene base inicial, pero todavía no está lista para operar reservas completas.',
    bg: '#fef3c7',
    color: '#92400e',
    border: '#fde68a',
  },
  operational: {
    label: 'Operativa',
    help: 'La sede puede operar reservas.',
    bg: '#dbeafe',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
  ready: {
    label: 'Lista',
    help: 'La sede tiene reservas, PadCoins, beneficios, campañas y pagos preparados.',
    bg: '#dcfce7',
    color: '#166534',
    border: '#bbf7d0',
  },
};

const SETUP_SECTION_LABELS = {
  identidad_sede: 'Identidad de sede',
  administracion: 'Administración',
  reservas: 'Reservas',
  padcoins: 'PadCoins',
  beneficios: 'Beneficios',
  campanas: 'Campañas',
  pagos: 'Pagos',
  reglas_operativas: 'Reglas operativas',
};

const SETUP_SECTION_ORDER = [
  'identidad_sede',
  'administracion',
  'reservas',
  'padcoins',
  'beneficios',
  'campanas',
  'pagos',
  'reglas_operativas',
];

const SETUP_LOYALTY_QUALITY_CONFIG = {
  none: { label: 'Sin beneficios', bg: '#f1f5f9', color: '#64748b' },
  poor: { label: 'Floja', bg: '#fef2f2', color: '#b91c1c' },
  partial: { label: 'Parcial', bg: '#fef3c7', color: '#92400e' },
  good: { label: 'Buena', bg: '#dcfce7', color: '#166534' },
};

const SETUP_LOYALTY_GOAL_LABELS = {
  retorno_post_partido: 'retorno post partido',
  frecuencia: 'frecuencia',
  participacion: 'participación',
  vinculo: 'vínculo',
  vinculo_sede: 'vínculo con la sede',
};

function setupLoyaltyGoalLabel(goal) {
  const key = String(goal || '').trim();
  if (!key) return '—';
  return SETUP_LOYALTY_GOAL_LABELS[key] || key.replace(/_/g, ' ');
}

function setupWarningText(warning) {
  const message = String(warning?.message || '').trim();
  if (message) return message;
  const code = String(warning?.code || '').trim();
  if (code === 'costo_padcoins_alto') return 'Un beneficio tiene un costo en PadCoins demasiado alto.';
  if (code) return `Alerta: ${code.replace(/_/g, ' ')}`;
  if (warning?.premio_id != null && warning?.premio_id !== '') {
    return `Revisar beneficio #${warning.premio_id}`;
  }
  return 'Revisar configuración del beneficio.';
}

function parseSetupBenefitsEvaluation(value) {
  const summary = value?.evaluation_summary;
  return {
    detail: String(value?.detail || '').trim(),
    recommendations: Array.isArray(value?.recommendations) ? value.recommendations : [],
    warnings: Array.isArray(value?.warnings) ? value.warnings : [],
    loyalty_quality: value?.loyalty_quality || null,
    evaluation_summary: summary && typeof summary === 'object' ? summary : null,
  };
}

function setupPadcoinsRangeText(range) {
  if (!range || typeof range !== 'object') return null;
  const min = range.min;
  const max = range.max;
  if (min != null && max != null) return `${min} a ${max} PadCoins`;
  if (min != null) return `desde ${min} PadCoins`;
  if (max != null) return `hasta ${max} PadCoins`;
  return null;
}

const SETUP_REACHABILITY_LABELS = {
  muy_facil: 'Muy fácil',
  buena: 'Buena',
  aspiracional: 'Aspiracional',
  demasiado_lejano: 'Demasiado lejano',
};

const SETUP_REACHABILITY_STYLES = {
  muy_facil: { bg: '#fef3c7', color: '#92400e' },
  buena: { bg: '#dcfce7', color: '#166534' },
  aspiracional: { bg: '#dbeafe', color: '#1d4ed8' },
  demasiado_lejano: { bg: '#fef2f2', color: '#b91c1c' },
};

function setupReachabilityLabel(zone) {
  const key = String(zone || '').trim().toLowerCase();
  if (!key) return '—';
  return SETUP_REACHABILITY_LABELS[key] || key.replace(/_/g, ' ');
}

function setupReachabilityStyle(zone) {
  const key = String(zone || '').trim().toLowerCase();
  return SETUP_REACHABILITY_STYLES[key] || { bg: '#f1f5f9', color: '#64748b' };
}

function setupConversionRateText(rate) {
  if (!rate) return '100 PadCoins = 1 unidad interna';
  if (typeof rate === 'object') {
    const padcoins = rate.padcoins ?? rate.from ?? rate.padcoins_per_unit ?? 100;
    const units = rate.units ?? rate.to ?? rate.internal_units ?? 1;
    const unitLabel = units === 1 ? 'unidad interna' : 'unidades internas';
    return `${padcoins} PadCoins = ${units} ${unitLabel}`;
  }
  return '100 PadCoins = 1 unidad interna';
}

function setupPolicyWarningText(warning) {
  const message = String(warning?.message || warning?.text || '').trim();
  if (message) return message;
  const code = String(warning?.code || '').trim();
  if (code) return `Alerta de política: ${code.replace(/_/g, ' ')}`;
  return setupHumanText(warning);
}

function normalizeCalculatorExample(row, idx) {
  const reachability = row?.reachability
    || row?.reachability_zone
    || row?.alcanceabilidad
    || row?.zone
    || row?.reachability?.zone;
  return {
    key: row?.key || row?.id || row?.premio_id || `calc-${idx}`,
    benefit: String(row?.beneficio || row?.benefit || row?.name || row?.benefit_name || '').trim() || '—',
    referenceValue: row?.valor_referencia ?? row?.reference_value ?? row?.valor ?? '—',
    padcoinsRequired: row?.padcoins_requeridos ?? row?.padcoins_required ?? row?.required_padcoins ?? row?.costo_padcoins ?? '—',
    padcoinsPerReservation: row?.padcoins_estimados_por_reserva ?? row?.estimated_padcoins_per_reservation ?? row?.padcoins_por_reserva ?? '—',
    approximateReservations: row?.reservas_aproximadas ?? row?.approximate_reservations ?? row?.reservas ?? '—',
    reachability,
    reachabilityLabel: setupReachabilityLabel(reachability),
    reservationMetrics: row?.reservation_metrics || null,
  };
}

function parseSetupPadcoinsPolicy(value) {
  if (!value || typeof value !== 'object') return null;
  const examples = Array.isArray(value?.calculator_examples) ? value.calculator_examples : [];
  const warnings = Array.isArray(value?.loyalty_policy_warnings) ? value.loyalty_policy_warnings : [];
  const nextActions = Array.isArray(value?.loyalty_policy_next_actions) ? value.loyalty_policy_next_actions : [];
  const hasPolicy = value?.minimum_loyalty_percentage != null
    || value?.current_loyalty_percentage != null
    || value?.conversion_rate != null
    || examples.length > 0
    || warnings.length > 0
    || nextActions.length > 0;
  if (!hasPolicy) return null;
  return {
    minimum_loyalty_percentage: value?.minimum_loyalty_percentage ?? 5,
    current_loyalty_percentage: value?.current_loyalty_percentage ?? null,
    conversion_rate: value?.conversion_rate ?? null,
    calculator_examples: examples.map(normalizeCalculatorExample),
    loyalty_policy_warnings: warnings,
    loyalty_policy_next_actions: nextActions,
  };
}

function setupHumanText(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(
    entry.label
    || entry.message
    || entry.text
    || entry.title
    || entry.description
    || entry.detail
    || entry.name
    || '',
  ).trim();
}

function setupStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (['ok', 'complete', 'completo', 'completed', 'done', 'ready'].includes(s)) return 'Completo';
  if (['partial', 'parcial', 'in_progress', 'in-progress'].includes(s)) return 'Parcial';
  if (['future', 'futuro', 'planned', 'later'].includes(s)) return 'Futuro';
  if (['missing', 'pending', 'pendiente', 'incomplete'].includes(s)) return 'Pendiente';
  return 'Pendiente';
}

function setupStatusStyle(statusLabel) {
  switch (statusLabel) {
    case 'Completo':
      return { bg: '#dcfce7', color: '#166534' };
    case 'Parcial':
      return { bg: '#dbeafe', color: '#1d4ed8' };
    case 'Futuro':
      return { bg: '#f1f5f9', color: '#64748b' };
    default:
      return { bg: '#fef3c7', color: '#92400e' };
  }
}

function parseSetupSections(raw) {
  if (!raw) return [];

  const toSection = (key, value) => {
    const sectionKey = String(key || value?.key || value?.id || '').trim();
    const itemsRaw = value?.items || value?.checklist || value?.checks || [];
    const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map((item, idx) => {
      const label = setupHumanText(item);
      const detail = String(item?.detail || item?.description || item?.message || '').trim();
      return {
        key: item?.key || item?.id || `${sectionKey}-${idx}`,
        label: label || detail,
        detail: label && detail && detail !== label ? detail : '',
        status: item?.status,
        statusLabel: setupStatusLabel(item?.status),
      };
    }).filter((item) => item.label || item.detail);

    const sectionLabel = value?.label || value?.title || SETUP_SECTION_LABELS[sectionKey] || '';
    const benefitsEvaluation = sectionKey === 'beneficios' ? parseSetupBenefitsEvaluation(value) : null;
    const padcoinsPolicy = (sectionKey === 'padcoins' || sectionKey === 'beneficios')
      ? parseSetupPadcoinsPolicy(value)
      : null;
    return {
      key: sectionKey,
      label: sectionLabel || (sectionKey ? sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''),
      status: value?.status,
      statusLabel: setupStatusLabel(value?.status),
      detail: String(value?.detail || '').trim(),
      items,
      benefitsEvaluation,
      padcoinsPolicy,
    };
  };

  if (Array.isArray(raw)) {
    return raw.map((section, idx) => toSection(section?.key || section?.id || idx, section));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => toSection(key, value));
  }
  return [];
}

function sortSetupSections(sections) {
  const order = new Map(SETUP_SECTION_ORDER.map((key, index) => [key, index]));
  return [...sections].sort((a, b) => {
    const aIndex = order.has(a.key) ? order.get(a.key) : 999;
    const bIndex = order.has(b.key) ? order.get(b.key) : 999;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return (a.label || '').localeCompare(b.label || '');
  });
}

function mergeSetupPhase2Fields(data, builtChecklist) {
  const readinessLevel = data?.readiness_level || data?.readinessLevel || null;
  const sections = sortSetupSections(parseSetupSections(data?.sections));
  const nextActions = Array.isArray(data?.next_actions) ? data.next_actions : [];
  const checklist = Array.isArray(data?.checklist) && data.checklist.length > 0
    ? data.checklist
    : (builtChecklist?.checklist || []);
  const checklistCompleto = data?.checklist_completo === true
    || builtChecklist?.checklist_completo === true
    || readinessLevel === 'ready';

  return {
    readiness_level: readinessLevel,
    sections,
    next_actions: nextActions,
    checklist,
    checklist_completo: checklistCompleto,
  };
}

export default function AdminDashboard({
  handleLogout = () => {},
  apiBaseUrl = 'https://padbol-backend.onrender.com',
  rol = null,
  sedeId = null,
}) {
  const { t } = useSafeTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentEmail = (JSON.parse(localStorage.getItem('currentCliente') || '{}')?.email || '').trim().toLowerCase();

  // Legacy email-based flags (kept for backward compatibility while roles roll out)
  const isSuperAdmin = rol === 'super_admin' || currentEmail === 'padbolinternacional@gmail.com';
  const isAdmin = isSuperAdmin || rol === 'admin_nacional' || rol === 'admin_club' ||
    ['admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'].includes(currentEmail);

  // Role-based access flags
  const esAdminNacional = rol === 'admin_nacional';
  const esAdminClub     = rol === 'admin_club';
  const puedeVerSetup   = isSuperAdmin || esAdminClub;
  const puedeVerConfig  = isSuperAdmin;
  const puedeCrearTorneosOficiales = isSuperAdmin || (!esAdminClub);

  const ROLE_BADGE = {
    super_admin:    '👑 Super Admin',
    admin_nacional: '🌎 Admin Nacional',
    admin_club:     '🏠 Admin Club',
  };

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [ingresos, setIngresos] = useState({ ARS: 0, USD: 0, EUR: 0 });
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || sessionStorage.getItem('adminActiveTab') || 'resumen'
  );

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  // keyed by player email: { open: bool, categoria: string, saving: bool }
  const [validacionState, setValidacionState] = useState({});

  const puedeVerScoreboard = isAdmin;
  const [sbSedeId, setSbSedeId] = useState(sedeId ? String(sedeId) : '');
  const [sbCancha, setSbCancha] = useState('');
  const [sbEquipoA, setSbEquipoA] = useState('');
  const [sbEquipoB, setSbEquipoB] = useState('');
  const [sbJugadoresA, setSbJugadoresA] = useState(EMPTY_JUGADORES);
  const [sbJugadoresB, setSbJugadoresB] = useState(EMPTY_JUGADORES);
  const [sbCreating, setSbCreating] = useState(false);
  const [sbError, setSbError] = useState('');
  const [sbCreated, setSbCreated] = useState(null);
  const [sbCopied, setSbCopied] = useState('');

  const puedeVerPadCoins = isAdmin;
  const [pcSedeId, setPcSedeId] = useState(sedeId ? String(sedeId) : '');
  const [premios, setPremios] = useState([]);
  const [premiosLoading, setPremiosLoading] = useState(false);
  const [premiosError, setPremiosError] = useState('');
  const [premioFormMode, setPremioFormMode] = useState(null);
  const [premioEditId, setPremioEditId] = useState(null);
  const [premioForm, setPremioForm] = useState(EMPTY_PREMIO_FORM);
  const [premioFormError, setPremioFormError] = useState('');
  const [premioSaving, setPremioSaving] = useState(false);

  const [setupSedeId, setSetupSedeId] = useState(sedeId ? String(sedeId) : '');
  const [setupStatus, setSetupStatus] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupActionLoading, setSetupActionLoading] = useState(false);
  const [setupInitResult, setSetupInitResult] = useState(null);
  const [setupInitError, setSetupInitError] = useState('');

  const pcNeedsSelector = isSuperAdmin || (esAdminNacional && !sedeId);
  const setupNeedsSelector = isSuperAdmin;

  function resolvePcSedeId() {
    if (esAdminClub && sedeId) return String(sedeId);
    if (pcNeedsSelector) return pcSedeId;
    return sedeId ? String(sedeId) : pcSedeId;
  }

  function resolveSetupSedeId() {
    if (esAdminClub && sedeId) return String(sedeId);
    if (setupNeedsSelector) return setupSedeId;
    return sedeId ? String(sedeId) : setupSedeId;
  }

  async function fetchSetupStatus() {
    const sid = resolveSetupSedeId();
    if (!sid) {
      setSetupStatus(null);
      setSetupError('');
      setSetupLoading(false);
      return;
    }
    setSetupLoading(true);
    setSetupError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/setup/sedes/${encodeURIComponent(sid)}/status`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar estado de setup');
      setSetupStatus(parseSetupStatusResponse(data));
    } catch (err) {
      setSetupError(err.message || 'Error al cargar estado de setup');
      setSetupStatus(null);
    } finally {
      setSetupLoading(false);
    }
  }

  async function validarSetup() {
    const sid = resolveSetupSedeId();
    if (!sid) {
      setSetupError('Seleccioná una sede para validar la configuración');
      return;
    }
    setSetupActionLoading(true);
    setSetupError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/setup/sedes/${encodeURIComponent(sid)}/validate`,
        { method: 'POST', headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al validar configuración');
      const parsed = parseSetupValidateResponse(data);
      setSetupStatus((prev) => ({
        sede_id: sid,
        checklist: parsed.checklist,
        checklist_completo: parsed.checklist_completo,
        readiness_level: parsed.readiness_level,
        sections: parsed.sections,
        meta: prev?.meta || {},
        next_actions: parsed.next_actions,
        status: parsed.ok ? 'validated' : 'incomplete',
      }));
      const readinessLabel = SETUP_READINESS_CONFIG[parsed.readiness_level]?.label;
      setMensajeExito(parsed.checklist_completo
        ? (readinessLabel ? `✅ Sede ${readinessLabel.toLowerCase()}` : '✅ Checklist de setup completo')
        : (readinessLabel ? `⚠️ Validación completada — sede ${readinessLabel.toLowerCase()}` : '⚠️ Validación completada — hay ítems pendientes'));
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err) {
      setSetupError(err.message || 'Error al validar configuración');
    } finally {
      setSetupActionLoading(false);
    }
  }

  async function inicializarPadcoinsSetup() {
    const sid = resolveSetupSedeId();
    if (!sid) {
      setSetupInitError('Seleccioná una sede para inicializar PadCoins');
      return;
    }
    const confirmMsg = 'Se aplicará la configuración inicial recomendada para esta sede: PadCoins activo, 5% de fidelización y beneficios iniciales si corresponde.';
    if (!window.confirm(confirmMsg)) return;
    setSetupActionLoading(true);
    setSetupInitError('');
    setSetupInitResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/setup/sedes/${encodeURIComponent(sid)}/initialize-padcoins`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ seed_beneficios: true }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al inicializar PadCoins');
      const parsed = parseSetupInitResponse(data);
      setSetupInitResult(parsed);
      if (data?.validation) {
        const validated = parseSetupValidateResponse(data.validation);
        setSetupStatus((prev) => ({
          sede_id: sid,
          checklist: validated.checklist,
          checklist_completo: validated.checklist_completo,
          readiness_level: validated.readiness_level,
          sections: validated.sections,
          meta: prev?.meta || {},
          next_actions: validated.next_actions,
          status: validated.checklist_completo ? 'complete' : 'incomplete',
        }));
      } else {
        await fetchSetupStatus();
      }
      setMensajeExito('✅ Inicialización de PadCoins aplicada');
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err) {
      setSetupInitError(err.message || 'Error al inicializar PadCoins');
    } finally {
      setSetupActionLoading(false);
    }
  }

  async function fetchPremios() {
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremios([]);
      return;
    }
    setPremiosLoading(true);
    setPremiosError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/premios-canjeables?sede_id=${encodeURIComponent(sid)}`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar premios');
      const list = Array.isArray(data) ? data : (data.premios || data.data || []);
      setPremios(list);
    } catch (err) {
      setPremiosError(err.message || 'Error al cargar premios');
      setPremios([]);
    } finally {
      setPremiosLoading(false);
    }
  }

  function abrirNuevoPremio() {
    setPremioForm(EMPTY_PREMIO_FORM());
    setPremioEditId(null);
    setPremioFormMode('create');
    setPremioFormError('');
  }

  function abrirEditarPremio(premio) {
    setPremioForm({
      nombre: premio.nombre || '',
      descripcion: premio.descripcion || '',
      costo_padcoins: premio.costo_padcoins != null ? String(premio.costo_padcoins) : '',
      stock_total: premio.stock_total != null ? String(premio.stock_total) : '',
      stock_disponible: premio.stock_disponible != null ? String(premio.stock_disponible) : '',
      condiciones: premio.condiciones || '',
      activo: premio.activo !== false,
    });
    setPremioEditId(premio.id);
    setPremioFormMode('edit');
    setPremioFormError('');
  }

  function cerrarPremioForm() {
    setPremioFormMode(null);
    setPremioEditId(null);
    setPremioForm(EMPTY_PREMIO_FORM());
    setPremioFormError('');
  }

  async function guardarPremio(e) {
    e.preventDefault();
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremioFormError('Seleccioná una sede para gestionar premios PadCoins');
      return;
    }
    const validationError = validatePremioForm(premioForm);
    if (validationError) {
      setPremioFormError(validationError);
      return;
    }
    setPremioSaving(true);
    setPremioFormError('');
    try {
      const headers = await getAuthHeaders();
      const payload = buildPremioPayload(premioForm, sid);
      const isEdit = premioFormMode === 'edit' && premioEditId;
      const url = isEdit
        ? `${apiBaseUrl}/api/admin/premios-canjeables/${premioEditId}`
        : `${apiBaseUrl}/api/admin/premios-canjeables`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al guardar premio');
      cerrarPremioForm();
      setMensajeExito(isEdit ? '✅ Premio actualizado' : '✅ Premio creado');
      setTimeout(() => setMensajeExito(''), 3000);
      await fetchPremios();
    } catch (err) {
      setPremioFormError(err.message || 'Error al guardar premio');
    } finally {
      setPremioSaving(false);
    }
  }

  async function desactivarPremio(premio) {
    if (!window.confirm(`¿Desactivar el premio "${premio.nombre}"? Ya no será visible para los jugadores.`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/admin/premios-canjeables/${premio.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al desactivar premio');
      setMensajeExito('✅ Premio desactivado');
      setTimeout(() => setMensajeExito(''), 3000);
      await fetchPremios();
    } catch (err) {
      alert(err.message || 'Error al desactivar premio');
    }
  }

  useEffect(() => {
    if (sedeId && !sbSedeId) setSbSedeId(String(sedeId));
  }, [sedeId, sbSedeId]);

  useEffect(() => {
    if (sedeId && !pcSedeId) setPcSedeId(String(sedeId));
  }, [sedeId, pcSedeId]);

  useEffect(() => {
    if (sedeId && !setupSedeId) setSetupSedeId(String(sedeId));
  }, [sedeId, setupSedeId]);

  useEffect(() => {
    if (activeTab !== 'setup' || !puedeVerSetup) return;
    const sid = resolveSetupSedeId();
    if (!sid) {
      setSetupStatus(null);
      setSetupError('');
      setSetupLoading(false);
      return;
    }
    fetchSetupStatus();
  }, [activeTab, setupSedeId, sedeId, apiBaseUrl, puedeVerSetup, esAdminClub, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 'padcoins') return;
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremios([]);
      setPremiosError('');
      setPremiosLoading(false);
      return;
    }
    fetchPremios();
  }, [activeTab, pcSedeId, sedeId, apiBaseUrl, esAdminClub, isSuperAdmin, esAdminNacional]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    console.log('[AdminDashboard] fetchData triggered — rol:', rol, 'sedeId:', sedeId);
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl, rol]); // rol in deps: re-fetch after role resolves from null → actual value

  const fetchPendientes = async () => {
    setPendientesLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, pais, nivel')
      .eq('pendiente_validacion', true)
      .order('nombre');
    if (!error) setPendientes(data || []);
    setPendientesLoading(false);
  };

  const aprobarJugador = async (email) => {
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const guardarCategoria = async (email) => {
    const nuevaCategoria = validacionState[email]?.categoria;
    if (!nuevaCategoria) return;
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ nivel: nuevaCategoria, pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const toggleCambiarCategoria = (email, nivelActual) => {
    setValidacionState(prev => ({
      ...prev,
      [email]: {
        open: !prev[email]?.open,
        categoria: prev[email]?.categoria || nivelActual,
        saving: false,
      },
    }));
  };

  const eliminarTorneo = async (torneoId, torneoNombre) => {
    if (!window.confirm(`¿Eliminar el torneo "${torneoNombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, { method: 'DELETE' });
      if (res.ok) {
        setTorneos(prev => prev.filter(t => t.id !== torneoId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al eliminar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const [editandoTorneoId, setEditandoTorneoId] = useState(null);
  const [editTorneoForm, setEditTorneoForm] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [torneoStats, setTorneoStats] = useState({});

  // ── Config puntos (superAdmin only) ──
  const CONFIG_NIVELES_DEFAULT       = { club_no_oficial: 10, club_oficial: 30, nacional: 100, internacional: 300, mundial: 1000 };
  const CONFIG_POSICIONES_DEFAULT    = { 1: 30, 2: 20, 3: 15, 4: 12, 5: 8, 6: 6, 7: 4, 8: 3, 9: 1, 10: 1 };
  const CONFIG_NIVELES_LABELS_DEFAULT = { club_no_oficial: 'Club No Oficial', club_oficial: 'Club Oficial', nacional: 'Nacional', internacional: 'Internacional', mundial: 'Mundial' };
  const STANDARD_KEYS = ['club_no_oficial', 'club_oficial', 'nacional', 'internacional', 'mundial'];

  // ── localStorage keys used in this component ──
  // 'config_puntos'  — superAdmin points config (niveles, posiciones, tipos_custom, niveles_labels, niveles_hidden)
  // 'currentCliente' — logged-in user object (email, nombre, etc.)
  // 'adminActiveTab' — last active tab so browser-back preserves position

  // Migrate old posiciones data: old system stored point-multipliers (pos 1 = 100).
  // New system stores percentages summing to 100 (pos 1 = 30). Detect and reset.
  const migratePositions = (posiciones) => {
    if (!posiciones || posiciones[1] !== 30) return CONFIG_POSICIONES_DEFAULT;
    return posiciones;
  };

  const loadConfigFromStorage = () => {
    try {
      const raw = localStorage.getItem('config_puntos');
      if (!raw) return { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT, tipos_custom: [] };
      const parsed = JSON.parse(raw);
      const migratedPos = migratePositions(parsed.posiciones);
      if (migratedPos !== parsed.posiciones) {
        // Write migrated value back so next load is clean
        parsed.posiciones = migratedPos;
        localStorage.setItem('config_puntos', JSON.stringify(parsed));
      }
      return parsed;
    } catch { return { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT, tipos_custom: [] }; }
  };

  const [configNiveles,      setConfigNiveles]      = useState(() => loadConfigFromStorage().niveles);
  const [configPosiciones,   setConfigPosiciones]   = useState(() => loadConfigFromStorage().posiciones);
  const [configTiposCustom,  setConfigTiposCustom]  = useState(() => loadConfigFromStorage().tipos_custom || []);
  const [configNivelesLabels,setConfigNivelesLabels]= useState(() => ({ ...CONFIG_NIVELES_LABELS_DEFAULT, ...(loadConfigFromStorage().niveles_labels || {}) }));
  const [configNivelesHidden,setConfigNivelesHidden]= useState(() => new Set(loadConfigFromStorage().niveles_hidden || []));
  const [previewNivel,       setPreviewNivel]       = useState('nacional');
  const [configSaving,       setConfigSaving]       = useState(false);
  const [configMsg,          setConfigMsg]          = useState('');
  const [nuevoTipo,          setNuevoTipo]          = useState({ nombre: '', puntos: 0 });
  const [editandoTipoId,     setEditandoTipoId]     = useState(null);
  const [editandoTipoData,   setEditandoTipoData]   = useState({ nombre: '', puntos: 0 });

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`${apiBaseUrl}/api/config/puntos`)
      .then(r => r.json())
      .then(data => {
        const posiciones = migratePositions(data.posiciones);
        if (data.niveles)        { setConfigNiveles(data.niveles); }
        if (data.posiciones)     { setConfigPosiciones(posiciones); }
        if (data.tipos_custom)   { setConfigTiposCustom(data.tipos_custom); }
        if (data.niveles_labels) { setConfigNivelesLabels(prev => ({ ...CONFIG_NIVELES_LABELS_DEFAULT, ...data.niveles_labels })); }
        if (data.niveles_hidden) { setConfigNivelesHidden(new Set(data.niveles_hidden)); }
        localStorage.setItem('config_puntos', JSON.stringify({
          niveles:        data.niveles,
          posiciones:     posiciones,
          tipos_custom:   data.tipos_custom   || [],
          niveles_labels: data.niveles_labels || {},
          niveles_hidden: data.niveles_hidden || [],
        }));
      })
      .catch(() => {});
  }, [isSuperAdmin, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarConfig = async () => {
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const body = {
        niveles:        configNiveles,
        posiciones:     configPosiciones,
        tipos_custom:   configTiposCustom,
        niveles_labels: configNivelesLabels,
        niveles_hidden: [...configNivelesHidden],
      };
      localStorage.setItem('config_puntos', JSON.stringify(body));
      const res = await fetch(`${apiBaseUrl}/api/config/puntos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setConfigMsg('✅ Configuración guardada'); }
      else        { setConfigMsg('⚠️ Guardado local OK, error en servidor'); }
    } catch {
      setConfigMsg('⚠️ Sin conexión — guardado solo en local');
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg(''), 3000);
    }
  };

  useEffect(() => {
    if (activeTab !== 'torneos' || torneos.length === 0) return;
    let cancelled = false;
    const fetchTorneoStats = async () => {
      const results = await Promise.all(
        torneos.map(async (t) => {
          try {
            const [eqRes, partRes] = await Promise.all([
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/equipos`),
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/partidos`),
            ]);
            const equipos  = eqRes.ok  ? await eqRes.json()  : [];
            const partidos = partRes.ok ? await partRes.json() : [];
            const jugados  = partidos.filter(p => p.estado === 'finalizado').length;
            // winner: equipo with highest puntos_ranking (finalizado) or puntos_totales (en_curso)
            const sorted = [...equipos].sort((a, b) =>
              t.estado === 'finalizado'
                ? (b.puntos_ranking || 0) - (a.puntos_ranking || 0)
                : (b.puntos_totales || 0) - (a.puntos_totales || 0)
            );
            return { id: t.id, equipos_count: equipos.length, partidos_jugados: jugados, total_partidos: partidos.length, winner: sorted[0] || null };
          } catch {
            return { id: t.id, equipos_count: 0, partidos_jugados: 0, total_partidos: 0, winner: null };
          }
        })
      );
      if (!cancelled) {
        const map = {};
        results.forEach(r => { map[r.id] = r; });
        setTorneoStats(map);
      }
    };
    fetchTorneoStats();
    return () => { cancelled = true; };
  }, [activeTab, torneos.length, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditTorneo = (torneo) => {
    setEditandoTorneoId(torneo.id);
    setEditTorneoForm({
      nombre:       torneo.nombre       || '',
      nivel_torneo: torneo.nivel_torneo || '',
      tipo_torneo:  torneo.tipo_torneo  || '',
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin:    torneo.fecha_fin    || '',
      sede_id:      torneo.sede_id      != null ? String(torneo.sede_id) : '',
    });
  };

  const guardarTorneo = async (torneoId) => {
    setSavingTorneo(true);
    try {
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
      };
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setTorneos(prev => prev.map(t => t.id === torneoId ? { ...t, ...body } : t));
        setEditandoTorneoId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al guardar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSavingTorneo(false);
    }
  };

  const fetchData = async () => {
    try {
      // Cargar sedes primero para poder resolver moneda por sede
      let sedesData = [];
      try {
        const sedesRes = await fetch(`${apiBaseUrl}/api/sedes`);
        if (sedesRes.ok) {
          sedesData = await sedesRes.json() || [];

          // Filter sedes by role scope
          if (esAdminClub && sedeId) {
            sedesData = sedesData.filter(s => s.id === sedeId);
          }
          // admin_nacional: filter by pais (stored in user_role_data)
          const roleData = (() => { try { return JSON.parse(localStorage.getItem('user_role_data') || '{}'); } catch { return {}; } })();
          if (esAdminNacional && roleData.pais) {
            sedesData = sedesData.filter(s => s.pais && s.pais.includes(roleData.pais.replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim()));
          }

          const map = {};
          sedesData.forEach(s => { map[s.id] = s; });
          setSedesMap(map);
        }
      } catch { /* sedes opcionales */ }

      // nombre de sede → moneda (ej: "Padbol Vienna" → "EUR")
      const sedeMonedaMap = {};
      sedesData.forEach(s => {
        if (s.nombre && s.moneda) sedeMonedaMap[s.nombre.trim().toLowerCase()] = s.moneda;
      });

      // Set of allowed sede IDs for non-super-admin filtering
      const allowedSedeIds = new Set(sedesData.map(s => s.id));

      // Cargar reservas
      const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
      let resData = await resRes.json();
      if (!Array.isArray(resData)) resData = [];

      // Filter reservas by allowed sedes (for admin_nacional and admin_club)
      if (!isSuperAdmin && sedesData.length > 0) {
        resData = resData.filter(r => r.sede_id == null || allowedSedeIds.has(r.sede_id));
      }
      setReservas(resData);

      const totales = { ARS: 0, USD: 0, EUR: 0 };
      resData.forEach(item => {
        // Priority: reserva.moneda → sede's moneda → ARS
        const moneda =
          item.moneda ||
          (item.sede ? sedeMonedaMap[item.sede.trim().toLowerCase()] : null) ||
          'ARS';
        if (moneda in totales) totales[moneda] += item.precio || 0;
        else totales.ARS += item.precio || 0;
      });
      setIngresos(totales);

      // Cargar torneos (filter by sede scope for non-super-admin)
      const tornRes = await fetch(`${apiBaseUrl}/api/torneos`);
      let tornData = await tornRes.json();
      if (!Array.isArray(tornData)) tornData = [];
      if (!isSuperAdmin && sedesData.length > 0) {
        tornData = tornData.filter(t => t.sede_id == null || allowedSedeIds.has(t.sede_id));
      }
      setTorneos(tornData);

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const iniciarEdicion = (reserva) => {
    setEditandoId(reserva.id);
    setEditFormData({ ...reserva, estado: reserva.estado || 'reservada' });
    setMensajeExito('');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFormData({});
  };

  const guardarEdicion = async (reservaId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva actualizada');
        setEditandoId(null);
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al actualizar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const cancelarReserva = async (reservaId) => {
    if (!window.confirm('¿Cancelar esta reserva?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva cancelada');
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al cancelar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Mi Sede (admin_club + admin_nacional only) ──
  const puedeVerMiSede = (esAdminClub || esAdminNacional || isSuperAdmin) && sedeId;
  const [miSede,        setMiSede]        = useState(null);
  const [miSedeLoading, setMiSedeLoading] = useState(false);
  const [miSedeForm,    setMiSedeForm]    = useState({});
  const [miSedeSaving,  setMiSedeSaving]  = useState(false);
  const [miSedeMsg,     setMiSedeMsg]     = useState('');
  const [canchas,       setCanchas]       = useState([]);
  const [nuevaCancha,   setNuevaCancha]   = useState('');
  const [licenciaForm,  setLicenciaForm]  = useState({ numero_licencia: '', fecha_licencia: '', licencia_activa: true });
  const [licenciaSaving,setLicenciaSaving]= useState(false);
  const [licenciaMsg,   setLicenciaMsg]   = useState('');
  const [sedeStatus,     setSedeStatus]     = useState(null);
  const [logoUrl,        setLogoUrl]        = useState('');
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [logoMsg,        setLogoMsg]        = useState('');
  const [fotosUrls,      setFotosUrls]      = useState([]);
  const [fotosUploading, setFotosUploading] = useState(false);
  const [fotosMsg,       setFotosMsg]       = useState('');

  useEffect(() => {
    if (activeTab !== 'mi_sede' || !sedeId) return;
    setMiSedeLoading(true);
    Promise.all([
      supabase.from('sedes').select('*').eq('id', sedeId).maybeSingle(),
      supabase.from('canchas').select('*').eq('sede_id', sedeId).order('nombre'),
    ]).then(([{ data: sedeData }, { data: canchasData }]) => {
      if (sedeData) {
        setMiSede(sedeData);
        setMiSedeForm({
          nombre:           sedeData.nombre          || '',
          direccion:        sedeData.direccion        || '',
          ciudad:           sedeData.ciudad           || '',
          pais:             sedeData.pais             || '',
          telefono:         sedeData.telefono         || '',
          email_contacto:   sedeData.email_contacto  || '',
          horario_apertura: sedeData.horario_apertura || '',
          horario_cierre:   sedeData.horario_cierre   || '',
          precio_turno:     sedeData.precio_turno     ?? '',
          precio_manana:    sedeData.precio_manana    ?? '',
          precio_tarde:     sedeData.precio_tarde     ?? '',
          moneda:           sedeData.moneda           || 'ARS',
          descripcion:      sedeData.descripcion      || '',
          mp_access_token:  sedeData.mp_access_token  || '',
          latitud:          sedeData.latitud  != null ? String(sedeData.latitud)  : '',
          longitud:         sedeData.longitud != null ? String(sedeData.longitud) : '',
          instagram:        sedeData.instagram  || '',
          facebook:         sedeData.facebook   || '',
          tiktok:           sedeData.tiktok     || '',
          twitter:          sedeData.twitter    || '',
          youtube:          sedeData.youtube    || '',
          website:          sedeData.website    || '',
        });
        setLicenciaForm({
          numero_licencia: sedeData.numero_licencia || '',
          fecha_licencia:  sedeData.fecha_licencia  || '',
          licencia_activa: sedeData.licencia_activa ?? true,
        });
        setLogoUrl(sedeData.logo_url || '');
        setFotosUrls(Array.isArray(sedeData.fotos_urls) ? sedeData.fotos_urls : []);
      }
      setCanchas(canchasData || []);
      setMiSedeLoading(false);
    }).catch(() => setMiSedeLoading(false));
  }, [activeTab, sedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sedeId || !esAdminClub) return;
    supabase.from('sedes')
      .select('numero_licencia, licencia_activa')
      .eq('id', sedeId)
      .maybeSingle()
      .then(({ data }) => { if (data) setSedeStatus(data); });
  }, [sedeId, esAdminClub]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarMiSede = async () => {
    setMiSedeSaving(true); setMiSedeMsg('');
    const { error } = await supabase.from('sedes').update({
      nombre:           miSedeForm.nombre,
      direccion:        miSedeForm.direccion        || null,
      ciudad:           miSedeForm.ciudad           || null,
      pais:             miSedeForm.pais             || null,
      telefono:         miSedeForm.telefono         || null,
      email_contacto:   miSedeForm.email_contacto  || null,
      horario_apertura: miSedeForm.horario_apertura || null,
      horario_cierre:   miSedeForm.horario_cierre   || null,
      precio_turno:     miSedeForm.precio_turno  !== '' ? parseFloat(miSedeForm.precio_turno)  : null,
      precio_manana:    miSedeForm.precio_manana  !== '' ? parseFloat(miSedeForm.precio_manana) : null,
      precio_tarde:     miSedeForm.precio_tarde   !== '' ? parseFloat(miSedeForm.precio_tarde)  : null,
      moneda:           miSedeForm.moneda           || 'ARS',
      descripcion:      miSedeForm.descripcion      || null,
      mp_access_token:  miSedeForm.mp_access_token  || null,
      latitud:          miSedeForm.latitud  !== '' ? parseFloat(miSedeForm.latitud)  : null,
      longitud:         miSedeForm.longitud !== '' ? parseFloat(miSedeForm.longitud) : null,
      instagram:        miSedeForm.instagram  || null,
      facebook:         miSedeForm.facebook   || null,
      tiktok:           miSedeForm.tiktok     || null,
      twitter:          miSedeForm.twitter    || null,
      youtube:          miSedeForm.youtube    || null,
      website:          miSedeForm.website    || null,
    }).eq('id', sedeId);
    setMiSedeSaving(false);
    setMiSedeMsg(error ? `⚠️ ${error.message}` : '✅ Sede actualizada');
    setTimeout(() => setMiSedeMsg(''), 3000);
  };

  const guardarLicencia = async () => {
    setLicenciaSaving(true); setLicenciaMsg('');
    const { error } = await supabase.from('sedes').update({
      numero_licencia: licenciaForm.numero_licencia || null,
      fecha_licencia:  licenciaForm.fecha_licencia  || null,
      licencia_activa: licenciaForm.licencia_activa,
    }).eq('id', sedeId);
    setLicenciaSaving(false);
    setLicenciaMsg(error ? `⚠️ ${error.message}` : '✅ Licencia actualizada');
    setTimeout(() => setLicenciaMsg(''), 3000);
  };

  const subirLogo = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLogoMsg('⚠️ El archivo supera los 2MB'); return; }
    setLogoUploading(true); setLogoMsg('');
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${sedeId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('sedes').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setLogoMsg(`⚠️ ${uploadError.message}`); setLogoUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('sedes').getPublicUrl(path);
    await supabase.from('sedes').update({ logo_url: publicUrl }).eq('id', sedeId);
    setLogoUrl(`${publicUrl}?t=${Date.now()}`);
    setLogoUploading(false);
    setLogoMsg('✅ Logo actualizado');
    setTimeout(() => setLogoMsg(''), 3000);
  };

  const subirFoto = async (file) => {
    if (!file) return;
    if (fotosUrls.length >= 4) { setFotosMsg('⚠️ Máximo 4 fotos permitidas'); return; }
    if (file.size > 2 * 1024 * 1024) { setFotosMsg('⚠️ El archivo supera los 2MB'); return; }
    setFotosUploading(true); setFotosMsg('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${sedeId}/fotos/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('sedes').upload(path, file, { contentType: file.type });
    if (uploadError) { setFotosMsg(`⚠️ ${uploadError.message}`); setFotosUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('sedes').getPublicUrl(path);
    const newFotos = [...fotosUrls, publicUrl];
    await supabase.from('sedes').update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
    setFotosUploading(false);
    setFotosMsg('✅ Foto agregada');
    setTimeout(() => setFotosMsg(''), 3000);
  };

  const eliminarFoto = async (url) => {
    const marker = '/public/sedes/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);
      await supabase.storage.from('sedes').remove([storagePath]);
    }
    const newFotos = fotosUrls.filter(u => u !== url);
    await supabase.from('sedes').update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
  };

  const agregarCancha = async () => {
    const nombre = nuevaCancha.trim();
    if (!nombre) return;
    const { data, error } = await supabase.from('canchas').insert({ sede_id: sedeId, nombre, estado: 'activa' }).select().single();
    if (!error && data) { setCanchas(prev => [...prev, data]); setNuevaCancha(''); }
    else if (error) alert('Error al agregar cancha: ' + error.message);
  };

  const toggleCanchaEstado = async (cancha) => {
    const nuevoEstado = cancha.estado === 'activa' ? 'inactiva' : 'activa';
    const { error } = await supabase.from('canchas').update({ estado: nuevoEstado }).eq('id', cancha.id);
    if (!error) setCanchas(prev => prev.map(c => c.id === cancha.id ? { ...c, estado: nuevoEstado } : c));
  };

  const sedesList = Object.values(sedesMap).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  const updateSbJugador = (equipo, index, nombre) => {
    const setter = equipo === 'A' ? setSbJugadoresA : setSbJugadoresB;
    setter((prev) => prev.map((j, i) => (i === index ? { ...j, nombre } : j)));
  };

  const copiarLink = async (url, key) => {
    try {
      await navigator.clipboard.writeText(url);
      setSbCopied(key);
      setTimeout(() => setSbCopied(''), 2000);
    } catch {
      window.prompt('Copiá este link:', url);
    }
  };

  const crearPartidoScoreboard = async (e) => {
    e.preventDefault();
    setSbError('');
    setSbCreated(null);

    const sede_id = parseInt(sbSedeId, 10);
    if (!Number.isFinite(sede_id) || sede_id <= 0) {
      setSbError(t('scoreboard.sedeRequired', 'Seleccioná una sede'));
      return;
    }
    if (!sbEquipoA.trim() || !sbEquipoB.trim()) {
      setSbError(t('scoreboard.teamsRequired', 'Completá los nombres de ambos equipos'));
      return;
    }

    setSbCreating(true);
    try {
      const partido = await createPartido({
        sede_id,
        cancha: sbCancha.trim() || null,
        equipo_a_nombre: sbEquipoA.trim(),
        equipo_b_nombre: sbEquipoB.trim(),
        equipo_a_jugadores: sbJugadoresA.map((j) => ({ numero: j.numero, nombre: j.nombre.trim() || `Jugador ${j.numero}` })),
        equipo_b_jugadores: sbJugadoresB.map((j) => ({ numero: j.numero, nombre: j.nombre.trim() || `Jugador ${j.numero}` })),
      });
      setSbCreated({ id: partido.id, sede_id: partido.sede_id });
      setMensajeExito(t('scoreboard.created', '✅ Partido de scoreboard creado'));
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err) {
      setSbError(err.message || t('scoreboard.createError', 'Error al crear el partido'));
    } finally {
      setSbCreating(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>;

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'torneos',      label: '🏆 Torneos' },
    { id: 'reservas',     label: '📅 Reservas' },
    { id: 'validaciones', label: '⏳ Validaciones', badge: pendientes.length },
    ...(puedeVerScoreboard ? [{ id: 'scoreboard', label: '📺 Scoreboard' }] : []),
    ...(puedeVerSetup ? [{ id: 'setup', label: '⚙️ Setup' }] : []),
    ...(puedeVerPadCoins   ? [{ id: 'padcoins',   label: '🪙 PadCoins' }] : []),
    ...(puedeVerMiSede  ? [{ id: 'mi_sede', label: '🏟️ Mi Sede' }] : []),
    ...(puedeVerConfig  ? [{ id: 'config',  label: '⚙️ Config' }]  : []),
  ];

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tvLink = sbCreated ? `${origin}/display/${sbCreated.sede_id}/scoreboard/${sbCreated.id}` : '';
  const arbiterLink = sbCreated ? `${origin}/admin/scoreboard/${sbCreated.id}` : '';

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>🏆 PADBOL MATCH - ADMIN</h1>
          {rol && ROLE_BADGE[rol] && (
            <span style={{
              padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
              background: rol === 'super_admin' ? 'rgba(250,204,21,0.25)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.2)' : 'rgba(147,197,253,0.2)',
              color: rol === 'super_admin' ? '#fde68a' : rol === 'admin_nacional' ? '#6ee7b7' : '#bfdbfe',
              border: `1px solid ${rol === 'super_admin' ? 'rgba(250,204,21,0.4)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.35)' : 'rgba(147,197,253,0.35)'}`,
              whiteSpace: 'nowrap',
            }}>
              {ROLE_BADGE[rol]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{currentEmail}</span>
          <button onClick={() => navigate('/torneos')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '5px', cursor: 'pointer' }}>
            🏆 Torneos
          </button>
          <button onClick={() => navigate('/rankings')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '5px', cursor: 'pointer' }}>
            🏅 Rankings
          </button>
          <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '5px', cursor: 'pointer' }}>
            ← Inicio
          </button>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); sessionStorage.setItem('adminActiveTab', tab.id); }}
            style={{
              position: 'relative',
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid white' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#d32f2f',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {mensajeExito && (
        <div style={{ background: '#4caf50', color: 'white', padding: '15px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center' }}>
          {mensajeExito}
        </div>
      )}

      {activeTab === 'resumen' && <>
        {esAdminClub && sedeStatus && (() => {
          const { numero_licencia, licencia_activa } = sedeStatus;
          const badge = !numero_licencia
            ? { icon: '📋', text: 'Sin licencia asignada', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' }
            : licencia_activa
              ? { icon: '✅', text: 'Licencia PADBOL Activa', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
              : { icon: '⚠️', text: 'Licencia Suspendida',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
          return (
            <div style={{ marginBottom: '20px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: badge.bg, color: badge.color,
                border: `1px solid ${badge.border}`,
              }}>
                {badge.icon} {badge.text}
                {numero_licencia && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 400, opacity: 0.75, marginLeft: '4px' }}>
                    · {numero_licencia}
                  </span>
                )}
              </span>
            </div>
          );
        })()}
        <div className="dashboard-grid">
        <div className="card ingresos">
          <h2>Ingresos Totales</h2>
          <div className="ingresos-por-moneda">
            <div className="ingreso-fila">
              <span className="ingreso-codigo">ARS</span>
              <span className="ingreso-valor">$ {ingresos.ARS.toLocaleString('es-AR')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">USD</span>
              <span className="ingreso-valor">US$ {ingresos.USD.toLocaleString('en-US')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">EUR</span>
              <span className="ingreso-valor">€ {ingresos.EUR.toLocaleString('de-DE')}</span>
            </div>
          </div>
        </div>
        <div className="card reservas">
          <h2>Total Reservas</h2>
          <p className="count">{reservas.length}</p>
        </div>
        <div className="card torneos">
          <h2>Total Torneos</h2>
          <p className="count">{torneos.length}</p>
        </div>
      </div>
      </>}

      {activeTab === 'torneos' && <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>📋 Torneos Creados</h2>
          <button
            onClick={() => navigate('/torneo/crear')}
            style={{ padding: '8px 16px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            + Nuevo Torneo
          </button>
        </div>
        {torneos.length === 0 ? (
          <p style={{ color: '#999' }}>Sin torneos</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {torneos.map(torneo => {
              const sede = sedesMap[torneo.sede_id];
              const flag = sedeFlag(sede);
              const NIVEL_COLOR = {
                nacional:        { bg: '#f3f4f6', color: '#374151' },
                club_no_oficial: { bg: '#f5f3ff', color: '#6d28d9' },
                club_oficial:    { bg: '#ede9fe', color: '#5b21b6' },
                internacional:   { bg: '#dbeafe', color: '#1e40af' },
                mundial:         { bg: '#fef3c7', color: '#92400e' },
              };
              const FORMATO_COLOR = {
                round_robin:     { bg: '#ede9fe', color: '#5b21b6' },
                knockout:        { bg: '#fee2e2', color: '#991b1b' },
                grupos_knockout: { bg: '#e0e7ff', color: '#3730a3' },
              };
              const nivelColor   = NIVEL_COLOR[torneo.nivel_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const formatoColor = FORMATO_COLOR[torneo.tipo_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const estadoBadge  = {
                planificacion: { bg: '#e5e7eb', color: '#374151', label: 'Planificación' },
                en_curso:      { bg: '#dbeafe', color: '#1d4ed8', label: 'En curso'      },
                finalizado:    { bg: '#fef3c7', color: '#92400e', label: 'Finalizado'    },
              }[torneo.estado] || { bg: '#e5e7eb', color: '#374151', label: torneo.estado };
              // Shared badge style — fixed 120px, centered
              const badge = (bg, col) => ({
                background: bg, color: col,
                borderRadius: '10px', padding: '3px 0',
                fontSize: '11px', fontWeight: '600',
                width: '120px', display: 'block',
                textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              });

              const isEditingThis = editandoTorneoId === torneo.id;
              const inp = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };

              return (
                <div key={torneo.id} style={{
                  background: 'white',
                  border: isEditingThis ? '2px solid #667eea' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}>
                  {isEditingThis ? (
                    /* ── Inline edit form ── */
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nombre</label>
                          <input style={inp} value={editTorneoForm.nombre} onChange={e => setEditTorneoForm(p => ({ ...p, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Sede</label>
                          <select style={inp} value={editTorneoForm.sede_id} onChange={e => setEditTorneoForm(p => ({ ...p, sede_id: e.target.value }))}>
                            <option value="">— Sin sede —</option>
                            {Object.values(sedesMap).map(s => (
                              <option key={s.id} value={String(s.id)}>{sedeFlag(s)} {s.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nivel</label>
                          <input style={inp} value={editTorneoForm.nivel_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, nivel_torneo: e.target.value }))} placeholder="Ej: Intermedio" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Formato</label>
                          <select style={inp} value={editTorneoForm.tipo_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, tipo_torneo: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            <option value="round_robin">Round Robin</option>
                            <option value="knockout">Knockout</option>
                            <option value="grupos_knockout">Grupos + Knockout</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha inicio</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_inicio} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha fin</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_fin} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditandoTorneoId(null)}
                          style={{ padding: '6px 14px', background: 'transparent', color: '#666', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={savingTorneo}
                          onClick={() => guardarTorneo(torneo.id)}
                          style={{ padding: '6px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: savingTorneo ? 0.6 : 1 }}
                        >
                          {savingTorneo ? 'Guardando...' : '✅ Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Compact view: CSS grid keeps columns aligned across all cards ── */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 130px auto', gap: '0 12px', alignItems: 'center' }}>

                      {/* Col 1 — name, sede, status summary */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {flag && <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.nombre}</strong>
                        </div>
                        {sede && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{sede.nombre}</div>}
                        {(() => {
                          const st = torneoStats[torneo.id];
                          if (!st) return <div style={{ fontSize: '11px', color: '#ddd', marginTop: '3px' }}>···</div>;
                          if (torneo.estado === 'planificacion') return (
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                              🔧 <strong>{st.equipos_count}</strong> equipo{st.equipos_count !== 1 ? 's' : ''} inscripto{st.equipos_count !== 1 ? 's' : ''}
                            </div>
                          );
                          if (torneo.estado === 'en_curso') return (
                            <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '3px' }}>
                              ⚔️ <strong>{st.partidos_jugados}/{st.total_partidos}</strong> partidos
                            </div>
                          );
                          if (torneo.estado === 'finalizado') return (
                            <div style={{ fontSize: '11px', color: '#92400e', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🥇 <strong>{st.winner?.nombre || '—'}</strong>
                            </div>
                          );
                          return null;
                        })()}
                      </div>

                      {/* Col 2 — nivel */}
                      <div>
                        {torneo.nivel_torneo
                          ? <span style={badge(nivelColor.bg, nivelColor.color)}>{torneo.nivel_torneo}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 3 — formato */}
                      <div>
                        {torneo.tipo_torneo
                          ? <span style={badge(formatoColor.bg, formatoColor.color)}>{torneo.tipo_torneo.replace(/_/g, ' ')}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 4 — estado */}
                      <div>
                        <span style={badge(estadoBadge.bg, estadoBadge.color)}>{estadoBadge.label}</span>
                      </div>

                      {/* Col 5 — dates (2 lines) */}
                      <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                        {torneo.fecha_inicio
                          ? <>
                              <div style={{ color: '#374151' }}>{formatFecha(torneo.fecha_inicio)}</div>
                              {torneo.fecha_fin && <div style={{ color: '#aaa' }}>→ {formatFecha(torneo.fecha_fin)}</div>}
                            </>
                          : <div style={{ color: '#ddd' }}>—</div>}
                      </div>

                      {/* Col 6 — actions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}/vista`)}
                          style={{ padding: '6px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          Ver →
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => abrirEditTorneo(torneo)}
                            style={{ padding: '6px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Editar torneo"
                          >
                            ✏️
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => eliminarTorneo(torneo.id, torneo.nombre)}
                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Eliminar torneo"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'validaciones' && <div className="section">
        <h2>⏳ Jugadores Pendientes de Validación</h2>
        {pendientesLoading ? (
          <p style={{ color: '#999' }}>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p style={{ color: '#999' }}>No hay jugadores pendientes de validación.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {pendientes.map(jugador => {
              const flag = (jugador.pais || '').split(' ')[0];
              const vs = validacionState[jugador.email] || {};
              return (
                <div key={jugador.email} style={{ background: 'white', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <strong style={{ fontSize: '15px' }}>{jugador.nombre}</strong>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>{jugador.email}</div>
                    <div style={{ marginTop: '5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {flag && <span style={{ fontSize: '18px' }}>{flag}</span>}
                      <span style={{ background: '#fffde7', border: '1px solid #ffc107', color: '#7c5b00', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 'bold' }}>
                        {jugador.nivel}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button
                      disabled={vs.saving}
                      onClick={() => aprobarJugador(jugador.email)}
                      style={{ padding: '7px 14px', background: '#43a047', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      disabled={vs.saving}
                      onClick={() => toggleCambiarCategoria(jugador.email, jugador.nivel)}
                      style={{ padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✏️ Cambiar categoría
                    </button>

                    {vs.open && (
                      <>
                        <select
                          value={vs.categoria || jugador.nivel}
                          onChange={e => setValidacionState(prev => ({ ...prev, [jugador.email]: { ...prev[jugador.email], categoria: e.target.value } }))}
                          style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '13px' }}
                        >
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          disabled={vs.saving}
                          onClick={() => guardarCategoria(jugador.email)}
                          style={{ padding: '7px 14px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                        >
                          {vs.saving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'reservas' && <div className="section">
        {(() => {
          // Upcoming ASC (soonest first), completed DESC (most recent first)
          const proximas    = reservas.filter(esFutura).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
          const completadas = reservas.filter(r => !esFutura(r)).sort((a, b) => (a.fecha + a.hora) > (b.fecha + b.hora) ? -1 : 1);
          const allRows = [...proximas, ...completadas];

          if (allRows.length === 0) return <p style={{ color: '#aaa', padding: '10px 0' }}>Sin reservas registradas.</p>;

          // Build ordered day groups preserving insertion order
          const orderedDays = [];
          const dayMap = {};
          allRows.forEach(r => {
            const k = r.fecha || 'Sin fecha';
            if (!dayMap[k]) { dayMap[k] = []; orderedDays.push(k); }
            dayMap[k].push(r);
          });

          const shortDate = (str) => {
            if (!str || str === 'Sin fecha') return str;
            const [y, m, d] = str.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            return `${DIAS[date.getDay()]} ${d} ${MESES[m - 1]}`;
          };

          const BTN = (extra) => ({
            padding: '4px 10px', border: 'none', borderRadius: '3px',
            cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', color: 'white', ...extra,
          });

          return (
            <div className="reservas-table-wrap">
            <table className="reservas-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '988px', marginTop: 0 }}>
              <colgroup>
                <col style={{ width: '52px' }} /> {/* Date label */}
                <col style={{ width: '108px' }} />{/* Sede */}
                <col style={{ width: '112px' }} />{/* Horario */}
                <col style={{ width: '80px' }} /> {/* Cancha */}
                <col style={{ width: '116px' }} />{/* Nombre */}
                <col style={{ width: '200px' }} />{/* Email */}
                <col style={{ width: '88px' }} /> {/* Precio */}
                <col style={{ width: '102px' }} />{/* Estado */}
                <col style={{ width: '130px' }} />{/* Acciones */}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: '10px 4px', fontSize: '10px', textAlign: 'center', color: '#888' }}></th>
                  <th>Sede</th>
                  <th>Horario</th>
                  <th style={{ textAlign: 'center' }}>Cancha</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orderedDays.map(dia => {
                  const rows = dayMap[dia];
                  const upcoming = esFutura(rows[0]);
                  const accentColor  = upcoming ? '#16a34a' : '#94a3b8';
                  const accentLight  = upcoming ? 'rgba(22,163,74,0.18)' : 'rgba(148,163,184,0.18)';
                  const dateBg       = upcoming ? '#f0fdf4' : 'rgba(148,163,184,0.08)';
                  const rowBg        = upcoming ? '#f0fdf4' : undefined;
                  const dateColor    = upcoming ? '#15803d' : '#64748b';
                  const dayTopBorder = `2px solid ${upcoming ? 'rgba(22,163,74,0.45)' : 'rgba(148,163,184,0.35)'}`;
                  return (
                    <React.Fragment key={dia}>
                      {rows.map((r, idx) => (
                        <tr key={r.id} style={rowBg ? { background: rowBg } : undefined}>
                          {/* Date cell: spans all rows for this day */}
                          {idx === 0 && (
                            <td rowSpan={rows.length} style={{
                              borderLeft: `4px solid ${accentColor}`,
                              borderRight: `2px solid ${accentLight}`,
                              borderTop: dayTopBorder,
                              borderBottom: `2px solid ${accentLight}`,
                              background: dateBg,
                              padding: '6px 2px',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                            }}>
                              <span style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                fontSize: '11px',
                                fontWeight: '700',
                                color: dateColor,
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}>
                                {shortDate(dia)}
                              </span>
                            </td>
                          )}
                          {editandoId === r.id ? (
                            <>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="text" value={editFormData.sede || ''} onChange={e => setEditFormData({ ...editFormData, sede: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  <input type="time" value={editFormData.hora || ''} onChange={e => setEditFormData({ ...editFormData, hora: e.target.value })} style={{ padding: '4px', flex: 1, minWidth: 0 }} />
                                  <input type="number" placeholder="min" value={editFormData.duracion || ''} onChange={e => setEditFormData({ ...editFormData, duracion: e.target.value })} style={{ padding: '4px', width: '46px' }} title="Duración en minutos" />
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="number" value={editFormData.cancha || ''} onChange={e => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="text" value={editFormData.nombre || ''} onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="number" value={editFormData.precio || ''} onChange={e => setEditFormData({ ...editFormData, precio: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <select value={editFormData.estado || 'reservada'} onChange={e => setEditFormData({ ...editFormData, estado: e.target.value })} style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '100%' }}>
                                  <option value="reservada">📋 Reservada</option>
                                  <option value="confirmada">🟢 Confirmada</option>
                                  <option value="completada">✅ Completada</option>
                                  <option value="cancelada">❌ Cancelada</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => guardarEdicion(r.id)} style={BTN({ background: '#4caf50' })}>✅ Guardar</button>
                                  <button onClick={cancelarEdicion} style={BTN({ background: '#999' })}>✕</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.sede}</td>
                              <td style={{ whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{horaRango(r.hora, r.duracion)}</td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.cancha}</td>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.nombre}</td>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.email}</td>
                              <td style={{ whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                              <td style={{ borderTop: idx === 0 ? dayTopBorder : undefined }}><EstadoBadge reserva={r} /></td>
                              <td style={{ borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => iniciarEdicion(r)} style={BTN({ background: '#667eea' })}>✏️ Editar</button>
                                  <button onClick={() => cancelarReserva(r.id)} style={BTN({ background: '#d32f2f' })}>🗑️</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          );
        })()}
      </div>}

      {activeTab === 'scoreboard' && puedeVerScoreboard && <div className="section">
        <h2 style={{ marginTop: 0 }}>📺 {t('scoreboard.sectionTitle', 'Scoreboard en vivo')}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
          {t('scoreboard.sectionDesc', 'Creá un partido y compartí los links de la pantalla TV y el panel del árbitro.')}
        </p>

        <form onSubmit={crearPartidoScoreboard} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '720px', color: '#1e293b' }}>
          <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('scoreboard.sedeLabel', 'Sede')}</span>
              <select
                value={sbSedeId}
                onChange={(e) => setSbSedeId(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              >
                <option value="">{t('scoreboard.selectSede', 'Seleccionar sede...')}</option>
                {sedesList.map((s) => (
                  <option key={s.id} value={s.id}>{sedeFlag(s)} {s.nombre}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('scoreboard.courtLabel', 'Cancha')}</span>
              <input
                type="text"
                value={sbCancha}
                onChange={(e) => setSbCancha(e.target.value)}
                placeholder={t('scoreboard.courtPlaceholder', 'Ej: Cancha 1')}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('scoreboard.teamA', 'Nombre Equipo A')}</span>
              <input
                type="text"
                value={sbEquipoA}
                onChange={(e) => setSbEquipoA(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('scoreboard.teamB', 'Nombre Equipo B')}</span>
              <input
                type="text"
                value={sbEquipoB}
                onChange={(e) => setSbEquipoB(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {['A', 'B'].map((equipo) => {
              const jugadores = equipo === 'A' ? sbJugadoresA : sbJugadoresB;
              return (
                <div key={equipo}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: '#334155' }}>
                    {t('scoreboard.playersTeam', 'Jugadores Equipo')} {equipo}
                  </h3>
                  {jugadores.map((j, idx) => (
                    <div key={j.numero} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: equipo === 'A' ? '#dbeafe' : '#fee2e2',
                        color: equipo === 'A' ? '#1d4ed8' : '#b91c1c',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px', flexShrink: 0,
                      }}
                      >
                        {j.numero}
                      </span>
                      <input
                        type="text"
                        value={j.nombre}
                        onChange={(e) => updateSbJugador(equipo, idx, e.target.value)}
                        placeholder={`${t('scoreboard.playerName', 'Nombre jugador')} ${j.numero}`}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {sbError && (
            <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '12px' }}>{sbError}</p>
          )}

          <button
            type="submit"
            disabled={sbCreating}
            style={{
              padding: '12px 24px',
              background: sbCreating ? '#94a3b8' : '#e53935',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '15px',
              cursor: sbCreating ? 'not-allowed' : 'pointer',
            }}
          >
            {sbCreating ? t('scoreboard.creating', 'Creando...') : t('scoreboard.createBtn', 'Crear partido')}
          </button>
        </form>

        {sbCreated && (
          <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', maxWidth: '720px' }}>
            <h3 style={{ margin: '0 0 14px', color: 'white' }}>{t('scoreboard.linksTitle', 'Links del partido')}</h3>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                {t('scoreboard.tvLink', 'Pantalla TV')}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={tvLink} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', wordBreak: 'break-all' }}>{tvLink}</a>
                <button
                  type="button"
                  onClick={() => copiarLink(tvLink, 'tv')}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  {sbCopied === 'tv' ? t('scoreboard.copied', '✓ Copiado') : t('scoreboard.copy', 'Copiar')}
                </button>
              </div>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                {t('scoreboard.arbiterLink', 'Panel del árbitro')}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={arbiterLink} style={{ color: '#7dd3fc', wordBreak: 'break-all' }}>{arbiterLink}</a>
                <button
                  type="button"
                  onClick={() => copiarLink(arbiterLink, 'arbiter')}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  {sbCopied === 'arbiter' ? t('scoreboard.copied', '✓ Copiado') : t('scoreboard.copy', 'Copiar')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/scoreboard/${sbCreated.id}`)}
                  style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  {t('scoreboard.openArbiter', 'Abrir panel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>}

      {activeTab === 'setup' && puedeVerSetup && (() => {
        const effectiveSetupSedeId = resolveSetupSedeId();
        const setupInp = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' };
        const sedeNombre = effectiveSetupSedeId ? sedesMap[effectiveSetupSedeId]?.nombre : null;
        const checklist = setupStatus?.checklist || [];
        const checklistCompleto = setupStatus?.checklist_completo === true;
        const nextActions = setupStatus?.next_actions || [];
        const sections = setupStatus?.sections || [];
        const readinessLevel = setupStatus?.readiness_level || null;
        const readinessConfig = SETUP_READINESS_CONFIG[readinessLevel] || null;

        const renderStatusBadge = (statusLabel) => {
          const style = setupStatusStyle(statusLabel);
          return (
            <span style={{
              background: style.bg,
              color: style.color,
              borderRadius: '12px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              {statusLabel}
            </span>
          );
        };

        const renderSetupItem = (item, isOverall = false) => {
          const ok = isOverall ? checklistCompleto : item.status === 'ok';
          return (
            <div
              key={isOverall ? 'checklist_completo' : item.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '14px 16px',
                background: 'white',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <span style={{
                flexShrink: 0,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                background: ok ? '#dcfce7' : '#fef3c7',
                color: ok ? '#166534' : '#92400e',
              }}>
                {ok ? '✓' : '…'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                    {isOverall ? 'Checklist completo' : item.label}
                  </strong>
                  <span style={{
                    background: ok ? '#dcfce7' : '#fef3c7',
                    color: ok ? '#166534' : '#92400e',
                    borderRadius: '12px',
                    padding: '2px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>
                    {ok ? 'Completo' : 'Pendiente'}
                  </span>
                </div>
                {!isOverall && item.detail ? (
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>{item.detail}</p>
                ) : null}
                {isOverall && !ok ? (
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                    Hay ítems pendientes en la configuración inicial de la sede.
                  </p>
                ) : null}
              </div>
            </div>
          );
        };

        const renderInitSummarySection = (title, items, tone) => {
          if (!items || items.length === 0) return null;
          const tones = {
            created: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
            existed: { bg: '#f8fafc', border: '#e2e8f0', color: '#475569' },
            updated: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
            skipped: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
            missing: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
          };
          const style = tones[tone] || tones.existed;
          return (
            <div style={{ marginTop: '12px' }}>
              <strong style={{ fontSize: '14px', color: style.color, display: 'block', marginBottom: '6px' }}>{title}</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '13px', lineHeight: 1.5 }}>
                {items.map((entry, idx) => {
                  const text = setupHumanText(entry);
                  return text ? <li key={`${title}-${idx}`}>{text}</li> : null;
                })}
              </ul>
            </div>
          );
        };

        const renderSetupSectionCard = (section) => {
          const isBeneficios = section.key === 'beneficios';
          const isPadcoins = section.key === 'padcoins';
          const benefitsEval = section.benefitsEvaluation;
          const policy = section.padcoinsPolicy;
          const loyaltyConfig = benefitsEval?.loyalty_quality
            ? SETUP_LOYALTY_QUALITY_CONFIG[benefitsEval.loyalty_quality]
            : null;
          const evalSummary = benefitsEval?.evaluation_summary;
          const hasPolicyCore = policy && (
            policy.minimum_loyalty_percentage != null
            || policy.current_loyalty_percentage != null
            || policy.conversion_rate != null
          );
          const hasCalculator = policy?.calculator_examples?.length > 0;
          const hasPolicyWarnings = policy?.loyalty_policy_warnings?.length > 0;
          const hasPolicyActions = policy?.loyalty_policy_next_actions?.length > 0;
          const hasPadcoinsPolicyBlock = isPadcoins && (hasPolicyCore || hasPolicyWarnings || hasPolicyActions);
          const hasBenefitsInsights = isBeneficios && benefitsEval && (
            loyaltyConfig
            || evalSummary
            || (benefitsEval.warnings?.length > 0)
            || (benefitsEval.recommendations?.length > 0)
            || benefitsEval.detail
          );
          const hasBenefitsPolicyExtras = isBeneficios && (hasCalculator || hasPolicyWarnings || hasPolicyActions || hasPolicyCore);
          const hasSectionInsights = hasBenefitsInsights || hasPadcoinsPolicyBlock || hasBenefitsPolicyExtras;

          const renderPolicyBlock = () => {
            if (!hasPolicyCore) return null;
            const minPct = policy.minimum_loyalty_percentage ?? 5;
            const currentPct = policy.current_loyalty_percentage;
            return (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}>
                <strong style={{ display: 'block', fontSize: '14px', color: '#1e3a8a', marginBottom: '10px' }}>
                  Política PadCoins
                </strong>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  marginBottom: '10px',
                }}>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'white', border: '1px solid #dbeafe' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Porcentaje mínimo</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{minPct}%</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'white', border: '1px solid #dbeafe' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Porcentaje actual de la sede</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                      {currentPct != null ? `${currentPct}%` : '—'}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'white', border: '1px solid #dbeafe' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Conversión global</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>
                      {setupConversionRateText(policy.conversion_rate)}
                    </div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.45 }}>
                  El 5% es el mínimo para que PadCoins tenga impacto real. La sede puede subirlo, pero no bajarlo.
                </p>
              </div>
            );
          };

          const renderCalculatorBlock = () => {
            if (!hasCalculator) return null;
            return (
              <div>
                <strong style={{ display: 'block', fontSize: '14px', color: '#334155', marginBottom: '8px' }}>
                  Calculadora de beneficios
                </strong>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
                  La sede carga el valor real local del beneficio. Padbol Match calcula los PadCoins necesarios y estima si el beneficio queda alcanzable para fidelizar.
                </p>
                <p style={{
                  margin: '0 0 12px',
                  fontSize: '13px',
                  color: '#475569',
                  lineHeight: 1.45,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}>
                  En esta pantalla, las reservas se usan como base de cálculo para estimar la alcanzabilidad de los beneficios. Más adelante PadCoins también podrá generarse por torneos, partidos, invitaciones, reseñas, perfil, e-shop y otras acciones.
                </p>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', background: 'white', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                        {['Beneficio', 'Valor de referencia', 'PadCoins requeridos', 'PadCoins estimados por reserva', 'Reservas aproximadas', 'Alcanzabilidad'].map((col) => (
                          <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {policy.calculator_examples.map((row) => {
                        const reachStyle = setupReachabilityStyle(row.reachability);
                        return (
                          <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 600 }}>{row.benefit}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{row.referenceValue}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{row.padcoinsRequired}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{row.padcoinsPerReservation}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{row.approximateReservations}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                background: reachStyle.bg,
                                color: reachStyle.color,
                                borderRadius: '12px',
                                padding: '2px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}>
                                {row.reachabilityLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          };

          const renderPolicyWarningsBlock = () => {
            if (!hasPolicyWarnings) return null;
            return (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
              }}>
                <strong style={{ display: 'block', fontSize: '14px', color: '#c2410c', marginBottom: '8px' }}>
                  Alertas de política PadCoins
                </strong>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#9a3412', lineHeight: 1.5 }}>
                  {policy.loyalty_policy_warnings.map((warning, idx) => {
                    const text = setupPolicyWarningText(warning);
                    return text ? <li key={`policy-warn-${idx}`}>{text}</li> : null;
                  })}
                </ul>
              </div>
            );
          };

          const renderPolicyActionsBlock = () => {
            if (!hasPolicyActions) return null;
            return (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}>
                <strong style={{ display: 'block', fontSize: '14px', color: '#334155', marginBottom: '8px' }}>
                  Acciones recomendadas
                </strong>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  {policy.loyalty_policy_next_actions.map((action, idx) => {
                    const text = setupHumanText(action);
                    return text ? <li key={`policy-action-${idx}`}>{text}</li> : null;
                  })}
                </ul>
              </div>
            );
          };

          return (
          <div
            key={section.key}
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>{section.label}</strong>
              {renderStatusBadge(section.statusLabel)}
            </div>

            {(section.detail || benefitsEval?.detail) && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                {benefitsEval?.detail || section.detail}
              </p>
            )}

            {(hasPadcoinsPolicyBlock || hasBenefitsPolicyExtras) ? (
              <div style={{ display: 'grid', gap: '14px', marginBottom: (hasBenefitsInsights || section.items.length > 0) ? '14px' : 0 }}>
                {(isPadcoins || (isBeneficios && hasPolicyCore)) ? renderPolicyBlock() : null}
                {isBeneficios ? renderCalculatorBlock() : null}
                {renderPolicyWarningsBlock()}
                {renderPolicyActionsBlock()}
              </div>
            ) : null}

            {hasBenefitsInsights ? (
              <div style={{ display: 'grid', gap: '14px', marginBottom: section.items.length > 0 ? '14px' : 0 }}>
                {loyaltyConfig ? (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: loyaltyConfig.bg,
                    border: `1px solid ${loyaltyConfig.color}22`,
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#334155' }}>Calidad de fidelización:</strong>
                      <span style={{
                        background: 'white',
                        color: loyaltyConfig.color,
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        {loyaltyConfig.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
                      La calidad de fidelización indica si los beneficios ayudan a que el jugador vuelva, participe y se vincule más con la sede.
                    </p>
                  </div>
                ) : null}

                {evalSummary ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px',
                  }}>
                    {[
                      { label: 'Beneficios cargados', value: evalSummary.count },
                      { label: 'Beneficios fuertes', value: evalSummary.strong_count },
                      { label: 'Beneficios débiles', value: evalSummary.weak_count },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
                          {stat.value != null ? stat.value : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#475569',
                  lineHeight: 1.45,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}>
                  PadCoins funciona mejor cuando los beneficios ayudan a generar frecuencia, vínculo y participación. No conviene cargar beneficios solo como productos aislados.
                </p>

                {benefitsEval.warnings?.length > 0 ? (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                  }}>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#b91c1c', marginBottom: '8px' }}>
                      Alertas de beneficios
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
                      {benefitsEval.warnings.map((warning, idx) => {
                        const text = setupWarningText(warning);
                        return text ? <li key={`warn-${idx}`}>{text}</li> : null;
                      })}
                    </ul>
                  </div>
                ) : null}

                {benefitsEval.recommendations?.length > 0 ? (
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#334155', marginBottom: '10px' }}>
                      Beneficios recomendados
                    </strong>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {benefitsEval.recommendations.map((rec, idx) => {
                        const name = String(rec?.name || '').trim();
                        const why = String(rec?.why || '').trim();
                        const rangeText = setupPadcoinsRangeText(rec?.suggested_padcoins_range);
                        const goal = setupLoyaltyGoalLabel(rec?.loyalty_goal);
                        if (!name && !why && !rangeText) return null;
                        return (
                          <div
                            key={`rec-${idx}`}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '8px',
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            {name ? (
                              <strong style={{ display: 'block', fontSize: '14px', color: '#166534', marginBottom: '6px' }}>
                                {name}
                              </strong>
                            ) : null}
                            {rec?.loyalty_goal ? (
                              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#334155' }}>
                                <strong>Objetivo:</strong> {goal}
                              </p>
                            ) : null}
                            {rangeText ? (
                              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#334155' }}>
                                <strong>Rango sugerido:</strong> {rangeText}
                              </p>
                            ) : null}
                            {why ? (
                              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
                                <strong>Por qué sirve:</strong> {why}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {section.items.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: item.detail ? '4px' : 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{item.label}</span>
                      {renderStatusBadge(item.statusLabel)}
                    </div>
                    {item.detail ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>{item.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : !hasSectionInsights ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Sin ítems detallados en esta área.</p>
            ) : null}
          </div>
          );
        };

        return (
          <div className="section">
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0 }}>⚙️ Padbol Match Setup</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 12px', maxWidth: '640px', lineHeight: 1.5 }}>
                Revisión inicial de sede, PadCoins, beneficios y campañas.
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '14px 16px',
                maxWidth: '640px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.55,
              }}>
                <p style={{ margin: '0 0 8px' }}>El Setup ayuda a confirmar si una sede está lista para recibir reservas y usar PadCoins correctamente.</p>
                <p style={{ margin: '0 0 8px' }}>El nivel Lista requiere que la sede esté operativa y que tenga PadCoins, beneficios, campañas y pagos preparados.</p>
                <p style={{ margin: '0 0 8px' }}>El 5% es el punto de partida recomendado.</p>
                <p style={{ margin: '0 0 8px' }}>La sede puede ajustar su estrategia de fidelización más adelante.</p>
                <p style={{ margin: '0 0 8px' }}>PadCoins debe usarse para generar frecuencia, vínculo y participación.</p>
                <p style={{ margin: 0 }}>La conversión interna es global y no se modifica desde la sede.</p>
              </div>
            </div>

            {setupNeedsSelector && (
              <div style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>Sede</span>
                  <select
                    value={setupSedeId}
                    onChange={(e) => {
                      setSetupSedeId(e.target.value);
                      setSetupInitResult(null);
                      setSetupInitError('');
                    }}
                    style={setupInp}
                  >
                    <option value="">Seleccionar sede...</option>
                    {sedesList.map((s) => (
                      <option key={s.id} value={s.id}>{sedeFlag(s)} {s.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {!effectiveSetupSedeId && (
              <p style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: '10px', maxWidth: '520px' }}>
                Seleccioná una sede para revisar su configuración inicial.
              </p>
            )}

            {effectiveSetupSedeId && sedeNombre && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>
                Sede: <strong style={{ color: 'white' }}>{sedeNombre}</strong>
                {setupStatus?.meta?.sede_nombre && setupStatus.meta.sede_nombre !== sedeNombre ? (
                  <span> ({setupStatus.meta.sede_nombre})</span>
                ) : null}
              </p>
            )}

            {effectiveSetupSedeId && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={validarSetup}
                  disabled={setupActionLoading || setupLoading}
                  style={{
                    padding: '10px 20px',
                    background: setupActionLoading ? '#94a3b8' : '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: setupActionLoading || setupLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {setupActionLoading ? 'Procesando...' : 'Validar configuración'}
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={inicializarPadcoinsSetup}
                    disabled={setupActionLoading || setupLoading}
                    style={{
                      padding: '10px 20px',
                      background: setupActionLoading ? '#94a3b8' : '#e53935',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: setupActionLoading || setupLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Inicializar PadCoins
                  </button>
                )}
              </div>
            )}

            {effectiveSetupSedeId && setupLoading && (
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>Cargando estado de setup...</p>
            )}

            {effectiveSetupSedeId && !setupLoading && setupError && (
              <p style={{ color: '#fecaca', fontWeight: 600, background: 'rgba(220,38,38,0.2)', padding: '12px 16px', borderRadius: '8px', maxWidth: '560px' }}>
                {setupError}
              </p>
            )}

            {effectiveSetupSedeId && !setupLoading && !setupError && readinessConfig && (
              <div style={{
                background: readinessConfig.bg,
                border: `1px solid ${readinessConfig.border}`,
                borderRadius: '12px',
                padding: '16px 18px',
                maxWidth: '720px',
                marginBottom: '24px',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '15px', color: readinessConfig.color }}>Nivel de preparación:</strong>
                  <span style={{
                    background: 'white',
                    color: readinessConfig.color,
                    borderRadius: '12px',
                    padding: '4px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}>
                    {readinessConfig.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: readinessConfig.color, lineHeight: 1.5 }}>
                  {readinessConfig.help}
                </p>
              </div>
            )}

            {effectiveSetupSedeId && !setupLoading && !setupError && checklist.length > 0 && (
              <div style={{ maxWidth: '720px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: 'rgba(255,255,255,0.95)' }}>Checklist principal</h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {checklist.map((item) => renderSetupItem(item))}
                  {renderSetupItem(null, true)}
                </div>
              </div>
            )}

            {effectiveSetupSedeId && !setupLoading && !setupError && sections.length > 0 && (
              <div style={{ maxWidth: '720px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: 'rgba(255,255,255,0.95)' }}>Detalle por áreas</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sections.map((section) => renderSetupSectionCard(section))}
                </div>
              </div>
            )}

            {effectiveSetupSedeId && !setupLoading && nextActions.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '10px',
                padding: '16px 18px',
                maxWidth: '720px',
                marginBottom: '24px',
                color: '#334155',
              }}>
                <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Próximas acciones recomendadas</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: 1.5 }}>
                  {nextActions.map((action, idx) => {
                    const text = setupHumanText(action);
                    return text ? <li key={`action-${idx}`}>{text}</li> : null;
                  })}
                </ul>
              </div>
            )}

            {setupInitError && (
              <p style={{ color: '#fecaca', fontWeight: 600, background: 'rgba(220,38,38,0.2)', padding: '12px 16px', borderRadius: '8px', maxWidth: '560px', marginBottom: '16px' }}>
                {setupInitError}
              </p>
            )}

            {setupInitResult && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '18px 20px',
                maxWidth: '720px',
                color: '#1e293b',
                marginBottom: '24px',
              }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#334155' }}>Resultado de inicialización</h3>
                {renderInitSummarySection('Creado', setupInitResult.created, 'created')}
                {renderInitSummarySection('Ya existía', setupInitResult.already_existed, 'existed')}
                {renderInitSummarySection('Actualizado', setupInitResult.updated, 'updated')}
                {renderInitSummarySection('Omitido', setupInitResult.skipped, 'skipped')}
                {renderInitSummarySection('Falta', setupInitResult.missing, 'missing')}
                {!setupInitResult.created.length
                  && !setupInitResult.already_existed.length
                  && !setupInitResult.updated.length
                  && !setupInitResult.skipped.length
                  && !setupInitResult.missing.length && (
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Sin cambios reportados por el servidor.</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'padcoins' && puedeVerPadCoins && (() => {
        const effectivePcSedeId = resolvePcSedeId();
        const pcInp = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' };
        const sedeNombre = effectivePcSedeId ? sedesMap[effectivePcSedeId]?.nombre : null;

        return (
          <div className="section">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ marginTop: 0 }}>🪙 Premios PadCoins</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, maxWidth: '560px' }}>
                  Estos premios serán visibles para los jugadores en Premios y Beneficios.
                </p>
              </div>
              {effectivePcSedeId && !premioFormMode && (
                <button
                  type="button"
                  onClick={abrirNuevoPremio}
                  style={{
                    padding: '10px 20px',
                    background: '#e53935',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Nuevo premio
                </button>
              )}
            </div>

            {pcNeedsSelector && (
              <div style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>Sede</span>
                  <select
                    value={pcSedeId}
                    onChange={(e) => { setPcSedeId(e.target.value); cerrarPremioForm(); }}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="">Seleccionar sede...</option>
                    {sedesList.map((s) => (
                      <option key={s.id} value={s.id}>{sedeFlag(s)} {s.nombre}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {!effectivePcSedeId && (
              <p style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: '10px', maxWidth: '520px' }}>
                Seleccioná una sede para gestionar premios PadCoins.
              </p>
            )}

            {effectivePcSedeId && sedeNombre && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>
                Sede: <strong style={{ color: 'white' }}>{sedeNombre}</strong>
              </p>
            )}

            {premioFormMode && effectivePcSedeId && (
              <form
                onSubmit={guardarPremio}
                style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '720px', color: '#1e293b', marginBottom: '24px' }}
              >
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', color: '#334155' }}>
                  {premioFormMode === 'edit' ? 'Editar premio' : 'Nuevo premio'}
                </h3>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Nombre *</span>
                    <input
                      type="text"
                      value={premioForm.nombre}
                      onChange={(e) => setPremioForm((p) => ({ ...p, nombre: e.target.value }))}
                      required
                      style={pcInp}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Descripción</span>
                    <textarea
                      value={premioForm.descripcion}
                      onChange={(e) => setPremioForm((p) => ({ ...p, descripcion: e.target.value }))}
                      rows={3}
                      style={{ ...pcInp, resize: 'vertical' }}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>Costo (PadCoins) *</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={premioForm.costo_padcoins}
                        onChange={(e) => setPremioForm((p) => ({ ...p, costo_padcoins: e.target.value }))}
                        required
                        style={pcInp}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>Stock total</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={premioForm.stock_total}
                        onChange={(e) => setPremioForm((p) => ({ ...p, stock_total: e.target.value }))}
                        style={pcInp}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>Stock disponible</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={premioForm.stock_disponible}
                        onChange={(e) => setPremioForm((p) => ({ ...p, stock_disponible: e.target.value }))}
                        style={pcInp}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Condiciones</span>
                    <textarea
                      value={premioForm.condiciones}
                      onChange={(e) => setPremioForm((p) => ({ ...p, condiciones: e.target.value }))}
                      rows={2}
                      placeholder="Ej: Válido de lunes a viernes"
                      style={{ ...pcInp, resize: 'vertical' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!premioForm.activo}
                      onChange={(e) => setPremioForm((p) => ({ ...p, activo: e.target.checked }))}
                    />
                    Premio activo
                  </label>
                </div>

                {premioFormError && (
                  <p style={{ color: '#dc2626', fontWeight: 600, marginTop: '14px', marginBottom: 0 }}>{premioFormError}</p>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    disabled={premioSaving}
                    style={{
                      padding: '10px 20px',
                      background: premioSaving ? '#94a3b8' : '#43a047',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: premioSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {premioSaving ? 'Guardando...' : 'Guardar premio'}
                  </button>
                  <button
                    type="button"
                    onClick={cerrarPremioForm}
                    disabled={premioSaving}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: premioSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {effectivePcSedeId && premiosLoading && (
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>Cargando premios...</p>
            )}

            {effectivePcSedeId && !premiosLoading && premiosError && (
              <p style={{ color: '#fecaca', fontWeight: 600, background: 'rgba(220,38,38,0.2)', padding: '12px 16px', borderRadius: '8px', maxWidth: '560px' }}>
                {premiosError}
              </p>
            )}

            {effectivePcSedeId && !premiosLoading && !premiosError && premios.length === 0 && !premioFormMode && (
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>No hay premios cargados para esta sede.</p>
            )}

            {effectivePcSedeId && !premiosLoading && premios.length > 0 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                {premios.map((premio) => (
                  <div
                    key={premio.id}
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      gap: '14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '16px', color: '#1e293b' }}>{premio.nombre}</strong>
                        <span style={{
                          background: premio.activo !== false ? '#dcfce7' : '#f1f5f9',
                          color: premio.activo !== false ? '#166534' : '#64748b',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          {premio.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {premio.descripcion && (
                        <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px' }}>{premio.descripcion}</p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#475569' }}>
                        <span><strong>Costo:</strong> {premio.costo_padcoins} PadCoins</span>
                        {premio.stock_total != null && (
                          <span><strong>Stock total:</strong> {premio.stock_total}</span>
                        )}
                        {premio.stock_disponible != null && (
                          <span><strong>Disponible:</strong> {premio.stock_disponible}</span>
                        )}
                      </div>
                      {premio.condiciones && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                          <strong>Condiciones:</strong> {premio.condiciones}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => abrirEditarPremio(premio)}
                        style={{
                          padding: '7px 14px',
                          background: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => desactivarPremio(premio)}
                        style={{
                          padding: '7px 14px',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'config' && puedeVerConfig && <div className="section">
        <h2>⚙️ Configuración de Puntos</h2>

        {/* Niveles de torneo + tipos custom unificados */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
            Puntos base por nivel de torneo
          </h3>
          <table style={{ width: '100%', maxWidth: '560px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <thead>
              <tr style={{ background: '#3b2f6e', color: 'white' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: '13px', fontWeight: 600 }}>Nivel</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '130px' }}>Pts totales torneo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '90px' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Standard rows — editable names and deletable */}
              {STANDARD_KEYS.filter(key => !configNivelesHidden.has(key)).map((key, i) => (
                <tr key={key} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                  {editandoTipoId === key ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: '#1e1b4b', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: '#1e1b4b' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => {
                          setConfigNivelesLabels(prev => ({ ...prev, [key]: editandoTipoData.nombre }));
                          setConfigNiveles(prev => ({ ...prev, [key]: editandoTipoData.puntos }));
                          setEditandoTipoId(null);
                        }} style={{ padding: '3px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>{configNivelesLabels[key]}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <input type="number" min="0" value={configNiveles[key] ?? 0}
                          onChange={e => setConfigNiveles(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '80px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold', color: '#3b2f6e' }} />
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>pts totales</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(key); setEditandoTipoData({ nombre: configNivelesLabels[key], puntos: configNiveles[key] ?? 0 }); }}
                          style={{ padding: '3px 8px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
                        <button onClick={() => { if (window.confirm(`¿Eliminar el nivel "${configNivelesLabels[key]}"? Se ocultará de los torneos nuevos.`)) setConfigNivelesHidden(prev => new Set([...prev, key])); }}
                          style={{ padding: '3px 8px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Custom rows — with edit/delete */}
              {configTiposCustom.length > 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: '600', color: '#7c3aed', background: '#f5f3ff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Tipos personalizados
                  </td>
                </tr>
              )}
              {configTiposCustom.map((tipo, i) => (
                <tr key={tipo.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fdf8ff' : 'white' }}>
                  {editandoTipoId === tipo.id ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: '#1e1b4b', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: '#1e1b4b' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => { setConfigTiposCustom(prev => prev.map(t => t.id === tipo.id ? { ...t, ...editandoTipoData } : t)); setEditandoTipoId(null); }}
                          style={{ padding: '3px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>{tipo.nombre}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b2f6e' }}>{tipo.puntos}</div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>pts totales</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(tipo.id); setEditandoTipoData({ nombre: tipo.nombre, puntos: tipo.puntos }); }}
                          style={{ padding: '3px 8px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
                        <button onClick={() => setConfigTiposCustom(prev => prev.filter(t => t.id !== tipo.id))}
                          style={{ padding: '3px 8px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Add row */}
              <tr style={{ background: '#f9f7ff', borderTop: '2px dashed #e9d5ff' }}>
                <td style={{ padding: '8px 12px' }}>
                  <input type="text" placeholder="Ej: FIPA Qualifier" value={nuevoTipo.nombre}
                    onChange={e => setNuevoTipo(p => ({ ...p, nombre: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && nuevoTipo.nombre.trim()) { setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); } }}
                    style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: '5px', fontSize: '13px', color: '#1e1b4b', background: 'white', boxSizing: 'border-box' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input type="number" placeholder="Pts" min="0" value={nuevoTipo.puntos || ''}
                    onChange={e => setNuevoTipo(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                    style={{ width: '72px', padding: '6px 8px', border: '1.5px solid #c4b5fd', borderRadius: '5px', fontSize: '13px', color: '#1e1b4b', textAlign: 'center', background: 'white' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => { if (!nuevoTipo.nombre.trim()) return; setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); }}
                    style={{ padding: '5px 12px', background: 'linear-gradient(135deg, #7c3aed, #4c1d95)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    + Agregar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Distribución por posición */}
        {(() => {
          const todosNiveles = STANDARD_KEYS
            .filter(key => !configNivelesHidden.has(key))
            .map(key => ({ value: key, label: configNivelesLabels[key] || key, pts: configNiveles[key] ?? 0 }))
            .concat(configTiposCustom.map(t => ({ value: t.id, label: t.nombre, pts: t.puntos })));
          const totalPts = todosNiveles.find(n => n.value === previewNivel)?.pts
            ?? todosNiveles[0]?.pts ?? 0;
          const pctSum = [1,2,3,4,5,6,7,8,9,10].reduce((acc, pos) => acc + (configPosiciones[pos] ?? 0), 0);
          const pctDiff = pctSum - 100;
          return (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
                Distribución de puntos por posición
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Previsualizar con:
                </label>
                <select value={previewNivel} onChange={e => setPreviewNivel(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: '600', color: '#3b2f6e', background: 'white', cursor: 'pointer' }}>
                  {todosNiveles.map(n => (
                    <option key={n.value} value={n.value}>{n.label} ({n.pts} pts totales)</option>
                  ))}
                </select>
              </div>
              <table style={{ width: '100%', maxWidth: '520px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <thead>
                  <tr style={{ background: '#3b2f6e', color: 'white' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: '13px', fontWeight: 600 }}>Posición</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '110px' }}>% del total</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, width: '100px', whiteSpace: 'nowrap' }}>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10].map((pos, i) => {
                    const pct = configPosiciones[pos] ?? 0;
                    const pts = Math.round((pct / 100) * totalPts);
                    return (
                      <tr key={pos} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>
                          {pos === 1 ? '🥇 1ro' : pos === 2 ? '🥈 2do' : pos === 3 ? '🥉 3ro' : `${pos}°`}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <input type="number" min="0" max="100" value={pct}
                              onChange={e => setConfigPosiciones(prev => ({ ...prev, [pos]: parseInt(e.target.value) || 0 }))}
                              style={{ width: '70px', padding: '5px 24px 5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: '#3b2f6e' }} />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#999', pointerEvents: 'none' }}>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', width: '100px', verticalAlign: 'middle', fontSize: '15px', fontWeight: 'bold', color: pts > 0 ? '#3b2f6e' : '#ccc', whiteSpace: 'nowrap' }}>
                          {pts > 0 ? pts : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Percentage sum indicator */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                marginTop: '10px', padding: '7px 14px', borderRadius: '8px',
                background: pctDiff === 0 ? 'rgba(22,163,74,0.15)' : pctDiff > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(234,88,12,0.12)',
                border: `1.5px solid ${pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c'}`,
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  Total: {pctSum}%
                </span>
                <span style={{ fontSize: '12px', color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  {pctDiff === 0 ? '✓ Distribución completa' : pctDiff > 0 ? `⚠ Excede por ${pctDiff}%` : `Faltan ${-pctDiff}%`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <button
            onClick={guardarConfig}
            disabled={configSaving}
            style={{
              padding: '12px 28px',
              background: configSaving ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4c1d95)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: configSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
              opacity: configSaving ? 0.8 : 1,
            }}
          >
            {configSaving ? '⏳ Guardando...' : '💾 Guardar configuración'}
          </button>
          {configMsg && (
            <span style={{ fontSize: '14px', fontWeight: '600', color: configMsg.startsWith('✅') ? '#86efac' : '#fde68a' }}>
              {configMsg}
            </span>
          )}
        </div>

      </div>}

      {/* ── Mi Sede tab ── */}
      {activeTab === 'mi_sede' && puedeVerMiSede && <div className="section">
        <h2>🏟️ Mi Sede</h2>

        {miSedeLoading ? (
          <p style={{ color: '#999' }}>Cargando datos de la sede...</p>
        ) : !miSede ? (
          <p style={{ color: '#f87171' }}>No se encontró información de la sede.</p>
        ) : (<>

          {/* ── 0. Licencia PADBOL ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>🔐 Licencia PADBOL</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              {isSuperAdmin ? (
                /* Editable for super_admin */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Número de licencia</label>
                    <input
                      type="text"
                      value={licenciaForm.numero_licencia}
                      placeholder="Ej: FIPA-ARG-001"
                      onChange={e => setLicenciaForm(p => ({ ...p, numero_licencia: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Fecha de otorgamiento</label>
                    <input
                      type="date"
                      value={licenciaForm.fecha_licencia}
                      onChange={e => setLicenciaForm(p => ({ ...p, fecha_licencia: e.target.value }))}
                      style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Estado</label>
                    <select
                      value={licenciaForm.licencia_activa ? 'activa' : 'suspendida'}
                      onChange={e => setLicenciaForm(p => ({ ...p, licencia_activa: e.target.value === 'activa' }))}
                      style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                    >
                      <option value="activa">✅ Activa</option>
                      <option value="suspendida">❌ Suspendida</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={guardarLicencia} disabled={licenciaSaving}
                      style={{ padding: '10px 24px', background: licenciaSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: licenciaSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                      {licenciaSaving ? '⏳ Guardando...' : '💾 Guardar licencia'}
                    </button>
                    {licenciaMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: licenciaMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{licenciaMsg}</span>}
                  </div>
                </>
              ) : (
                /* Read-only for admin_club / admin_nacional */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Número de licencia</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e1b4b', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {licenciaForm.numero_licencia || <span style={{ color: '#aaa', fontFamily: 'inherit', fontWeight: 400 }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Fecha de otorgamiento</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>
                      {licenciaForm.fecha_licencia
                        ? new Date(licenciaForm.fecha_licencia + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : <span style={{ color: '#aaa' }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Estado</span>
                    <span style={{
                      padding: '4px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                      background: licenciaForm.licencia_activa ? '#dcfce7' : '#fee2e2',
                      color:      licenciaForm.licencia_activa ? '#16a34a' : '#dc2626',
                    }}>
                      {licenciaForm.licencia_activa ? '✅ Activa' : '❌ Suspendida'}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    🔒 Solo un Super Admin puede modificar estos datos.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── 1. Info General ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Información General</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              {[
                { label: 'Nombre del club',        field: 'nombre' },
                { label: 'Dirección',              field: 'direccion' },
                { label: 'Ciudad',                 field: 'ciudad' },
                { label: 'País',                   field: 'pais' },
                { label: 'WhatsApp del club',       field: 'telefono', placeholder: 'Ej: 2213032019', hint: 'Sin 0 adelante, sin 15' },
                { label: 'Email de contacto',      field: 'email_contacto' },
                { label: 'Horario apertura',       field: 'horario_apertura', placeholder: 'Ej: 08:00' },
                { label: 'Horario cierre',         field: 'horario_cierre',   placeholder: 'Ej: 23:00' },
                { label: 'Latitud',                field: 'latitud',          placeholder: 'Ej: -34.6037' },
                { label: 'Longitud',               field: 'longitud',         placeholder: 'Ej: -58.3816', hint: 'Podés obtener las coordenadas desde Google Maps (clic derecho → "¿Qué hay aquí?")' },
              ].map(({ label, field, placeholder, hint }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>{label}</label>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={miSedeForm[field] || ''}
                      placeholder={placeholder || ''}
                      onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', boxSizing: 'border-box' }}
                    />
                    {hint && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9ca3af' }}>{hint}</p>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>Descripción del club</label>
                <div style={{ flex: 1 }}>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={miSedeForm.descripcion || ''}
                    placeholder="Ej: Primer club de PADBOL del mundo, donde todo comenzó..."
                    onChange={e => setMiSedeForm(p => ({ ...p, descripcion: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '12px', color: (miSedeForm.descripcion || '').length >= 280 ? '#dc2626' : '#9ca3af', marginTop: '3px' }}>
                    {(miSedeForm.descripcion || '').length}/300
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Moneda</label>
                <select value={miSedeForm.moneda || 'ARS'} onChange={e => setMiSedeForm(p => ({ ...p, moneda: e.target.value }))}
                  style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}>
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar estadounidense</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="BRL">BRL — Real brasileño</option>
                  <option value="CLP">CLP — Peso chileno</option>
                  <option value="UYU">UYU — Peso uruguayo</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={guardarMiSede} disabled={miSedeSaving}
                  style={{ padding: '10px 24px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar cambios'}
                </button>
                {miSedeMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: miSedeMsg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>{miSedeMsg}</span>}
              </div>
            </div>
          </div>

          {/* ── 2. Precios ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Precios</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Precio por turno (90 min)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{miSedeForm.moneda || 'ARS'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={miSedeForm.precio_turno !== '' && miSedeForm.precio_turno !== null
                      ? Number(miSedeForm.precio_turno).toLocaleString('es-AR')
                      : ''}
                    onChange={e => {
                      const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                      setMiSedeForm(p => ({ ...p, precio_turno: digits }));
                    }}
                    style={{ width: '120px', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right' }}
                  />
                </div>
              </div>
              <p style={{ margin: '4px 0 18px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Precio base aplicado cuando no hay tarifas diferenciadas.
              </p>

              {[
                { field: 'precio_manana', label: '🌅 Mañana (08–16hs)' },
                { field: 'precio_tarde',  label: '🌆 Tarde/noche (16–23hs)' },
              ].map(({ field, label }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', width: '190px' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{miSedeForm.moneda || 'ARS'}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={miSedeForm[field] !== '' && miSedeForm[field] !== null
                        ? Number(miSedeForm[field]).toLocaleString('es-AR')
                        : ''}
                      onChange={e => {
                        const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        setMiSedeForm(p => ({ ...p, [field]: digits }));
                      }}
                      placeholder="Ej: 5000"
                      style={{ width: '120px', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right' }}
                    />
                  </div>
                </div>
              ))}
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Si se configuran ambas tarifas, el precio cambia automáticamente según el horario del turno.
              </p>

              <button onClick={guardarMiSede} disabled={miSedeSaving}
                style={{ padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar precios'}
              </button>
            </div>
          </div>

          {/* ── 3. Mercado Pago ── */}
          {(esAdminClub || isSuperAdmin) && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>💳 Mercado Pago</h3>
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
                  Ingresá el Access Token de tu cuenta de Mercado Pago para recibir los pagos directamente en tu cuenta.
                </p>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                  Access Token de MP
                </label>
                <input
                  type="password"
                  value={miSedeForm.mp_access_token || ''}
                  placeholder="APP_USR-..."
                  onChange={e => setMiSedeForm(p => ({ ...p, mp_access_token: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box', fontFamily: 'monospace', marginBottom: '14px' }}
                />
                <button onClick={guardarMiSede} disabled={miSedeSaving}
                  style={{ padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar token'}
                </button>
              </div>
            </div>
          )}

          {/* ── 4. Redes Sociales ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>📱 Redes Sociales</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
                Ingresá las URLs completas (incluye https://). Solo se muestran las redes que tengas cargadas.
              </p>
              {[
                { field: 'instagram', label: '📸 Instagram', placeholder: 'https://instagram.com/tusede' },
                { field: 'facebook',  label: '👍 Facebook',  placeholder: 'https://facebook.com/tusede' },
                { field: 'tiktok',    label: '🎵 TikTok',    placeholder: 'https://tiktok.com/@tusede' },
                { field: 'twitter',   label: '✖ Twitter / X', placeholder: 'https://x.com/tusede' },
                { field: 'youtube',   label: '▶ YouTube',   placeholder: 'https://youtube.com/@tusede' },
                { field: 'website',   label: '🌐 Sitio web', placeholder: 'https://tusede.com' },
              ].map(({ field, label, placeholder }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '150px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>{label}</label>
                  <input
                    type="url"
                    value={miSedeForm[field] || ''}
                    placeholder={placeholder}
                    onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button onClick={guardarMiSede} disabled={miSedeSaving}
                style={{ marginTop: '8px', padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar redes'}
              </button>
            </div>
          </div>

          {/* ── 5. Canchas ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Canchas</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
              {canchas.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>No hay canchas registradas para esta sede.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#555' }}>Cancha</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#555', width: '110px' }}>Estado</th>
                      <th style={{ padding: '8px 12px', width: '90px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {canchas.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px', fontSize: '14px', color: '#333' }}>{c.nombre}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: c.estado === 'activa' ? '#dcfce7' : '#fee2e2',
                            color:      c.estado === 'activa' ? '#16a34a' : '#dc2626',
                          }}>
                            {c.estado === 'activa' ? '✓ Activa' : '✗ Inactiva'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button onClick={() => toggleCanchaEstado(c)}
                            style={{ padding: '4px 10px', background: c.estado === 'activa' ? '#fee2e2' : '#dcfce7', color: c.estado === 'activa' ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            {c.estado === 'activa' ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add court */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" placeholder="Ej: Cancha 3" value={nuevaCancha}
                  onChange={e => setNuevaCancha(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarCancha(); }}
                  style={{ flex: 1, padding: '7px 10px', border: '1.5px solid #a5b4fc', borderRadius: '6px', fontSize: '13px', color: '#333' }} />
                <button onClick={agregarCancha}
                  style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  + Agregar
                </button>
              </div>
            </div>
          </div>

        </>)}

        {/* ── 4. Fotos ── always visible when tab is active */}
        {!miSedeLoading && <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>📸 Fotos</h3>

          {/* Logo */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#1e1b4b' }}>Logo del club</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo del club"
                  style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb' }}
                />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '10px', border: '2px dashed #d1d5db', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '28px' }}>🏟️</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Sin logo</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'inline-block', padding: '9px 18px',
                  background: logoUploading ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: logoUploading ? '#9ca3af' : 'white',
                  borderRadius: '8px', cursor: logoUploading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '13px',
                }}>
                  {logoUploading ? '⏳ Subiendo...' : '📤 Subir logo'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={logoUploading}
                    onChange={e => subirLogo(e.target.files[0])}
                  />
                </label>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>JPG, PNG o WEBP · máx. 2MB</span>
                <span style={{ fontSize: '11px', color: '#c4b5fd', lineHeight: 1.4 }}>💡 Recomendado: PNG transparente, mín. 300×300 px</span>
                {logoMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: logoMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{logoMsg}</span>}
              </div>
            </div>
          </div>

          {/* Fotos de canchas */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e1b4b' }}>
                Fotos de las canchas
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af', marginLeft: '8px' }}>({fotosUrls.length}/4)</span>
              </p>
              {fotosUrls.length < 4 && (
                <label style={{
                  display: 'inline-block', padding: '7px 16px',
                  background: fotosUploading ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: fotosUploading ? '#9ca3af' : 'white',
                  borderRadius: '8px', cursor: fotosUploading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '13px',
                }}>
                  {fotosUploading ? '⏳ Subiendo...' : '+ Agregar foto'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={fotosUploading}
                    onChange={e => subirFoto(e.target.files[0])}
                  />
                </label>
              )}
            </div>
            {fotosUrls.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>No hay fotos cargadas aún.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {fotosUrls.map((url, i) => (
                  <div key={url} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3', background: '#f1f5f9' }}>
                    <img
                      src={url}
                      alt={`Cancha ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      onClick={() => eliminarFoto(url)}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: 'rgba(220,38,38,0.85)', color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                      title="Eliminar foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotosMsg && <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 600, color: fotosMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{fotosMsg}</p>}
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#9ca3af' }}>JPG, PNG o WEBP · máx. 2MB por foto</p>
          </div>
        </div>}

      </div>}

    </div>
  );
}