export const PC_CAMPAIGN_TYPES = [
  { id: 'multiplier', label: 'Multiplicador' },
  { id: 'percentage_override', label: 'Porcentaje temporal' },
  { id: 'fixed_padcoins', label: 'PadCoins fijos' },
  { id: 'benefit_equivalent', label: 'Equivalente a beneficio' },
];

export const PC_CAMPAIGN_STATE_BADGES = {
  draft: { label: 'Borrador', bg: '#f1f5f9', color: '#475569' },
  active: { label: 'Activa', bg: '#dcfce7', color: '#166534' },
  paused: { label: 'Pausada', bg: '#fef3c7', color: '#92400e' },
  ended: { label: 'Finalizada', bg: '#e2e8f0', color: '#64748b' },
};

export const EMPTY_PC_CAMPAIGN_FORM = () => ({
  sede_id: '',
  name: '',
  description: '',
  campaign_type: 'multiplier',
  start_at: '',
  end_at: '',
  multiplier: '',
  loyalty_percentage_override: '',
  fixed_padcoins: '',
  benefit_id: '',
  max_total_uses: '',
  max_uses_per_player: '',
  estimated_cost_reference: '',
  message_title: '',
  message_body: '',
});

function parsePcCampaignNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function padcoinsCampaignTypeLabel(type) {
  const id = String(type || '').trim();
  return PC_CAMPAIGN_TYPES.find((row) => row.id === id)?.label || id || '—';
}

export function padcoinsCampaignStateBadge(status) {
  const key = String(status || 'draft').trim().toLowerCase();
  return PC_CAMPAIGN_STATE_BADGES[key] || PC_CAMPAIGN_STATE_BADGES.draft;
}

export function parsePadcoinsCampaignsList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.campaigns)) return data.campaigns;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function parsePadcoinsCampaignEntity(data) {
  return data?.campaign || data?.data || data || null;
}

export function parsePadcoinsCampaignSummary(data) {
  const raw = data?.summary || data?.campaign || data?.data || data || {};
  return {
    total_uses: raw.total_uses ?? raw.usos ?? raw.uses ?? null,
    padcoins_delivered: raw.padcoins_delivered ?? raw.padcoins_entregados ?? raw.total_padcoins ?? null,
    reservations_impacted: raw.reservations_impacted ?? raw.reservas_impactadas ?? null,
    players_impacted: raw.players_impacted ?? raw.jugadores_impactados ?? null,
    estimated_cost: raw.estimated_cost
      ?? raw.estimated_cost_impact
      ?? raw.costo_estimado
      ?? raw.estimated_cost_reference
      ?? null,
    raw,
  };
}

export function isPadcoinsCampaignHighImpact(campaign) {
  return !!(campaign?.high_impact || campaign?.is_high_impact || campaign?.alto_impacto);
}

export function isPadcoinsCampaignLikelyHighImpact(form) {
  const mult = parsePcCampaignNumber(form?.multiplier);
  const pct = parsePcCampaignNumber(form?.loyalty_percentage_override);
  const fixed = parsePcCampaignNumber(form?.fixed_padcoins);
  const maxTotal = parsePcCampaignNumber(form?.max_total_uses);
  const est = parsePcCampaignNumber(form?.estimated_cost_reference);
  if (mult != null && mult >= 3) return true;
  if (pct != null && pct >= 15) return true;
  if (fixed != null && fixed >= 500) return true;
  if (maxTotal != null && maxTotal >= 1000) return true;
  if (est != null && est >= 1000) return true;
  return false;
}

export function padcoinsCampaignToForm(campaign) {
  const toLocalInput = (value) => {
    if (!value) return '';
    const s = String(value).trim();
    if (s.length >= 16) return s.slice(0, 16);
    return s.slice(0, 10);
  };
  return {
    sede_id: campaign?.sede_id != null ? String(campaign.sede_id) : '',
    name: campaign?.name || '',
    description: campaign?.description || '',
    campaign_type: campaign?.campaign_type || 'multiplier',
    start_at: toLocalInput(campaign?.start_at),
    end_at: toLocalInput(campaign?.end_at),
    multiplier: campaign?.multiplier != null ? String(campaign.multiplier) : '',
    loyalty_percentage_override: campaign?.loyalty_percentage_override != null
      ? String(campaign.loyalty_percentage_override)
      : '',
    fixed_padcoins: campaign?.fixed_padcoins != null ? String(campaign.fixed_padcoins) : '',
    benefit_id: campaign?.benefit_id != null ? String(campaign.benefit_id) : '',
    max_total_uses: campaign?.max_total_uses != null ? String(campaign.max_total_uses) : '',
    max_uses_per_player: campaign?.max_uses_per_player != null ? String(campaign.max_uses_per_player) : '',
    estimated_cost_reference: campaign?.estimated_cost_reference != null
      ? String(campaign.estimated_cost_reference)
      : '',
    message_title: campaign?.message_title || '',
    message_body: campaign?.message_body || '',
  };
}

