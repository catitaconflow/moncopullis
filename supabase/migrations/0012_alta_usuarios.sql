-- 0012: alta de usuarios desde el panel.
-- La función crear-usuario crea la cuenta en Auth con la clave de servicio y después llama a
-- fn_crear_usuario con el JWT del ADMIN, para que el permiso y la auditoría queden a su nombre.
BEGIN;

-- Dígito verificador módulo 11 (la misma regla que panel/src/lib/rut.ts).
CREATE OR REPLACE FUNCTION fn_rut_valido(p_rut text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_cuerpo text;
  v_suma   integer := 0;
  v_factor integer := 2;
  v_r      integer;
BEGIN
  IF p_rut IS NULL OR p_rut !~ '^[0-9]{1,8}-[0-9K]$' THEN RETURN false; END IF;
  v_cuerpo := split_part(p_rut, '-', 1);
  FOR i IN REVERSE length(v_cuerpo)..1 LOOP
    v_suma := v_suma + substr(v_cuerpo, i, 1)::integer * v_factor;
    v_factor := CASE WHEN v_factor = 7 THEN 2 ELSE v_factor + 1 END;
  END LOOP;
  v_r := 11 - v_suma % 11;
  RETURN split_part(p_rut, '-', 2) = CASE v_r WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE v_r::text END;
END $$;

CREATE OR REPLACE FUNCTION fn_crear_usuario(p_auth_user_id uuid, p_rut text, p_nombres text, p_apellidos text,
                                            p_email text, p_telefono text, p_rol text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u     bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_rut   text := upper(replace(btrim(p_rut), '.', ''));
  v_nom   text := NULLIF(btrim(p_nombres), '');
  v_ape   text := NULLIF(btrim(p_apellidos), '');
  v_email text := lower(btrim(p_email));
  v_tel   text := NULLIF(btrim(p_telefono), '');
  v_id    bigint;
BEGIN
  IF p_auth_user_id IS NULL THEN PERFORM fn_error('Falta la cuenta de acceso del usuario.'); END IF;
  IF v_rut IS NULL OR v_rut !~ '^[0-9]{1,8}-[0-9K]$' THEN PERFORM fn_error('El RUT debe tener el formato 12345678-9.'); END IF;
  IF NOT fn_rut_valido(v_rut) THEN PERFORM fn_error('El dígito verificador del RUT no es correcto.'); END IF;
  IF v_nom IS NULL OR length(v_nom) > 80 THEN PERFORM fn_error('Los nombres son obligatorios (hasta 80 caracteres).'); END IF;
  IF v_ape IS NULL OR length(v_ape) > 80 THEN PERFORM fn_error('Los apellidos son obligatorios (hasta 80 caracteres).'); END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    PERFORM fn_error('El correo no es válido.');
  END IF;
  IF length(v_tel) > 15 THEN PERFORM fn_error('El teléfono admite hasta 15 caracteres.'); END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('ADMIN', 'OPERARIO', 'AUDITOR') THEN PERFORM fn_error('Rol no válido.'); END IF;
  IF EXISTS (SELECT 1 FROM usuario WHERE rut = v_rut) THEN PERFORM fn_error('Ya existe un usuario con ese RUT.'); END IF;
  IF EXISTS (SELECT 1 FROM usuario WHERE lower(email) = v_email) THEN PERFORM fn_error('Ya existe un usuario con ese correo.'); END IF;
  IF EXISTS (SELECT 1 FROM usuario WHERE auth_user_id = p_auth_user_id) THEN
    PERFORM fn_error('Esa cuenta de acceso ya tiene un usuario asociado.');
  END IF;
  -- Sin esto un ADMIN podría asociar por la API una cuenta de Auth ajena.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id AND lower(email) = v_email) THEN
    PERFORM fn_error('La cuenta de acceso no existe o su correo no coincide.');
  END IF;

  INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, telefono, rol)
  VALUES (p_auth_user_id, v_rut, v_nom, v_ape, v_email, v_tel, p_rol)
  RETURNING id INTO v_id;
  PERFORM fn_auditar(v_u, 'CREAR', 'usuario', v_id, 'Usuario creado: ' || v_email || ' (' || p_rol || ')');
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION fn_rut_valido(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_crear_usuario(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_crear_usuario(uuid, text, text, text, text, text, text) TO authenticated;

COMMIT;
