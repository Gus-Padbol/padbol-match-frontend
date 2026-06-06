import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import UserHeader from '../components/UserHeader';

function getCurrentCliente() {
  try {
    const raw = localStorage.getItem('currentCliente');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getRoleData() {
  try {
    const raw = localStorage.getItem('user_role_data');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') return { nombre: p, email: '' };
  return {
    id: p.id ?? null,
    nombre: p.nombre || p.email || 'Jugador',
    email: p.email || '',
  };
}

function getPlayers(eq) {
  if (Array.isArray(eq?.jugadores)) {
    return eq.jugadores.map(normalizePlayer).filter(Boolean);
  }
  if (typeof eq?.jugadores === 'string' && eq.jugadores.trim()) {
    return eq.jugadores
      .split(' + ')
      .map((n) => ({ nombre: n.trim(), email: '' }))
      .filter((p) => p.nombre);
  }
  return [];
}

function getRequests(eq) {
  if (Array.isArray(eq?.solicitudes)) {
    return eq.solicitudes.map(normalizePlayer).filter(Boolean);
  }
  return [];
}

function samePerson(a, b) {
  if (!a || !b) return false;
  if (a.email && b.email) return a.email === b.email;
  return a.nombre === b.nombre;
}

export default function FormEquipos({ onLogout }) {
  const { id } = useParams();
  const torneoId = parseInt(id, 10);
  const navigate = useNavigate();
  const location = useLocation();

  const currentCliente = getCurrentCliente();
  const roleData = getRoleData();
  const isAdmin = ['super_admin', 'admin_nacional', 'admin_club'].includes(roleData?.rol);

  const [torneo, setTorneo] = useState(null);
  const [jugadoresTorneo, setJugadoresTorneo] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [cupoMaximo, setCupoMaximo] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargarTodo = async () => {
    if (!torneoId) return;

    setLoading(true);

    const [
      { data: torneoData, error: torneoError },
      { data: jugadoresData, error: jugadoresError },
      { data: equiposData, error: equiposError },
    ] = await Promise.all([
      supabase.from('torneos').select('*').eq('id', torneoId).maybeSingle(),
      supabase.from('jugadores_torneo').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
      supabase.from('equipos').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
    ]);

    if (torneoError) console.error(torneoError);
    if (jugadoresError) console.error(jugadoresError);
    if (equiposError) console.error(equiposError);

    setTorneo(torneoData || null);
    setJugadoresTorneo(Array.isArray(jugadoresData) ? jugadoresData : []);
    setEquipos(Array.isArray(equiposData) ? equiposData : []);
    setLoading(false);
  };

  useEffect(() => {
    cargarTodo();
  }, [torneoId]);

  const equiposNormalizados = useMemo(() => {
    return equipos.map((eq) => ({
      ...eq,
      players: getPlayers(eq),
      requests: getRequests(eq),
      cupo: Number(eq.cupo_maximo || 2),
    }));
  }, [equipos]);

  const currentJugador = useMemo(() => {
    if (!currentCliente) return null;

    if (currentCliente.email) {
      const byEmail = jugadoresTorneo.find((j) => j.email === currentCliente.email);
      if (byEmail) return byEmail;
    }

    if (!currentCliente.email && currentCliente.nombre) {
      const byName = jugadoresTorneo.find((j) => j.nombre === currentCliente.nombre);
      if (byName) return byName;
    }

    return null;
  }, [jugadoresTorneo, currentCliente]);

  const yo = useMemo(() => {
    if (!currentCliente) return null;
    return {
      id: currentJugador?.id ?? null,
      nombre: currentJugador?.nombre || currentCliente.nombre || currentCliente.email || 'Jugador',
      email: currentJugador?.email || currentCliente.email || '',
    };
  }, [currentCliente, currentJugador]);

  const miEquipo = useMemo(() => {
    if (!yo) return null;
    return equiposNormalizados.find((eq) => eq.players.some((p) => samePerson(p, yo))) || null;
  }, [equiposNormalizados, yo]);

  const miSolicitudPendiente = useMemo(() => {
    if (!yo) return null;
    return equiposNormalizados.find((eq) => eq.requests.some((r) => samePerson(r, yo))) || null;
  }, [equiposNormalizados, yo]);

  const crearEquipo = async () => {
    if (!yo) {
      alert('Tenés que iniciar sesión');
      return;
    }

    if (!currentJugador) {
      alert('Primero inscribite al torneo');
      return;
    }

    if (miEquipo) {
      alert('Ya estás en un equipo');
      return;
    }

    if (miSolicitudPendiente) {
      alert('Ya tenés una solicitud pendiente');
      return;
    }

    if (!nombreEquipo.trim()) {
      alert('Poné nombre al equipo');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('equipos')
      .insert([
        {
          torneo_id: torneoId,
          nombre: nombreEquipo.trim(),
          cupo_maximo: Number(cupoMaximo),
          creador_email: yo.email || '',
          jugadores: [yo],
          solicitudes: [],
        },
      ])
      .select();

    setSaving(false);

    if (error) {
      console.error(error);
      alert('Error creando equipo');
      return;
    }

    const nuevo = Array.isArray(data) ? data[0] : null;
    if (!nuevo) {
      alert('Error creando equipo');
      return;
    }

    setEquipos((prev) => [...prev, nuevo]);
    setNombreEquipo('');
    setCupoMaximo(2);
  };

  const pedirUnirme = async (equipo) => {
    if (!yo) {
      alert('Tenés que iniciar sesión');
      return;
    }

    if (!currentJugador) {
      alert('Primero inscribite al torneo');
      return;
    }

    if (miEquipo) {
      alert('Ya estás en un equipo');
      return;
    }

    if (miSolicitudPendiente) {
      alert('Ya tenés una solicitud pendiente');
      return;
    }

    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    if (requests.some((r) => samePerson(r, yo))) {
      alert('Ya pediste unirte a este equipo');
      return;
    }

    const nuevasSolicitudes = [...requests, yo];

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al pedir unirte');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id ? { ...eq, solicitudes: nuevasSolicitudes } : eq
      )
    );
  };

  const aceptarSolicitud = async (equipo, solicitud) => {
    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const nuevosJugadores = [...players, solicitud];
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({
        jugadores: nuevosJugadores,
        solicitudes: nuevasSolicitudes,
      })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al aceptar');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id
          ? { ...eq, jugadores: nuevosJugadores, solicitudes: nuevasSolicitudes }
          : eq
      )
    );
  };

  const rechazarSolicitud = async (equipo, solicitud) => {
    const requests = getRequests(equipo);
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al rechazar');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id ? { ...eq, solicitudes: nuevasSolicitudes } : eq
      )
    );
  };

  const equiposVisibles = equiposNormalizados.filter((eq) => eq.players.length > 0);
  const torneoCerrado = torneo?.estado === 'finalizado' || torneo?.estado === 'cancelado';
  const homePath = torneo?.sede_id ? `/sede/${torneo.sede_id}` : '/';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
        <UserHeader onLogout={onLogout} title="Equipos" homePath={homePath} />
        <div style={{ maxWidth: '1100px', margin: '0 auto', color: 'white' }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
      <UserHeader onLogout={onLogout} title="Equipos" homePath={homePath} />

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ color: 'white', marginBottom: '6px' }}>⚽ Formar Equipos</h2>

       <div style={{ color: 'white', opacity: 0.9, marginBottom: '6px', fontWeight: 600 }}>
  Torneo: {torneo?.nombre || `#${torneoId}`}
