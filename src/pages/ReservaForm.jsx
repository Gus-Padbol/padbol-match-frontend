import React, { useState, useEffect } from 'react';
import '../styles/ReservaForm.css';

export default function ReservaForm({ currentCliente, apiBaseUrl }) {
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
  });

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [canchasDisponibles, setCanchasDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

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

      const cancharesReservadas = reservadas
        .filter(r => r.hora === hora)
        .map(r => r.cancha);

      const libres = [];
      for (let i = 1; i <= sedeSeleccionada.cantidad_canchas; i++) {
        if (!cancharesReservadas.includes(i)) {
          libres.push(i);
        }
      }

      setCanchasDisponibles(libres);
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

  const sedeSeleccionada = sedes.find(s => s.id === filtros.sede_id);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sede: sedeSeleccionada.nombre,
          fecha: formData.fecha,
          hora: formData.hora,
          cancha: parseInt(formData.cancha),
          nombre: currentCliente.nombre,
          email: currentCliente.email,
          whatsapp: currentCliente.whatsapp || '',
          nivel: 'Principiante',
          precio: sedeSeleccionada.precio_por_reserva,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMensaje('✅ Reserva confirmada. Te enviaremos confirmación por WhatsApp.');
        setTimeout(() => {
          setPantalla(1);
          setFiltros({ pais: '', ciudad: '', sede_id: '' });
          setFormData({
            fecha: '',
            hora: '',
            cancha: '',
          });
          setMensaje('');
          setHorariosDisponibles([]);
          setCanchasDisponibles([]);
        }, 3000);
      } else {
        setError(result.error || result.message || 'Error al crear reserva');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
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
              <button type="button" onClick={siguientePantalla2} style={{
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
                ➜ Continuar
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

            {error && <div className="error-message">{error}</div>}

            {formData.fecha && formData.hora && (
              <button type="button" onClick={siguientePantalla3} style={{
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
                ➜ Continuar
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 3: Seleccionar Cancha
  if (pantalla === 3) {
    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>🏟️ Elige Cancha</h1>
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

          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'center', fontSize: '14px' }}>
            {sedeSeleccionada?.nombre} • {formData.fecha} • {formData.hora}
          </p>

          <form>
            <div className="form-group">
              <label>Cancha Disponible:</label>
              <select
                name="cancha"
                value={formData.cancha}
                onChange={handleChange}
                required
              >
                <option value="">-- Selecciona Cancha --</option>
                {canchasDisponibles.map(c => (
                  <option key={c} value={c}>Cancha {c}</option>
                ))}
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}

            {formData.cancha && (
              <button type="button" onClick={siguientePantalla4} style={{
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
                ➜ Continuar
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 4: Confirmación (sin pedir datos, están en currentCliente)
  if (pantalla === 4) {
    return (
      <div className="reserva-container">
        <div className="reserva-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>✅ Confirmar Reserva</h1>
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

          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p><strong>📍 Sede:</strong> {sedeSeleccionada?.nombre}</p>
            <p><strong>📅 Fecha:</strong> {formData.fecha}</p>
            <p><strong>🕐 Hora:</strong> {formData.hora}</p>
            <p><strong>🏟️ Cancha:</strong> {formData.cancha}</p>
            <p><strong>👤 Jugador:</strong> {currentCliente.nombre}</p>
            <p><strong>📧 Email:</strong> {currentCliente.email}</p>
            <p><strong>💬 WhatsApp:</strong> {currentCliente.whatsapp || 'No registrado'}</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {mensaje && <div className="success-message">{mensaje}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%',
            padding: '12px',
            background: '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Procesando...' : '✅ Confirmar Reserva'}
          </button>
        </div>
      </div>
    );
  }
}