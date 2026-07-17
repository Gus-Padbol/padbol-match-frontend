import React, { useState } from 'react';
import { useSafeTranslation } from '../i18n/tSafe';
import { getAuthHeaders } from '../utils/scoreboardApi';
import {
  buildPagosPatchPayload,
  parseSedePatchResponse,
  pagosEstadoKey,
} from '../utils/miSedePagos';

const cardStyle = {
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  maxWidth: '480px',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#555',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#333',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  marginBottom: '6px',
};

const estadoStyle = {
  configurado: { color: '#16a34a' },
  no_configurado: { color: '#b45309' },
  desconocido: { color: '#6b7280' },
};

/**
 * Mi Sede — Configuración de pagos (write-only).
 *
 * Las credenciales nunca se cargan desde el Backend ni se muestran:
 * los inputs siempre inician vacíos y solo se envía una credencial cuando
 * el administrador escribe un valor nuevo. El estado configurado/no
 * configurado se toma de indicadores booleanos seguros (`response.pagos`
 * del PATCH /api/sedes/:id, o derivados en memoria en la carga inicial).
 */
export default function AdminSedePagosSection({
  apiBaseUrl,
  sedeId,
  pagos = { mercadopago_configurado: null, stripe_configurado: null },
  onPagosChange = () => {},
  onSedeActualizada = () => {},
}) {
  const { t } = useSafeTranslation();
  const [mpInput, setMpInput] = useState('');
  const [stripeInput, setStripeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'error'|'info', texto }

  const ESTADO_TEXTOS = {
    mp: {
      configurado: t('miSede.pagos.mpConfigurado', 'Mercado Pago configurado'),
      no_configurado: t('miSede.pagos.mpNoConfigurado', 'Mercado Pago no configurado'),
      desconocido: t('miSede.pagos.estadoNoDisponible', 'Estado no disponible'),
    },
    stripe: {
      configurado: t('miSede.pagos.stripeConfigurado', 'Stripe configurado'),
      no_configurado: t('miSede.pagos.stripeNoConfigurado', 'Stripe no configurado'),
      desconocido: t('miSede.pagos.estadoNoDisponible', 'Estado no disponible'),
    },
  };

  const PLACEHOLDER_REEMPLAZAR = t(
    'miSede.pagos.placeholderReemplazar',
    'Ingresá una nueva credencial para reemplazar la actual',
  );
  const PLACEHOLDER_INGRESAR = t('miSede.pagos.placeholderIngresar', 'Ingresá la credencial');

  const placeholderFor = (indicador) => (indicador === true ? PLACEHOLDER_REEMPLAZAR : PLACEHOLDER_INGRESAR);
  const placeholders = [PLACEHOLDER_REEMPLAZAR, PLACEHOLDER_INGRESAR];

  const guardar = async () => {
    const payload = buildPagosPatchPayload({
      mpAccessToken: mpInput,
      stripeAccountId: stripeInput,
      placeholders,
    });

    if (Object.keys(payload).length === 0) {
      setMsg({ tipo: 'info', texto: t('miSede.pagos.sinCambios', 'No hay una credencial nueva para guardar') });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // Mensaje controlado, sin detalles internos ni credenciales.
        setMsg({ tipo: 'error', texto: t('miSede.pagos.errorGuardar', 'No se pudo guardar la configuración de pagos. Reintentá en unos segundos.') });
        return;
      }

      const { sede, pagos: nuevosPagos } = parseSedePatchResponse(json, pagos);
      onPagosChange(nuevosPagos);
      if (sede) onSedeActualizada(sede);

      const mpEnviadoYNoQuedo = 'mp_access_token' in payload && nuevosPagos.mercadopago_configurado !== true;
      const stripeEnviadoYNoQuedo = 'stripe_account_id' in payload && nuevosPagos.stripe_configurado !== true;
      if (mpEnviadoYNoQuedo || stripeEnviadoYNoQuedo) {
        // El Backend descartó la credencial (rol sin permiso para escribirla).
        setMsg({ tipo: 'error', texto: t('miSede.pagos.sinPermisoCredencial', 'Tu rol no tiene permiso para guardar esta credencial. Contactá a un administrador de PADBOL.') });
        return;
      }

      // Éxito: limpiar inmediatamente los inputs secretos.
      setMpInput('');
      setStripeInput('');
      setMsg({ tipo: 'ok', texto: t('miSede.pagos.guardadoOk', 'Configuración de pagos guardada') });
    } catch {
      // Error de red: conservar lo escrito para reintentar; nunca loguear la credencial.
      setMsg({ tipo: 'error', texto: t('miSede.pagos.errorGuardar', 'No se pudo guardar la configuración de pagos. Reintentá en unos segundos.') });
    } finally {
      setSaving(false);
    }
  };

  const mpEstado = pagosEstadoKey(pagos?.mercadopago_configurado);
  const stripeEstado = pagosEstadoKey(pagos?.stripe_configurado);

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>
        💳 {t('miSede.pagos.titulo', 'Configuración de pagos')}
      </h3>
      <div style={cardStyle}>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
          {t('miSede.pagos.descripcion', 'Las credenciales son privadas: se guardan pero nunca se vuelven a mostrar. Para cambiarlas, ingresá un valor nuevo.')}
        </p>

        <label style={labelStyle} htmlFor="pagos-mp-input">
          {t('miSede.pagos.mpLabel', 'Access Token de Mercado Pago')}
        </label>
        <input
          id="pagos-mp-input"
          type="password"
          autoComplete="off"
          value={mpInput}
          placeholder={placeholderFor(pagos?.mercadopago_configurado)}
          onChange={(e) => setMpInput(e.target.value)}
          style={inputStyle}
        />
        <p data-testid="pagos-mp-estado" style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: 600, ...estadoStyle[mpEstado] }}>
          {ESTADO_TEXTOS.mp[mpEstado]}
        </p>

        <label style={labelStyle} htmlFor="pagos-stripe-input">
          {t('miSede.pagos.stripeLabel', 'Cuenta de Stripe')}
        </label>
        <input
          id="pagos-stripe-input"
          type="password"
          autoComplete="off"
          value={stripeInput}
          placeholder={placeholderFor(pagos?.stripe_configurado)}
          onChange={(e) => setStripeInput(e.target.value)}
          style={inputStyle}
        />
        <p data-testid="pagos-stripe-estado" style={{ margin: '0 0 18px', fontSize: '12px', fontWeight: 600, ...estadoStyle[stripeEstado] }}>
          {ESTADO_TEXTOS.stripe[stripeEstado]}
        </p>

        <button
          onClick={guardar}
          disabled={saving}
          style={{ padding: '8px 20px', background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          {saving
            ? `⏳ ${t('miSede.pagos.guardando', 'Guardando...')}`
            : `💾 ${t('miSede.pagos.guardarBtn', 'Guardar credenciales')}`}
        </button>
        {msg && (
          <span
            data-testid="pagos-msg"
            style={{ marginLeft: '12px', fontSize: '13px', fontWeight: 600, color: msg.tipo === 'ok' ? '#16a34a' : msg.tipo === 'info' ? '#6b7280' : '#dc2626' }}
          >
            {msg.tipo === 'ok' ? '✅ ' : msg.tipo === 'error' ? '⚠️ ' : ''}{msg.texto}
          </span>
        )}
      </div>
    </div>
  );
}
