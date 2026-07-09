import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { API_BASE, getAuthHeaders } from '../utils/scoreboardApi';
import {
  TIPO_DOCUMENTO_OPTIONS,
  GENERO_OPTIONS,
  PAISES_ISO_OPTIONS,
  parseIdentidadFromApi,
  identidadEstadoDisplay,
  emptyIdentidadForm,
  identidadToForm,
  buildIdentidadPutPayload,
  validateIdentidadForm,
} from '../utils/jugadorIdentidad';

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '6px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  boxSizing: 'border-box',
  fontSize: '14px',
  background: 'white',
};

const labelStyle = {
  display: 'block',
  fontWeight: 'bold',
  marginBottom: '5px',
  color: '#333',
  fontSize: '13px',
};

export default function JugadorFichaTorneosSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState(emptyIdentidadForm);
  const [replaceDocument, setReplaceDocument] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadIdentidad = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setAuthMissing(true);
        setParsed(null);
        setForm(emptyIdentidadForm());
        return;
      }
      setAuthMissing(false);
      const res = await fetch(`${API_BASE}/api/jugador/identidad`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'No se pudo cargar la ficha para torneos');
      }
      const nextParsed = parseIdentidadFromApi(body);
      setParsed(nextParsed);
      setForm(identidadToForm(nextParsed));
      setReplaceDocument(false);
    } catch (e) {
      setLoadError(e.message || 'Error al cargar la ficha');
      setParsed(null);
      setForm(emptyIdentidadForm());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIdentidad();
  }, [loadIdentidad]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadIdentidad();
    });
    return () => subscription.unsubscribe();
  }, [loadIdentidad]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const hasExistingDocument = Boolean(parsed?.tiene_documento);
    const errors = validateIdentidadForm(form, { hasExistingDocument, replaceDocument });
    if (errors.length) {
      setErrorMsg(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setAuthMissing(true);
        setErrorMsg('Volvé a iniciar sesión para guardar la ficha.');
        return;
      }
      const payload = buildIdentidadPutPayload(form, { replaceDocument, hasExistingDocument });
      const res = await fetch(`${API_BASE}/api/jugador/identidad`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'No se pudo guardar la ficha');
      }
      setSuccessMsg('✅ Ficha guardada correctamente');
      setReplaceDocument(false);
      await loadIdentidad();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const estadoUi = identidadEstadoDisplay(parsed?.estado || 'incompleta');
  const maskedDoc = parsed?.numero_documento_mascarado || '';
  const formDisabled = saving;

  return (
    <div
      id="ficha-torneos"
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '20px 24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        marginBottom: '16px',
        border: '1px solid #c7d2fe',
        borderLeft: '4px solid #1e3a8a',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#1e3a8a', fontSize: '16px' }}>Ficha para torneos</h4>
        {!loading ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              color: estadoUi.color,
              background: estadoUi.bg,
              border: `1px solid ${estadoUi.color}33`,
            }}
          >
            {estadoUi.label}
          </span>
        ) : null}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666', lineHeight: 1.45 }}>
        Estos datos ayudan a validar identidad y categorías en torneos. Solo vos podés verlos desde tu perfil.
      </p>

      {loading ? (
        <p style={{ color: '#888', fontSize: '14px', margin: '0 0 12px' }}>Cargando ficha…</p>
      ) : null}

      {authMissing ? (
        <p style={{ color: '#b45309', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.45 }}>
          Tu sesión no está lista para sincronizar con el servidor. Podés completar la ficha abajo; si no podés guardar, volvé a iniciar sesión.
        </p>
      ) : null}

      {loadError ? (
        <p style={{ color: '#b91c1c', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.45 }}>
          No se pudieron cargar datos guardados ({loadError}). Completá la ficha y guardala.
        </p>
      ) : null}

      <form onSubmit={handleGuardar}>
          <label style={labelStyle}>Fecha de nacimiento</label>
          <input
            type="date"
            name="fecha_nacimiento"
            value={form.fecha_nacimiento}
            onChange={handleChange}
            disabled={formDisabled}
            style={{ ...inputStyle, marginBottom: '14px' }}
          />

          <label style={labelStyle}>Tipo de documento</label>
          <select
            name="tipo_documento"
            value={form.tipo_documento}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          >
            {TIPO_DOCUMENTO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label style={labelStyle}>País del documento</label>
          <select
            name="pais_documento"
            value={form.pais_documento}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          >
            {PAISES_ISO_OPTIONS.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Número de documento</label>
          {parsed?.tiene_documento && !replaceDocument ? (
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  fontSize: '14px',
                  color: '#334155',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}
              >
                {maskedDoc || '••••••••'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplaceDocument(true);
                  setForm((prev) => ({ ...prev, numero_documento: '' }));
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reemplazar documento
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                name="numero_documento"
                value={form.numero_documento}
                onChange={handleChange}
                placeholder="Solo visible para vos al guardar"
                autoComplete="off"
                style={{ ...inputStyle, marginBottom: replaceDocument ? '8px' : '14px' }}
              />
              {replaceDocument ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplaceDocument(false);
                    setForm((prev) => ({ ...prev, numero_documento: '' }));
                  }}
                  style={{
                    marginBottom: '14px',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    fontSize: '12px',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar reemplazo
                </button>
              ) : null}
            </>
          )}

          <label style={labelStyle}>Nacionalidad</label>
          <select
            name="nacionalidad"
            value={form.nacionalidad}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          >
            {PAISES_ISO_OPTIONS.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Género</label>
          <select
            name="genero"
            value={form.genero}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          >
            <option value="">— Seleccionar —</option>
            {GENERO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Teléfono</label>
          <input
            type="tel"
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            placeholder="Ej: +5491112345678"
            style={{ ...inputStyle, marginBottom: '14px' }}
          />

          <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#444' }}>Contacto de emergencia</p>

          <label style={labelStyle}>Nombre</label>
          <input
            type="text"
            name="contacto_emergencia_nombre"
            value={form.contacto_emergencia_nombre}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          />

          <label style={labelStyle}>Teléfono</label>
          <input
            type="tel"
            name="contacto_emergencia_telefono"
            value={form.contacto_emergencia_telefono}
            onChange={handleChange}
            style={{ ...inputStyle, marginBottom: '14px' }}
          />

          <label style={labelStyle}>Relación</label>
          <input
            type="text"
            name="contacto_emergencia_relacion"
            value={form.contacto_emergencia_relacion}
            onChange={handleChange}
            placeholder="Ej: Madre, pareja, amigo"
            style={{ ...inputStyle, marginBottom: '14px' }}
          />

          {errorMsg ? (
            <p style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '10px' }}>{errorMsg}</p>
          ) : null}
          {successMsg ? (
            <p style={{ color: '#15803d', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>{successMsg}</p>
          ) : null}

        <button
          type="submit"
          disabled={formDisabled}
          style={{
            width: '100%',
            padding: '11px',
            background: '#1e3a8a',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: formDisabled ? 'wait' : 'pointer',
            fontWeight: 'bold',
            opacity: formDisabled ? 0.7 : 1,
          }}
        >
          {saving ? 'Guardando…' : 'Guardar ficha'}
        </button>
      </form>
    </div>
  );
}
