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
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import ScoreboardDisplay from './pages/ScoreboardDisplay';
import ScoreboardControl from './pages/ScoreboardControl';

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

  const [authReady, setAuthReady] = useState(false);

  const { rol, sedeId } = useUserRole(currentCliente);

  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerNombre, setRegisterNombre] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerCodigoPais, setRegisterCodigoPais] = useState('+54');
  const [registerNumeroTel, setRegisterNumeroTel] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const [showPreguntaTorneo, setShowPreguntaTorneo] = useState(false);
  const [showFichaJugador, setShowFichaJugador] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const email = session.user.email;

        const { data: cliente } = await supabase
          .from('clientes')
          .select('nombre, whatsapp, foto')
          .eq('email', email)
          .maybeSingle();

        const user = {
          email,
          nombre: cliente?.nombre || email.split('@')[0],
          whatsapp: cliente?.whatsapp || '',
          foto: cliente?.foto || null,
        };

        setCurrentCliente(user);
        localStorage.setItem('currentCliente', JSON.stringify(user));
      }

      setAuthReady(true);
    };

    init();
  }, []);

  if (!authReady) {
    return <div style={{color: 'white'}}>Cargando sesión...</div>;
  }

  if (!currentCliente && showPreguntaTorneo) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
        <h2>¿Querés competir?</h2>
        <button onClick={() => setShowFichaJugador(true)}>Sí</button>
        <button onClick={() => setShowPreguntaTorneo(false)}>No</button>
      </div>
    );
  }

  if (!currentCliente && showFichaJugador) {
    return <div>Ficha jugador</div>;
  }

  if (!currentCliente) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto' }}>
        <h2>Login</h2>

        <form onSubmit={async (e) => {
          e.preventDefault();

          const { data, error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
          });

          if (error) {
            setErrorMsg('Error');
            return;
          }

          const { data: cliente } = await supabase
            .from('clientes')
            .select('nombre, whatsapp, foto')
            .eq('email', data.user.email)
            .maybeSingle();

          const user = {
            email: data.user.email,
            nombre: cliente?.nombre || data.user.email.split('@')[0],
            whatsapp: cliente?.whatsapp || '',
            foto: cliente?.foto || null,
          };

          setCurrentCliente(user);
          localStorage.setItem('currentCliente', JSON.stringify(user));

          navigate('/');
        }}>
          <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
          <button>Entrar</button>
        </form>

        {errorMsg && <p>{errorMsg}</p>}
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<UserHome currentCliente={currentCliente} />} />
      <Route path="/reservar" element={<ReservaForm currentCliente={currentCliente} />} />
      <Route path="/perfil" element={<MiPerfil currentCliente={currentCliente} />} />
      <Route path="/admin" element={<AdminDashboard rol={rol} sedeId={sedeId} apiBaseUrl={API_BASE_URL} />} />
      <Route
        path="/admin/scoreboard/:partidoId"
        element={<ScoreboardControl rol={rol} sedeId={sedeId} />}
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/display/:sedeId/scoreboard/:partidoId" element={<ScoreboardDisplay />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;