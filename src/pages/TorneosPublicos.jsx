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

  // Unique sedes present in the list for the filter dropdown
 const sedesEnLista = [...new Set(torneos.map(t => String(t.sede_id)).filter(Boolean))]
  .map(id => sedesMap[id])
  .filter(Boolean);

  const filtered = torneos.filter(t => {
    if (filterSede   && String(t.sede_id) !== filterSede)   return false;
    if (filterEstado && t.estado !== filterEstado)           return false;
    return true;
  });

  const btnBase = {
    padding: '10px 20px', border: 'none', borderRadius: '5px',
    cursor: 'pointer', fontWeight: '600', fontSize: '13px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '0 0 60px' }}>

      <UserHeader onLogout={onLogout} title="Torneos" />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600 }}>Filtrar:</span>
          <select value={filterSede} onChange={e => setFilterSede(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '7px', border: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.95)', color: '#333', minWidth: '160px' }}>
            <option value="">Todas las sedes</option>
            {sedesEnLista.map(s => (
              <option key={s.id} value={String(s.id)}>{s.nombre}</option>
            ))}
          </select>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '7px', border: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.95)', color: '#333', minWidth: '140px' }}>
            <option value="">Todos los estados</option>
            <option value="abierto">🟢 Abierto</option>
            <option value="en_curso">🟡 En curso</option>
            <option value="finalizado">🔴 Finalizado</option>
          </select>
          {(filterSede || filterEstado) && (
            <button onClick={() => { setFilterSede(''); setFilterEstado(''); }}
              style={{ ...btnBase, padding: '7px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)', fontSize: '12px' }}>
              ✕ Limpiar
            </button>
          )}
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
            {filtered.length} torneo{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingTop: '60px', fontSize: '16px' }}>Cargando torneos...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingTop: '60px', fontSize: '15px' }}>No hay torneos con estos filtros.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
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
                    <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: 700, lineHeight: 1.3, flex: 1, paddingRight: '10px' }}>{t.nombre}</h3>
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
        )}
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
