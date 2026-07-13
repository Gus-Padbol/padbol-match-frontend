const MINUTOS_DIA = 24 * 60;
const DEFAULT_APERTURA = '10:00';
const DEFAULT_CIERRE = '23:00';

export const RESERVA_SLOT_STEP_MIN = 30;
export const RESERVA_DURACION_SLOT_DEFAULT_MIN = 90;

export function horaAMinutos(hora) {
  if (hora == null || hora === '') return null;
  const s = String(hora).trim().split(' - ')[0].trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export function minutosAHoraReserva(totalMin) {
  const t = ((Number(totalMin) % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ventanasHorarioReserva(sede) {
  const startMin = horaAMinutos(sede?.horario_apertura) ?? horaAMinutos(DEFAULT_APERTURA);
  let endMin = horaAMinutos(sede?.horario_cierre) ?? horaAMinutos(DEFAULT_CIERRE);
  if (startMin == null || endMin == null) {
    return [{ startMin: 10 * 60, endMin: 23 * 60, cruzaMedianoche: false }];
  }
  if (endMin <= startMin) endMin += MINUTOS_DIA;
  return [{ startMin, endMin, cruzaMedianoche: endMin > MINUTOS_DIA }];
}

function agregarIniciosEnVentana(out, ventana, duracionMin, stepMin) {
  const { startMin, endMin, cruzaMedianoche } = ventana;
  const pushRango = (from, to) => {
    for (let start = from; start + duracionMin <= to; start += stepMin) {
      out.add(start % MINUTOS_DIA);
    }
  };
  if (!cruzaMedianoche) {
    pushRango(startMin, endMin);
    return;
  }
  pushRango(startMin, MINUTOS_DIA);
  pushRango(0, endMin);
}

function duracionSlotReservaMin(duracionMin) {
  const dur = parseInt(String(duracionMin), 10);
  if (!Number.isFinite(dur) || dur < 15) return RESERVA_DURACION_SLOT_DEFAULT_MIN;
  return dur;
}

export function generarIniciosMinutosSlotReserva(sede, _fechaISO, duracionMin, stepMin = RESERVA_SLOT_STEP_MIN) {
  const dur = duracionSlotReservaMin(duracionMin);
  const ventanas = ventanasHorarioReserva(sede);
  const inicios = new Set();
  for (const v of ventanas) {
    agregarIniciosEnVentana(inicios, v, dur, stepMin);
  }
  return [...inicios].sort((a, b) => a - b);
}
