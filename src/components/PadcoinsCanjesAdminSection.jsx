import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { getAuthHeaders } from '../utils/scoreboardApi';
import {
  CANJE_ESTADOS_FILTRO,
  CANJES_PAGE_SIZE,
  buildCanjeHistorial,
  buildCanjesQueryParams,
  canjeCodigoDisplay,
  canjeCostoPadcoins,
  canjeEstadoBadge,
  canjeJugadorDisplay,
  canjeOperacionesFlags,
  canjePremioImagen,
  canjePremioNombre,
  canjePerteneceASede,
  extractCodigoFromScanValue,
  filterCanjesClient,
  formatCanjeDateTime,
  isBarcodeDetectorSupported,
  normalizeCanjeEstado,
  parseCanjesList,
  parseCanjesPagination,
  resolveCanjeQrValue,
} from '../utils/padcoinsCanjesAdmin';

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

function CanjeImagen({ row, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const src = canjePremioImagen(row);
  if (!src || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: 8, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, background: '#f8fafc' }}>🎁</div>
    );
  }
  return (
    <img src={src} alt="" onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
  );
}

function CanjeDetalleModal({
  open,
  onClose,
  canje,
  validation,
  sedeNombre,
  actionBusy,
  onAprobar,
  onEntregar,
  onCancelar,
  error,
}) {
  if (!open || !canje) return null;
  const badge = canjeEstadoBadge(canje.estado);
  const flags = canjeOperacionesFlags(canje, validation);
  const historial = buildCanjeHistorial(canje);
  const qrValue = resolveCanjeQrValue(canje);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 14, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 22, color: '#1e293b' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>Detalle del canje</h3>
            <span style={{ background: badge.bg, color: badge.color, borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label="Cerrar">×</button>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <CanjeImagen row={canje} size={72} />
          <div style={{ flex: 1, fontSize: 14, display: 'grid', gap: 4 }}>
            <div><strong>Beneficio:</strong> {canjePremioNombre(canje)}</div>
            <div><strong>Jugador:</strong> {canjeJugadorDisplay(canje)}</div>
            <div><strong>Sede:</strong> {sedeNombre || canje.sede_id || '—'}</div>
            <div><strong>Código:</strong> {canjeCodigoDisplay(canje)}</div>
            <div><strong>Costo:</strong> {canjeCostoPadcoins(canje) ?? '—'} PadCoins</div>
            <div><strong>Creado:</strong> {formatCanjeDateTime(canje.created_at)}</div>
            <div><strong>Vencimiento:</strong> {formatCanjeDateTime(canje.expires_at)}</div>
            <div><strong>Aprobado:</strong> {formatCanjeDateTime(canje.aprobado_at)}</div>
            <div><strong>Entregado:</strong> {formatCanjeDateTime(canje.entregado_at)}</div>
          </div>
        </div>

        {qrValue ? (
          <div style={{ textAlign: 'center', marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 10 }}>
            <QRCodeCanvas value={qrValue} size={180} level="M" includeMargin />
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>QR del canje (mismo payload que la app)</p>
          </div>
        ) : null}

        {historial.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 14 }}>Historial</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#475569' }}>
              {historial.map((item) => (
                <li key={item.key}>{item.label}: {formatCanjeDateTime(item.at)}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p style={{ color: '#dc2626', fontWeight: 600, fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {flags.aprobable && (
            <button type="button" disabled={actionBusy} onClick={() => onAprobar(canje)} style={{ padding: '8px 14px', background: actionBusy ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: actionBusy ? 'not-allowed' : 'pointer' }}>
              Aprobar
            </button>
          )}
          {flags.entregable && (
            <button type="button" disabled={actionBusy} onClick={() => onEntregar(canje)} style={{ padding: '8px 14px', background: actionBusy ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: actionBusy ? 'not-allowed' : 'pointer' }}>
              Entregar
            </button>
          )}
          {flags.cancelable && (
            <button type="button" disabled={actionBusy} onClick={() => onCancelar(canje)} style={{ padding: '8px 14px', background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, cursor: actionBusy ? 'not-allowed' : 'pointer' }}>
              Cancelar
            </button>
          )}
          {flags.final && (
            <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>Estado final — sin acciones disponibles.</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PadcoinsCanjesAdminSection({
  apiBaseUrl,
  isSuperAdmin,
  esAdminClub,
  resolvePcSedeId,
  sedesMap,
  active,
  onSuccessMessage,
  premiosOptions = [],
}) {
  const [subView, setSubView] = useState('listado');
  const [canjes, setCanjes] = useState([]);
  const [canjesLoading, setCanjesLoading] = useState(false);
  const [canjesError, setCanjesError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: CANJES_PAGE_SIZE, offset: 0, hasMore: false });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroBeneficioId, setFiltroBeneficioId] = useState('');
  const [filtroJugador, setFiltroJugador] = useState('');
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [detalleCanje, setDetalleCanje] = useState(null);
  const [detalleValidation, setDetalleValidation] = useState(null);
  const [detalleError, setDetalleError] = useState('');
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const actionLockRef = useRef(false);

  const [validarCodigo, setValidarCodigo] = useState('');
  const [validarLoading, setValidarLoading] = useState(false);
  const [validarError, setValidarError] = useState('');
  const [validarResult, setValidarResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const scanTimerRef = useRef(null);

  const effectivePcSedeId = resolvePcSedeId();
  const sedeNombre = effectivePcSedeId ? sedesMap[effectivePcSedeId]?.nombre : null;

  const clientFiltersActive = Boolean(
    filtroBeneficioId || filtroJugador || filtroCodigo || filtroDesde || filtroHasta,
  );

  const fetchCanjes = useCallback(async (offset = 0) => {
    const sid = resolvePcSedeId();
    if (!sid) {
      setCanjes([]);
      setPagination({ total: 0, limit: CANJES_PAGE_SIZE, offset: 0, hasMore: false });
      return;
    }
    setCanjesLoading(true);
    setCanjesError('');
    try {
      const headers = await getAuthHeaders();
      const params = buildCanjesQueryParams({
        sedeId: sid,
        estado: clientFiltersActive ? '' : filtroEstado,
        limit: clientFiltersActive ? 100 : CANJES_PAGE_SIZE,
        offset: clientFiltersActive ? 0 : offset,
      });
      const res = await fetch(`${apiBaseUrl}/api/admin/padcoins-canjes?${params}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error('No tenés permisos para ver canjes de esta sede.');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar canjes');

      let list = parseCanjesList(data).filter((row) => canjePerteneceASede(row, sid));
      if (clientFiltersActive) {
        list = filterCanjesClient(list, {
          beneficioId: filtroBeneficioId,
          jugador: filtroJugador,
          codigo: filtroCodigo,
          desde: filtroDesde,
          hasta: filtroHasta,
        });
        if (filtroEstado) {
          list = list.filter((row) => normalizeCanjeEstado(row.estado) === filtroEstado);
        }
        const pageStart = offset;
        const pageEnd = pageStart + CANJES_PAGE_SIZE;
        setPagination({
          total: list.length,
          limit: CANJES_PAGE_SIZE,
          offset: pageStart,
          hasMore: pageEnd < list.length,
        });
        setCanjes(list.slice(pageStart, pageEnd));
      } else {
        const pag = parseCanjesPagination(data);
        setCanjes(list);
        setPagination({ ...pag, hasMore: pag.offset + list.length < pag.total });
      }
    } catch (err) {
      setCanjesError(err.message || 'Error al cargar canjes');
      setCanjes([]);
      setPagination({ total: 0, limit: CANJES_PAGE_SIZE, offset: 0, hasMore: false });
    } finally {
      setCanjesLoading(false);
    }
  }, [
    apiBaseUrl,
    clientFiltersActive,
    filtroBeneficioId,
    filtroCodigo,
    filtroDesde,
    filtroEstado,
    filtroHasta,
    filtroJugador,
    resolvePcSedeId,
  ]);

  useEffect(() => {
    if (!active) return;
    const sid = resolvePcSedeId();
    if (!sid) {
      setCanjes([]);
      setCanjesError('');
      setCanjesLoading(false);
      return;
    }
    void fetchCanjes(0);
  }, [active, effectivePcSedeId, fetchCanjes, resolvePcSedeId]);

  async function cargarDetalleCanje(canjeId) {
    setDetalleError('');
    setDetalleValidation(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/admin/padcoins-canjes/${encodeURIComponent(canjeId)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('No tenés permisos para ver este canje.');
      if (!res.ok) throw new Error(data.error || data.message || 'Error al cargar detalle');
      const canje = data.canje || data;
      if (!canjePerteneceASede(canje, resolvePcSedeId())) {
        throw new Error('Este canje pertenece a otra sede.');
      }
      setDetalleCanje(canje);
      setDetalleValidation({
        aprobable: data.aprobable,
        entregable: data.entregable,
        cancelable: data.cancelable,
        final: data.final,
      });
      setDetalleOpen(true);
    } catch (err) {
      setDetalleError(err.message || 'Error al cargar detalle');
      alert(err.message || 'Error al cargar detalle');
    }
  }

  async function ejecutarAccionCanje(canje, action) {
    if (!canje?.id || actionLockRef.current) return;
    const codigo = canjeCodigoDisplay(canje);
    const confirmMessages = {
      aprobar: `¿Aprobar el canje ${codigo}? El jugador podrá retirar el beneficio en sede.`,
      entregar: `¿Marcar como entregado el canje ${codigo}?`,
      cancelar: `¿Cancelar el canje ${codigo}?\n\nSi el backend lo permite, se devolverá el saldo de PadCoins al jugador.`,
    };
    if (!window.confirm(confirmMessages[action])) return;

    actionLockRef.current = true;
    setActionBusyId(canje.id);
    setDetalleError('');
    try {
      const headers = await getAuthHeaders();
      const path = action === 'aprobar' ? 'aprobar' : action === 'entregar' ? 'entregar' : 'cancelar';
      const res = await fetch(`${apiBaseUrl}/api/admin/padcoins-canjes/${canje.id}/${path}`, {
        method: 'POST',
        headers,
        body: action === 'cancelar' ? JSON.stringify({}) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('No tenés permisos para operar canjes de esta sede.');
      if (!res.ok) throw new Error(data.error || data.message || `Error al ${action} canje`);

      const labels = { aprobar: '✅ Canje aprobado', entregar: '✅ Canje entregado', cancelar: '✅ Canje cancelado' };
      onSuccessMessage?.(labels[action]);
      setDetalleOpen(false);
      setDetalleCanje(null);
      setValidarResult(null);
      await fetchCanjes(pagination.offset);
    } catch (err) {
      const msg = err.message || `Error al ${action} canje`;
      setDetalleError(msg);
      alert(msg);
    } finally {
      setActionBusyId(null);
      actionLockRef.current = false;
    }
  }

  async function buscarPorCodigo(rawCodigo) {
    const codigo = extractCodigoFromScanValue(rawCodigo);
    if (!codigo) {
      setValidarError('Ingresá un código PC-... válido.');
      return;
    }
    const sid = resolvePcSedeId();
    if (!sid) {
      setValidarError('Seleccioná una sede antes de validar.');
      return;
    }
    setValidarLoading(true);
    setValidarError('');
    setValidarResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${apiBaseUrl}/api/admin/padcoins-canjes/validar?codigo=${encodeURIComponent(codigo)}`,
        { headers },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error('No tenés permisos para validar canjes de esta sede.');
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Canje no encontrado');

      const canje = data.canje || data;
      if (!canjePerteneceASede(canje, sid)) {
        const otraSede = sedesMap[String(canje.sede_id)]?.nombre || `Sede #${canje.sede_id}`;
        throw new Error(`Este canje pertenece a ${otraSede}. No podés operarlo desde la sede actual.`);
      }
      setValidarResult(data);
      setValidarCodigo(codigo);
    } catch (err) {
      setValidarError(err.message || 'Error al validar canje');
    } finally {
      setValidarLoading(false);
    }
  }

  async function iniciarEscaneoQr() {
    if (!isBarcodeDetectorSupported() || !navigator.mediaDevices?.getUserMedia) {
      setValidarError('Tu navegador no soporta lectura de QR por cámara. Usá el código manual.');
      return;
    }
    setValidarError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes?.[0]?.rawValue;
          if (raw) {
            detenerEscaneoQr();
            void buscarPorCodigo(raw);
          }
        } catch {
          /* frame sin detección */
        }
      }, 450);
    } catch (err) {
      setScanning(false);
      setValidarError(err.message || 'No se pudo acceder a la cámara.');
    }
  }

  function detenerEscaneoQr() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    const stream = videoRef.current?.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  useEffect(() => () => detenerEscaneoQr(), []);

  const canjesFiltrados = canjes;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {[
          { id: 'listado', label: 'Listado de canjes' },
          { id: 'validar', label: 'Validar canje' },
        ].map((tab) => {
          const isActive = subView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setSubView(tab.id); detenerEscaneoQr(); }}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: isActive ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.25)',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: 'white',
                fontWeight: isActive ? 700 : 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!effectivePcSedeId && (
        <p style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 10, maxWidth: 520 }}>
          Seleccioná una sede para gestionar canjes PadCoins.
        </p>
      )}

      {effectivePcSedeId && subView === 'listado' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 6px' }}>📋 Canjes</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 14, maxWidth: 640 }}>
                Canjes de la sede {sedeNombre || effectivePcSedeId}. Cada sede opera solo sus propios canjes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchCanjes(pagination.offset)}
              disabled={canjesLoading}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, cursor: canjesLoading ? 'wait' : 'pointer' }}
            >
              {canjesLoading ? 'Actualizando…' : '↻ Refrescar'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14, maxWidth: 960 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Estado</span>
              <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); }} style={PC_INP}>
                {CANJE_ESTADOS_FILTRO.map((row) => (
                  <option key={row.id || 'todos'} value={row.id}>{row.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Beneficio</span>
              <select value={filtroBeneficioId} onChange={(e) => setFiltroBeneficioId(e.target.value)} style={PC_INP}>
                <option value="">Todos</option>
                {premiosOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Jugador</span>
              <input type="text" placeholder="Nombre o email" value={filtroJugador} onChange={(e) => setFiltroJugador(e.target.value)} style={PC_INP} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Código</span>
              <input type="text" placeholder="PC-..." value={filtroCodigo} onChange={(e) => setFiltroCodigo(e.target.value)} style={PC_INP} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Desde</span>
              <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={PC_INP} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Hasta</span>
              <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={PC_INP} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void fetchCanjes(0)} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => {
                setFiltroEstado('');
                setFiltroBeneficioId('');
                setFiltroJugador('');
                setFiltroCodigo('');
                setFiltroDesde('');
                setFiltroHasta('');
              }}
              style={{ padding: '8px 14px', background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              Limpiar
            </button>
          </div>

          {canjesLoading && <p style={{ color: 'rgba(255,255,255,0.7)' }}>Cargando canjes...</p>}
          {!canjesLoading && canjesError && (
            <p style={{ color: '#fecaca', fontWeight: 600, background: 'rgba(220,38,38,0.2)', padding: '12px 16px', borderRadius: 8, maxWidth: 560 }}>{canjesError}</p>
          )}
          {!canjesLoading && !canjesError && canjesFiltrados.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>No hay canjes para los filtros seleccionados.</p>
          )}

          {!canjesLoading && canjesFiltrados.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                    {['Beneficio', 'Jugador', 'Código', 'Estado', 'Costo', 'Fecha', 'Vence', 'Aprobación', 'Entrega', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: '#334155' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {canjesFiltrados.map((canje) => {
                    const badge = canjeEstadoBadge(canje.estado);
                    const flags = canjeOperacionesFlags(canje);
                    const busy = actionBusyId === canje.id;
                    return (
                      <tr key={canje.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CanjeImagen row={canje} size={36} />
                            <span>{canjePremioNombre(canje)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{canjeJugadorDisplay(canje)}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{canjeCodigoDisplay(canje)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{canjeCostoPadcoins(canje) ?? '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatCanjeDateTime(canje.created_at)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatCanjeDateTime(canje.expires_at)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatCanjeDateTime(canje.aprobado_at)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatCanjeDateTime(canje.entregado_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => void cargarDetalleCanje(canje.id)} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Ver</button>
                            {flags.aprobable && (
                              <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'aprobar')} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: 'none', background: busy ? '#94a3b8' : '#2563eb', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}>Aprobar</button>
                            )}
                            {flags.entregable && (
                              <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'entregar')} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: 'none', background: busy ? '#94a3b8' : '#16a34a', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}>Entregar</button>
                            )}
                            {flags.cancelable && (
                              <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'cancelar')} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: busy ? 'not-allowed' : 'pointer' }}>Cancelar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              <span>
                Mostrando {pagination.offset + 1}–{Math.min(pagination.offset + canjes.length, pagination.total)} de {pagination.total}
              </span>
              <button
                type="button"
                disabled={canjesLoading || pagination.offset <= 0}
                onClick={() => void fetchCanjes(Math.max(0, pagination.offset - CANJES_PAGE_SIZE))}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: pagination.offset <= 0 ? 'not-allowed' : 'pointer' }}
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={canjesLoading || !pagination.hasMore}
                onClick={() => void fetchCanjes(pagination.offset + CANJES_PAGE_SIZE)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: !pagination.hasMore ? 'not-allowed' : 'pointer' }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {effectivePcSedeId && subView === 'validar' && (
        <div style={{ maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>🔍 Validar canje</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            Ingresá el código <code style={{ color: '#fde68a' }}>PC-...</code> o escaneá el QR si tu dispositivo lo permite. Sede activa: <strong style={{ color: 'white' }}>{sedeNombre}</strong>
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              type="text"
              placeholder="PC-XXXXXXXXXXXX"
              value={validarCodigo}
              onChange={(e) => setValidarCodigo(e.target.value.toUpperCase())}
              style={{ ...PC_INP, flex: '1 1 200px' }}
            />
            <button type="button" disabled={validarLoading} onClick={() => void buscarPorCodigo(validarCodigo)} style={{ padding: '10px 16px', background: validarLoading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: validarLoading ? 'wait' : 'pointer' }}>
              {validarLoading ? 'Buscando…' : 'Buscar'}
            </button>
            {isBarcodeDetectorSupported() && (
              <button type="button" onClick={() => (scanning ? detenerEscaneoQr() : void iniciarEscaneoQr())} style={{ padding: '10px 16px', background: scanning ? '#b91c1c' : '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {scanning ? 'Detener cámara' : '📷 Escanear QR'}
              </button>
            )}
          </div>

          {scanning && (
            <div style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', maxWidth: 320, border: '2px solid rgba(255,255,255,0.2)' }}>
              <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', background: '#000' }} />
            </div>
          )}

          {validarError && <p style={{ color: '#fecaca', fontWeight: 600 }}>{validarError}</p>}

          {validarResult?.canje && (
            <div style={{ background: 'white', borderRadius: 12, padding: 18, color: '#1e293b' }}>
              {(() => {
                const canje = validarResult.canje;
                const badge = canjeEstadoBadge(canje.estado);
                const flags = canjeOperacionesFlags(canje, validarResult);
                const busy = actionBusyId === canje.id;
                const qrValue = resolveCanjeQrValue(canje);
                return (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                      <CanjeImagen row={canje} size={64} />
                      <div style={{ flex: 1, fontSize: 14 }}>
                        <div style={{ marginBottom: 6 }}><strong>{canjePremioNombre(canje)}</strong> <span style={{ background: badge.bg, color: badge.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span></div>
                        <div><strong>Código:</strong> {canjeCodigoDisplay(canje)}</div>
                        <div><strong>Jugador:</strong> {canjeJugadorDisplay(canje)}</div>
                        <div><strong>Sede del canje:</strong> {sedesMap[String(canje.sede_id)]?.nombre || canje.sede_id}</div>
                        <div><strong>Vence:</strong> {formatCanjeDateTime(canje.expires_at)}</div>
                      </div>
                    </div>
                    {qrValue && (
                      <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        <QRCodeCanvas value={qrValue} size={160} level="M" includeMargin />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void cargarDetalleCanje(canje.id)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Ver detalle</button>
                      {flags.aprobable && (
                        <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'aprobar')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: busy ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>Aprobar</button>
                      )}
                      {flags.entregable && (
                        <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'entregar')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: busy ? '#94a3b8' : '#16a34a', color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>Entregar</button>
                      )}
                      {flags.cancelable && (
                        <button type="button" disabled={busy} onClick={() => void ejecutarAccionCanje(canje, 'cancelar')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>Cancelar</button>
                      )}
                      {flags.final && <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>Estado final.</span>}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <CanjeDetalleModal
        open={detalleOpen}
        onClose={() => { setDetalleOpen(false); setDetalleCanje(null); setDetalleError(''); }}
        canje={detalleCanje}
        validation={detalleValidation}
        sedeNombre={sedeNombre}
        actionBusy={Boolean(actionBusyId)}
        onAprobar={(c) => void ejecutarAccionCanje(c, 'aprobar')}
        onEntregar={(c) => void ejecutarAccionCanje(c, 'entregar')}
        onCancelar={(c) => void ejecutarAccionCanje(c, 'cancelar')}
        error={detalleError}
      />
    </div>
  );
}
