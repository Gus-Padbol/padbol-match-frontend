import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/ReservaForm.css';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

// Returns the correct price for a given sede + time slot.
// Falls back to precio_por_reserva / precio_turno if no differentiated prices are configured.
function getPrecio(sede, hora) {
  const base = Number(sede?.precio_por_reserva || sede?.precio_turno || 0);
  if (!hora || !sede) return base;
  const h = parseInt(hora.split(':')[0], 10);
  return h < 16
    ? Number(sede.precio_manana || base)
    : Number(sede.precio_tarde  || base);
}

export default function ReservaForm({ currentCliente, apiBaseUrl = 'https://padbol-backend.onrender.com' }) {
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

  const [formData, setFormData] = useState({
    fecha: '',
    hora: '',
    cancha: '',
    codigoPais: '+54',
    numeroTel: '',
  });

  // Pre-fill phone from profile — split stored full number into country code + local
  useEffect(() => {
    if (!currentCliente?.whatsapp) return;
    const wa = currentCliente.whatsapp;
    const allPaises = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];
    // Match longest country code first to avoid prefix conflicts (e.g. +1 vs +12)
    const sorted = [...allPaises].sort((a, b) => b.codigo.length - a.codigo.length);
    const match = sorted.find(p => wa.startsWith(p.codigo));
    if (match) {
      setFormData(prev => ({ ...prev, codigoPais: match.codigo, numeroTel: wa.slice(match.codigo.length) }));
    } else {
      setFormData(prev => ({ ...prev, numeroTel: wa }));
    }
  }, [currentCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [canchasDisponibles, setCanchasDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mpLoading, setMpLoading] = useState(false);

  const [creditDisponible, setCreditDisponible] = useState(0);
  const [aplicarCredito, setAplicarCredito] = useState(false);

  // Auto-select + auto-advance when only one court is free
  useEffect(() => {
    if (!canchasDisponibles.length || pantalla !== 2) return;
    const libres = canchasDisponibles.filter(c => c.libre);
    if (libres.length === 1) {
      setFormData(prev => ({ ...prev, cancha: String(libres[0].num) }));
      setPantalla(4);
      setError('');
    }
  }, [canchasDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sedes`)
      .then(res => res.json())
      .then(data => {
        setSedes(data || []);
        const paisesUnicos = [...new Set(data.map(s => s.pais))].sort();
        setPaises(paisesUnicos);
      })
      .catch(err => setError('Error al cargar sedes'));
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!currentCliente?.email) return;
    fetch(`${apiBaseUrl}/api/creditos/${encodeURIComponent(currentCliente.email)}`)
      .then(r => r.json())
      .then(d => setCreditDisponible(d.total || 0))
      .catch(() => {});
  }, [currentCliente, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // If arriving from SedePublica (?sedeId=X) or remembered from last visit, skip to pantalla 2
  useEffect(() => {
    const remembered = localStorage.getItem('ultima_sede');
    const targetId = initialSedeId || remembered;
    if (!targetId || sedes.length === 0) return;
    const id = parseInt(targetId);
    const sede = sedes.find(s => s.id === id);
    if (!sede) return;
    const ciudadesDelPais = [...new Set(sedes.filter(s => s.pais === sede.pais).map(s => s.ciudad))].sort();
    const sedesDeLaCiudad = sedes.filter(s => s.pais === sede.pais && s.ciudad === sede.ciudad);
    setCiudades(ciudadesDelPais);
    setSedesFiltradasPorCiudad(sedesDeLaCiudad);
    setFiltros({ pais: sede.pais, ciudad: sede.ciudad, sede_id: id });
    setPantalla(2);
  }, [sedes, initialSedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load time slots when date is selected
  useEffect(() => {
    console.log('[ReservaForm] Date change effect - pantalla:', pantalla, 'fecha:', formData.fecha, 'sedeId:', filtros.sede_id, 'sedeSeleccionada:', sedeSeleccionada?.nombre);
    if (pantalla !== 2 || !formData.fecha) return;
    if (!sedeSeleccionada) return;
    console.log('[ReservaForm] Triggering buscarHorariosDisponibles for fecha:', formData.fecha);
    buscarHorariosDisponibles(formData.fecha);
  }, [formData.fecha, pantalla, filtros.sede_id, sedes]); // eslint-disable-line react-hooks/exhaustive-deps


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

  const handleChangeCiudad = (e) => {
    const ciudad = e.target.value;
    setFiltros(prev => ({ ...prev, ciudad, sede_id: '' }));

    if (ciudad) {
      const sedesDeLaCiudad = sedes.filter(
        s => s.pais === filtros.pais && s.ciudad === ciudad
      );
      setSedesFiltradasPorCiudad(sedesDeLaCiudad);
    } else {
      setSedesFiltradasPorCiudad([]);
    }
  };

  const handleChangeSede = (e) => {
    const sede_id = parseInt(e.target.value);
    setFiltros(prev => ({ ...prev, sede_id }));
    if (sede_id) { setPantalla(2); setError(''); }
  };

  const siguientePantalla2 = () => {
    if (!filtros.sede_id) {
      setError('Selecciona una sede');
      return;
    }
    setPantalla(2);
    setError('');
  };

  const buscarHorariosDisponibles = async (fecha) => {
    if (!fecha || !sedeSeleccionada) {
      console.log('[ReservaForm] buscarHorariosDisponibles early return - fecha:', fecha, 'sedeSeleccionada:', sedeSeleccionada?.nombre);
      return;
    }

    console.log('[ReservaForm] buscarHorariosDisponibles fetching for sede:', sedeSeleccionada.nombre, 'fecha:', fecha);
    setLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${fecha}`
      );
      const reservadas = await response.json();
      console.log('[ReservaForm] buscarHorariosDisponibles got response:', reservadas);

      const sedeData = sedeSeleccionada;

      // Parse opening/closing times with defensive checks
      let horaApertura = 10; // default: 10 AM
      let horaCierre = 23;   // default: 11 PM

      try {
        if (sedeData.horario_apertura) {
          const apertura = parseInt(sedeData.horario_apertura.split(':')[0], 10);
          if (!isNaN(apertura)) horaApertura = apertura;
        }
      } catch (e) {
        console.log('[ReservaForm] Could not parse horario_apertura, using default:', horaApertura);
      }

      try {
        if (sedeData.horario_cierre) {
          const cierre = parseInt(sedeData.horario_cierre.split(':')[0], 10);
          if (!isNaN(cierre)) horaCierre = cierre;
        }
      } catch (e) {
        console.log('[ReservaForm] Could not parse horario_cierre, using default:', horaCierre);
      }

      const duracion = sedeData.duracion_reserva_minutos || 90;
      const cantidadCanchas = sedeData.cantidad_canchas || 2;

      console.log('[ReservaForm] Schedule config - opening:', horaApertura, 'closing:', horaCierre, 'duration:', duracion, 'courts:', cantidadCanchas);

      const todosLosHorarios = [];

      // Generate all possible time slots based on club schedule
      for (let h = horaApertura; h < horaCierre; h++) {
        for (let m = 0; m < 60; m += duracion) {
          // Check if slot fits within business hours
          const slotEndMinutes = m + duracion;
          const slotEndHours = h + Math.floor(slotEndMinutes / 60);
          const slotEndMins = slotEndMinutes % 60;

          // Only add if slot ends by closing time
          if (slotEndHours < horaCierre || (slotEndHours === horaCierre && slotEndMins === 0)) {
            const horaInicio = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
            const hFin = slotEndHours;
            const mFin = slotEndMins;
            const horaFin = String(hFin).padStart(2, '0') + ':' + String(mFin).padStart(2, '0');

            // Count reservations for this time slot
            const ocupadas = Array.isArray(reservadas) ? reservadas.filter(
              r => r.hora === horaInicio
            ).length : 0;
            const libres = cantidadCanchas - ocupadas;

            // Add slot only if at least one court is available
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

      console.log('[ReservaForm] Generated', todosLosHorarios.length, 'available time slots');
      setHorariosDisponibles(todosLosHorarios);

      // If no slots found, log full diagnostics
      if (todosLosHorarios.length === 0) {
        console.log('[ReservaForm] WARNING: No time slots generated. Debug info:', {
          horaApertura, horaCierre, duracion, cantidadCanchas,
          reservadasCount: Array.isArray(reservadas) ? reservadas.length : 'NaN',
          fechaSelected: fecha
        });
      }
    } catch (err) {
      console.error('[ReservaForm] Error in buscarHorariosDisponibles:', err);
      setError('Error al buscar disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeFecha = (e) => {
    const fecha = e.target.value;
    console.log('[ReservaForm] handleChangeFecha called with fecha:', fecha);
    console.log('[ReservaForm]  Current state - pantalla:', pantalla, 'filtros.sede_id:', filtros.sede_id, 'sedes.length:', sedes.length);
    console.log('[ReservaForm]  sedeSeleccionada at call time:', sedeSeleccionada?.nombre || sedeSeleccionada);
    setFormData(prev => ({
      ...prev,
      fecha,
      hora: '',
      cancha: '',
    }));
    setHorariosDisponibles([]);
    setCanchasDisponibles([]);
    buscarHorariosDisponibles(fecha);
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
    if (!hora || !formData.fecha) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${formData.fecha}`
      );
      const reservadas = await response.json();

      const ocupadas = Array.isArray(reservadas) ? reservadas.filter(r => r.hora === hora).map(r => r.cancha) : [];
      const total = sedeSeleccionada.cantidad_canchas || 2;

      setCanchasDisponibles(
        Array.from({ length: total }, (_, i) => ({ num: i + 1, libre: !ocupadas.includes(i + 1) }))
      );
    } catch (err) {
      setError('Error al buscar canchas disponibles');
    }
  };

  const siguientePantalla3 = () => {
    if (!formData.fecha || !formData.hora) {
      setError('Selecciona Fecha y Horario');
      return;
    }
    setPantalla(3);
    setError('');
  };

  const siguientePantalla4 = () => {
    if (!formData.cancha) {
      setError('Selecciona una cancha');
      return;
    }
    setPantalla(4);
    setError('');
  };

  const volverAtras = () => {
    setPantalla(pantalla - 1);
    setError('');
  };

  const sedeSeleccionada = Array.isArray(sedes) && sedes.length > 0 ? sedes.find(s => s.id === filtros.sede_id) : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePagarConMP = async () => {
    if (!formData.numeroTel.trim()) {
      setError('Ingresa tu número de WhatsApp');
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = aplicarCredito ? Math.min(creditDisponible, precio) : 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);

    const whatsappCompleto = `${formData.codigoPais}${formData.numeroTel.replace(/[\s\-().]/g, '')}`;
    const reservaData = {
      sede: sedeSeleccionada.nombre,
      fecha: formData.fecha,
      hora: formData.hora,
      cancha: parseInt(formData.cancha),
      nombre: currentCliente.nombre,
      email: currentCliente.email,
      whatsapp: whatsappCompleto,
      nivel: 'Principiante',
      precio,
      moneda: sedeSeleccionada.moneda || 'ARS',
      creditUsed: creditoAplicado,
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`,
          precio: precioFinal,
          moneda: sedeSeleccionada.moneda || 'ARS',
          sedeNombre: sedeSeleccionada.nombre,
          sedeId: sedeSeleccionada.id,
          reservaData,
        }),
      });
      const data = await res.json();
      if (res.ok && data.init_point) {
        localStorage.setItem('ultima_sede', String(filtros.sede_id));
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
    if (!formData.numeroTel.trim()) {
      setError('Ingresa tu número de WhatsApp');
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = Math.min(creditDisponible, precio);
    const whatsappCompleto = `${formData.codigoPais}${formData.numeroTel.replace(/[\s\-().]/g, '')}`;

    try {
      const res = await fetch(`${apiBaseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sede: sedeSeleccionada.nombre,
          fecha: formData.fecha,
          hora: formData.hora,
          cancha: parseInt(formData.cancha),
          nombre: currentCliente.nombre,
          email: currentCliente.email,
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

  // PANTALLA 1: País, Ciudad, Sede
  if (pantalla === 1) {
    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>🎾 Reserva tu Cancha de PADBOL</h1>
            <button onClick={() => navigate('/')} style={{
              padding: '8px 15px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
            }}>
              🏠 Inicio
            </button>
          </div>

          <form>
            <div className="form-group">
              <label>País:</label>
              <select
                value={filtros.pais}
                onChange={handleChangePais}
                required
              >
                <option value="">-- Selecciona País --</option>
                {paises.map(pais => (
                  <option key={pais} value={pais}>{pais}</option>
                ))}
              </select>
            </div>

            {filtros.pais && (
              <div className="form-group">
                <label>Ciudad:</label>
                <select
                  value={filtros.ciudad}
                  onChange={handleChangeCiudad}
                  required
                >
                  <option value="">-- Selecciona Ciudad --</option>
                  {ciudades.map(ciudad => (
                    <option key={ciudad} value={ciudad}>{ciudad}</option>
                  ))}
                </select>
              </div>
            )}

            {filtros.ciudad && (
              <div className="form-group">
                <label>Sede:</label>
                <select
                  value={filtros.sede_id}
                  onChange={handleChangeSede}
                  required
                >
                  <option value="">-- Selecciona Sede --</option>
                  {sedesFiltradasPorCiudad.map(sede => (
                    <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {filtros.sede_id && (
              <button type="button" onClick={() => navigate(`/sede/${filtros.sede_id}`)} style={{
                width: '100%',
                padding: '12px',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '20px',
              }}>
                Ver sede →
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 2: Fecha y Horario
  if (pantalla === 2) {
    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>📅 {sedeSeleccionada?.nombre}</h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => navigate('/')} style={{
                padding: '8px 15px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}>
                🏠 Inicio
              </button>
              <button onClick={volverAtras} style={{
                padding: '8px 15px',
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}>
                ← Atrás
              </button>
            </div>
          </div>

          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'center' }}>
            {sedeSeleccionada?.ciudad}, {sedeSeleccionada?.pais}
            {sedeSeleccionada?.precio_manana && sedeSeleccionada?.precio_tarde
              ? ` • 🌅 $${Number(sedeSeleccionada.precio_manana).toLocaleString('es-AR')} / 🌆 $${Number(sedeSeleccionada.precio_tarde).toLocaleString('es-AR')} ${sedeSeleccionada?.moneda || 'ARS'}`
              : ` • $${Number(sedeSeleccionada?.precio_por_reserva || sedeSeleccionada?.precio_turno || 0).toLocaleString('es-AR')} ${sedeSeleccionada?.moneda || 'ARS'}`
            }
          </p>

          <form>
            <div className="form-group">
              <label>Fecha:</label>
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleChangeFecha}
                required
              />
            </div>

            {horariosDisponibles.length > 0 && (
              <div className="form-group">
                <label>Horario (con canchas libres):</label>
                <select
                  name="hora"
                  value={formData.hora}
                  onChange={handleChangeHora}
                  required
                >
                  <option value="">-- Selecciona Horario --</option>
                  {horariosDisponibles.map((h, idx) => (
                    <option key={idx} value={h.hora}>
                      {h.horario}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.fecha && horariosDisponibles.length === 0 && loading === false && (
              <div className="error-message">No hay horarios disponibles para esta fecha</div>
            )}

            {/* Price badge — shown as soon as a time is selected */}
            {formData.hora && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0369a1' }}>
                  💰 {Number(getPrecio(sedeSeleccionada, formData.hora)).toLocaleString('es-AR')} {sedeSeleccionada?.moneda || 'ARS'}
                </span>
                {sedeSeleccionada?.precio_manana && sedeSeleccionada?.precio_tarde && (
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {parseInt(formData.hora.split(':')[0], 10) < 16 ? '🌅 Tarifa mañana' : '🌆 Tarifa tarde/noche'}
                  </span>
                )}
              </div>
            )}

            {/* Court availability buttons — shown after hora is selected */}
            {formData.hora && canchasDisponibles.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#333', marginBottom: '10px' }}>Elegí tu cancha:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {canchasDisponibles.map(c => (
                    <button
                      key={c.num}
                      type="button"
                      disabled={!c.libre}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, cancha: String(c.num) }));
                        setPantalla(4);
                        setError('');
                      }}
                      style={{
                        padding: '13px 16px', textAlign: 'left', fontWeight: 700, fontSize: '14px',
                        borderRadius: '8px', cursor: c.libre ? 'pointer' : 'not-allowed',
                        border: `2px solid ${c.libre ? '#16a34a' : '#dc2626'}`,
                        background: c.libre ? '#f0fdf4' : '#fef2f2',
                        color: c.libre ? '#15803d' : '#dc2626',
                        opacity: c.libre ? 1 : 0.65,
                      }}
                    >
                      Cancha {c.num} {c.libre ? '✅ Disponible' : '🔴 Reservada'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 4: Resumen + pago
  if (pantalla === 4) {
    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const moneda = sedeSeleccionada?.moneda || 'ARS';

    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>🎾 Resumen de reserva</h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => navigate('/')} style={{
                padding: '8px 15px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}>
                🏠 Inicio
              </button>
              <button onClick={() => { setPantalla(2); setError(''); }} style={{
                padding: '8px 15px', background: '#999', color: 'white',
                border: 'none', borderRadius: '5px', cursor: 'pointer',
              }}>
                ← Atrás
              </button>
            </div>
          </div>

          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px' }}><strong>📍 Sede:</strong> {sedeSeleccionada?.nombre}</p>
            <p style={{ margin: '0 0 8px' }}><strong>📅 Fecha:</strong> {formData.fecha}</p>
            <p style={{ margin: '0 0 8px' }}><strong>🕐 Hora:</strong> {formData.hora}</p>
            <p style={{ margin: '0 0 8px' }}><strong>🏟️ Cancha:</strong> {formData.cancha}</p>
            <p style={{ margin: '0 0 8px' }}><strong>👤 Jugador:</strong> {currentCliente.nombre}</p>
            <p style={{ margin: '0 0 8px' }}><strong>📧 Email:</strong> {currentCliente.email}</p>
            {precio && (
              <p style={{ margin: '12px 0 0', fontSize: '18px', fontWeight: 800, color: '#d32f2f' }}>
                💰 {Number(precio).toLocaleString('es-AR')} {moneda}
              </p>
            )}
          </div>

          {/* Credit usage section */}
          {creditDisponible > 0 && (
            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bae6fd' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={aplicarCredito}
                  onChange={(e) => setAplicarCredito(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Usar créditos disponibles (${Number(creditDisponible).toLocaleString('es-AR')})
              </label>
            </div>
          )}

          {/* Pricing breakdown */}
          <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Precio original:</span>
              <span>${Number(precio).toLocaleString('es-AR')} {moneda}</span>
            </div>
            {aplicarCredito && creditDisponible > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#16a34a' }}>
                <span>Crédito aplicado:</span>
                <span>-${Number(Math.min(creditDisponible, precio)).toLocaleString('es-AR')} {moneda}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
              <span>Total final:</span>
              <span>${Number(Math.max(0, precio - (aplicarCredito ? Math.min(creditDisponible, precio) : 0))).toLocaleString('es-AR')} {moneda}</span>
            </div>
          </div>

          <div className="form-group">
            <label>💬 WhatsApp para confirmación *</label>
            <div className="phone-field">
              <select
                value={formData.codigoPais}
                onChange={e => setFormData(prev => ({ ...prev, codigoPais: e.target.value }))}
              >
                <optgroup label="Principales">
                  {PAISES_TELEFONO_PRINCIPALES.map(p => (
                    <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo}</option>
                  ))}
                </optgroup>
                <optgroup label="Otros">
                  {PAISES_TELEFONO_OTROS.map(p => (
                    <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo} {p.nombre}</option>
                  ))}
                </optgroup>
              </select>
              <input
                type="tel"
                name="numeroTel"
                value={formData.numeroTel}
                onChange={handleChange}
                placeholder="9 11 2345 6789"
              />
            </div>
            {formData.numeroTel && (
              <small className="phone-preview">
                Número completo: {formData.codigoPais}{formData.numeroTel.replace(/[\s\-().]/g, '')}
              </small>
            )}
          </div>

          {/* Cancellation policy */}
          <div style={{
            margin: '16px 0', padding: '12px 14px',
            background: '#fffbeb', border: '1px solid #fcd34d',
            borderRadius: '8px', fontSize: '13px', color: '#78350f', lineHeight: 1.6,
          }}>
            <strong>📋 Política de cancelación</strong><br />
            ✅ Más de 24hs de anticipación: crédito total<br />
            ❌ Menos de 24hs de anticipación: sin devolución
          </div>

          {error && <div className="error-message">{error}</div>}

          {(() => {
            const creditoAplicado = aplicarCredito ? Math.min(creditDisponible, precio) : 0;
            const precioFinal = Math.max(0, precio - creditoAplicado);
            const usarCreditos = precioFinal === 0;

            return (
              <button
                onClick={usarCreditos ? handleConfirmarConCreditos : handlePagarConMP}
                disabled={mpLoading}
                style={{
                  width: '100%', padding: '14px',
                  background: mpLoading ? '#aaa' : (usarCreditos ? '#16a34a' : 'linear-gradient(135deg, #009ee3 0%, #0077c8 100%)'),
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 'bold',
                  cursor: mpLoading ? 'not-allowed' : 'pointer',
                  boxShadow: usarCreditos ? '0 3px 12px rgba(22,163,74,0.4)' : '0 3px 12px rgba(0,158,227,0.4)',
                }}
              >
                {mpLoading ? 'Procesando...' : (usarCreditos ? '✅ Confirmar con créditos' : '💳 Pagar con Mercado Pago')}
              </button>
            );
          })()}

        </div>
      </div>
    );
  }
}