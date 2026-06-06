import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSafeTranslation } from '../i18n/tSafe';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import { fetchPartido, scoreboardAction } from '../utils/scoreboardApi';
import '../styles/ScoreboardControl.css';

const ADMIN_ROLES = ['super_admin', 'admin_club', 'admin_sede', 'admin_nacional'];

function formatTimer(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function canAdminScoreboard(rol, sedeIdPartido, sedeIdUser) {
  if (!rol) return false;
  if (rol === 'super_admin' || rol === 'admin_nacional') return true;
  if ((rol === 'admin_club' || rol === 'admin_sede') && sedeIdUser != null) {
    return Number(sedeIdUser) === Number(sedeIdPartido);
  }
  return false;
}

export default function ScoreboardControl({ rol, sedeId: userSedeId }) {
  const { t } = useSafeTranslation();
  const { partidoId } = useParams();
  const navigate = useNavigate();
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
    if (payload?.display?.cronometroSegundos != null) {
      setTimerSeconds(payload.display.cronometroSegundos);
    }
  }, []);

  useScoreboardSocket(partidoId, handleUpdate);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchPartido(partidoId);
        if (!cancelled) {
          if (!canAdminScoreboard(rol, p.sede_id, userSedeId)) {
            setError(t('scoreboard.noPermission', 'No tenés permiso para controlar este scoreboard'));
            setLoading(false);
            return;
          }
          setPartido(p);
          setTimerSeconds(p?.display?.cronometroSegundos ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [partidoId, rol, userSedeId, t]);

  useEffect(() => {
    if (!partido?.display?.cronometroActivo) return undefined;
    const id = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [partido?.display?.cronometroActivo]);

  const runAction = async (path) => {
    setActionLoading(true);
    setError('');
    try {
      const data = await scoreboardAction(path);
      setPartido(data);
      setTimerSeconds(data?.display?.cronometroSegundos ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCronometro = (accion) => {
    runAction(`/api/scoreboard/partidos/${partidoId}/cronometro/${accion}`);
  };

  if (loading) {
    return <div className="sc-control"><div className="sc-loading">{t('scoreboard.loading', 'Cargando...')}</div></div>;
  }

  if (!partido && error) {
    return (
      <div className="sc-control">
        <div className="sc-error">{error}</div>
        <button type="button" className="sc-secondary-btn" onClick={() => navigate('/admin')}>
          {t('scoreboard.backAdmin', 'Volver al admin')}
        </button>
      </div>
    );
  }

  const display = partido.display || {};
  const terminado = partido.estado === 'terminado';
  const cronometroActivo = partido.display?.cronometroActivo;
  const canUndo = Array.isArray(partido.historial_puntos) && partido.historial_puntos.length > 0;

  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : null;

  return (
    <div className="sc-control">
      <header className="sc-header">
        <h1 className="sc-header__title">
          {partido.equipo_a_nombre} vs {partido.equipo_b_nombre}
        </h1>
        <p className="sc-header__meta">
          {partido.cancha && `${partido.cancha} · `}
          {t('scoreboard.sede', 'Sede')} #{partido.sede_id}
          {partido.saque_actual === 'A' && (
            <span className="sc-serve-indicator" title={t('scoreboard.serveA', 'Saque equipo A')} />
          )}
          {partido.saque_actual === 'B' && (
            <span className="sc-serve-indicator" title={t('scoreboard.serveB', 'Saque equipo B')} />
          )}
        </p>
        <div className="sc-timer-bar">
          <span className="sc-timer">⏱ {formatTimer(timerSeconds)}</span>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--start"
            disabled={actionLoading || terminado || cronometroActivo}
            onClick={() => handleCronometro('start')}
          >
            {t('scoreboard.start', 'START')}
          </button>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--pause"
            disabled={actionLoading || terminado || !cronometroActivo}
            onClick={() => handleCronometro('pause')}
          >
            {t('scoreboard.pause', 'PAUSE')}
          </button>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--reset"
            disabled={actionLoading}
            onClick={() => handleCronometro('reset')}
          >
            {t('scoreboard.reset', 'RESET')}
          </button>
        </div>
      </header>

      {error && <div className="sc-error">{error}</div>}

      {terminado && winnerName && (
        <div className="sc-finished-banner">
          <h2>{t('scoreboard.finished', 'PARTIDO TERMINADO')}</h2>
          <p style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>{winnerName}</p>
        </div>
      )}

      <div className="sc-columns">
        <div className="sc-team-card sc-team-card--a">
          <h2 className="sc-team-name">{partido.equipo_a_nombre}</h2>
          <div className="sc-game-score">
            {display.mode === 'deuce' ? 'DEUCE' : display.displayA ?? '0'}
          </div>
          <div className="sc-stats">
            <div>
              <strong>{partido.games_a}</strong>
              {t('scoreboard.gamesShort', 'Games')}
            </div>
            <div>
              <strong>{partido.sets_a}</strong>
              {t('scoreboard.setsShort', 'Sets')}
            </div>
          </div>
          <button
            type="button"
            className="sc-point-btn sc-point-btn--a"
            disabled={actionLoading || terminado}
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/A`)}
          >
            + {t('scoreboard.pointBtn', 'PUNTO')}
          </button>
        </div>

        <div className="sc-team-card sc-team-card--b">
          <h2 className="sc-team-name">{partido.equipo_b_nombre}</h2>
          <div className="sc-game-score">
            {display.mode === 'deuce' ? 'DEUCE' : display.displayB ?? '0'}
          </div>
          <div className="sc-stats">
            <div>
              <strong>{partido.games_b}</strong>
              {t('scoreboard.gamesShort', 'Games')}
            </div>
            <div>
              <strong>{partido.sets_b}</strong>
              {t('scoreboard.setsShort', 'Sets')}
            </div>
          </div>
          <button
            type="button"
            className="sc-point-btn sc-point-btn--b"
            disabled={actionLoading || terminado}
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/B`)}
          >
            + {t('scoreboard.pointBtn', 'PUNTO')}
          </button>
        </div>
      </div>

      <div className="sc-secondary">
        <button
          type="button"
          className="sc-secondary-btn"
          disabled={actionLoading || terminado || !canUndo}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/deshacer`)}
        >
          ↩ {t('scoreboard.undo', 'DESHACER último punto')}
        </button>
        <button
          type="button"
          className="sc-secondary-btn"
          disabled={actionLoading || terminado}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/saque`)}
        >
          {t('scoreboard.changeServe', 'CAMBIO DE SAQUE manual')}
        </button>
        <button
          type="button"
          className="sc-secondary-btn"
          disabled={actionLoading || terminado || partido.es_tiebreak}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/tiebreak`)}
        >
          {t('scoreboard.startTiebreak', 'INICIAR TIE-BREAK')}
        </button>
      </div>
    </div>
  );
}
