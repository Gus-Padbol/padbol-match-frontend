import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Consistent top navigation for user-facing pages
 * Always shows: Inicio, Torneos, Ranking, Mi Perfil, Logout
 */
export default function UserHeader({ onLogout, title }) {
  const navigate = useNavigate();

  const btnStyle = {
    padding: '9px 18px',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '13px',
    background: 'rgba(0,0,0,0.3)',
    color: 'white',
    backdropFilter: 'blur(4px)',
    whiteSpace: 'nowrap',
  };

  const logoutBtnStyle = {
    ...btnStyle,
    background: 'rgba(220, 38, 38, 0.5)',
    border: '1px solid rgba(220, 38, 38, 0.6)',
    color: '#fca5a5',
  };

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(6px)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ height: '36px' }} />
        {title && (
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>
            {title}
          </h1>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/')}
          style={btnStyle}
          title="Volver al inicio"
        >
          🏠 Inicio
        </button>

        <button
          onClick={() => navigate('/torneos')}
          style={btnStyle}
          title="Ver torneos"
        >
          🏆 Torneos
        </button>

        <button
          onClick={() => navigate('/rankings')}
          style={btnStyle}
          title="Ver rankings"
        >
          🏅 Ranking
        </button>

        <button
          onClick={() => navigate('/perfil')}
          style={btnStyle}
          title="Mi perfil de jugador"
        >
          👤 Mi Perfil
        </button>

        <button
          onClick={() => {
            if (typeof onLogout === 'function') onLogout();
          }}
          style={logoutBtnStyle}
          title="Cerrar sesión"
        >
          🚪 Salir
        </button>
      </div>
    </div>
  );
}