function padcoinsCampaignNumericOptional(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function validatePadcoinsCampaignForm(form, { requireSedeId = false } = {}) {
  if (!(form?.name || '').trim()) return 'El nombre es obligatorio';
  if (!(form?.campaign_type || '').trim()) return 'El tipo de campaña es obligatorio';
  if (requireSedeId && !String(form?.sede_id || '').trim()) return 'Seleccione una sede';

  const start = String(form?.start_at || '').trim();
  const end = String(form?.end_at || '').trim();
  if (start && end && start >= end) return 'La fecha de fin debe ser posterior a la fecha de inicio';

  const numericFields = [
    form?.multiplier,
    form?.loyalty_percentage_override,
    form?.fixed_padcoins,
    form?.max_total_uses,
    form?.max_uses_per_player,
    form?.estimated_cost_reference,
  ];
  for (const val of numericFields) {
    if (val === '' || val == null) continue;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return 'Los valores numéricos no pueden ser negativos';
  }

  const type = String(form?.campaign_type || '').trim();
  if (type === 'multiplier') {
    const m = Number(form?.multiplier);
    if (!Number.isFinite(m) || m <= 0) return 'Indique un multiplicador mayor a 0';
  }
  if (type === 'percentage_override') {
    const p = Number(form?.loyalty_percentage_override);
    if (!Number.isFinite(p) || p < 0) return 'Indique el porcentaje de fidelización';
  }
  if (type === 'fixed_padcoins') {
    const f = Number(form?.fixed_padcoins);
    if (!Number.isFinite(f) || f <= 0) return 'Indique una cantidad de PadCoins fijos mayor a 0';
  }
  if (type === 'benefit_equivalent') {
    const bid = String(form?.benefit_id || '').trim();
    if (!bid) return 'Seleccione un beneficio asociado';
  }
  return null;
}

export function buildPadcoinsCampaignPayload(form, sedeId) {
  const payload = {
    name: form.name.trim(),
    description: (form.description || '').trim() || null,
    campaign_type: form.campaign_type,
    message_title: (form.message_title || '').trim() || null,
    message_body: (form.message_body || '').trim() || null,
  };
  if (sedeId) payload.sede_id = parseInt(sedeId, 10);

  const start = String(form.start_at || '').trim();
  const end = String(form.end_at || '').trim();
  if (start) payload.start_at = start.length === 10 ? `${start}T00:00:00` : start;
  if (end) payload.end_at = end.length === 10 ? `${end}T23:59:59` : end;

  const type = String(form.campaign_type || '').trim();
  if (type === 'multiplier') {
    const m = padcoinsCampaignNumericOptional(form.multiplier);
    if (m != null) payload.multiplier = m;
  }
  if (type === 'percentage_override') {
    const p = padcoinsCampaignNumericOptional(form.loyalty_percentage_override);
    if (p != null) payload.loyalty_percentage_override = p;
  }
  if (type === 'fixed_padcoins') {
    const f = padcoinsCampaignNumericOptional(form.fixed_padcoins);
    if (f != null) payload.fixed_padcoins = f;
  }
  if (type === 'benefit_equivalent') {
    const bid = String(form.benefit_id || '').trim();
    if (bid) payload.benefit_id = parseInt(bid, 10);
  }

  const mtu = padcoinsCampaignNumericOptional(form.max_total_uses);
  const mup = padcoinsCampaignNumericOptional(form.max_uses_per_player);
  const est = padcoinsCampaignNumericOptional(form.estimated_cost_reference);
  if (mtu != null) payload.max_total_uses = mtu;
  if (mup != null) payload.max_uses_per_player = mup;
  if (est != null) payload.estimated_cost_reference = est;
  return payload;
}

export function padcoinsCampaignSedeNombre(campaign, sedesMapRef, sedesList) {
  const sid = campaign?.sede_id;
  if (sid == null || sid === '') return '—';
  return sedesMapRef[sid]?.nombre
    || sedesMapRef[String(sid)]?.nombre
    || sedesList.find((s) => String(s.id) === String(sid))?.nombre
    || `Sede #${sid}`;
}

export function formatPadcoinsCampaignDateRange(campaign) {
  const start = campaign?.start_at ? String(campaign.start_at).slice(0, 10) : '—';
  const end = campaign?.end_at ? String(campaign.end_at).slice(0, 10) : '—';
  return `${start} → ${end}`;
}
