import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function formatHorario(apertura, cierre) {
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  if (apertura) return `Desde ${apertura}`;
  if (cierre)   return `Hasta ${cierre}`;
  return null;
}

export default function SedesPublicas({ currentCliente }) {
  const navigate = useNavigate();
  const [sedes,   setSedes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    supabase
      .from('sedes')
      .select('id, nombre, ciudad, pais, logo_url, horario_apertura, horario_cierre, descripcion')
      .eq('licencia_activa', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => { setSedes(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = sedes.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.ciudad || '').toLowerCase().includes(q) ||
      (s.pais   || '').toLowerCase().includes(q)
    );
  });

  const btnBase = {
    padding: '9px 18px', border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
    background: 'rgba(0,0,0,0.3)', color: 'white', backdropFilter: 'blur(4px)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', paddingBottom: '60px' }}>

      {/* Top bar */}
      <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ height: '36px' }} />
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: 700 }}>Canchas</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} style={btnBase}>← Inicio</button>
          <button onClick={() => navigate('/torneos')} style={btnBase}>🏆 Torneos</button>
          {currentCliente && (
            <button onClick={() => navigate('/perfil')} style={btnBase}>👤 Mi Perfil</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px 0' }}>

        {/* Title + search */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: 'clamp(1.3rem, 4vw, 2rem)', margin: '0 0 20px', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            🏟️ Canchas de PADBOL cerca tuyo
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, ciudad o país..."
              style={{ flex: 1, minWidth: '200px', maxWidth: '340px', padding: '9px 14px', borderRadius: '8px', border: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.95)', color: '#333' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
              {filtered.length} sede{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingTop: '60px', fontSize: '16px' }}>Cargando canchas...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingTop: '60px', fontSize: '15px' }}>
            {search ? 'No hay resultados para esa búsqueda.' : 'No hay sedes habilitadas por el momento.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filtered.map(sede => {
              const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
              return (
                <div key={sede.id} style={{
                  background: 'white', borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
                >
                  {/* Card header */}
                  <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '20px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {sede.logo_url ? (
                      <img src={sede.logo_url} alt={`Logo ${sede.nombre}`}
                        style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain', background: 'white', padding: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🏟️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 4px', color: 'white', fontSize: '15px', fontWeight: 800, lineHeight: 1.25, wordBreak: 'break-word' }}>{sede.nombre}</h3>
                      {(sede.ciudad || sede.pais) && (
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                          📍 {[sede.ciudad, sede.pais].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px 18px', flex: 1 }}>
                    {horario && (
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555' }}>⏰ {horario}</p>
                    )}
                    {sede.descripcion && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#777', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {sede.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ padding: '12px 18px', borderTop: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => navigate(`/sede/${sede.id}`)}
                      style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                    >
                      Ver sede →
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
