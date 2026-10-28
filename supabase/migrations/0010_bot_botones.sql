-- 0010: registro por botones en el bot.
-- fn_bot_opciones da las listas para los botones; fn_bot_preparar_id prepara el registro con el
-- medicamento elegido por id. fn_bot_preparar (texto libre) resuelve el nombre y usa la misma función.
BEGIN;

-- Animales activos (primero los tratados más recientemente) y medicamentos con stock.
CREATE OR REPLACE FUNCTION fn_bot_opciones(p_clave text, p_tg bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM fn_bot_usuario_vinculado(p_tg);
  RETURN jsonb_build_object(
    'animales', COALESCE((SELECT jsonb_agg(jsonb_build_object('diio', x.diio, 'categoria', x.categoria)) FROM (
        SELECT a.diio, a.categoria
          FROM animal a LEFT JOIN tratamiento t ON t.animal_id = a.id
         WHERE a.fecha_baja IS NULL AND a.diio IS NOT NULL
         GROUP BY a.id
         ORDER BY max(t.fecha_creacion) DESC NULLS LAST, a.diio
         LIMIT 8) x), '[]'::jsonb),
    'medicamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre_comercial,
                                                                  'unidad', m.unidad_base, 'stock', m.stock_actual)
                                               ORDER BY m.nombre_comercial)
                                FROM medicamento m WHERE m.activo AND m.stock_actual > 0), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION fn_bot_preparar_id(p_clave text, p_tg bigint, p_chat bigint, p_update bigint, p_texto text,
                                              p_diio text, p_medicamento_id bigint, p_cantidad numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u  usuario;
  v_a  animal;
  v_m  medicamento;
  v_l  lote;
  v_id bigint;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  v_u := fn_bot_usuario_vinculado(p_tg);
  IF v_u.rol NOT IN ('ADMIN', 'OPERARIO') THEN PERFORM fn_error('Tu rol no permite registrar tratamientos.'); END IF;
  IF p_diio IS NULL OR p_diio !~ '^[0-9]{9}$' THEN PERFORM fn_error('Falta el DIIO del animal (9 dígitos).'); END IF;
  SELECT * INTO v_a FROM animal WHERE diio = p_diio;
  IF NOT FOUND THEN PERFORM fn_error('No encontré un animal con DIIO ' || p_diio || '.'); END IF;
  IF v_a.fecha_baja IS NOT NULL THEN PERFORM fn_error('El animal ' || p_diio || ' está dado de baja.'); END IF;
  IF COALESCE(p_cantidad, 0) <= 0 THEN PERFORM fn_error('Falta la cantidad de la dosis.'); END IF;
  SELECT * INTO v_m FROM medicamento WHERE id = p_medicamento_id AND activo;
  IF NOT FOUND THEN PERFORM fn_error('El medicamento no existe o está inactivo.'); END IF;

  v_l := fn_bot_lote_fefo(v_m.id, p_cantidad);
  IF v_l.id IS NULL THEN
    PERFORM fn_error('Stock insuficiente: ningún lote vigente de ' || v_m.nombre_comercial || ' tiene ' || p_cantidad || ' ' || v_m.unidad_base || '.');
  END IF;

  INSERT INTO mensaje_bot (telegram_update_id, telegram_chat_id, telegram_from_id, usuario_id, texto, intencion,
                           animal_diio_propuesto, medicamento_id, cantidad_propuesta, fecha_propuesta)
  VALUES (p_update, p_chat, p_tg, v_u.id, left(p_texto, 1000), 'REGISTRAR_TRATAMIENTO', p_diio, v_m.id, p_cantidad, now())
  ON CONFLICT (telegram_update_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN PERFORM fn_error('Este mensaje ya se procesó.'); END IF;

  RETURN jsonb_build_object('mensaje_id', v_id, 'diio', p_diio, 'categoria', v_a.categoria, 'medicamento', v_m.nombre_comercial,
                            'cantidad', p_cantidad, 'unidad', v_m.unidad_base, 'lote', v_l.numero_lote,
                            'vence', v_l.fecha_vencimiento, 'resguardo_dias', v_m.resguardo_leche_dias);
END $$;

-- Texto libre: resuelve el nombre del medicamento y delega en fn_bot_preparar_id.
CREATE OR REPLACE FUNCTION fn_bot_preparar(p_clave text, p_tg bigint, p_chat bigint, p_update bigint, p_texto text,
                                           p_diio text, p_medicamento text, p_cantidad numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n  integer;
  v_id bigint;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM fn_bot_usuario_vinculado(p_tg);
  IF NULLIF(btrim(p_medicamento), '') IS NULL THEN PERFORM fn_error('Falta el medicamento.'); END IF;
  SELECT count(*), min(id) INTO v_n, v_id FROM medicamento WHERE activo AND nombre_comercial ILIKE '%' || btrim(p_medicamento) || '%';
  IF v_n = 0 THEN PERFORM fn_error('No encontré el medicamento «' || btrim(p_medicamento) || '».'); END IF;
  IF v_n > 1 THEN PERFORM fn_error('Hay ' || v_n || ' medicamentos que coinciden con «' || btrim(p_medicamento) || '». Escribe el nombre más completo.'); END IF;
  RETURN fn_bot_preparar_id(p_clave, p_tg, p_chat, p_update, p_texto, p_diio, v_id, p_cantidad);
END $$;

REVOKE ALL ON FUNCTION fn_bot_opciones(text, bigint),
                       fn_bot_preparar_id(text, bigint, bigint, bigint, text, text, bigint, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_bot_opciones(text, bigint),
                          fn_bot_preparar_id(text, bigint, bigint, bigint, text, text, bigint, numeric) TO anon;

COMMIT;
