import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserHeader({ onLogout, title, showBack = false, sedeNombre }) {
  const navigate = useNavigate();

const handleCambiarSede = () => {
  localStorage.removeItem('ultima_sede');
  navigate('/reservar');
};

return (
  <div style={{
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto 20px auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)'
  }}>

    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      
      {showBack && (
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: 1
          }}
        >
          ←
        </button>
      )}

      <span style={{ fontSize: '18px' }}>
        {title === 'Ranking' && '🥇'}
        {title === 'Torneos' && '🏆'}
        {title === 'Perfil' && '👤'}
        {title === 'Reservar' && '⚽'}
        {!title && '⚽'}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontWeight: '600', fontSize: '15px', color: 'white' }}>
          {title || 'Padbol'}
        </span>

        {sedeNombre && (
          <span style={{ fontSize: '11px', color: '#cbd5f5' }}>
            {sedeNombre}
          </span>
        )}
      </div>

    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      
      <button
        onClick={onLogout}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          color: 'white',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        ⏻
      </button>

    </div>

  </div>
);
}