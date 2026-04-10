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
import { supabase } from './supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from './constants/paisesTelefono';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

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
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerNombre, setRegisterNombre] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerCodigoPais, setRegisterCodigoPais] = useState('+54');
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
  const [fichaNivel, setFichaNivel] = useState('Principiante');
  const [fichaPais, setFichaPais] = useState('');
  const [fichaCiudad, setFichaCiudad] = useState('');
  const [fichaClub, setFichaClub] = useState('');
  const [fichaFechaNacimiento, setFichaFechaNacimiento] = useState('');
  const [fichaLoading, setFichaLoading] = useState(false);

 const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Completa todos los campos');
      return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === loginEmail && u.password === loginPassword);

    if (user) {
      setCurrentCliente(user);
      localStorage.setItem('currentCliente', JSON.stringify(user));
      setLoginEmail('');
      setLoginPassword('');
      navigate('/');
    } else {
      setErrorMsg('Email o contraseña incorrectos');
    }
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

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === registerEmail)) {
      setErrorMsg('Este email ya está registrado');
      return;
    }

    let fotoUrl = null;

    if (registerFoto) {
      try {
        const fileName = `${Date.now()}_${registerFoto.name}`;
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, registerFoto);

        if (error) {
          setErrorMsg('Error al subir foto: ' + error.message);
          return;
        }

        fotoUrl = `https://vpldffhsxhgnmitiikof.supabase.co/storage/v1/object/public/avatars/${fileName}`;
      } catch (err) {
        setErrorMsg('Error al procesar foto: ' + err.message);
        return;
      }
    }

    const newUser = {
      nombre: registerNombre,
      email: registerEmail,
      password: registerPassword,
      whatsapp: `${registerCodigoPais}${registerNumeroTel.replace(/[\s\-().]/g, '')}`,
      foto: fotoUrl,
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    setPendingUserData({ email: registerEmail, nombre: registerNombre, whatsapp: newUser.whatsapp });

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

  const handleLogout = () => {
    setCurrentCliente(null);
    localStorage.removeItem('currentCliente');
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

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Nivel de juego</label>
          <select value={fichaNivel} onChange={e => setFichaNivel(e.target.value)} style={inputStyle}>
            <option value="Principiante">🟢 Principiante</option>
            <option value="Intermedio">🟡 Intermedio</option>
            <option value="Avanzado">🟠 Avanzado</option>
            <option value="Profesional">🔴 Profesional</option>
          </select>

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
            <input
              type="password"
              placeholder="Contraseña"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
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
            <input
              type="password"
              placeholder="Contraseña"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
            <input
              type="password"
              placeholder="Confirmar Contraseña"
              value={registerConfirmPassword}
              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
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
    <Route path="/perfil" element={<MiPerfil currentCliente={currentCliente} />} />
    <Route path="/crear-torneo" element={<TorneoCrear apiBaseUrl={API_BASE_URL} />} />
    <Route path="/torneo/crear" element={<TorneoCrear apiBaseUrl={API_BASE_URL} />} />
<Route path="/torneo/:torneoId/jugadores" element={<JugadoresCargar apiBaseUrl={API_BASE_URL} />} />
<Route path="/torneo/:torneoId/equipos" element={<FormEquipos apiBaseUrl={API_BASE_URL} />} />
<Route path="/torneo/:torneoId/vista" element={<TorneoVista apiBaseUrl={API_BASE_URL} />} />
<Route path="/admin" element={<AdminDashboard handleLogout={handleLogout} apiBaseUrl={API_BASE_URL} />} />
<Route path="/" element={
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={{ padding: '10px 20px', background: '#c41e3a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>
              📊 Admin Dashboard
            </button>
          )}
          <button onClick={() => navigate('/perfil')} style={{ padding: '10px 20px', background: '#c41e3a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>
            👤 Mi Perfil
          </button>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
        <ReservaForm currentCliente={currentCliente} apiBaseUrl={API_BASE_URL} />
      </div>
    } />
  </Routes>
);
}
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;