import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import UserHeader from '../components/UserHeader';

const API_BASE = 'https://padbol-backend.onrender.com';

function formatFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

const NIVEL_LABEL = {
  club:            'Club',
  club_no_oficial: 'Club No Oficial',
  club_oficial:    'Club Oficial',
  nacional:        'Nacional',
  internacional:   'Internacional',
  mundial:         'Mundial',
};

const FORMATO_LABEL = {
  round_robin:     'Round Robin',
  knockout:        'Eliminatorio',
  grupos_knockout: 'Grupos + Eliminatorio',
};

const ESTADO_BADGE = {
  abierto:   { label: '🟢 Abierto',   bg: '#dcfce7', color: '#16a34a' },
  en_curso:  { label: '🟡 En curso',  bg: '#fef9c3', color: '#ca8a04' },
  finalizado:{ label: '🔴 Finalizado',bg: '#fee2e2', color: '#dc2626' },
  cerrado:   { label: '⚪ Cerrado',   bg: '#f1f5f9', color: '#64748b' },
};

export default function TorneosPublicos({ currentCliente, onLogout, apiBaseUrl = API_BASE }) {
  const navigate = useNavigate();
  const [torneos,     setTorneos]     = useState([]);
  const [sedesMap,    setSedesMap]    = useState({});
  const [equiposCount,setEquiposCount]= useState({});
  const [loading,     setLoading]     = useState(true);
  const [filterSede,  setFilterSede]  = useState('');
  const [filterEstado,setFilterEstado]= useState('');
  const [perfil,      setPerfil]      = useState(null);   // jugadores_perfil: { sede_id, pais }
  const [viewMode,    setViewMode]    = useState('sede'); // 'sede', 'pais', 'global'
  const [searchQuery, setSearchQuery] = useState('');     // global search
  const [filterPais,  setFilterPais]  = useState('');     // country filter in global mode
  const [isMobile,    setIsMobile]    = useState(false);  // mobile detection

  useEffect(() => {
  const load = async () => {
    setLoading(true);
    try {
      // Fetch torneos directly from Supabase (critical — must not fail due to sedes)
      const { data: torneosData } = await supabase
        .from('torneos')
        .select('*')
        .in('estado', ['abierto', 'en_curso', 'finalizado'])
        .order('fecha_inicio', { ascending: false });

      const lista = torneosData || [];
      setTorneos(lista);

      // Fetch sedes independently — a failure here must not hide torneos
      try {
        const sedesRes = await Promise.race([
          fetch(`${apiBaseUrl}/api/sedes`),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sedes timeout')), 5000)
          ),
        ]);
        const sedes = sedesRes?.ok ? await sedesRes.json() : [];
        const map = {};
(sedes || []).forEach(s => {
  if (s && s.id != null) {
    map[String(s.id)] = s;
  }
});
setSedesMap(map);

console.log("SEDES MAP:", map);
      } catch {
        // sedes are supplementary; torneos still show without sede names
      }

      // Fetch team counts per torneo
      const countPromises = lista.map(t =>
        Promise.race([
          fetch(`${apiBaseUrl}/api/torneos/${t.id}/equipos`)
            .then(r => r.ok ? r.json() : [])
            .then(eq => ({ id: t.id, count: eq.length })),
          new Promise(resolve =>
            setTimeout(() => resolve({ id: t.id, count: 0 }), 3000)
          )
        ]).catch(() => ({ id: t.id, count: 0 }))
      );

      const counts = await Promise.allSettled(countPromises);
      const cm = {};
      counts.forEach(result => {
        if (result.status === 'fulfilled') {
          cm[result.value.id] = result.value.count;
        }
      });
      setEquiposCount(cm);
    } catch (err) {
      console.error('TorneosPublicos load error:', err);
      setTorneos([]);
    } finally {
      setLoading(false);
    }
  };

  load();
}, [apiBaseUrl]);

  // Fetch player profile (sede_id + pais) — lightweight, supplementary
  useEffect(() => {
    if (!currentCliente?.email) return;
    supabase
      .from('jugadores_perfil')
      .select('sede_id, pais')
      .eq('email', currentCliente.email)
      .maybeSingle()
      .then(({ data }) => setPerfil(data || null));
  }, [currentCliente?.email]);

  // Strip leading flag emoji from stored pais ("🇦🇷 Argentina" → "Argentina")
  const playerPaisNombre = (perfil?.pais || '').replace(/^[\p{Emoji_Presentation}\p{Emoji}\s]+/u, '').trim();

  // Filter by view mode: sede → pais → global
  let baseTorneos = torneos;

  if (viewMode === 'sede' && perfil?.sede_id) {
    baseTorneos = torneos.filter(t => t.sede_id === perfil.sede_id);
  } else if (viewMode === 'pais' && playerPaisNombre) {
    baseTorneos = torneos.filter(t => {
      const sede = sedesMap[String(t.sede_id)];
      return sede && (sede.pais || '').includes(playerPaisNombre);
    });
  } else if (viewMode === 'global') {
    // In global mode, apply country filter (defaults to player's country)
    baseTorneos = torneos.filter(t => {
      const sede = sedesMap[String(t.sede_id)];
      if (filterPais && sede) {
        return (sede.pais || '').includes(filterPais);
      }
      return true;
    });
  }

  // Apply manual filters in global mode + search query
  const filtered = viewMode === 'global'
    ? baseTorneos.filter(t => {
        // Search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const sede = sedesMap[String(t.sede_id)];
          const matchesName   = (t.nombre || '').toLowerCase().includes(q);
          const matchesSede   = sede && (sede.nombre || '').toLowerCase().includes(q);
          const matchesCiudad = sede && (sede.ciudad || '').toLowerCase().includes(q);
          if (!matchesName && !matchesSede && !matchesCiudad) return false;
        }
        // Existing filters
        if (filterSede   && String(t.sede_id) !== filterSede)   return false;
        if (filterEstado && t.estado !== filterEstado)           return false;
        return true;
      })
    : baseTorneos;

  // All sedes for the dropdown (only shown in global mode)
  const sedesEnLista = [...new Set(torneos.map(t => String(t.sede_id)).filter(Boolean))]
    .map(id => sedesMap[id])
    .filter(Boolean);

  // Unique countries from sedes
  const paisesDisponibles = [...new Set(
    Object.values(sedesMap)
      .map(s => s.pais)
      .filter(Boolean)
      .map(p => p.replace(/^[\p{Emoji_Presentation}\p{Emoji}\s]+/u, '').trim())
  )].sort();

  // Auto-set country filter to player's country when entering global mode
  useEffect(() => {
    if (viewMode === 'global' && playerPaisNombre && !filterPais) {
      setFilterPais(playerPaisNombre);
    }
  }, [viewMode, playerPaisNombre, filterPais]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const btnBase = {
    padding: '10px 20px', border: 'none', borderRadius: '5px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px',
  };

  const navButtonStyle = {
    padding: isMobile ? '8px 10px' : '10px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    fontWeight: '600',
    fontSize: '13px',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '0 0 60px' }}>

      <UserHeader onLogout={onLogout} title="Torneos" />

      {/* Global container */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {/* Main column */}
        <div style={{
          width: '100%',
          maxWidth: '700px',
          padding: '0 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>

          {/* 3-level navigation: sede → pais → global */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '32px', flexWrap: 'wrap' }}>

          {/* Current scope badge */}
          {viewMode === 'sede' && perfil?.sede_id && (
            <span style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              🏠 {sedesMap[String(perfil.sede_id)]?.nombre || 'Mi club'}
            </span>
          )}
          {viewMode === 'pais' && playerPaisNombre && (
            <span style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              🌍 {playerPaisNombre}
            </span>
          )}
          {viewMode === 'global' && (
            <span style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              🌎 Global
            </span>
          )}

          {/* Navigation buttons */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            {viewMode === 'sede' && (
              <button
                onClick={() => setViewMode('pais')}
                style={{ ...navButtonStyle, background: 'white', color: '#4f46e5', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                🌍 Ver torneos del país
              </button>
            )}

            {viewMode === 'pais' && (
              <>
                <button
                  onClick={() => setViewMode('global')}
                  style={{ ...navButtonStyle, background: 'white', color: '#4f46e5', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                >
                  🌍 Ver torneos globales
                </button>
                <button
                  onClick={() => setViewMode('sede')}
                  style={{ ...navButtonStyle, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
                >
                  🎯 Volver a mi club
                </button>
              </>
            )}

            {viewMode === 'global' && (
              <>
                <button
                  onClick={() => setViewMode('pais')}
                  style={{ ...navButtonStyle, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
                >
                  🏠 Volver a mi país
                </button>
                <button
                  onClick={() => setViewMode('sede')}
                  style={{ ...navButtonStyle, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
                >
                  🎯 Volver a mi club
                </button>
              </>
            )}
          </div>

          {/* Tournament count */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
            {filtered.length} torneo{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Global filters — search + country + advanced */}
        {viewMode === 'global' && (
          <div style={{ marginBottom: '28px' }}>
            {/* Search bar */}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Buscar torneo, club o ciudad..."
              style={{
                width: '100%',
                margin: '16px 0',
                padding: '12px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                background: 'rgba(255,255,255,0.95)',
                color: '#333',
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            />

            {/* Filters row */}
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600 }}>Filtros:</span>

              <select value={filterPais} onChange={e => setFilterPais(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#333',
                  boxSizing: 'border-box',
                }}>
                <option value="">Todos los países</option>
                {paisesDisponibles.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select value={filterSede} onChange={e => setFilterSede(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#333',
                  boxSizing: 'border-box',
                }}>
                <option value="">Todas las sedes</option>
                {sedesEnLista
                  .filter(s => !filterPais || (s.pais || '').includes(filterPais))
                  .map(s => (
                    <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                  ))}
              </select>

              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#333',
                  boxSizing: 'border-box',
                }}>
                <option value="">Todos los estados</option>
                <option value="abierto">🟢 Abierto</option>
                <option value="en_curso">🟡 En curso</option>
                <option value="finalizado">🔴 Finalizado</option>
              </select>

              {(filterPais || filterSede || filterEstado || searchQuery) && (
                <button onClick={() => { setFilterPais(''); setFilterSede(''); setFilterEstado(''); setSearchQuery(''); }}
                  style={{ ...btnBase, padding: '8px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)', fontSize: '12px' }}>
                  ✕ Limpiar todo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingTop: '60px', fontSize: '16px' }}>Cargando torneos...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingTop: '60px', fontSize: '15px' }}>No hay torneos con estos filtros.</p>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              width: '100%',
            }}>
            {filtered.map(t => {
              const sede   = sedesMap[t.sede_id];
              const badge  = ESTADO_BADGE[t.estado] || ESTADO_BADGE.cerrado;
              const inscritos = equiposCount[t.id] ?? '…';
              const maxEq = t.cantidad_equipos;
              const nivelLabel  = NIVEL_LABEL[t.nivel_torneo]  || t.nivel_torneo  || '—';
              const formatoLabel= FORMATO_LABEL[t.tipo_torneo] || t.tipo_torneo   || '—';

              return (
                <div key={t.id} style={{
                  background: 'white', borderRadius: '14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
                >
                  {/* Card header strip */}
                  <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: isMobile ? '16px' : '15px', fontWeight: 700, lineHeight: 1.3, flex: 1, paddingRight: '10px' }}>{t.nombre}</h3>
                    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Row icon="📍" label={sede ? `${sede.nombre}${sede.ciudad ? ` — ${sede.ciudad}` : ''}` : (t.es_multisede ? 'Multisede' : '—')} />
                    <Row icon="📅" label={`${formatFecha(t.fecha_inicio)}${t.fecha_fin ? ` → ${formatFecha(t.fecha_fin)}` : ''}`} />
                    <Row icon="🎯" label={formatoLabel} />
                    <Row icon="⭐" label={nivelLabel} />
                    <Row icon="👥" label={maxEq ? `${inscritos} / ${maxEq} equipos` : `${inscritos} equipos inscriptos`} />
                  </div>

                  {/* Card footer */}
                  <div style={{ padding: '12px 18px', borderTop: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => navigate(`/torneo/${t.id}/vista`)}
                      style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                    >
                      Ver detalles →
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444' }}>
      <span style={{ flexShrink: 0, width: '18px', textAlign: 'center' }}>{icon}</span>
      <span style={{ lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}
