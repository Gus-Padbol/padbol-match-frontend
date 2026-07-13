import {
  buildPremioPayload,
  validatePremioForm,
  formatPremioLimite,
} from './padcoinsPremiosAdmin';
import {
  normalizeCanjeEstado,
  canjeEstadoBadge,
  extractCodigoFromScanValue,
  filterCanjesClient,
  canjeOperacionesFlags,
} from './padcoinsCanjesAdmin';

describe('validatePremioForm', () => {
  const base = {
    nombre: 'Café',
    descripcion: '',
    costo_padcoins: '100',
    stock_total: '',
    stock_disponible: '',
    condiciones: '',
    fecha_inicio: '',
    fecha_fin: '',
    imagen_url: '',
    limite_usuario_cantidad: '',
    limite_usuario_periodo: '',
    limite_global_cantidad: '',
    limite_global_periodo: '',
    canje_validez_dias: '',
    activo: true,
  };

  it('rechaza costo no positivo', () => {
    expect(validatePremioForm({ ...base, costo_padcoins: '0' })).toMatch(/mayor a 0/);
  });

  it('acepta límites vacíos como sin límite', () => {
    expect(validatePremioForm(base)).toBeNull();
  });

  it('exige período si hay cantidad de límite usuario', () => {
    expect(validatePremioForm({ ...base, limite_usuario_cantidad: '2' })).toMatch(/período/);
  });

  it('rechaza validez inválida', () => {
    expect(validatePremioForm({ ...base, canje_validez_dias: '0' })).toMatch(/validez/);
  });
});

describe('buildPremioPayload', () => {
  it('envía null en límites vacíos y validez opcional', () => {
    const payload = buildPremioPayload({
      nombre: ' Test ',
      descripcion: '',
      costo_padcoins: '50',
      stock_total: '',
      stock_disponible: '',
      condiciones: '',
      fecha_inicio: '2026-01-01',
      fecha_fin: '',
      imagen_url: 'https://img.test/x.jpg',
      limite_usuario_cantidad: '',
      limite_usuario_periodo: '',
      limite_global_cantidad: '3',
      limite_global_periodo: 'mes',
      canje_validez_dias: '7',
      activo: true,
    }, '12');

    expect(payload.sede_id).toBe(12);
    expect(payload.limite_usuario_cantidad).toBeNull();
    expect(payload.limite_global_cantidad).toBe(3);
    expect(payload.limite_global_periodo).toBe('mes');
    expect(payload.canje_validez_dias).toBe(7);
    expect(payload.imagen_url).toBe('https://img.test/x.jpg');
  });
});

describe('formatPremioLimite', () => {
  it('muestra sin límite cuando cantidad es 0', () => {
    expect(formatPremioLimite(0, 'dia')).toBe('Sin límite');
  });
});

describe('padcoins canjes admin utils', () => {
  it('normaliza estados a labels humanos', () => {
    expect(canjeEstadoBadge('aprobado').label).toBe('Aprobado');
    expect(normalizeCanjeEstado('vencida')).toBe('vencido');
  });

  it('extrae código PC desde payload escaneado', () => {
    expect(extractCodigoFromScanValue('PC-ABCDEF123456')).toBe('PC-ABCDEF123456');
    expect(extractCodigoFromScanValue(JSON.stringify({ codigo: 'PC-AAAABBBBCCCC' }))).toBe('PC-AAAABBBBCCCC');
  });

  it('filtra canjes por código y beneficio', () => {
    const rows = [
      { id: 1, premio_id: 10, codigo: 'PC-111111111111', created_at: '2026-07-01T10:00:00Z', estado: 'pendiente', user_id: 'u1' },
      { id: 2, premio_id: 20, codigo: 'PC-222222222222', created_at: '2026-07-10T10:00:00Z', estado: 'entregado', user_id: 'u2' },
    ];
    expect(filterCanjesClient(rows, { beneficioId: '10' })).toHaveLength(1);
    expect(filterCanjesClient(rows, { codigo: '2222' })).toHaveLength(1);
    expect(filterCanjesClient(rows, { desde: '2026-07-05' })).toHaveLength(1);
  });

  it('define acciones según estado', () => {
    expect(canjeOperacionesFlags({ estado: 'pendiente' })).toEqual({
      aprobable: true,
      entregable: true,
      cancelable: true,
      final: false,
    });
    expect(canjeOperacionesFlags({ estado: 'vencido' }).final).toBe(true);
  });
});
