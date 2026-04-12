import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

/* ─── Photo Carousel ──────────────────────────────────────────────────── */
function Carousel({ fotos }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  const go = (delta) => setIdx((prev) => (prev + delta + fotos.length) % fotos.length);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % fotos.length), 4000);
  };

  useEffect(() => {
    if (fotos.length > 1) startTimer();
    return () => clearInterval(timerRef.current);
  }, [fotos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNav = (delta) => { go(delta); startTimer(); };
  const handleDot = (i) => { setIdx(i); startTimer(); };

  if (!fotos.length) return null;

  // Show 2 photos side-by-side when there are ≥2 and viewport is wide enough
  const showTwo = fotos.length >= 2;
  const visible = showTwo
    ? [fotos[idx], fotos[(idx + 1) % fotos.length]]
    : [fotos[idx]];

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', background: '#111', marginBottom: '8px' }}>
      {/* Image strip — relative so arrows are anchored here */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: showTwo ? 'repeat(2, 1fr)' : '1fr',
          gap: '3px',
        }}>
          {visible.map((url, i) => (
            <div key={`${url}-${i}`} style={{ aspectRatio: '4/3', overflow: 'hidden', maxHeight: '280px' }}>
              <img
                src={url}
                alt={`Cancha ${idx + i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))}
        </div>

        {/* Arrows */}
        {fotos.length > 1 && (
          <>
            <button
              onClick={() => handleNav(-1)}
              aria-label="Anterior"
              style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >‹</button>
            <button
              onClick={() => handleNav(1)}
              aria-label="Siguiente"
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >›</button>
          </>
        )}
      </div>

      {/* Dots — outside the image div so they're never clipped */}
      {fotos.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '6px', padding: '10px 0', background: '#111',
        }}>
          {fotos.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDot(i)}
              aria-label={`Foto ${i + 1}`}
              style={{
                width: i === idx ? '22px' : '8px', height: '8px',
                borderRadius: '4px', border: 'none', cursor: 'pointer', padding: 0,
                background: i === idx ? 'white' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.25s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Info row ────────────────────────────────────────────────────────── */
function InfoRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: '#374151' }}>
      <span style={{ flexShrink: 0, fontSize: '18px', width: '24px', textAlign: 'center', marginTop: '1px' }}>{icon}</span>
      <span style={{ lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function SedePublica({ currentCliente }) {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[SedePublica] useEffect fired, sedeId:', sedeId);
    if (!sedeId) { setError('No se recibió un ID de sede.'); setLoading(false); return; }
    setLoading(true); setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        console.log('[SedePublica] query result — data:', data, 'error:', err);
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else setSede(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[SedePublica] catch:', err);
        setError('Error inesperado: ' + (err?.message || String(err)));
        setLoading(false);
      });
  }, [sedeId]);

  const btnBack = {
    padding: '9px 18px', border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
    background: 'rgba(0,0,0,0.35)', color: 'white', backdropFilter: 'blur(4px)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>

      {/* ── Floating top nav ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ height: '30px', filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate(-1)} style={btnBack}>← Volver</button>
          {currentCliente && (
            <button onClick={() => navigate('/perfil')} style={btnBack}>👤 Mi Perfil</button>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'white', fontSize: '18px', fontWeight: 600 }}>Cargando sede...</p>
        </div>
      )}

      {/* ── Error / not found ── */}
      {!loading && (error || !sede) && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px' }}>
          <p style={{ color: 'white', fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>{error || 'Sede no encontrada.'}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>sedeId: {sedeId ?? '(undefined)'}</p>
        </div>
      )}

      {/* ── Sede loaded ── */}
      {!loading && !error && sede && (() => {
        console.log('[SedePublica] rendering sede:', sede);
        const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
        const fotos = Array.isArray(sede.fotos_urls) ? sede.fotos_urls : [];
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);

        return (
          <>
            {/* ── HERO ─────────────────────────────────────────────────── */}
            <div style={{
              position: 'relative',
              minHeight: '320px',
              /* Always a clean dark gradient — never use logo as bg image */
              background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: '36px', paddingTop: '72px',
              overflow: 'hidden',
            }}>
              {/* Subtle glow blob */}
              <div style={{
                position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
                width: '320px', height: '320px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(102,126,234,0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              {/* Logo */}
              {sede.logo_url && (
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '18px' }}>
                  <img
                    src={sede.logo_url}
                    alt={`Logo ${sede.nombre}`}
                    style={{
                      width: '100px', height: '100px', objectFit: 'contain',
                      borderRadius: '22px', background: 'white', padding: '10px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    }}
                  />
                </div>
              )}

              {/* Club name */}
              <h1 style={{
                position: 'relative', zIndex: 2,
                color: 'white',
                /* Responsive: shrinks on narrow screens, never overflows */
                fontSize: 'clamp(1.3rem, 6vw, 2.2rem)',
                fontWeight: 900, margin: '0 0 14px', textAlign: 'center',
                textShadow: '0 2px 16px rgba(0,0,0,0.6)',
                padding: '0 24px',
                lineHeight: 1.15,
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}>
                {sede.nombre || '(sin nombre)'}
              </h1>

              {/* ── Premium license badge ── */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                {licenciaActiva ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '7px 16px 7px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800,
                    background: 'linear-gradient(135deg, rgba(254,243,199,0.97) 0%, rgba(253,230,138,0.97) 100%)',
                    color: '#92400e',
                    border: '1.5px solid #d97706',
                    boxShadow: '0 2px 12px rgba(217,119,6,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
                    letterSpacing: '0.1px',
                  }}>
                    <span style={{ fontSize: '15px' }}>⭐</span>
                    <span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', display: 'block', lineHeight: 1, marginBottom: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>PADBOL</span>
                      <span style={{ lineHeight: 1 }}>Licencia Activa</span>
                    </span>
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                    background: 'rgba(254,226,226,0.93)', color: '#dc2626',
                    border: '1px solid rgba(220,38,38,0.35)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}>
                    ⛔ No habilitado
                  </span>
                )}
              </div>
            </div>

            {/* ── BODY ─────────────────────────────────────────────────── */}
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px 80px' }}>

              {/* Info card */}
              <div style={{ background: 'white', borderRadius: '18px', padding: '24px 28px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(sede.direccion || sede.ciudad || sede.pais) && (
                    <InfoRow icon="📍" text={[sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ')} />
                  )}
                  {horario && (
                    <InfoRow icon="⏰" text={`Abierto ${horario}`} />
                  )}
                  {sede.telefono && (
                    <InfoRow icon="📞" text={sede.telefono} />
                  )}
                  {sede.email_contacto && (
                    <InfoRow icon="✉️" text={sede.email_contacto} />
                  )}
                  {sede.precio_turno && (
                    <InfoRow
                      icon="💰"
                      text={`${Number(sede.precio_turno).toLocaleString('es-AR')} ${sede.moneda || 'ARS'} por turno (90 min)`}
                    />
                  )}
                  {!sede.direccion && !sede.ciudad && !sede.pais && !sede.telefono && !sede.email_contacto && (
                    <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Sin información de contacto cargada.</p>
                  )}
                </div>
              </div>

              {/* Sobre nosotros card */}
              {sede.descripcion && (
                <div style={{
                  background: 'white', borderRadius: '18px', padding: '28px',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: '20px',
                  borderLeft: '4px solid #667eea',
                }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Sobre nosotros
                  </h3>
                  <p style={{
                    fontSize: '16px', color: '#374151', lineHeight: 1.8,
                    margin: 0, fontStyle: 'italic', textAlign: 'center',
                  }}>
                    "{sede.descripcion}"
                  </p>
                </div>
              )}

              {/* Photo carousel */}
              {fotos.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#1e1b4b', fontSize: '15px', fontWeight: 700, marginBottom: '12px', paddingLeft: '2px' }}>📸 Las canchas</h3>
                  <Carousel fotos={fotos} />
                </div>
              )}

              {/* Reserve button */}
              <button
                onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                style={{
                  width: '100%', padding: '18px 24px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 800, fontSize: '17px',
                  boxShadow: '0 4px 18px rgba(185,28,28,0.45)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(185,28,28,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(185,28,28,0.45)'; }}
              >
                🎾 Reservar Cancha en {sede.nombre || 'esta sede'} →
              </button>

            </div>
          </>
        );
      })()}
    </div>
  );
}
