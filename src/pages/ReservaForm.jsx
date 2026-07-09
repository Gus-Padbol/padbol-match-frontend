import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/ReservaForm.css';
import { usePadcoinsActiveCampaign } from '../hooks/usePadcoinsActiveCampaign';
import {
  PadcoinsCampaignPlayerBadge,
  PadcoinsCampaignPlayerHint,
} from '../components/PadcoinsCampaignPlayerSurfaces';

function getPrecio(sede, hora) {
  const base = Number(sede?.precio_por_reserva || sede?.precio_turno || 0);
  if (!hora || !sede) return base;
  const h = parseInt(hora.split(':')[0], 10);
  return h < 16
    ? Number(sede.precio_manana || base)
    : Number(sede.precio_tarde || base);
}

function getTodayLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
}

function getClienteWhatsapp(cliente) {
  if (!cliente) return '';

  return (
    cliente.whatsapp ||
    cliente.telefono ||
    cliente.telephone ||
    cliente.phone ||
    cliente.numeroTel ||
    cliente.numero_tel ||
    cliente.celular ||
    cliente.mobile ||
    ''
  );
}

export default function ReservaForm({
  currentCliente,
  apiBaseUrl = 'https://padbol-backend.onrender.com'
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSedeId = searchParams.get('sedeId');

  const [sedes, setSedes] = useState([]);
  const [paises, setPaises] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [sedesFiltradasPorCiudad, setSedesFiltradasPorCiudad] = useState([]);

  const [filtros, setFiltros] = useState({
    pais: '',
    ciudad: '',
    sede_id: '',
  });

  const [pantalla, setPantalla] = useState(1);

  // DEBUG
  console.log('PANTALLA:', pantalla);
  console.log('SEDE_ID:', filtros.sede_id);
  console.log('LOCAL STORAGE:', localStorage.getItem('ultima_sede'));

  const [formData, setFormData] = useState({
    fecha: '',
    hora: '',
    cancha: '',
    numeroTel: localStorage.getItem('usuario_whatsapp') || '',
  });

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [canchasDisponibles, setCanchasDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [creditDisponible, setCreditDisponible] = useState(0);
  const [aplicarCredito, setAplicarCredito] = useState(false);

  const sedeSeleccionada =
    Array.isArray(sedes) && sedes.length > 0
      ? sedes.find(s => s.id === filtros.sede_id)
      : null;

  const reservaCampaignSedeId = useMemo(() => {
    const raw = filtros.sede_id ?? sedeSeleccionada?.id;
    const n = Number.parseInt(String(raw ?? '').trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [filtros.sede_id, sedeSeleccionada?.id]);

  const { campaign: pcActiveCampaign } = usePadcoinsActiveCampaign(reservaCampaignSedeId, {
    apiBaseUrl,
    enabled: Boolean(reservaCampaignSedeId) && (pantalla === 2 || pantalla === 4),
  });

  useEffect(() => {
    const whatsappCliente = getClienteWhatsapp(currentCliente);
    const whatsappGuardado = localStorage.getItem('usuario_whatsapp') || '';

    const numero = whatsappCliente || whatsappGuardado || '';

    if (!numero) return;

    setFormData(prev => ({
      ...prev,
      numeroTel: numero
    }));
  }, [currentCliente]);

  useEffect(() => {
    if (!canchasDisponibles.length || pantalla !== 2) return;

    const libres = canchasDisponibles.filter(c => c.libre);
    if (libres.length === 1) {
      setFormData(prev => ({ ...prev, cancha: String(libres[0].num) }));
      setPantalla(4);
      setError('');
    }
  }, [canchasDisponibles, pantalla]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sedes`)
      .then(res => res.json())
      .then(data => {
        const lista = data || [];
        setSedes(lista);
        const paisesUnicos = [...new Set(lista.map(s => s.pais))].sort();
        setPaises(paisesUnicos);
      })
      .catch(() => setError('Error al cargar sedes'));
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!currentCliente?.email) return;

    fetch(`${apiBaseUrl}/api/creditos/${encodeURIComponent(currentCliente.email)}`)
      .then(r => r.json())
      .then(d => setCreditDisponible(d.total || 0))
      .catch(() => {});
  }, [currentCliente, apiBaseUrl]);

  useEffect(() => {
    const remembered = localStorage.getItem('ultima_sede');
    const targetId = initialSedeId || remembered;

    if (!targetId || sedes.length === 0) return;

    const id = parseInt(targetId, 10);
    const sede = sedes.find(s => s.id === id);
    if (!sede) return;

    setFiltros({
      pais: sede.pais,
      ciudad: sede.ciudad,
      sede_id: id,
    });

    localStorage.setItem('ultima_sede', String(id));
    localStorage.setItem('ultima_sede_nombre', sede.nombre);

    setPantalla(2);
  }, [sedes, initialSedeId]);

  useEffect(() => {
    if (pantalla !== 2) return;
    if (!formData.fecha) return;
    if (!sedeSeleccionada) return;

    buscarHorariosDisponibles(formData.fecha);
  }, [formData.fecha, pantalla, sedeSeleccionada]);

  const handleChangePais = (e) => {
    const pais = e.target.value;
    setFiltros({ pais, ciudad: '', sede_id: '' });
    setCiudades([]);
    setSedesFiltradasPorCiudad([]);

    if (pais) {
      const ciudadesDelPais = [...new Set(
        sedes.filter(s => s.pais === pais).map(s => s.ciudad)
      )].sort();
      setCiudades(ciudadesDelPais);
    }
  };

const buscarHorariosDisponibles = (fecha) => {
  if (!fecha || !sedeSeleccionada) return;

  setLoading(true);
  setError('');

  fetch(`${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${fecha}`)
    .then(response => response.json())
    .then(reservadas => {
      const sedeData = sedeSeleccionada;
      let horaApertura = 10;
      let horaCierre = 23;

      if (sedeData.horario_apertura) {
        const apertura = parseInt(sedeData.horario_apertura.split(':')[0], 10);
        if (!isNaN(apertura)) horaApertura = apertura;
      }

      if (sedeData.horario_cierre) {
        const cierre = parseInt(sedeData.horario_cierre.split(':')[0], 10);
        if (!isNaN(cierre)) horaCierre = cierre;
      }

      const duracion = sedeData.duracion_reserva_minutos || 90;
      const cantidadCanchas = sedeData.cantidad_canchas || 2;
      const todosLosHorarios = [];

      for (let h = horaApertura; h < horaCierre; h++) {
        for (let m = 0; m < 60; m += duracion) {
          const slotEndMinutes = m + duracion;
          const slotEndHours = h + Math.floor(slotEndMinutes / 60);
          const slotEndMins = slotEndMinutes % 60;

          if (
            slotEndHours < horaCierre ||
            (slotEndHours === horaCierre && slotEndMins === 0)
          ) {
            const horaInicio =
              String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

            const hFin = slotEndHours;
            const mFin = slotEndMins;

            const horaFin =
              String(hFin).padStart(2, '0') +
              ':' +
              String(mFin).padStart(2, '0');

            const ocupadas = Array.isArray(reservadas)
              ? reservadas.filter(r => r.hora === horaInicio).length
              : 0;

            const libres = cantidadCanchas - ocupadas;

            if (libres > 0) {
              todosLosHorarios.push({
                horario: `${horaInicio} - ${horaFin}`,
                hora: horaInicio,
                libres,
                ocupadas,
              });
            }
          }
        }
      }

      setHorariosDisponibles(todosLosHorarios);
    })
    .catch(() => {
      setError('Error al buscar disponibilidad');
    })
    .finally(() => {
      setLoading(false);
    });
};

  const handleChangeFecha = (e) => {
    const fecha = e.target.value;

    setFormData(prev => ({
      ...prev,
      fecha,
      hora: '',
      cancha: '',
    }));

    setHorariosDisponibles([]);
    setCanchasDisponibles([]);
    setError('');
  };

  const handleChangeHora = (e) => {
    const hora = e.target.value;

    setFormData(prev => ({
      ...prev,
      hora,
      cancha: '',
    }));

    buscarCanchasDisponibles(hora);
  };

  const buscarCanchasDisponibles = async (hora) => {
    if (!hora || !formData.fecha || !sedeSeleccionada) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${formData.fecha}`
      );
      const reservadas = await response.json();

      const ocupadas = Array.isArray(reservadas)
        ? reservadas.filter(r => r.hora === hora).map(r => r.cancha)
        : [];

      const total = sedeSeleccionada.cantidad_canchas || 2;

      setCanchasDisponibles(
        Array.from({ length: total }, (_, i) => ({
          num: i + 1,
          libre: !ocupadas.includes(i + 1),
        }))
      );
    } catch (err) {
      setError('Error al buscar canchas disponibles');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'numeroTel') {
      localStorage.setItem('usuario_whatsapp', value);
    }
  };

  const handlePagarConMP = async () => {
    const telefonoFinal =
      formData.numeroTel ||
      getClienteWhatsapp(currentCliente) ||
      localStorage.getItem('usuario_whatsapp') ||
      '';

    if (!telefonoFinal.trim()) {
      setError('Ingresa tu número de WhatsApp');
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = aplicarCredito ? Math.min(creditDisponible, precio) : 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);
    const whatsappCompleto = telefonoFinal.replace(/[\s\-().]/g, '');

const reservaData = {
  sede: sedeSeleccionada.nombre,
  sede_id: sedeSeleccionada.id,
  fecha: formData.fecha,
  hora: formData.hora,
  cancha: parseInt(formData.cancha, 10),
  nombre: currentCliente?.nombre,
  email: currentCliente?.email,
  whatsapp:
    formData.numeroTel ||
    getClienteWhatsapp(currentCliente) ||
    localStorage.getItem('usuario_whatsapp') ||
    '',
  nivel: 'Principiante',
  precio,
  moneda: sedeSeleccionada?.moneda || 'ARS',
  creditUsed: creditoAplicado,
};

    try {
      localStorage.setItem('usuario_whatsapp', telefonoFinal);

      const res = await fetch(`${apiBaseUrl}/api/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`,
          precio: precioFinal,
          moneda: sedeSeleccionada?.moneda || 'ARS',
          sedeNombre: sedeSeleccionada.nombre,
          sedeId: sedeSeleccionada.id,
          reservaData,
        }),
      });

      const data = await res.json();

      if (res.ok && data.init_point) {
        localStorage.setItem('ultima_sede', String(filtros.sede_id));
        localStorage.setItem('ultima_sede_nombre', sedeSeleccionada.nombre);
        window.location.href = data.init_point;
      } else {
        setError(data.error || 'No se pudo iniciar el pago');
        setMpLoading(false);
      }
    } catch (err) {
      setError('Error al conectar con Mercado Pago: ' + err.message);
      setMpLoading(false);
    }
  };

  const handleConfirmarConCreditos = async () => {
    const telefonoFinal =
      formData.numeroTel ||
      getClienteWhatsapp(currentCliente) ||
      localStorage.getItem('usuario_whatsapp') ||
      '';

    if (!telefonoFinal.trim()) {
      setError('Ingresa tu número de WhatsApp');
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = Math.min(creditDisponible, precio);
    const whatsappCompleto = telefonoFinal.replace(/[\s\-().]/g, '');

    try {
      localStorage.setItem('usuario_whatsapp', telefonoFinal);

      const res = await fetch(`${apiBaseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sede: sedeSeleccionada.nombre,
          sede_id: sedeSeleccionada.id,
          fecha: formData.fecha,
          hora: formData.hora,
          cancha: parseInt(formData.cancha, 10),
          nombre: currentCliente?.nombre,
          email: currentCliente?.email,
          whatsapp: whatsappCompleto,
          nivel: 'Principiante',
          precio,
          estado: 'reservada',
          creditUsed: creditoAplicado,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('ultima_sede', String(filtros.sede_id));
        localStorage.setItem('ultima_sede_nombre', sedeSeleccionada.nombre);
        navigate('/perfil');
      } else {
        setError(data.error || 'No se pudo confirmar la reserva');
        setMpLoading(false);
      }
    } catch (err) {
      setError('Error al confirmar: ' + err.message);
      setMpLoading(false);
    }
  };

// PANTALLA 1 SOLO SI NO HAY SEDE
if (pantalla === 1) {
  const sedeGuardadaId = localStorage.getItem('ultima_sede');

  if (sedeGuardadaId && sedes.length > 0) {
    const sede = sedes.find(s => s.id === parseInt(sedeGuardadaId, 10));

    if (sede) {
      setFiltros({
        pais: sede.pais,
        ciudad: sede.ciudad,
        sede_id: sede.id,
      });

      setPantalla(2);
      return null;
    }
  }

  return (
    <div className="reserva-container">
      <div className="reserva-card">
        <h1>⚽ Reserva tu Cancha</h1>

        <select value={filtros.pais} onChange={handleChangePais}>
          <option value="">País</option>
          {paises.map(p => <option key={p}>{p}</option>)}
        </select>

        {filtros.pais && (
          <select value={filtros.ciudad} onChange={handleChangeCiudad}>
            <option value="">Ciudad</option>
            {ciudades.map(c => <option key={c}>{c}</option>)}
          </select>
        )}

        {filtros.ciudad && (
          <select value={filtros.sede_id} onChange={handleChangeSede}>
            <option value="">Sede</option>
            {sedesFiltradasPorCiudad.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

// PANTALLA 2
if (pantalla === 2) {
  const sedeGuardada = localStorage.getItem('ultima_sede_nombre');

  return (
    <div className="reserva-container">
      <div className="reserva-card">
        <h1>📅 RESERVA DE CANCHA</h1>

        <p>
          Estás en: <strong>{sedeSeleccionada?.nombre || sedeGuardada}</strong>
        </p>

        {pcActiveCampaign ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <PadcoinsCampaignPlayerBadge campaign={pcActiveCampaign} />
          </div>
        ) : null}

        <button
          onClick={() => {
            localStorage.removeItem('ultima_sede');
            localStorage.removeItem('ultima_sede_nombre');
            setPantalla(1);
            setFiltros({ pais: '', ciudad: '', sede_id: '' });
          }}
          style={{
            marginBottom: '20px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: 'none',
            background: '#ccc',
            cursor: 'pointer'
          }}
        >
          Cambiar sede
        </button>

        <form>
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              value={formData.fecha}
              onChange={handleChangeFecha}
              min={getTodayLocalISO()}
            />
          </div>

          {loading && <p style={{ marginTop: '10px' }}>Cargando horarios...</p>}

          {horariosDisponibles.length > 0 && (
            <div className="form-group">
              <label>Horario</label>
              <select value={formData.hora} onChange={handleChangeHora}>
                <option value="">Seleccionar</option>
                {horariosDisponibles.map((h, i) => (
                  <option key={i} value={h.hora}>{h.horario}</option>
                ))}
              </select>
            </div>
          )}

          {!loading && formData.fecha && horariosDisponibles.length === 0 && (
            <div className="error-message">No hay horarios disponibles para esa fecha</div>
          )}

          {formData.hora && canchasDisponibles.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {canchasDisponibles.map(c => (
                <button
                  key={c.num}
                  type="button"
                  disabled={!c.libre}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, cancha: String(c.num) }));
                    setPantalla(4);
                  }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '999px',
                    border: 'none',
                    background: c.libre ? '#16a34a' : '#ccc',
                    color: 'white',
                    cursor: c.libre ? 'pointer' : 'not-allowed',
                    opacity: c.libre ? 1 : 0.6,
                  }}
                >
                  {c.libre ? `Cancha ${c.num}` : `Cancha ${c.num} reservada`}
                </button>
              ))}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </form>
      </div>
    </div>
  );
}

  // PANTALLA 4
  if (pantalla === 4) {
    const whatsappFinal =
      formData.numeroTel ||
      getClienteWhatsapp(currentCliente) ||
      localStorage.getItem('usuario_whatsapp') ||
      '';

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = aplicarCredito ? Math.min(creditDisponible, precio) : 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);
    const usarCreditos = precioFinal === 0;

    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <h1 style={{ textAlign: 'center' }}>⚽ Resumen de reserva</h1>

          <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
            <p><strong>📍 Sede:</strong> {sedeSeleccionada?.nombre}</p>
            <p><strong>📅 Fecha:</strong> {formData.fecha}</p>
            <p><strong>🕐 Hora:</strong> {formData.hora}</p>
            <p><strong>🏟️ Cancha:</strong> {formData.cancha}</p>
            <p><strong>💰 Precio:</strong> {Number(precio).toLocaleString('es-AR')} {sedeSeleccionada?.moneda || 'ARS'}</p>
          </div>

          {creditDisponible > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={aplicarCredito}
                  onChange={(e) => setAplicarCredito(e.target.checked)}
                />
                Usar créditos disponibles ({Number(creditDisponible).toLocaleString('es-AR')})
              </label>
            </div>
          )}

          <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
            <p><strong>Total:</strong> {Number(precioFinal).toLocaleString('es-AR')} {sedeSeleccionada?.moneda || 'ARS'}</p>
          </div>

          <PadcoinsCampaignPlayerHint campaign={pcActiveCampaign} variant="confirm" />

<div className="form-group">
  <label>WhatsApp</label>
  <input
    type="tel"
    name="numeroTel"
    value={
      formData.numeroTel ||
      localStorage.getItem('usuario_whatsapp') ||
      ''
    }
    onChange={(e) => {
      const value = e.target.value;

      setFormData(prev => ({
        ...prev,
        numeroTel: value
      }));

      localStorage.setItem('usuario_whatsapp', value);
    }}
  />
</div>
          <button
            type="button"
            onClick={usarCreditos ? handleConfirmarConCreditos : handlePagarConMP}
            disabled={mpLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: usarCreditos ? '#16a34a' : '#009ee3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {mpLoading
              ? 'Procesando...'
              : (usarCreditos ? 'Confirmar con créditos' : 'Pagar con Mercado Pago')}
          </button>

          {error && <div className="error-message">{error}</div>}
          {mensaje && <div style={{ marginTop: '12px' }}>{mensaje}</div>}
        </div>
      </div>
    );
  }

  return null;
}