-- 0009: correcciones de la revisión de seguridad del bot.
-- 1. Cada usuario genera su propio código: un ADMIN ya no puede vincular su Telegram a la cuenta de otro.
-- 2. Código con generador criptográfico y la misma respuesta para todo fallo (no revela quién tiene código vigente).
-- 3. fn_bot_verificar: el Worker comprueba la vinculación antes de gastar una llamada a Gemini.
BEGIN;

DROP FUNCTION fn_generar_codigo_telegram(bigint);

CREATE OR REPLACE FUNCTION fn_generar_codigo_telegram() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_u      bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_codigo text := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
BEGIN
  IF (SELECT telegram_user_id FROM usuario WHERE id = v_u) IS NOT NULL THEN
    PERFORM fn_error('Tu cuenta ya tiene Telegram vinculado.');
  END IF;
  UPDATE usuario SET telegram_codigo_hash = encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'),
                     telegram_codigo_expira = now() + interval '10 minutes', telegram_codigo_intentos = 0
   WHERE id = v_u;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'usuario', v_u, 'Código de vinculación de Telegram generado');
  RETURN v_codigo;
END $$;
REVOKE ALL ON FUNCTION fn_generar_codigo_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_generar_codigo_telegram() TO authenticated;

CREATE OR REPLACE FUNCTION fn_bot_vincular(p_clave text, p_tg bigint, p_correo text, p_codigo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v usuario;
  c_falla CONSTANT text := 'Código incorrecto o vencido. Revisa el correo y el código, o genera uno nuevo en el panel.';
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM set_config('moncopulli.origen', 'TELEGRAM', true);
  IF EXISTS (SELECT 1 FROM usuario WHERE telegram_user_id = p_tg) THEN
    PERFORM fn_error('Esta cuenta de Telegram ya está vinculada.');
  END IF;
  SELECT * INTO v FROM usuario WHERE lower(email) = lower(btrim(p_correo)) AND activo FOR UPDATE;
  IF NOT FOUND OR v.telegram_codigo_hash IS NULL OR v.telegram_codigo_expira < now() OR v.telegram_codigo_intentos >= 3 THEN
    RETURN c_falla;
  END IF;
  IF v.telegram_codigo_hash <> encode(sha256(convert_to(btrim(p_codigo), 'UTF8')), 'hex') THEN
    UPDATE usuario SET telegram_codigo_intentos = telegram_codigo_intentos + 1 WHERE id = v.id;
    RETURN c_falla;
  END IF;
  UPDATE usuario SET telegram_user_id = p_tg, telegram_codigo_hash = NULL, telegram_codigo_expira = NULL,
                     telegram_codigo_intentos = 0
   WHERE id = v.id;
  PERFORM fn_auditar(v.id, 'MODIFICAR', 'usuario', v.id, 'Cuenta vinculada a Telegram',
                     jsonb_build_object('telegram_user_id', jsonb_build_array(NULL, p_tg)));
  RETURN 'Listo, ' || v.nombres || '. Tu cuenta quedó vinculada.';
END $$;

CREATE OR REPLACE FUNCTION fn_bot_verificar(p_clave text, p_tg bigint) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM fn_bot_usuario_vinculado(p_tg);
END $$;
REVOKE ALL ON FUNCTION fn_bot_verificar(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_bot_verificar(text, bigint) TO anon;

COMMIT;
