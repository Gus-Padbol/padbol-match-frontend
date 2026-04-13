import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/ReservaForm.css';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

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
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const IS_TEST_DOMAIN = window.location.hostname === 'padbol-match.netlify.app';

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
    if (!fecha) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${fecha}`
      );
      const reservadas = await response.json();

      const sedeData = sedeSeleccionada;
      const horaApertura = parseInt(sedeData.horario_apertura.split(':')[0]);
      const horaCierre = parseInt(sedeData.horario_cierre.split(':')[0]);
      const duracion = sedeData.duracion_reserva_minutos || 90;
      const cantidadCanchas = sedeData.cantidad_canchas || 2;

      const todosLosHorarios = [];

      for (let h = horaApertura; h < horaCierre; h++) {
        for (let m = 0; m < 60; m += duracion) {
          if (h + (m + duracion) / 60 <= horaCierre) {
            const horaInicio = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
            const minFin = m + duracion;
            const hFin = h + Math.floor(minFin / 60);
            const mFin = minFin % 60;
            const horaFin = String(hFin).padStart(2, '0') + ':' + String(mFin).padStart(2, '0');

            const ocupadas = reservadas.filter(
              r => r.hora === horaInicio
            ).length;
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
    } catch (err) {
      setError('Error al buscar disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeFecha = (e) => {
    const fecha = e.target.value;
    setFormData(prev => ({
      ...prev,
      fecha,
      hora: '',
      cancha: '',
    }));
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

      const ocupadas = reservadas.filter(r => r.hora === hora).map(r => r.cancha);
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
      precio: sedeSeleccionada.precio_por_reserva,
      moneda: sedeSeleccionada.moneda || 'ARS',
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`,
          precio: sedeSeleccionada.precio_por_reserva,
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

  const handleTestConfirm = async () => {
    if (!formData.numeroTel.trim()) {
      setError('Ingresa tu número de WhatsApp');
      return;
    }
    setTestLoading(true);
    setError('');
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
          precio: sedeSeleccionada.precio_por_reserva,
          moneda: sedeSeleccionada.moneda || 'ARS',
          estado: 'confirmada',
        }),
      });
      if (!res.ok && res.status !== 409) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }
      localStorage.setItem('ultima_sede', String(filtros.sede_id));
      setTestSuccess(true);
    } catch (err) {
      setError('Error TEST: ' + err.message);
    } finally {
      setTestLoading(false);
    }
  };

  // PANTALLA 1: País, Ciudad, Sede
  if (pantalla === 1) {
    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <h1>🎾 Reserva tu Cancha de PADBOL</h1>

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

          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'center' }}>
            {sedeSeleccionada?.ciudad}, {sedeSeleccionada?.pais} • ${sedeSeleccionada?.precio_por_reserva.toLocaleString('es-AR')} {sedeSeleccionada?.moneda}
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
    const precio = sedeSeleccionada?.precio_por_reserva;
    const moneda = sedeSeleccionada?.moneda || 'ARS';

    if (testSuccess) {
      return (
        <div className="reserva-container">
          <div className="reserva-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#16a34a', marginBottom: '8px' }}>Reserva confirmada (TEST)</h2>
            <p style={{ color: '#555', marginBottom: '6px' }}>{sedeSeleccionada?.nombre}</p>
            <p style={{ color: '#555', marginBottom: '24px' }}>📅 {formData.fecha} ⏰ {formData.hora} 🎾 Cancha {formData.cancha}</p>
            <button
              onClick={() => navigate('/perfil')}
              style={{ width: '100%', padding: '12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
            >
              Ver mis reservas →
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>🎾 Resumen de reserva</h1>
            <button onClick={() => { setPantalla(2); setError(''); }} style={{
              padding: '8px 15px', background: '#999', color: 'white',
              border: 'none', borderRadius: '5px', cursor: 'pointer',
            }}>
              ← Atrás
            </button>
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

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={handlePagarConMP}
            disabled={mpLoading}
            style={{
              width: '100%', padding: '14px',
              background: mpLoading ? '#aaa' : 'linear-gradient(135deg, #009ee3 0%, #0077c8 100%)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 'bold',
              cursor: mpLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 3px 12px rgba(0,158,227,0.4)',
            }}
          >
            {mpLoading ? 'Redirigiendo a Mercado Pago...' : '💳 Pagar con Mercado Pago'}
          </button>

          {IS_TEST_DOMAIN && (
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                onClick={handleTestConfirm}
                disabled={testLoading}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {testLoading ? 'Guardando...' : 'Confirmar sin pago (solo pruebas)'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}