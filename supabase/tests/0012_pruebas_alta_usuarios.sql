-- =====================================================================
-- Pruebas de la migración 0012 (alta de usuarios).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Las cuentas de auth.users de prueba también se deshacen con el ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000012a1', '10000121-1', 'Ana', 'Admin', 'u12.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000012b2', '10000122-2', 'Omar', 'Operario', 'u12.operario@prueba.cl', 'OPERARIO');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000012e1', 'nuevo.0012@prueba.cl'),
  ('00000000-0000-0000-0000-0000000012e2', 'otro.0012@prueba.cl');

CREATE FUNCTION pg_temp.como(p_sub text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

CREATE FUNCTION pg_temp.debe_fallar(p_prueba text, p_sql text, p_texto text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION '% FALLA: se aceptó la operación', p_prueba;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE p_prueba || ' FALLA%' THEN RAISE; END IF;
  IF position(p_texto IN SQLERRM) = 0 THEN
    RAISE EXCEPTION '% FALLA: mensaje inesperado: %', p_prueba, SQLERRM;
  END IF;
END $$;

DO $$
DECLARE
  v_id bigint;
  v_u  usuario;
BEGIN
  -- U1: el dígito verificador se calcula igual que en el panel
  IF NOT fn_rut_valido('12000001-2') OR NOT fn_rut_valido('12000002-0') OR fn_rut_valido('12000001-3')
     OR fn_rut_valido('12.000.001-2') OR fn_rut_valido(NULL) THEN
    RAISE EXCEPTION 'U1 FALLA: fn_rut_valido';
  END IF;

  -- U2: el operario no puede crear usuarios
  PERFORM pg_temp.como('00000000-0000-0000-0000-0000000012b2');
  PERFORM pg_temp.debe_fallar('U2',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e1', '12000001-2', 'Nuevo', 'Usuario',
                               'nuevo.0012@prueba.cl', NULL, 'OPERARIO')$q$,
    'No tienes permiso');

  -- U3: el admin crea el usuario; RUT con puntos y correo en mayúsculas se normalizan y queda auditado
  PERFORM pg_temp.como('00000000-0000-0000-0000-0000000012a1');
  v_id := fn_crear_usuario('00000000-0000-0000-0000-0000000012e1', '12.000.001-2', ' Nuevo ', 'Usuario',
                           'Nuevo.0012@Prueba.cl', '', 'OPERARIO');
  SELECT * INTO v_u FROM usuario WHERE id = v_id;
  IF v_u.rut <> '12000001-2' OR v_u.email <> 'nuevo.0012@prueba.cl' OR v_u.nombres <> 'Nuevo'
     OR v_u.telefono IS NOT NULL OR v_u.rol <> 'OPERARIO' OR NOT v_u.activo THEN
    RAISE EXCEPTION 'U3 FALLA: datos guardados %', row_to_json(v_u);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auditoria WHERE accion = 'CREAR' AND entidad = 'usuario' AND entidad_id = v_id
                    AND usuario_id = (SELECT id FROM usuario WHERE email = 'u12.admin@prueba.cl')) THEN
    RAISE EXCEPTION 'U3 FALLA: no se auditó el alta a nombre del admin';
  END IF;

  -- U4: formato y dígito verificador
  PERFORM pg_temp.debe_fallar('U4',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'formato 12345678-9');
  PERFORM pg_temp.debe_fallar('U4',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-1', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'dígito verificador');

  -- U5: RUT y correo repetidos (el correo sin distinguir mayúsculas)
  PERFORM pg_temp.debe_fallar('U5',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000001-2', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'Ya existe un usuario con ese RUT');
  PERFORM pg_temp.debe_fallar('U5',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-0', 'Otro', 'Usuario', 'NUEVO.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'Ya existe un usuario con ese correo');

  -- U6: rol, nombres y correo inválidos
  PERFORM pg_temp.debe_fallar('U6',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-0', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'JEFE')$q$,
    'Rol no válido');
  PERFORM pg_temp.debe_fallar('U6',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-0', '  ', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'nombres son obligatorios');
  PERFORM pg_temp.debe_fallar('U6',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-0', 'Otro', 'Usuario', 'otro.prueba.cl', NULL, 'AUDITOR')$q$,
    'correo no es válido');

  -- U7: la cuenta de Auth debe existir y tener el mismo correo
  PERFORM pg_temp.debe_fallar('U7',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e2', '12000002-0', 'Otro', 'Usuario', 'distinto.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'su correo no coincide');
  PERFORM pg_temp.debe_fallar('U7',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012ff', '12000002-0', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'no existe');

  -- U8: la misma cuenta de Auth no se asocia dos veces
  PERFORM pg_temp.debe_fallar('U8',
    $q$SELECT fn_crear_usuario('00000000-0000-0000-0000-0000000012e1', '12000002-0', 'Otro', 'Usuario', 'otro.0012@prueba.cl', NULL, 'AUDITOR')$q$,
    'ya tiene un usuario asociado');

  RAISE NOTICE 'Pruebas U1 a U8: TODAS PASAN';
END $$;

-- U9: anon no ejecuta fn_crear_usuario y nadie desde la API ejecuta fn_rut_valido
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM fn_crear_usuario(gen_random_uuid(), '12000003-9', 'A', 'B', 'a@b.cl', NULL, 'AUDITOR');
  RAISE EXCEPTION 'U9 FALLA: anon ejecutó fn_crear_usuario';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'U9 PASA: anon no tiene permiso de ejecución';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM fn_rut_valido('12000001-2');
  RAISE EXCEPTION 'U9 FALLA: authenticated ejecutó fn_rut_valido';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'U9 PASA: fn_rut_valido no se expone por la API';
END $$;
RESET ROLE;

SELECT 'U1 a U9: TODAS PASAN' AS resultado;
ROLLBACK;
