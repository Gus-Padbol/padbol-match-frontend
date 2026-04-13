import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import ReservaForm from './pages/ReservaForm';
import AdminDashboard from './pages/AdminDashboard';
import TorneoCrear from './pages/TorneoCrear';
import JugadoresCargar from './pages/JugadoresCargar';
import FormEquipos from './pages/FormEquipos';
import MiPerfil from './pages/MiPerfil';
import TorneoVista from './pages/TorneoVista';
import Rankings from './pages/Rankings';
import TorneosPublicos from './pages/TorneosPublicos';
import SedePublica from './pages/SedePublica';
import SedesPublicas from './pages/SedesPublicas';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import { supabase } from './supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from './constants/paisesTelefono';
import useUserRole from './hooks/useUserRole';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

function PlayerHome({ currentCliente, onLogout }) {
  const navigate = useNavigate();
  const ultimaSedeId = localStorage.getItem('ultima_sede');
  const [sedeName,  setSedeName]  = React.useState('');
  const [sedeCiudad, setSedeCiudad] = React.useState('');

  useEffect(() => {
    if (!ultimaSedeId) return;
    supabase
      .from('sedes')
      .select('nombre, ciudad')
      .eq('id', parseInt(ultimaSedeId))
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setSedeName(data.nombre || ''); setSedeCiudad(data.ciudad || ''); }
      });
  }, [ultimaSedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = [
    { icon: '🎾', label: 'Reservar Cancha',  action: () => navigate(`/reservar?sedeId=${ultimaSedeId}`) },
    { icon: '🏆', label: 'Torneos',           action: () => navigate('/torneos') },
    { icon: '👤', label: 'Mi Perfil',         action: () => navigate('/perfil') },
    { icon: '🏟️', label: 'Cambiar Cancha',    action: () => { localStorage.removeItem('ultima_sede'); navigate('/sedes'); } },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      padding: '40px 20px', boxSizing: 'border-box',
    }}>
      <img src="/logo-padbol-match.png" alt="Padbol Match"
        style={{ width: '90px', marginBottom: '24px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />

      <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 700, margin: '0 0 16px', textAlign: 'center' }}>
        Bienvenido/a, {currentCliente?.nombre || currentCliente?.email?.split('@')[0]}
      </h1>

      {sedeName && (
        <div style={{ marginBottom: '36px' }}>
          <span style={{
            padding: '6px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
            background: 'rgba(147,197,253,0.15)', color: '#bfdbfe',
            border: '1px solid rgba(147,197,253,0.3)',
          }}>
            🏟️ {sedeName}{sedeCiudad ? ` — ${sedeCiudad}` : ''}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px', width: '100%', maxWidth: '380px' }}>
        {cards.map(({ icon, label, action }) => (
          <button key={label} onClick={action} style={{
            minHeight: '140px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'white', border: 'none', borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', cursor: 'pointer',
            transition: 'transform 0.1s, box-shadow 0.1s', padding: '20px',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'; }}
          >
            <span style={{ fontSize: '2.2rem' }}>{icon}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e1b4b', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
          </button>
        ))}
      </div>

      <button onClick={onLogout} style={{
        padding: '10px 28px', background: '#dc2626', color: 'white',
        border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontWeight: '600', fontSize: '14px',
      }}>
        Cerrar Sesión
      </button>
    </div>
  );
}

const ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

function AppContent() {
  const navigate = useNavigate();
  const [currentCliente, setCurrentCliente] = useState(() => {
    const saved = localStorage.getItem('currentCliente');
    return saved ? JSON.parse(saved) : null;
  });
  const isAdmin = ADMIN_EMAILS.includes(currentCliente?.email);
  const { rol, sedeId, nombre: rolNombre, loading: roleLoading } = useUserRole(currentCliente);
  const [sedeName, setSedeName] = React.useState('');
  useEffect(() => {
    if (!sedeId) { setSedeName(''); return; }
    fetch(`${API_BASE_URL}/api/sedes`)
      .then(r => r.json())
      .then(sedes => {
        const sede = (sedes || []).find(s => s.id === sedeId);
        setSedeName(sede?.nombre || '');
      })
      .catch(() => {});
  }, [sedeId]);

  // Auto-redirect admin users to /admin as soon as their role resolves
  const ADMIN_ROLES = ['super_admin', 'admin_nacional', 'admin_club'];
  useEffect(() => {
    if (currentCliente && rol && ADMIN_ROLES.includes(rol)) {
      navigate('/admin');
    }
  }, [rol, currentCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore session from Supabase Auth on mount (handles page refresh / returning users)
  useEffect(() => {
    if (currentCliente) return; // already restored from localStorage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const email = session.user.email;
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nombre, whatsapp, foto')
        .eq('email', email)
        .maybeSingle();
      const user = {
        email,
        nombre:   cliente?.nombre   || email.split('@')[0],
        whatsapp: cliente?.whatsapp || '',
        foto:     cliente?.foto     || null,
      };
      setCurrentCliente(user);
      localStorage.setItem('currentCliente', JSON.stringify(user));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerNombre, setRegisterNombre] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerCodigoPais, setRegisterCodigoPais] = useState('+54');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [registerNumeroTel, setRegisterNumeroTel] = useState('');
  const [registerFoto, setRegisterFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Post-registration flow
  const [showPreguntaTorneo, setShowPreguntaTorneo] = useState(false);
  const [showFichaJugador, setShowFichaJugador] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);
  const [fichaLateralidad, setFichaLateralidad] = useState('Diestro');
  const [fichaNivel, setFichaNivel] = useState('5ta');
  const [fichaPais, setFichaPais] = useState('');
  const [fichaCiudad, setFichaCiudad] = useState('');
  const [fichaClub, setFichaClub] = useState('');
  const [fichaFechaNacimiento, setFichaFechaNacimiento] = useState('');
  const [fichaLoading, setFichaLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loginEmail || !loginPassword) {
      setErrorMsg('Completa todos los campos');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setErrorMsg('Email o contraseña incorrectos');
      return;
    }

    // Fetch extra profile fields from clientes table
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre, whatsapp, foto')
      .eq('email', loginEmail)
      .maybeSingle();

    const user = {
      email:    data.user.email,
      nombre:   cliente?.nombre   || data.user.email.split('@')[0],
      whatsapp: cliente?.whatsapp || '',
      foto:     cliente?.foto     || null,
    };

    setCurrentCliente(user);
    localStorage.setItem('currentCliente', JSON.stringify(user));
    setLoginEmail('');
    setLoginPassword('');
    const ultimaSede = localStorage.getItem('ultima_sede');
    navigate(ultimaSede ? `/sede/${ultimaSede}` : '/');
  };
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!registerNombre || !registerEmail || !registerPassword) {
      setErrorMsg('Completa todos los campos');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
    });

    if (authError) {
      setErrorMsg(authError.message);
      return;
    }

    const whatsapp = `${registerCodigoPais}${registerNumeroTel.replace(/[\s\-().]/g, '')}`;

    let fotoUrl = null;
    if (registerFoto) {
      try {
        const fileName = `${Date.now()}_${registerFoto.name}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, registerFoto);
        if (uploadError) {
          setErrorMsg('Error al subir foto: ' + uploadError.message);
          return;
        }
        fotoUrl = `https://vpldffhsxhgnmitiikof.supabase.co/storage/v1/object/public/avatars/${fileName}`;
      } catch (err) {
        setErrorMsg('Error al procesar foto: ' + err.message);
        return;
      }
    }

    // Save extra profile fields to clientes table
    if (authData.user) {
      await supabase.from('clientes').upsert({
        id:       authData.user.id,
        email:    registerEmail,
        nombre:   registerNombre,
        whatsapp: whatsapp,
        foto:     fotoUrl,
      });
    }

    setPendingUserData({ email: registerEmail, nombre: registerNombre, whatsapp });

    setRegisterNombre('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterConfirmPassword('');
    setRegisterCodigoPais('+54');
    setRegisterNumeroTel('');
    setRegisterFoto(null);
    setFotoPreview(null);

    setShowPreguntaTorneo(true);
  };

  const handleElegirNo = () => {
    setShowPreguntaTorneo(false);
    setShowFichaJugador(false);
    setPendingUserData(null);
    setShowLogin(true);
  };

  const handleElegirSi = () => {
    setShowPreguntaTorneo(false);
    setShowFichaJugador(true);
  };

  const handleSubmitFicha = async (e) => {
    e.preventDefault();
    if (!fichaPais) {
      setErrorMsg('Seleccioná tu país');
      return;
    }
    setFichaLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('jugadores_perfil')
        .insert([{
          email: pendingUserData.email,
          nombre: pendingUserData.nombre,
          whatsapp: pendingUserData.whatsapp,
          lateralidad: fichaLateralidad,
          nivel: fichaNivel,
          pais: fichaPais,
          ciudad: fichaCiudad || null,
          club: fichaClub || null,
          fecha_nacimiento: fichaFechaNacimiento || null,
        }]);
      if (error) throw error;
      setFichaLateralidad('Diestro');
      setFichaNivel('Principiante');
      setFichaPais('');
      setFichaCiudad('');
      setFichaClub('');
      setFichaFechaNacimiento('');
    } catch (err) {
      setErrorMsg('Error al guardar ficha: ' + err.message);
      setFichaLoading(false);
      return;
    }
    setFichaLoading(false);
    setShowFichaJugador(false);
    setPendingUserData(null);
    setShowLogin(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentCliente(null);
    localStorage.removeItem('currentCliente');
    localStorage.removeItem('user_role_data');
    navigate('/');
  };

  if (!currentCliente && showPreguntaTorneo) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', fontFamily: 'Arial', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px' }}>
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ width: '100px' }} />
        </div>
        <p style={{ color: '#4caf50', fontWeight: 'bold', marginBottom: '10px' }}>✅ ¡Cuenta creada con éxito!</p>
        <h2 style={{ color: 'white', marginBottom: '10px' }}>¿Querés competir en torneos de PADBOL?</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '30px', fontSize: '14px' }}>Podés crear tu ficha de jugador ahora o hacerlo más tarde.</p>
        <button
          onClick={handleElegirSi}
          style={{ width: '100%', padding: '12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}
        >
          🏆 Sí, crear mi ficha de jugador
        </button>
        <button
          onClick={handleElegirNo}
          style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '5px', cursor: 'pointer', fontSize: '15px' }}
        >
          🎾 No, solo reservar canchas
        </button>
      </div>
    );
  }

  if (!currentCliente && showFichaJugador) {
    const inputStyle = { width: '100%', padding: '10px', marginBottom: '14px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box', fontSize: '14px' };
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', padding: '20px', fontFamily: 'Arial' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ width: '100px' }} />
        </div>
        <h2 style={{ marginBottom: '20px' }}>🏆 Ficha de Jugador</h2>
        <form onSubmit={handleSubmitFicha}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Lateralidad</label>
          <select value={fichaLateralidad} onChange={e => setFichaLateralidad(e.target.value)} style={inputStyle}>
            <option value="Diestro">🤜 Diestro</option>
            <option value="Zurdo">🤛 Zurdo</option>
          </select>

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Categoría</label>
          <select value={fichaNivel} onChange={e => setFichaNivel(e.target.value)} style={inputStyle}>
            <option value="Principiante">Principiante</option>
            <option value="5ta">5ta</option>
            <option value="4ta">4ta</option>
            <option value="3ra">3ra</option>
            <option value="2da">2da</option>
            <option value="1ra">1ra</option>
            <option value="Elite">Elite</option>
          </select>
          <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '-10px', marginBottom: '14px' }}>
            ⏳ La categoría será validada por un administrador
          </p>

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>País *</label>
          <select value={fichaPais} onChange={e => setFichaPais(e.target.value)} style={inputStyle} required>
            <option value="">— Seleccionar país —</option>
            <optgroup label="Principales">
              {PAISES_TELEFONO_PRINCIPALES.map(p => (
                <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
              ))}
            </optgroup>
            <optgroup label="Otros países">
              {PAISES_TELEFONO_OTROS.map(p => (
                <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
              ))}
            </optgroup>
          </select>

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Ciudad</label>
          <input
            type="text"
            placeholder="Ej: Buenos Aires"
            value={fichaCiudad}
            onChange={e => setFichaCiudad(e.target.value)}
            style={inputStyle}
          />

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Club</label>
          <input
            type="text"
            placeholder="Ej: Club Padbol Palermo"
            value={fichaClub}
            onChange={e => setFichaClub(e.target.value)}
            style={inputStyle}
          />

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Fecha de nacimiento</label>
          <input
            type="date"
            value={fichaFechaNacimiento}
            onChange={e => setFichaFechaNacimiento(e.target.value)}
            style={inputStyle}
          />

          {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

          <button
            type="submit"
            disabled={fichaLoading}
            style={{ width: '100%', padding: '12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', opacity: fichaLoading ? 0.6 : 1 }}
          >
            {fichaLoading ? 'Guardando...' : '✅ Guardar ficha'}
          </button>
          <button
            type="button"
            onClick={handleElegirNo}
            style={{ width: '100%', padding: '10px', background: 'transparent', color: '#999', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' }}
          >
            Omitir por ahora
          </button>
        </form>
      </div>
    );
  }

  if (!currentCliente) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', fontFamily: 'Arial' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ width: '100px' }} />
        </div>

        {showLogin ? (
          <form onSubmit={handleLogin}>
            <h2>Iniciar Sesión</h2>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', paddingRight: '40px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowLoginPassword(p => !p)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888' }}>
                {showLoginPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
            <button type="submit" style={{ width: '100%', padding: '10px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Entrar
            </button>
            <p style={{ textAlign: 'center' }}>
              ¿No tienes cuenta? <a href="#" onClick={() => setShowLogin(false)} style={{ color: '#d32f2f', textDecoration: 'none' }}>Regístrate</a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <h2>Crear Cuenta</h2>
            <input
              type="text"
              placeholder="Nombre"
              value={registerNombre}
              onChange={(e) => setRegisterNombre(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type={showRegPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', paddingRight: '40px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowRegPassword(p => !p)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888' }}>
                {showRegPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type={showRegConfirmPassword ? 'text' : 'password'}
                placeholder="Confirmar Contraseña"
                value={registerConfirmPassword}
                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '10px', paddingRight: '40px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowRegConfirmPassword(p => !p)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888' }}>
                {showRegConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={registerCodigoPais}
                  onChange={(e) => setRegisterCodigoPais(e.target.value)}
                  style={{ width: '110px', flexShrink: 0, padding: '10px 4px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px', background: 'white' }}
                >
                  <optgroup label="Principales">
                    {PAISES_TELEFONO_PRINCIPALES.map(p => (
                      <option key={p.nombre} value={p.codigo}>
                        {p.bandera} {p.codigo}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Otros">
                    {PAISES_TELEFONO_OTROS.map(p => (
                      <option key={p.nombre} value={p.codigo}>
                        {p.bandera} {p.codigo} {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="tel"
                  placeholder="9 11 2345 6789"
                  value={registerNumeroTel}
                  onChange={(e) => setRegisterNumeroTel(e.target.value)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
                />
              </div>
              {registerNumeroTel && (
                <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  WhatsApp: {registerCodigoPais}{registerNumeroTel.replace(/[\s\-().]/g, '')}
                </small>
              )}
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="foto-upload" style={{
                display: 'block',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: fotoPreview ? '#fff' : '#fafafa',
                transition: 'border-color 0.2s',
              }}>
                {fotoPreview ? (
                  <>
                    <img src={fotoPreview} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }} />
                    <span style={{ color: '#666', fontSize: '12px' }}>{registerFoto?.name}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>📸</span>
                    <span style={{ color: '#666', fontSize: '13px' }}>Subí tu foto de perfil</span>
                  </>
                )}
              </label>
              <input
                id="foto-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  setRegisterFoto(file || null);
                  setFotoPreview(file ? URL.createObjectURL(file) : null);
                }}
                style={{ display: 'none' }}
              />
            </div>
            {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
            {successMsg && <p style={{ color: 'green' }}>{successMsg}</p>}
            <button type="submit" style={{ width: '100%', padding: '10px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Registrarse
            </button>
            <p style={{ textAlign: 'center' }}>
              ¿Ya tienes cuenta? <a href="#" onClick={() => setShowLogin(true)} style={{ color: '#d32f2f', textDecoration: 'none' }}>Inicia sesión</a>
            </p>
          </form>
        )}
      </div>
    );
  }

return (
  <Routes>
    <Route path="/reservar" element={
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            ← Volver al inicio
          </button>
        </div>
        <ReservaForm currentCliente={currentCliente} apiBaseUrl={API_BASE_URL} />
      </div>
    } />
    <Route path="/perfil" element={<MiPerfil currentCliente={currentCliente} />} />
    <Route path="/rankings" element={<Rankings currentCliente={currentCliente} onLogout={handleLogout} />} />
    <Route path="/torneos" element={<TorneosPublicos currentCliente={currentCliente} onLogout={handleLogout} />} />
    <Route path="/sedes" element={<SedesPublicas currentCliente={currentCliente} onLogout={handleLogout} />} />
    <Route path="/crear-torneo" element={<TorneoCrear apiBaseUrl={API_BASE_URL} rol={rol} />} />
    <Route path="/torneo/crear" element={<TorneoCrear apiBaseUrl={API_BASE_URL} rol={rol} />} />
<Route path="/torneo/:torneoId/jugadores" element={<JugadoresCargar apiBaseUrl={API_BASE_URL} />} />
<Route path="/torneo/:torneoId/equipos" element={<FormEquipos apiBaseUrl={API_BASE_URL} />} />
<Route path="/torneo/:torneoId/vista" element={<TorneoVista apiBaseUrl={API_BASE_URL} />} />
<Route path="/admin" element={<AdminDashboard handleLogout={handleLogout} apiBaseUrl={API_BASE_URL} rol={rol} sedeId={sedeId} />} />
<Route path="/" element={
      ADMIN_ROLES.includes(rol) ? (
        /* ── Admin Home Screen ── */
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '40px 20px', boxSizing: 'border-box',
        }}>
          {/* Logo */}
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ width: '90px', marginBottom: '24px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }} />

          {/* Welcome */}
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
            Bienvenido, {rolNombre || currentCliente?.nombre || currentCliente?.email?.split('@')[0]}
          </h1>

          {/* Role badge + sede */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
              background: rol === 'super_admin' ? 'rgba(250,204,21,0.2)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.2)' : 'rgba(147,197,253,0.2)',
              color: rol === 'super_admin' ? '#fde68a' : rol === 'admin_nacional' ? '#6ee7b7' : '#bfdbfe',
              border: `1px solid ${rol === 'super_admin' ? 'rgba(250,204,21,0.35)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.35)' : 'rgba(147,197,253,0.35)'}`,
            }}>
              {rol === 'super_admin' ? '👑 Super Admin' : rol === 'admin_nacional' ? '🌎 Admin Nacional' : '🏠 Admin Club'}
            </span>
            {rol === 'admin_club' && sedeName && (
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>— {sedeName}</span>
            )}
          </div>

          {/* Action cards 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px', width: '100%', maxWidth: '380px' }}>
            {[
              { icon: '📊', label: 'Dashboard',         action: () => navigate('/admin') },
              { icon: '🎾', label: 'Reservar Cancha',   action: () => navigate('/reservar') },
              { icon: '👤', label: 'Mi Perfil Jugador', action: () => navigate('/perfil') },
              { icon: '🏆', label: 'Rankings',          action: () => navigate('/rankings') },
            ].map(({ icon, label, action }) => (
              <button key={label} onClick={action} style={{
                minHeight: '140px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: 'white', border: 'none', borderRadius: '14px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)', cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
                padding: '20px',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'; }}
              >
                <span style={{ fontSize: '2.2rem' }}>{icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e1b4b', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            padding: '10px 28px', background: '#dc2626', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontWeight: '600', fontSize: '14px',
          }}>
            Cerrar Sesión
          </button>
        </div>
      ) : localStorage.getItem('ultima_sede') ? (
        /* ── Player home screen ── */
        <PlayerHome currentCliente={currentCliente} onLogout={handleLogout} />
      ) : (
        /* ── No sede yet: send to sedes picker ── */
        <SedesPublicas currentCliente={currentCliente} />
      )
    } />
  </Routes>
);
}
function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes — no auth required */}
        <Route path="/sede/:sedeId" element={<SedePublica />} />
        <Route path="/pago-exitoso" element={<PagoExitoso />} />
        <Route path="/pago-fallido" element={<PagoFallido />} />
        {/* Everything else goes through AppContent (auth logic lives there) */}
        <Route path="*" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;