</div>

<div style={{ color: 'white', opacity: 0.8, marginBottom: '16px', fontSize: '14px' }}>
  Fecha: {torneo?.fecha_inicio || '—'}
</div>

        {location.state?.justRegistered && !miEquipo && !miSolicitudPendiente && (
          <div
            style={{
              marginBottom: '18px',
              background: '#dcfce7',
              color: '#166534',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            Inscripción exitosa. Ahora podés crear tu equipo o pedir unirte a uno existente.
          </div>
        )}

        {miEquipo && (
          <div
            style={{
              marginBottom: '18px',
              background: '#dcfce7',
              color: '#166534',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              border: '1px solid #86efac'
            }}
          >
            ✅ Ya formás parte del equipo: {miEquipo.nombre}
          </div>
        )}

        {miSolicitudPendiente && !miEquipo && (
          <div
            style={{
              marginBottom: '18px',
              background: '#fef3c7',
              color: '#92400e',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            Tenés una solicitud pendiente para unirte al equipo: {miSolicitudPendiente.nombre}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: miEquipo ? '1fr' : '1fr 1fr',
            gap: '20px',
          }}
        >
          {!torneoCerrado && !miEquipo && !miSolicitudPendiente && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
              <h3>👥 Crear equipo</h3>

              <div
                style={{
                  padding: '12px',
                  marginBottom: '12px',
                  borderRadius: '8px',
                  background: '#f3f4f6',
                  fontWeight: 600
                }}
              >
                Creador del equipo: {yo?.nombre || 'No identificado'}
              </div>

              <input
                placeholder="Nombre del equipo"
                value={nombreEquipo}
                onChange={(e) => setNombreEquipo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginTop: '10px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                }}
              />

              <select
                value={cupoMaximo}
                onChange={(e) => setCupoMaximo(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginTop: '10px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                }}
              >
                <option value={2}>Equipo de 2</option>
                <option value={3}>Equipo de 3</option>
                <option value={4}>Equipo de 4</option>
              </select>

              <button
                onClick={crearEquipo}
                disabled={saving || !yo || !currentJugador}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '12px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  opacity: saving || !yo || !currentJugador ? 0.6 : 1,
                }}
              >
                + Crear equipo
              </button>
            </div>
          )}

          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
            <h3>🏆 Equipos ({equiposVisibles.length})</h3>

{torneoCerrado && (
  <div
    style={{
      marginBottom: '12px',
      background: '#f3f4f6',
      color: '#374151',
      padding: '10px 12px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600
    }}
  >
    Este torneo está {torneo?.estado}. Solo se muestran los equipos participantes.
  </div>
)}

{equiposVisibles.map((eq) => {
             
             const nombres = eq.players.map((p) => p.nombre).filter(Boolean);
              const lleno = eq.players.length >= eq.cupo;
              const soyCreador = !!(yo?.email && eq.creador_email === yo.email);

              return (
                <div
                  key={eq.id}
                  style={{
                    padding: '14px',
                    background: '#f3f3f3',
                    borderRadius: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{eq.nombre}</div>

                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                    {nombres.length > 0 ? nombres.join(' + ') : 'Sin jugadores'}
                  </div>

                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                    {eq.players.length}/{eq.cupo} jugadores
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => navigate(`/torneo/${id}/equipos/${eq.id}`)}
                      style={{
                        padding: '6px 10px',
                        background: eq.id === miEquipo?.id ? '#166534' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {eq.id === miEquipo?.id ? 'Ver mi equipo' : 'Ver equipo'}
                    </button>

                    {!lleno && !miEquipo && !miSolicitudPendiente && !soyCreador && currentJugador && (
                      <button
                        onClick={() => pedirUnirme(eq)}
                        style={{
                          padding: '6px 10px',
                          background: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        + Pedir unirme
                      </button>
                    )}
                  </div>

                  {(soyCreador || isAdmin) && eq.requests.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                        Solicitudes pendientes
                      </div>

                      {eq.requests.map((sol, idx) => (
                        <div
                          key={`${eq.id}-req-${idx}`}
                          style={{
                            background: '#fff',
                            borderRadius: '8px',
                            padding: '8px',
                            marginBottom: '8px',
                          }}
                        >
                          <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                            {sol.nombre}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => aceptarSolicitud(eq, sol)}
                              style={{
                                padding: '6px 10px',
                                background: '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Aceptar
                            </button>

                            <button
                              onClick={() => rechazarSolicitud(eq, sol)}
                              style={{
                                padding: '6px 10px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/torneo/${id}/vista`)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#999',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ← Volver al torneo
          </button>
        </div>
      </div>
    </div>
  );
}