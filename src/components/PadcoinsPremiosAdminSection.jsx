import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAuthHeaders } from '../utils/scoreboardApi';
import {
  EMPTY_PREMIO_FORM,
  PREMIO_IMAGEN_FALLBACK,
  PREMIO_LIMITE_PERIODOS,
  buildPremioPayload,
  formatPremioLimite,
  parsePremiosList,
  premioToForm,
  validatePremioForm,
} from '../utils/padcoinsPremiosAdmin';

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

function PremioImagenPreview({ url, alt }) {
  const [failed, setFailed] = useState(false);
  const src = String(url || '').trim();
  if (!src || failed) {
    return (
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          border: '1px dashed #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          background: '#f8fafc',
        }}
        aria-hidden
      >
        {PREMIO_IMAGEN_FALLBACK}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      onError={() => setFailed(true)}
      style={{
        width: 72,
        height: 72,
        objectFit: 'cover',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}
    />
  );
}

export default function PadcoinsPremiosAdminSection({
  apiBaseUrl,
  isSuperAdmin,
  esAdminClub,
  resolvePcSedeId,
  sedesList,
  sedesMap,
  sedeFlag,
  pcNeedsSelector,
  pcSedeId,
  setPcSedeId,
  active,
  onSuccessMessage,
  onPremiosChange,
}) {
  const [premios, setPremios] = useState([]);
  const [premiosLoading, setPremiosLoading] = useState(false);
  const [premiosError, setPremiosError] = useState('');
  const [premioFormMode, setPremioFormMode] = useState(null);
  const [premioEditId, setPremioEditId] = useState(null);
  const [premioForm, setPremioForm] = useState(EMPTY_PREMIO_FORM);
  const [premioFormError, setPremioFormError] = useState('');
  const [premioSaving, setPremioSaving] = useState(false);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  const effectivePcSedeId = resolvePcSedeId();
  const sedeNombre = effectivePcSedeId ? sedesMap[effectivePcSedeId]?.nombre : null;

  const fetchPremios = useCallback(async () => {
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremios([]);
      return [];
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
      if (res.status === 403) {
        throw new Error('No tenés permisos para gestionar beneficios de esta sede.');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar beneficios');
      const list = parsePremiosList(data);
      setPremios(list);
      onPremiosChange?.(list);
      return list;
    } catch (err) {
      setPremiosError(err.message || 'Error al cargar beneficios');
      setPremios([]);
      onPremiosChange?.([]);
      return [];
    } finally {
      setPremiosLoading(false);
    }
  }, [apiBaseUrl, onPremiosChange, resolvePcSedeId]);

  useEffect(() => {
    if (!active) return;
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremios([]);
      setPremiosError('');
      setPremiosLoading(false);
      return;
    }
    void fetchPremios();
  }, [active, effectivePcSedeId, fetchPremios, resolvePcSedeId]);

  function cerrarPremioForm() {
    setPremioFormMode(null);
    setPremioEditId(null);
    setPremioForm(EMPTY_PREMIO_FORM());
    setPremioFormError('');
  }

  function abrirNuevoPremio() {
    setPremioForm(EMPTY_PREMIO_FORM());
    setPremioEditId(null);
    setPremioFormMode('create');
    setPremioFormError('');
  }

  function abrirEditarPremio(premio) {
    setPremioForm(premioToForm(premio));
    setPremioEditId(premio.id);
    setPremioFormMode('edit');
    setPremioFormError('');
  }

  async function subirImagenPremio(file) {
    if (!file) return;
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremioFormError('Seleccioná una sede antes de subir la imagen.');
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      setPremioFormError('Elegí una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPremioFormError('La imagen no puede superar 4 MB.');
      return;
    }
    setUploadingImagen(true);
    setPremioFormError('');
    const safe = String(file.name || 'beneficio').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `premios/${sid}/${Date.now()}_${safe}`;
    try {
      const { data: uploadData, error: upErr } = await supabase.storage.from('sponsors').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) throw new Error(upErr.message);
      const filePath = uploadData?.path ? String(uploadData.path).trim() : path;
      const { data } = supabase.storage.from('sponsors').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl ? String(data.publicUrl).trim() : '';
      if (!publicUrl) throw new Error('No se obtuvo URL pública de la imagen');
      setPremioForm((p) => ({ ...p, imagen_url: publicUrl }));
    } catch (err) {
      setPremioFormError(err.message || 'Error al subir imagen');
    } finally {
      setUploadingImagen(false);
    }
  }

  async function guardarPremio(e) {
    e.preventDefault();
    const sid = resolvePcSedeId();
    if (!sid) {
      setPremioFormError('Seleccioná una sede para gestionar beneficios PadCoins');
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
      if (res.status === 403) {
        throw new Error('No tenés permisos para modificar beneficios de esta sede.');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Error al guardar beneficio');
      cerrarPremioForm();
      onSuccessMessage?.(isEdit ? '✅ Beneficio actualizado' : '✅ Beneficio creado');
      await fetchPremios();
    } catch (err) {
      setPremioFormError(err.message || 'Error al guardar beneficio');
    } finally {
      setPremioSaving(false);
    }
  }

  async function desactivarPremio(premio) {
    if (!window.confirm(`¿Desactivar el beneficio "${premio.nombre}"? Ya no será visible para los jugadores.`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/admin/premios-canjeables/${premio.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error('No tenés permisos para desactivar beneficios de esta sede.');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Error al desactivar beneficio');
      onSuccessMessage?.('✅ Beneficio desactivado');
      await fetchPremios();
    } catch (err) {
      alert(err.message || 'Error al desactivar beneficio');
    }
  }

  return (
    <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ marginTop: 0 }}>🎁 Beneficios PadCoins</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, maxWidth: 560 }}>
            Premios canjeables visibles para jugadores. Cada sede administra solo sus beneficios.
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
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Nuevo beneficio
          </button>
        )}
      </div>

      {pcNeedsSelector && (
        <div style={{ marginBottom: 20, maxWidth: 360 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Sede</span>
            <select
              value={pcSedeId}
              onChange={(e) => { setPcSedeId(e.target.value); cerrarPremioForm(); }}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
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
        <p style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 10, maxWidth: 520 }}>
          {esAdminClub
            ? 'Tu usuario no tiene sede asignada para gestionar beneficios.'
            : 'Seleccioná una sede para gestionar beneficios PadCoins.'}
        </p>
      )}

      {effectivePcSedeId && sedeNombre && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Sede: <strong style={{ color: 'white' }}>{sedeNombre}</strong>
          {isSuperAdmin ? ' · Super Admin' : esAdminClub ? ' · Admin Club' : ''}
        </p>
      )}

      {premioFormMode && effectivePcSedeId && (
        <form
          onSubmit={guardarPremio}
          style={{ background: 'white', borderRadius: 12, padding: 20, maxWidth: 820, color: '#1e293b', marginBottom: 24 }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 17, color: '#334155' }}>
            {premioFormMode === 'edit' ? 'Editar beneficio' : 'Nuevo beneficio'}
          </h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Nombre *</span>
              <input type="text" value={premioForm.nombre} onChange={(e) => setPremioForm((p) => ({ ...p, nombre: e.target.value }))} required style={PC_INP} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Descripción</span>
              <textarea value={premioForm.descripcion} onChange={(e) => setPremioForm((p) => ({ ...p, descripcion: e.target.value }))} rows={3} style={{ ...PC_INP, resize: 'vertical' }} />
            </label>

            <div>
              <span style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 8 }}>Imagen (opcional)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <PremioImagenPreview url={premioForm.imagen_url} alt={premioForm.nombre} />
                <label style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 8, background: uploadingImagen ? '#94a3b8' : '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: uploadingImagen ? 'wait' : 'pointer' }}>
                  {uploadingImagen ? '⏳ Subiendo…' : premioForm.imagen_url ? 'Cambiar imagen' : '📤 Subir imagen'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={uploadingImagen || premioSaving} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void subirImagenPremio(f); }} />
                </label>
                <input type="url" placeholder="o pegá URL de imagen" value={premioForm.imagen_url} onChange={(e) => setPremioForm((p) => ({ ...p, imagen_url: e.target.value }))} style={{ ...PC_INP, flex: '1 1 200px' }} />
                {premioForm.imagen_url ? (
                  <button type="button" onClick={() => setPremioForm((p) => ({ ...p, imagen_url: '' }))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Costo (PadCoins) *</span>
                <input type="number" min="1" step="1" value={premioForm.costo_padcoins} onChange={(e) => setPremioForm((p) => ({ ...p, costo_padcoins: e.target.value }))} required style={PC_INP} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Stock total</span>
                <input type="number" min="0" step="1" value={premioForm.stock_total} onChange={(e) => setPremioForm((p) => ({ ...p, stock_total: e.target.value }))} style={PC_INP} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Stock disponible</span>
                <input type="number" min="0" step="1" value={premioForm.stock_disponible} onChange={(e) => setPremioForm((p) => ({ ...p, stock_disponible: e.target.value }))} style={PC_INP} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Validez canje (días)</span>
                <input type="number" min="1" step="1" placeholder="Default sede" value={premioForm.canje_validez_dias} onChange={(e) => setPremioForm((p) => ({ ...p, canje_validez_dias: e.target.value }))} style={PC_INP} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Vigencia desde</span>
                <input type="date" value={premioForm.fecha_inicio} onChange={(e) => setPremioForm((p) => ({ ...p, fecha_inicio: e.target.value }))} style={PC_INP} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Vigencia hasta</span>
                <input type="date" value={premioForm.fecha_fin} onChange={(e) => setPremioForm((p) => ({ ...p, fecha_fin: e.target.value }))} style={PC_INP} />
              </label>
            </div>

            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 13, padding: '0 6px' }}>Límite por usuario (0 o vacío = sin límite)</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Cantidad</span>
                  <input type="number" min="0" step="1" value={premioForm.limite_usuario_cantidad} onChange={(e) => setPremioForm((p) => ({ ...p, limite_usuario_cantidad: e.target.value }))} style={PC_INP} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Período</span>
                  <select value={premioForm.limite_usuario_periodo} onChange={(e) => setPremioForm((p) => ({ ...p, limite_usuario_periodo: e.target.value }))} style={PC_INP}>
                    <option value="">—</option>
                    {PREMIO_LIMITE_PERIODOS.map((row) => (
                      <option key={row.id} value={row.id}>{row.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 13, padding: '0 6px' }}>Límite global (0 o vacío = sin límite)</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Cantidad</span>
                  <input type="number" min="0" step="1" value={premioForm.limite_global_cantidad} onChange={(e) => setPremioForm((p) => ({ ...p, limite_global_cantidad: e.target.value }))} style={PC_INP} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Período</span>
                  <select value={premioForm.limite_global_periodo} onChange={(e) => setPremioForm((p) => ({ ...p, limite_global_periodo: e.target.value }))} style={PC_INP}>
                    <option value="">—</option>
                    {PREMIO_LIMITE_PERIODOS.map((row) => (
                      <option key={row.id} value={row.id}>{row.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Condiciones</span>
              <textarea value={premioForm.condiciones} onChange={(e) => setPremioForm((p) => ({ ...p, condiciones: e.target.value }))} rows={2} placeholder="Ej: Válido de lunes a viernes" style={{ ...PC_INP, resize: 'vertical' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <input type="checkbox" checked={!!premioForm.activo} onChange={(e) => setPremioForm((p) => ({ ...p, activo: e.target.checked }))} />
              Beneficio activo
            </label>
          </div>

          {premioFormError && (
            <p style={{ color: '#dc2626', fontWeight: 600, marginTop: 14, marginBottom: 0 }}>{premioFormError}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="submit" disabled={premioSaving || uploadingImagen} style={{ padding: '10px 20px', background: premioSaving ? '#94a3b8' : '#43a047', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: premioSaving ? 'not-allowed' : 'pointer' }}>
              {premioSaving ? 'Guardando...' : 'Guardar beneficio'}
            </button>
            <button type="button" onClick={cerrarPremioForm} disabled={premioSaving} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: premioSaving ? 'not-allowed' : 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {effectivePcSedeId && premiosLoading && (
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Cargando beneficios...</p>
      )}

      {effectivePcSedeId && !premiosLoading && premiosError && (
        <p style={{ color: '#fecaca', fontWeight: 600, background: 'rgba(220,38,38,0.2)', padding: '12px 16px', borderRadius: 8, maxWidth: 560 }}>
          {premiosError}
        </p>
      )}

      {effectivePcSedeId && !premiosLoading && !premiosError && premios.length === 0 && !premioFormMode && (
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>No hay beneficios cargados para esta sede.</p>
      )}

      {effectivePcSedeId && !premiosLoading && premios.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {premios.map((premio) => (
            <div key={premio.id} style={{ background: 'white', borderRadius: 10, padding: '16px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
              <PremioImagenPreview url={premio.imagen_url} alt={premio.nombre} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <strong style={{ fontSize: 16, color: '#1e293b' }}>{premio.nombre}</strong>
                  <span style={{ background: premio.activo !== false ? '#dcfce7' : '#f1f5f9', color: premio.activo !== false ? '#166534' : '#64748b', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                    {premio.activo !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {premio.descripcion && <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 13 }}>{premio.descripcion}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#475569' }}>
                  <span><strong>Costo:</strong> {premio.costo_padcoins} PadCoins</span>
                  {premio.stock_total != null && <span><strong>Stock:</strong> {premio.stock_disponible ?? '—'} / {premio.stock_total}</span>}
                  {(premio.fecha_inicio || premio.fecha_fin) && (
                    <span><strong>Vigencia:</strong> {premio.fecha_inicio ? String(premio.fecha_inicio).slice(0, 10) : '—'} → {premio.fecha_fin ? String(premio.fecha_fin).slice(0, 10) : '—'}</span>
                  )}
                  <span><strong>Lím. usuario:</strong> {formatPremioLimite(premio.limite_usuario_cantidad, premio.limite_usuario_periodo)}</span>
                  <span><strong>Lím. global:</strong> {formatPremioLimite(premio.limite_global_cantidad, premio.limite_global_periodo)}</span>
                  {premio.canje_validez_dias != null && <span><strong>Validez canje:</strong> {premio.canje_validez_dias} días</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => abrirEditarPremio(premio)} style={{ padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>✏️ Editar</button>
                <button type="button" onClick={() => void desactivarPremio(premio)} style={{ padding: '7px 14px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Desactivar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
