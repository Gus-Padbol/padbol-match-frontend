import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#333',
};

const cardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
  background: '#fff',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

/**
 * Mi Sede — extras del tercer tiempo (MEJ-06: formulario nuevo bajo demanda).
 */
export default function AdminSedeExtrasSection({
  apiBaseUrl,
  accessToken,
  sedeId,
  monedaSede = 'ARS',
  isSuperAdmin = false,
}) {
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
  const [edits, setEdits] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingImagen, setUploadingImagen] = useState(null);

  const load = useCallback(async () => {
    if (!sedeId || !accessToken) {
      setExtras([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras-admin`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudieron cargar los extras');
      const list = Array.isArray(j.extras) ? j.extras : [];
      setExtras(list);
      const nextEdits = {};
      for (const row of list) {
        nextEdits[row.id] = {
          precio: row.precio != null ? String(Math.round(Number(row.precio))) : '',
          activo: !!row.activo,
          stock: row.stock != null ? String(row.stock) : '',
        };
      }
      setEdits(nextEdits);
    } catch (e) {
      setMsg(e.message || 'Error');
      setExtras([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken, sedeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stockPayload = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const subirImagenExtra = async (file, target, assign) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setMsg('Elegí una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg('La imagen no puede superar 4 MB.');
      return;
    }
    setUploadingImagen(target);
    setMsg('');
    const safe = String(file.name || 'extra').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `extras/${sedeId}/${Date.now()}_${safe}`;
    try {
      const { data: uploadData, error: upErr } = await supabase.storage.from('sponsors').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) {
        setMsg(`⚠️ ${upErr.message}`);
        return;
      }
      const filePath = uploadData?.path != null && String(uploadData.path).trim() !== ''
        ? String(uploadData.path).trim()
        : path;
      const { data } = supabase.storage.from('sponsors').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl != null ? String(data.publicUrl).trim() : '';
      if (!publicUrl) {
        setMsg('⚠️ No se obtuvo URL pública de la imagen');
        return;
      }
      assign(publicUrl);
    } finally {
      setUploadingImagen(null);
    }
  };

  const imagenUploadControl = ({ target, value, onChangeUrl }) => {
    const busy = uploadingImagen === target;
    const url = String(value || '').trim();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {url ? (
          <img
            src={url}
            alt=""
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              border: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🏷️
          </div>
        )}
        <label
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 8,
            background: busy ? '#9ca3af' : '#4f46e5',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? '⏳ Subiendo…' : url ? 'Cambiar imagen' : '📤 Subir imagen'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void subirImagenExtra(f, target, onChangeUrl);
            }}
          />
        </label>
        {url ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeUrl('')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Quitar
          </button>
        ) : null}
      </div>
    );
  };

  const resetNewForm = () => {
    setDraft({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
    setShowNewForm(false);
  };

  const crear = async () => {
    const nombre = String(draft.nombre || '').trim();
    if (!nombre) {
      setMsg('Completá el nombre del extra.');
      return;
    }
    setCreating(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nombre,
          descripcion: String(draft.descripcion || '').trim() || null,
          precio: draft.precio,
          precio_moneda: monedaSede,
          imagen_url: String(draft.imagen_url || '').trim() || null,
          activo: true,
          stock: stockPayload(draft.stock),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo crear');
      resetNewForm();
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const guardarFila = async (rowId) => {
    const ed = edits[rowId];
    if (!ed) return;
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            precio: ed.precio,
            activo: ed.activo,
            stock: stockPayload(ed.stock),
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const aprobar = async (rowId) => {
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ aprobado_super: true }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo aprobar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const guardarEdicionModal = async () => {
    if (!editRow?.id) return;
    setSavingId(editRow.id);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(editRow.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            nombre: String(editRow.nombre || '').trim(),
            descripcion: String(editRow.descripcion || '').trim() || null,
            precio: editRow.precio,
            stock: stockPayload(editRow.stock),
            imagen_url: String(editRow.imagen_url || '').trim() || null,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
      setEditRow(null);
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const eliminarExtra = async () => {
    const rowId = deleteTarget?.id;
    if (!rowId) return;
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo eliminar');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const rechazar = async (rowId) => {
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ activo: false }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo actualizar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  if (!sedeId || !accessToken) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
        Iniciá sesión nuevamente para gestionar extras.
      </p>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5, color: '#555' }}>
        Productos o servicios opcionales que los jugadores pueden sumar al pagar una reserva «Armar partido».
        Los nuevos extras pueden quedar pendientes de aprobación del super admin.
      </p>
      {msg ? (
        <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{msg}</p>
      ) : null}
      {loading ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>Cargando extras…</p>
      ) : (
        <>
          {extras.length === 0 && !showNewForm ? (
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              No hay extras cargados todavía.
            </p>
          ) : null}
          {extras.map((row) => {
            const ed = edits[row.id] || { precio: '', activo: true };
            const pendiente = !row.aprobado_super;
            return (
              <div key={row.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                  {String(row.imagen_url || '').trim() ? (
                    <img
                      src={String(row.imagen_url).trim()}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }}
                    />
                  ) : null}
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#334155' }}>{row.nombre}</div>
                </div>
                {row.descripcion ? (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>{row.descripcion}</p>
                ) : null}
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {pendiente ? (
                    <span style={{ color: '#ca8a04', fontWeight: 700 }}>Pendiente de aprobación</span>
                  ) : (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Aprobado</span>
                  )}
                  {!row.activo ? (
                    <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 600 }}>Inactivo</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                    Precio ({row.precio_moneda || monedaSede})
                    <input
                      type="text"
                      inputMode="decimal"
                      style={{ ...inputStyle, marginLeft: 8, width: 120 }}
                      value={ed.precio}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, precio: e.target.value } }))}
                    />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
                    <input
                      type="checkbox"
                      checked={ed.activo}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, activo: e.target.checked } }))}
                    />
                    Activo
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                    Stock
                    <input
                      type="number"
                      min={0}
                      style={{ ...inputStyle, marginLeft: 8, width: 88 }}
                      placeholder="∞"
                      value={ed.stock ?? ''}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, stock: e.target.value } }))}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => guardarFila(row.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#4f46e5',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: savingId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() =>
                      setEditRow({
                        id: row.id,
                        nombre: row.nombre,
                        descripcion: row.descripcion || '',
                        precio: ed.precio,
                        stock: ed.stock ?? '',
                        imagen_url: row.imagen_url || '',
                      })
                    }
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#334155',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: savingId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => setDeleteTarget({ id: row.id, nombre: row.nombre })}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #fecaca',
                      background: 'transparent',
                      color: '#b91c1c',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: savingId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Eliminar
                  </button>
                  {isSuperAdmin && pendiente ? (
                    <>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => aprobar(row.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #16a34a',
                          background: 'transparent',
                          color: '#16a34a',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: savingId === row.id ? 'wait' : 'pointer',
                        }}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => rechazar(row.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: savingId === row.id ? 'wait' : 'pointer',
                        }}
                      >
                        Rechazar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!showNewForm ? (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Agregar extra
            </button>
          ) : (
            <div style={{ ...cardStyle, marginTop: extras.length ? 8 : 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: '#334155' }}>Nuevo extra</div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Nombre</label>
              <input
                style={{ ...inputStyle, maxWidth: 360, marginBottom: 10 }}
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                maxLength={200}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Descripción (opcional)</label>
              <textarea
                style={{ ...inputStyle, maxWidth: 360, minHeight: 64, marginBottom: 10, resize: 'vertical' }}
                value={draft.descripcion}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Precio ({monedaSede})</label>
              <input
                style={{ ...inputStyle, maxWidth: 200, marginBottom: 10 }}
                value={draft.precio}
                onChange={(e) => setDraft((d) => ({ ...d, precio: e.target.value }))}
                inputMode="decimal"
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Stock (opcional)</label>
              <input
                style={{ ...inputStyle, maxWidth: 200, marginBottom: 10 }}
                value={draft.stock}
                onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                inputMode="numeric"
                min={0}
                placeholder="Ilimitado"
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Imagen (opcional)</label>
              {imagenUploadControl({
                target: 'draft',
                value: draft.imagen_url,
                onChangeUrl: (url) => setDraft((d) => ({ ...d, imagen_url: url })),
              })}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  disabled={creating}
                  onClick={crear}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: creating ? '#9ca3af' : '#4f46e5',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: creating ? 'wait' : 'pointer',
                  }}
                >
                  {creating ? 'Creando…' : 'Crear extra'}
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={resetNewForm}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: creating ? 'wait' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {deleteTarget ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !savingId && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: '0 0 8px', color: '#334155', fontSize: 16 }}>Eliminar producto</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>
              ¿Eliminar <strong>{deleteTarget.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#334155' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(savingId)}
                onClick={() => void eliminarExtra()}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 700 }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !savingId && setEditRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: '#334155', fontSize: 16 }}>Editar producto</h3>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Nombre</label>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              value={editRow.nombre}
              onChange={(e) => setEditRow((r) => ({ ...r, nombre: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Descripción</label>
            <textarea
              style={{ ...inputStyle, minHeight: 56, marginBottom: 10, resize: 'vertical' }}
              value={editRow.descripcion}
              onChange={(e) => setEditRow((r) => ({ ...r, descripcion: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Precio ({monedaSede})</label>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              value={editRow.precio}
              onChange={(e) => setEditRow((r) => ({ ...r, precio: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Stock (vacío = ilimitado)</label>
            <input
              style={{ ...inputStyle, marginBottom: 14 }}
              value={editRow.stock}
              onChange={(e) => setEditRow((r) => ({ ...r, stock: e.target.value }))}
              inputMode="numeric"
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>Imagen (opcional)</label>
            {imagenUploadControl({
              target: 'edit',
              value: editRow.imagen_url,
              onChangeUrl: (url) => setEditRow((r) => ({ ...r, imagen_url: url })),
            })}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditRow(null)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#334155' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingId === editRow.id}
                onClick={() => void guardarEdicionModal()}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700 }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
