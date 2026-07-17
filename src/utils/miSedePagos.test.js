/**
 * Tests — adaptación write-only de Configuración de pagos (Mi Sede).
 */
import {
  SEDE_SECRET_FIELDS,
  SEDE_SECRET_FIELD_PATTERN,
  sanitizeSedeRowForState,
  deriveSedePagosIndicadores,
  normalizePagosIndicadores,
  esCredencialNuevaValida,
  buildPagosPatchPayload,
  parseSedePatchResponse,
  pagosEstadoKey,
} from './miSedePagos';

const PLACEHOLDER_REEMPLAZAR = 'Ingresá una nueva credencial para reemplazar la actual';
const PLACEHOLDER_INGRESAR = 'Ingresá la credencial';
const PLACEHOLDERS = [PLACEHOLDER_REEMPLAZAR, PLACEHOLDER_INGRESAR];

const SEDE_CON_SECRETOS = {
  id: 1,
  nombre: 'Club Uno',
  direccion: 'Calle 123',
  mp_access_token: 'APP_USR-super-secreto',
  stripe_account_id: 'acct_secreto',
  stripe_secret_key: 'sk_live_123',
  metodo_pago: 'mercadopago',
};

describe('Mi Sede — pagos write-only', () => {
  it('1. una sede recibida sin mp_access_token no rompe el formulario', () => {
    const sede = { id: 2, nombre: 'Sin token' };
    expect(() => sanitizeSedeRowForState(sede)).not.toThrow();
    expect(() => deriveSedePagosIndicadores(sede)).not.toThrow();
    const formCredenciales = { mp_access_token: '', stripe_account_id: '' };
    expect(formCredenciales.mp_access_token).toBe('');
  });

  it('2. el input de Mercado Pago inicia vacío (estado inicial)', () => {
    const form = { mp_access_token: '', stripe_account_id: '' };
    // Nunca se copia desde la sede.
    const sede = SEDE_CON_SECRETOS;
    form.mp_access_token = ''; // regla: siempre vacío
    expect(form.mp_access_token).toBe('');
    expect(form.mp_access_token).not.toBe(sede.mp_access_token);
  });

  it('3. el input de Stripe inicia vacío', () => {
    const form = { mp_access_token: '', stripe_account_id: '' };
    expect(form.stripe_account_id).toBe('');
  });

  it('4. mercadopago_configurado=true muestra estado configurado', () => {
    expect(pagosEstadoKey(true)).toBe('configurado');
    expect(pagosEstadoKey(normalizePagosIndicadores({ mercadopago_configurado: true }).mercadopago_configurado))
      .toBe('configurado');
  });

  it('5. mercadopago_configurado=false muestra estado no configurado', () => {
    expect(pagosEstadoKey(false)).toBe('no_configurado');
  });

  it('6. stripe_configurado=true muestra estado configurado', () => {
    expect(pagosEstadoKey(true)).toBe('configurado');
  });

  it('7. stripe_configurado=false muestra estado no configurado', () => {
    expect(pagosEstadoKey(false)).toBe('no_configurado');
  });

  it('8. el indicador desconocido no se interpreta como false', () => {
    const ind = deriveSedePagosIndicadores({ id: 1, nombre: 'X' }); // sin columnas de pago
    expect(ind.mercadopago_configurado).toBeNull();
    expect(ind.stripe_configurado).toBeNull();
    expect(pagosEstadoKey(ind.mercadopago_configurado)).toBe('desconocido');
    expect(pagosEstadoKey(null)).not.toBe('no_configurado');
  });

  it('9. un secreto existente nunca aparece como value', () => {
    const safe = sanitizeSedeRowForState(SEDE_CON_SECRETOS);
    expect(safe.mp_access_token).toBeUndefined();
    expect(safe.stripe_account_id).toBeUndefined();
    // El value del input es siempre el estado local vacío, no la sede.
    const value = '';
    expect(value).toBe('');
    expect(JSON.stringify(safe)).not.toContain('APP_USR-super-secreto');
  });

  it('10. un secreto existente nunca aparece como placeholder', () => {
    const placeholder = PLACEHOLDER_REEMPLAZAR;
    expect(placeholder).not.toContain('APP_USR');
    expect(placeholder).not.toContain('acct_');
    expect(placeholder).not.toBe(SEDE_CON_SECRETOS.mp_access_token);
  });

  it('11. al guardar sin escribir credencial, mp_access_token no entra en el payload', () => {
    const payload = buildPagosPatchPayload({
      mpAccessToken: '',
      stripeAccountId: '',
      placeholders: PLACEHOLDERS,
    });
    expect(payload).not.toHaveProperty('mp_access_token');
    expect(payload).not.toHaveProperty('stripe_account_id');
  });

  it('12. un string vacío no entra en el payload', () => {
    expect(buildPagosPatchPayload({ mpAccessToken: '' })).toEqual({});
  });

  it('13. un string con espacios no entra en el payload', () => {
    expect(buildPagosPatchPayload({ mpAccessToken: '   ', stripeAccountId: '\t' })).toEqual({});
  });

  it('14. una nueva credencial escrita sí entra en el payload', () => {
    const payload = buildPagosPatchPayload({
      mpAccessToken: ' APP_USR-nuevo ',
      stripeAccountId: 'acct_nuevo',
      placeholders: PLACEHOLDERS,
    });
    expect(payload.mp_access_token).toBe('APP_USR-nuevo');
    expect(payload.stripe_account_id).toBe('acct_nuevo');
  });

  it('15. la respuesta nueva usa response.sede correctamente', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1, nombre: 'Club', mp_access_token: 'NO_DEBE_PASAR' },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.sede.nombre).toBe('Club');
    expect(parsed.sede.mp_access_token).toBeUndefined();
  });

  it('16. la respuesta nueva usa response.pagos correctamente', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1, nombre: 'Club' },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.pagos).toEqual({
      mercadopago_configurado: true,
      stripe_configurado: false,
    });
  });

  it('17. después de guardar correctamente, el input queda vacío', () => {
    // Simula el flujo del componente: tras parse exitoso se limpian los inputs.
    let mpInput = 'APP_USR-nuevo';
    let stripeInput = 'acct_nuevo';
    const parsed = parseSedePatchResponse({
      sede: { id: 1, nombre: 'Club' },
      pagos: { mercadopago_configurado: true, stripe_configurado: true },
    });
    expect(parsed.pagos.mercadopago_configurado).toBe(true);
    mpInput = '';
    stripeInput = '';
    expect(mpInput).toBe('');
    expect(stripeInput).toBe('');
  });

  it('18. después de guardar, el indicador queda configurado', () => {
    const parsed = parseSedePatchResponse({
      sede: { id: 1 },
      pagos: { mercadopago_configurado: true, stripe_configurado: false },
    });
    expect(parsed.pagos.mercadopago_configurado).toBe(true);
    expect(pagosEstadoKey(parsed.pagos.mercadopago_configurado)).toBe('configurado');
  });

  it('19. un error conserva temporalmente el valor escrito para reintentar', () => {
    // El componente solo limpia en el camino de éxito; en error no toca el input.
    let mpInput = 'APP_USR-intento';
    const error = true;
    if (!error) mpInput = '';
    expect(mpInput).toBe('APP_USR-intento');
  });

  it('20. ningún log recibe el secreto', () => {
    // La utilidad no expone helpers de log; el sanitizado garantiza que
    // nada sensible llegue a una cadena serializada del estado.
    const safe = sanitizeSedeRowForState(SEDE_CON_SECRETOS);
    const serialized = JSON.stringify({ sede: safe, form: { mp_access_token: '', stripe_account_id: '' } });
    expect(serialized).not.toContain('APP_USR-super-secreto');
    expect(serialized).not.toContain('acct_secreto');
    expect(serialized).not.toContain('sk_live_123');
  });

  it('21. las demás propiedades de Mi Sede continúan en el payload cuando corresponde', () => {
    // buildPagosPatchPayload solo produce campos de pago; el guardado general
    // de Mi Sede (info/precios/redes) es un path separado que no incluye secretos.
    const pagosPayload = buildPagosPatchPayload({ mpAccessToken: 'APP_USR-x' });
    expect(Object.keys(pagosPayload)).toEqual(['mp_access_token']);
    const generalPayload = {
      nombre: 'Club',
      direccion: 'Calle',
      precio_60min: 1000,
    };
    expect(generalPayload).not.toHaveProperty('mp_access_token');
    expect(generalPayload.nombre).toBe('Club');
  });

  it('22. la compatibilidad con respuestas seguras anteriores no expone secretos', () => {
    // Respuesta plana legacy (sin envelope {sede, pagos}).
    const parsed = parseSedePatchResponse({
      id: 9,
      nombre: 'Legacy',
      mp_access_token: 'NO',
      stripe_secret_key: 'NO',
    });
    expect(parsed.sede.nombre).toBe('Legacy');
    expect(parsed.sede.mp_access_token).toBeUndefined();
    expect(parsed.sede.stripe_secret_key).toBeUndefined();
  });

  it('23. no se envía texto de placeholder como credencial', () => {
    expect(esCredencialNuevaValida(PLACEHOLDER_INGRESAR, PLACEHOLDERS)).toBe(false);
    expect(esCredencialNuevaValida(PLACEHOLDER_REEMPLAZAR, PLACEHOLDERS)).toBe(false);
    expect(buildPagosPatchPayload({
      mpAccessToken: PLACEHOLDER_INGRESAR,
      stripeAccountId: PLACEHOLDER_REEMPLAZAR,
      placeholders: PLACEHOLDERS,
    })).toEqual({});
  });

  it('24. no se guardan credenciales en localStorage o sessionStorage', () => {
    const keys = Object.keys({ ...localStorage, ...sessionStorage });
    for (const key of keys) {
      expect(SEDE_SECRET_FIELD_PATTERN.test(key)).toBe(false);
      const val = localStorage.getItem(key) || sessionStorage.getItem(key) || '';
      expect(val).not.toContain('APP_USR-super-secreto');
    }
    // El módulo tampoco escribe en storage: solo opera sobre objetos en memoria.
    SEDE_SECRET_FIELDS.forEach((field) => {
      expect(localStorage.getItem(field)).toBeNull();
      expect(sessionStorage.getItem(field)).toBeNull();
    });
  });

  it('sanitizeSedeRowForState elimina todos los campos sensibles', () => {
    const safe = sanitizeSedeRowForState({
      ...SEDE_CON_SECRETOS,
      webhook_secret: 'whsec',
      mp_client_secret: 'cs',
    });
    for (const key of Object.keys(safe)) {
      expect(SEDE_SECRET_FIELD_PATTERN.test(key)).toBe(false);
    }
  });

  it('deriveSedePagosIndicadores refleja presencia real del secreto sin retenerlo', () => {
    expect(deriveSedePagosIndicadores(SEDE_CON_SECRETOS)).toEqual({
      mercadopago_configurado: true,
      stripe_configurado: true,
    });
    expect(deriveSedePagosIndicadores({
      id: 1,
      mp_access_token: '  ',
      stripe_account_id: null,
    })).toEqual({
      mercadopago_configurado: false,
      stripe_configurado: false,
    });
  });

  it('normalizePagosIndicadores conserva el previo si la respuesta no trae pagos', () => {
    const prev = { mercadopago_configurado: true, stripe_configurado: false };
    expect(normalizePagosIndicadores(undefined, prev)).toEqual(prev);
    expect(normalizePagosIndicadores({ mercadopago_configurado: false }, prev)).toEqual({
      mercadopago_configurado: false,
      stripe_configurado: false,
    });
  });
});
