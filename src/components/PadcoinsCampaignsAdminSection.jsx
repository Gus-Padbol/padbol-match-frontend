import React, { useEffect, useState } from 'react';
import { getAuthHeaders } from '../utils/scoreboardApi';
import {
  PC_CAMPAIGN_TYPES,
  EMPTY_PC_CAMPAIGN_FORM,
  padcoinsCampaignTypeLabel,
  padcoinsCampaignStateBadge,
  parsePadcoinsCampaignsList,
  parsePadcoinsCampaignEntity,
  parsePadcoinsCampaignSummary,
  isPadcoinsCampaignHighImpact,
  isPadcoinsCampaignLikelyHighImpact,
  padcoinsCampaignToForm,
  validatePadcoinsCampaignForm,
  buildPadcoinsCampaignPayload,
  padcoinsCampaignSedeNombre,
  formatPadcoinsCampaignDateRange,
} from '../utils/padcoinsCampaignsAdmin';

const PC_INP = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  background: 'white',
  color: '#1e293b',
};

export default function PadcoinsCampaignsAdminSection({
  apiBaseUrl,
  isSuperAdmin,
  esAdminClub,
  resolvePcSedeId,
  sedesList,
  sedesMap,
  sedeFlag,
  active,
  onSuccessMessage,
}) {
  const [pcCampaigns, setPcCampaigns] = useState([]);
  const [pcCampaignsLoading, setPcCampaignsLoading] = useState(false);
  const [pcCampaignsError, setPcCampaignsError] = useState('');
  const [pcCampaignFiltroSedeId, setPcCampaignFiltroSedeId] = useState('');
  const [pcCampaignFormMode, setPcCampaignFormMode] = useState(null);
  const [pcCampaignEditId, setPcCampaignEditId] = useState(null);
  const [pcCampaignForm, setPcCampaignForm] = useState(() => EMPTY_PC_CAMPAIGN_FORM());
  const [pcCampaignFormError, setPcCampaignFormError] = useState('');
  const [pcCampaignSaving, setPcCampaignSaving] = useState(false);
  const [pcCampaignActionId, setPcCampaignActionId] = useState(null);
  const [pcCampaignBenefits, setPcCampaignBenefits] = useState([]);
  const [pcCampaignBenefitsLoading, setPcCampaignBenefitsLoading] = useState(false);
  const [pcCampaignSummaryId, setPcCampaignSummaryId] = useState(null);
  const [pcCampaignSummary, setPcCampaignSummary] = useState(null);
  const [pcCampaignSummaryLoading, setPcCampaignSummaryLoading] = useState(false);
  const [pcCampaignSummaryError, setPcCampaignSummaryError] = useState('');

  const effectivePcSedeId = resolvePcSedeId();
  const sedeNombre = effectivePcSedeId ? sedesMap[effectivePcSedeId]?.nombre : null;

  async function fetchPadcoinsCampaigns() {
    if (!isSuperAdmin && !esAdminClub) {
      setPcCampaigns([]);
      setPcCampaignsError('');
      setPcCampaignsLoading(false);
      return;
    }
    const clubSid = esAdminClub ? resolvePcSedeId() : '';
    if (esAdminClub && !clubSid) {
      setPcCampaigns([]);
      setPcCampaignsError('');
      setPcCampaignsLoading(false);
      return;
    }
    setPcCampaignsLoading(true);
    setPcCampaignsError('');
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      const sid = clubSid || pcCampaignFiltroSedeId;
      if (sid) params.set('sede_id', String(sid));
      const qs = params.toString();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins/campaigns${qs ? `?${qs}` : ''}`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error('No tienes permisos para ver campañas PadCoins.');
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al cargar campañas PadCoins');
      }
      setPcCampaigns(parsePadcoinsCampaignsList(data));
    } catch (err) {
      setPcCampaigns([]);
      setPcCampaignsError(err.message || 'Error al cargar campañas PadCoins');
    } finally {
      setPcCampaignsLoading(false);
    }
  }

  async function fetchPadcoinsCampaignBenefits(targetSedeId) {
    const sid = targetSedeId != null ? String(targetSedeId) : '';
    if (!sid) {
      setPcCampaignBenefits([]);
      return;
    }
    setPcCampaignBenefitsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/premios-canjeables?sede_id=${encodeURIComponent(sid)}`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar beneficios');
      const list = Array.isArray(data) ? data : (data.premios || data.data || []);
      setPcCampaignBenefits(list);
    } catch {
      setPcCampaignBenefits([]);
    } finally {
      setPcCampaignBenefitsLoading(false);
    }
  }

  function cerrarCampanaForm() {
    setPcCampaignFormMode(null);
    setPcCampaignEditId(null);
    setPcCampaignForm(EMPTY_PC_CAMPAIGN_FORM());
    setPcCampaignFormError('');
    setPcCampaignBenefits([]);
  }

  function abrirNuevaCampana() {
    const clubSid = esAdminClub ? resolvePcSedeId() : '';
    const form = EMPTY_PC_CAMPAIGN_FORM();
    if (clubSid) form.sede_id = String(clubSid);
    else if (pcCampaignFiltroSedeId) form.sede_id = String(pcCampaignFiltroSedeId);
    setPcCampaignForm(form);
    setPcCampaignFormMode('create');
    setPcCampaignEditId(null);
    setPcCampaignFormError('');
    if (form.sede_id) void fetchPadcoinsCampaignBenefits(form.sede_id);
  }

  async function abrirEditarCampana(campaign) {
    if (!campaign?.id) return;
    setPcCampaignActionId(campaign.id);
    setPcCampaignFormError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins/campaigns/${encodeURIComponent(campaign.id)}`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar campaña');
      const entity = parsePadcoinsCampaignEntity(data) || campaign;
      const form = padcoinsCampaignToForm(entity);
      if (esAdminClub) {
        const clubSid = resolvePcSedeId();
        if (clubSid) form.sede_id = String(clubSid);
      }
      setPcCampaignForm(form);
      setPcCampaignFormMode('edit');
      setPcCampaignEditId(entity.id);
      if (form.sede_id) void fetchPadcoinsCampaignBenefits(form.sede_id);
    } catch (err) {
      alert(err.message || 'Error al cargar campaña');
    } finally {
      setPcCampaignActionId(null);
    }
  }

  function updatePcCampaignFormField(key, value) {
    if (['multiplier', 'loyalty_percentage_override', 'fixed_padcoins', 'max_total_uses', 'max_uses_per_player', 'estimated_cost_reference'].includes(key)) {
      const s = String(value);
      if (s !== '' && Number(s) < 0) return;
    }
    setPcCampaignForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'sede_id') next.benefit_id = '';
      if (key === 'campaign_type') {
        next.multiplier = '';
        next.loyalty_percentage_override = '';
        next.fixed_padcoins = '';
        next.benefit_id = '';
      }
      return next;
    });
    if (key === 'sede_id') void fetchPadcoinsCampaignBenefits(value);
    setPcCampaignFormError('');
  }

  async function guardarCampana(e) {
    e?.preventDefault?.();
    if (!isSuperAdmin && !esAdminClub) return;
    const clubSid = esAdminClub ? resolvePcSedeId() : '';
    const formSedeId = clubSid || pcCampaignForm.sede_id;
    const validationError = validatePadcoinsCampaignForm(pcCampaignForm, {
      requireSedeId: isSuperAdmin && !clubSid,
    });
    if (validationError) {
      setPcCampaignFormError(validationError);
      return;
    }
    if (!formSedeId) {
      setPcCampaignFormError('Seleccione una sede para la campaña');
      return;
    }
    setPcCampaignSaving(true);
    setPcCampaignFormError('');
    try {
      const headers = await getAuthHeaders();
      const payload = buildPadcoinsCampaignPayload(pcCampaignForm, formSedeId);
      const isEdit = pcCampaignFormMode === 'edit' && pcCampaignEditId;
      const url = isEdit
        ? `${apiBaseUrl}/api/admin/padcoins/campaigns/${encodeURIComponent(pcCampaignEditId)}`
        : `${apiBaseUrl}/api/admin/padcoins/campaigns`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error('No tienes permisos para guardar esta campaña.');
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al guardar campaña');
      }
      onSuccessMessage?.(isEdit ? '✅ Campaña actualizada' : '✅ Campaña creada');
      cerrarCampanaForm();
      await fetchPadcoinsCampaigns();
    } catch (err) {
      setPcCampaignFormError(err.message || 'Error al guardar campaña');
    } finally {
      setPcCampaignSaving(false);
    }
  }

  async function activarCampana(campaign) {
    if (!campaign?.id) return;
    const highImpact = isPadcoinsCampaignHighImpact(campaign);
    const msg = highImpact
      ? `La campaña "${campaign.name}" está marcada como alto impacto. No se bloqueará, pero quedará registrada para auditoría.\n\n¿Activar de todos modos?`
      : `¿Activar la campaña "${campaign.name}"?`;
    if (!window.confirm(msg)) return;
    setPcCampaignActionId(campaign.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins/campaigns/${encodeURIComponent(campaign.id)}/activate`,
        { method: 'POST', headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al activar campaña');
      onSuccessMessage?.('✅ Campaña activada');
      await fetchPadcoinsCampaigns();
    } catch (err) {
      alert(err.message || 'Error al activar campaña');
    } finally {
      setPcCampaignActionId(null);
    }
  }

  async function pausarCampana(campaign) {
    if (!campaign?.id) return;
    if (!window.confirm(`¿Pausar la campaña "${campaign.name}"?`)) return;
    setPcCampaignActionId(campaign.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins/campaigns/${encodeURIComponent(campaign.id)}/pause`,
        { method: 'POST', headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al pausar campaña');
      onSuccessMessage?.('✅ Campaña pausada');
      await fetchPadcoinsCampaigns();
    } catch (err) {
      alert(err.message || 'Error al pausar campaña');
    } finally {
      setPcCampaignActionId(null);
    }
  }

  function cerrarResumenCampana() {
    setPcCampaignSummaryId(null);
    setPcCampaignSummary(null);
    setPcCampaignSummaryError('');
    setPcCampaignSummaryLoading(false);
  }

  async function verResumenCampana(campaign) {
    if (!campaign?.id) return;
    setPcCampaignSummaryId(campaign.id);
    setPcCampaignSummary(null);
    setPcCampaignSummaryError('');
    setPcCampaignSummaryLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins/campaigns/${encodeURIComponent(campaign.id)}/summary`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar resumen de campaña');
      setPcCampaignSummary({
        campaign,
        summary: parsePadcoinsCampaignSummary(data),
      });
    } catch (err) {
      setPcCampaignSummaryError(err.message || 'Error al cargar resumen de campaña');
    } finally {
      setPcCampaignSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    if (isSuperAdmin || esAdminClub) {
      void fetchPadcoinsCampaigns();
    } else {
      setPcCampaigns([]);
      setPcCampaignsError('');
      setPcCampaignsLoading(false);
      cerrarCampanaForm();
    }
  }, [active, apiBaseUrl, isSuperAdmin, esAdminClub, pcCampaignFiltroSedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperAdmin && !esAdminClub) return null;

  return (
    <div
      id="admin-padcoins-campaigns"
      style={{
        marginBottom: '32px',
        paddingBottom: '28px',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>📣 Campañas automáticas</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 8px', maxWidth: '720px', fontSize: '14px' }}>
            Crea campañas temporales para impulsar reservas y fidelización con PadCoins.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', maxWidth: '720px', fontSize: '13px' }}>
            La sede asume el costo y cumplimiento de esta campaña.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', maxWidth: '720px', fontSize: '13px' }}>
            Padbol Match registra la trazabilidad y el impacto.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: '720px', fontSize: '13px' }}>
            Las campañas de alto impacto no se bloquean, pero quedan marcadas para auditoría.
          </p>
        </div>
        {!pcCampaignFormMode ? (
          <button
            type="button"
            onClick={abrirNuevaCampana}
            disabled={esAdminClub && !resolvePcSedeId()}
            style={{
              padding: '10px 20px',
              background: (esAdminClub && !resolvePcSedeId()) ? '#94a3b8' : '#e53935',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: (esAdminClub && !resolvePcSedeId()) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Nueva campaña
          </button>
        ) : null}
      </div>

      {isSuperAdmin ? (
        <div style={{ marginBottom: '16px', maxWidth: '360px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>Filtrar por sede</span>
            <select
              value={pcCampaignFiltroSedeId}
              onChange={(e) => setPcCampaignFiltroSedeId(e.target.value)}
              style={PC_INP}
            >
              <option value="">Todas las sedes</option>
              {sedesList.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>{sedeFlag(s)} {s.nombre}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {esAdminClub && effectivePcSedeId && sedeNombre ? (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>
          Sede: <strong style={{ color: 'white' }}>{sedeNombre}</strong>
        </p>
      ) : null}

      {esAdminClub && !resolvePcSedeId() ? (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 }}>
          No se pudo determinar la sede del club.
        </p>
      ) : null}

      {pcCampaignFormMode ? (
        <form
          onSubmit={guardarCampana}
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '960px',
            marginBottom: '20px',
            color: '#1e293b',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: '17px', color: '#1e293b' }}>
            {pcCampaignFormMode === 'edit' ? 'Editar campaña' : 'Nueva campaña'}
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}>
            {isSuperAdmin ? (
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Sede</span>
                <select
                  value={pcCampaignForm.sede_id}
                  onChange={(e) => updatePcCampaignFormField('sede_id', e.target.value)}
                  style={PC_INP}
                  required
                >
                  <option value="">Seleccionar sede...</option>
                  {sedesList.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{sedeFlag(s)} {s.nombre}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Nombre</span>
              <input
                type="text"
                value={pcCampaignForm.name}
                onChange={(e) => updatePcCampaignFormField('name', e.target.value)}
                style={PC_INP}
                required
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Tipo de campaña</span>
              <select
                value={pcCampaignForm.campaign_type}
                onChange={(e) => updatePcCampaignFormField('campaign_type', e.target.value)}
                style={PC_INP}
              >
                {PC_CAMPAIGN_TYPES.map((row) => (
                  <option key={row.id} value={row.id}>{row.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Inicio</span>
              <input
                type="datetime-local"
                value={pcCampaignForm.start_at}
                onChange={(e) => updatePcCampaignFormField('start_at', e.target.value)}
                style={PC_INP}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Fin</span>
              <input
                type="datetime-local"
                value={pcCampaignForm.end_at}
                onChange={(e) => updatePcCampaignFormField('end_at', e.target.value)}
                style={PC_INP}
              />
            </label>

            {pcCampaignForm.campaign_type === 'multiplier' ? (
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Multiplicador</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={pcCampaignForm.multiplier}
                  onChange={(e) => updatePcCampaignFormField('multiplier', e.target.value)}
                  placeholder="2"
                  style={PC_INP}
                />
              </label>
            ) : null}

            {pcCampaignForm.campaign_type === 'percentage_override' ? (
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Porcentaje de fidelización</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={pcCampaignForm.loyalty_percentage_override}
                  onChange={(e) => updatePcCampaignFormField('loyalty_percentage_override', e.target.value)}
                  placeholder="10"
                  style={PC_INP}
                />
              </label>
            ) : null}

            {pcCampaignForm.campaign_type === 'fixed_padcoins' ? (
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>PadCoins fijos</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pcCampaignForm.fixed_padcoins}
                  onChange={(e) => updatePcCampaignFormField('fixed_padcoins', e.target.value)}
                  placeholder="100"
                  style={PC_INP}
                />
              </label>
            ) : null}

            {pcCampaignForm.campaign_type === 'benefit_equivalent' ? (
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Beneficio asociado</span>
                <select
                  value={pcCampaignForm.benefit_id}
                  onChange={(e) => updatePcCampaignFormField('benefit_id', e.target.value)}
                  style={PC_INP}
                  disabled={!pcCampaignForm.sede_id || pcCampaignBenefitsLoading}
                >
                  <option value="">
                    {pcCampaignBenefitsLoading ? 'Cargando...' : 'Seleccionar beneficio...'}
                  </option>
                  {pcCampaignBenefits.map((premio) => (
                    <option key={String(premio.id)} value={String(premio.id)}>
                      {premio.nombre} ({premio.costo_padcoins} PadCoins)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Cupo total</span>
              <input
                type="number"
                min="0"
                step="1"
                value={pcCampaignForm.max_total_uses}
                onChange={(e) => updatePcCampaignFormField('max_total_uses', e.target.value)}
                style={PC_INP}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Cupo por jugador</span>
              <input
                type="number"
                min="0"
                step="1"
                value={pcCampaignForm.max_uses_per_player}
                onChange={(e) => updatePcCampaignFormField('max_uses_per_player', e.target.value)}
                style={PC_INP}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Referencia de costo estimado</span>
              <input
                type="number"
                min="0"
                step="any"
                value={pcCampaignForm.estimated_cost_reference}
                onChange={(e) => updatePcCampaignFormField('estimated_cost_reference', e.target.value)}
                style={PC_INP}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: '6px', marginTop: '14px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Descripción</span>
            <textarea
              value={pcCampaignForm.description}
              onChange={(e) => updatePcCampaignFormField('description', e.target.value)}
              rows={2}
              style={{ ...PC_INP, resize: 'vertical' }}
            />
          </label>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginTop: '14px',
          }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Título del mensaje (jugador)</span>
              <input
                type="text"
                value={pcCampaignForm.message_title}
                onChange={(e) => updatePcCampaignFormField('message_title', e.target.value)}
                style={PC_INP}
                placeholder="Campaña PadCoins activa"
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Cuerpo del mensaje (jugador)</span>
              <textarea
                value={pcCampaignForm.message_body}
                onChange={(e) => updatePcCampaignFormField('message_body', e.target.value)}
                rows={2}
                style={{ ...PC_INP, resize: 'vertical' }}
                placeholder="Esta sede tiene una campaña especial por tiempo limitado."
              />
            </label>
          </div>

          {isPadcoinsCampaignLikelyHighImpact(pcCampaignForm) ? (
            <p style={{
              margin: '14px 0 0',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontSize: '13px',
            }}>
              Esta configuración parece de alto impacto. Al activarla quedará marcada para auditoría.
            </p>
          ) : null}

          {pcCampaignFormError ? (
            <p style={{ color: '#dc2626', fontWeight: 600, marginTop: '14px', marginBottom: 0 }}>
              {pcCampaignFormError}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={pcCampaignSaving}
              style={{
                padding: '10px 20px',
                background: pcCampaignSaving ? '#94a3b8' : '#e53935',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: pcCampaignSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {pcCampaignSaving ? 'Guardando...' : 'Guardar campaña'}
            </button>
            <button
              type="button"
              onClick={cerrarCampanaForm}
              disabled={pcCampaignSaving}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: pcCampaignSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {pcCampaignsLoading ? (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>Cargando campañas...</p>
      ) : null}

      {!pcCampaignsLoading && pcCampaignsError ? (
        <p style={{
          margin: 0,
          padding: '12px 14px',
          borderRadius: '8px',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: '14px',
          maxWidth: '720px',
        }}>
          {pcCampaignsError}
        </p>
      ) : null}

      {!pcCampaignsLoading && !pcCampaignsError && pcCampaigns.length === 0 && !pcCampaignFormMode ? (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 }}>
          No hay campañas registradas.
        </p>
      ) : null}

      {!pcCampaignsLoading && !pcCampaignsError && pcCampaigns.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '980px', background: 'white', color: '#1e293b' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Nombre</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Sede</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Tipo</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Estado</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Fechas</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Cupos</th>
                <th style={{ padding: '10px 12px', color: '#64748b' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pcCampaigns.map((campaign) => {
                const statusKey = String(campaign.status || 'draft').trim().toLowerCase();
                const badge = padcoinsCampaignStateBadge(statusKey);
                const busy = pcCampaignActionId === campaign.id;
                const highImpact = isPadcoinsCampaignHighImpact(campaign);
                return (
                  <tr key={String(campaign.id)} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      <strong>{campaign.name || '—'}</strong>
                      {highImpact ? (
                        <span style={{
                          display: 'inline-block',
                          marginLeft: '8px',
                          background: '#fff7ed',
                          color: '#9a3412',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}>
                          Alto impacto
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569', verticalAlign: 'top' }}>
                      {padcoinsCampaignSedeNombre(campaign, sedesMap, sedesList)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569', verticalAlign: 'top' }}>
                      {padcoinsCampaignTypeLabel(campaign.campaign_type)}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      <span style={{
                        background: badge.bg,
                        color: badge.color,
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569', verticalAlign: 'top' }}>
                      {formatPadcoinsCampaignDateRange(campaign)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569', verticalAlign: 'top' }}>
                      <div>Total: {campaign.max_total_uses ?? '—'}</div>
                      <div>Por jugador: {campaign.max_uses_per_player ?? '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void verResumenCampana(campaign)}
                          style={{
                            padding: '6px 10px',
                            background: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: busy ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Ver resumen
                        </button>
                        {statusKey !== 'ended' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void abrirEditarCampana(campaign)}
                            style={{
                              padding: '6px 10px',
                              background: '#1976d2',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: busy ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Editar
                          </button>
                        ) : null}
                        {(statusKey === 'draft' || statusKey === 'paused') ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void activarCampana(campaign)}
                            style={{
                              padding: '6px 10px',
                              background: '#166534',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: busy ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Activar
                          </button>
                        ) : null}
                        {statusKey === 'active' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void pausarCampana(campaign)}
                            style={{
                              padding: '6px 10px',
                              background: '#92400e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: busy ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Pausar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pcCampaignSummaryId ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1200,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: '#1e293b',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>Resumen de campaña</h3>
            {pcCampaignSummaryLoading ? (
              <p style={{ color: '#64748b', margin: 0 }}>Cargando resumen...</p>
            ) : null}
            {!pcCampaignSummaryLoading && pcCampaignSummaryError ? (
              <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{pcCampaignSummaryError}</p>
            ) : null}
            {!pcCampaignSummaryLoading && !pcCampaignSummaryError && pcCampaignSummary ? (
              <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>{pcCampaignSummary.campaign?.name || '—'}</strong>
                </p>
                <p style={{ margin: '0 0 6px' }}>Usos: {pcCampaignSummary.summary.total_uses ?? '—'}</p>
                <p style={{ margin: '0 0 6px' }}>PadCoins entregados: {pcCampaignSummary.summary.padcoins_delivered ?? '—'}</p>
                <p style={{ margin: '0 0 6px' }}>Reservas impactadas: {pcCampaignSummary.summary.reservations_impacted ?? '—'}</p>
                <p style={{ margin: '0 0 6px' }}>Jugadores impactados: {pcCampaignSummary.summary.players_impacted ?? '—'}</p>
                <p style={{ margin: '0 0 12px' }}>Impacto estimado: {pcCampaignSummary.summary.estimated_cost ?? '—'}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={cerrarResumenCampana}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                background: '#f1f5f9',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
