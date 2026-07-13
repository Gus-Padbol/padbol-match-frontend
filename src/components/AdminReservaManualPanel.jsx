import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAuthHeaders } from '../utils/scoreboardApi';
import {
  RESERVA_MANUAL_DURACIONES,
  RESERVA_MANUAL_ESTADOS,
  ahoraArgentinaPartes,
  canchasManualDesdeFilas,
  crearReservaManualApi,
  slotsReservaManualDisponibles,
  validateReservaManualForm,
  validationErrorMessage,
  buildReservaManualPostPayload,
} from '../utils/adminReservaManual';

const DEFAULT_FORM = (sedeIdDefault) => ({
  sede_id: sedeIdDefault != null ? String(sedeIdDefault) : '',
  cancha: '',
  fecha: '',
  hora: '',
  duracion: 90,
  nombre: '',
  telefono: '',
  estado: 'confirmada',
});

export default function AdminReservaManualPanel({
  apiBaseUrl,
  sedesMap,
  reservas,
  esAdminClub,
  sedeId,
  adminEmail,
  onSuccess,
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [canchasRows, setCanchasRows] = useState([]);
  const [canchasLoading, setCanchasLoading] = useState(false);
  const [form, setForm] = useState(() => DEFAULT_FORM(esAdminClub ? sedeId : ''));

  const sedesList = Object.values(sedesMap || {}).sort((a, b) =>
    String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' }),
  );
  const mostrarSelectorSede = !esAdminClub && sedesList.length !== 1;
  const sedeManualId = String(form.sede_id || (esAdminClub && sedeId != null ? sedeId : '') || '');
  const sedeRow = sedeManualId ? sedesMap[sedeManualId] : null;
  const canchasOptions = canchasManualDesdeFilas(canchasRows, sedeRow);
  const slotCtx = ahoraArgentinaPartes();
  const horariosDisponibles = slotsReservaManualDisponibles({
    sedeRow,
    reservas,
    fecha: form.fecha,
    cancha: form.cancha,
    duracion: form.duracion,
    ctx: slotCtx,
  });

  useEffect(() => {
    if (!open) return;
    if (!sedeManualId) {
      setCanchasRows([]);
      return;
    }
    let cancelled = false;
    setCanchasLoading(true);
    supabase
      .from('canchas')
      .select('id, nombre, estado, orden, numero_reserva')
      .eq('sede_id', sedeManualId)
      .order('nombre')
      .then(({ data, error: sbErr }) => {
        if (cancelled) return;
        if (sbErr) {
          setCanchasRows([]);
        } else {
          setCanchasRows(data || []);
        }
        setCanchasLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, sedeManualId]);

  useEffect(() => {
    if (open && !form.sede_id && sedesList.length === 1) {
      setForm((prev) => ({ ...prev, sede_id: String(sedesList[0].id) }));
    }
  }, [open, form.sede_id, sedesList]);

  useEffect(() => {
    if (!form.hora) return;
    if (!horariosDisponibles.includes(form.hora)) {
      setForm((prev) => ({ ...prev, hora: '' }));
    }
  }, [form.hora, horariosDisponibles]);

  const resetForm = () => {
    setForm(DEFAULT_FORM(esAdminClub ? sedeId : ''));
    setError('');
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (saving) return;
    setError('');

    const validated = validateReservaManualForm(form, { esAdminClub, sedeIdDefault: sedeId });
    if (!validated.ok) {
      setError(validationErrorMessage(validated.errors));
      return;
    }

    const sedeNombre = String(sedeRow?.nombre || '').trim();
    if (!sedeNombre) {
      setError('Sede inválida o no encontrada.');
      return;
    }

    if (!horariosDisponibles.includes(validated.hora)) {
      setError('El horario seleccionado no está disponible u ocupado.');
      return;
    }

    const payload = buildReservaManualPostPayload(validated, {
      sedeNombre,
      email: adminEmail,
    });

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setError('Sesión expirada. Volvé a iniciar sesión.');
        return;
      }
      await crearReservaManualApi({
        apiBaseUrl,
        headers,
        payload,
        estadoDeseado: validated.estado,
      });
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setError('');
        }}
        style={{
          padding: '10px 16px',
          border: 'none',
          borderRadius: '8px',
          background: '#E11B22',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {open ? 'Cerrar formulario' : '+ Nueva reserva manual'}
      </button>

      {open ? (
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: '14px',
            display: 'grid',
            gap: '12px',
            background: '#fff',
            borderRadius: '12px',
            padding: '16px',
            color: '#1e293b',
            maxWidth: '720px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px' }}>Reserva manual</h3>

          {mostrarSelectorSede ? (
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Sede *</span>
              <select
                value={form.sede_id}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  sede_id: e.target.value,
                  cancha: '',
                  hora: '',
                }))}
                required
                style={inputStyle}
              >
                <option value="">Seleccionar sede</option>
                {sedesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Cancha *</span>
            <select
              value={form.cancha}
              onChange={(e) => setForm((prev) => ({ ...prev, cancha: e.target.value, hora: '' }))}
              required
              disabled={!sedeManualId || canchasLoading}
              style={inputStyle}
            >
              <option value="">
                {!sedeManualId
                  ? 'Elegí una sede primero'
                  : canchasLoading
                    ? 'Cargando canchas…'
                    : canchasOptions.length === 0
                      ? 'Sin canchas activas'
                      : 'Seleccionar cancha'}
              </option>
              {canchasOptions.map((c) => (
                <option key={c.numero} value={String(c.numero)}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Fecha *</span>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value, hora: '' }))}
                required
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Duración *</span>
              <select
                value={form.duracion}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  duracion: parseInt(e.target.value, 10),
                  hora: '',
                }))}
                style={inputStyle}
              >
                {RESERVA_MANUAL_DURACIONES.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Horario *</span>
            <select
              value={form.hora}
              onChange={(e) => setForm((prev) => ({ ...prev, hora: e.target.value }))}
              required
              disabled={!form.cancha || !form.fecha || horariosDisponibles.length === 0}
              style={inputStyle}
            >
              <option value="">
                {!form.cancha || !form.fecha
                  ? 'Elegí cancha y fecha'
                  : horariosDisponibles.length === 0
                    ? 'Sin horarios disponibles'
                    : 'Seleccionar horario'}
              </option>
              {horariosDisponibles.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Nombre *</span>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                required
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Teléfono / WhatsApp</span>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: '6px', maxWidth: '240px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Estado inicial</span>
            <select
              value={form.estado}
              onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
              style={inputStyle}
            >
              {RESERVA_MANUAL_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e === 'confirmada' ? 'Confirmada' : e === 'reservada' ? 'Reservada' : 'Pendiente'}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <div role="alert" style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 700 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 14px',
                border: 'none',
                borderRadius: '6px',
                background: saving ? '#94a3b8' : '#16a34a',
                color: '#fff',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creando…' : 'Crear reserva'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { setOpen(false); resetForm(); }}
              style={{
                padding: '9px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
