import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import ReservaForm from './pages/ReservaForm';
import AdminDashboard from './pages/AdminDashboard';
import TorneoCrear from './pages/TorneoCrear';
import JugadoresCargar from './pages/JugadoresCargar';
import FormEquipos from './pages/FormEquipos';
import Perfil from './Perfil';
import TorneoVista from './pages/TorneoVista';
import { supabase } from './supabaseClient';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

function AppContent() {
  const navigate = useNavigate();
  const [currentCliente, setCurrentCliente] = useState(() => {
    const saved = localStorage.getItem('currentCliente');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerNombre, setRegisterNombre] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerWhatsapp, setRegisterWhatsapp] = useState('');
  const [registerFoto, setRegisterFoto] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      whatsapp: registerWhatsapp,
      foto: fotoUrl,
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    setSuccessMsg('✅ Registro exitoso. Ahora inicia sesión.');
    
    setRegisterNombre('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterConfirmPassword('');
    setRegisterWhatsapp('');
    setRegisterFoto(null);
    
    setTimeout(() => setShowLogin(true), 2000);
  };

  const handleLogout = () => {
    setCurrentCliente(null);
    localStorage.removeItem('currentCliente');
    navigate('/');
  };

  if (!currentCliente) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', fontFamily: 'Arial' }}>
        <h1 style={{ textAlign: 'center', color: '#d32f2f' }}>🎾 PADBOL MATCH</h1>

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
            <input
              type="tel"
              placeholder="WhatsApp (ej: +54 9 11 2345 6789)"
              value={registerWhatsapp}
              onChange={(e) => setRegisterWhatsapp(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setRegisterFoto(e.target.files[0])}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }}
            />
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
    <Route path="/perfil" element={<Perfil />} />
    <Route path="/crear-torneo" element={<TorneoCrear />} />
    <Route path="/torneo/:torneoId/jugadores" element={<JugadoresCargar />} />
    <Route path="/torneo/:torneoId/equipos" element={<FormEquipos />} />
    <Route path="/torneo/:torneoId/vista" element={<TorneoVista />} />
    <Route path="/admin" element={<AdminDashboard handleLogout={handleLogout} />} />
    <Route path="/" element={
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          <button onClick={() => navigate('/perfil')} style={{ padding: '10px 20px', background: '#c41e3a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>
            Mi Perfil
          </button>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
        <ReservaForm currentCliente={currentCliente} />
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