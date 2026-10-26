-- =====================================================================
-- Migración 0005: operaciones de escritura del panel web.
-- Aditiva: solo crea funciones. No cambia tablas ni datos existentes.
--
-- Las tablas siguen sin políticas de escritura. Cada operación es una
-- función SECURITY DEFINER que:
--   1. comprueba el rol con fn_rol_actual() (matriz de la sección 8.1),
--   2. valida los datos con mensajes comprensibles (ERRCODE P0001),
--   3. escribe y deja auditoría y detalle en la misma transacción.
-- El stock solo cambia con movimientos de inventario (triggers de 0001).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Utilidades
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_exigir_rol(p_roles text[]) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id  bigint;
  v_rol text;
BEGIN
  SELECT u.id, u.rol INTO v_id, v_rol FROM usuario u WHERE u.auth_user_id = auth.uid() AND u.activo;
  IF v_id IS NULL OR NOT (v_rol = ANY (p_roles)) THEN
    RAISE EXCEPTION 'No tienes permiso para esta acción.' USING ERRCODE = '42501';
  END IF;
  RETURN v_id;
END $$;

-- p_cambios: {"campo": [anterior, nuevo], ...}; solo se guardan los campos que cambiaron.
CREATE OR REPLACE FUNCTION fn_auditar(p_usuario bigint, p_accion text, p_entidad text, p_entidad_id bigint,
                                      p_descripcion text, p_cambios jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aud bigint;
BEGIN
  INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, origen, descripcion)
  VALUES (p_usuario, p_accion, p_entidad, p_entidad_id, 'WEBAPP', left(p_descripcion, 300))
  RETURNING id INTO v_aud;

  INSERT INTO auditoria_detalle (auditoria_id, campo, valor_anterior, valor_nuevo)
  SELECT v_aud, c.key, c.value ->> 0, c.value ->> 1
    FROM jsonb_each(p_cambios) AS c
   WHERE (c.value ->> 0) IS DISTINCT FROM (c.value ->> 1);
END $$;

CREATE OR REPLACE FUNCTION fn_error(p_mensaje text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%', p_mensaje USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION fn_texto(p jsonb, p_campo text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(p ->> p_campo), '')
$$;

-- ---------------------------------------------------------------------
-- 2. Alertas: se recalculan después de cada cambio de stock o de dosis
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generar_alertas() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_abiertas  integer;
  v_resueltas integer;
  n integer;
BEGIN
  -- Stock bajo: stock actual menor al mínimo (misma regla que el panel)
  INSERT INTO alerta (tipo, medicamento_id)
  SELECT 'STOCK_BAJO', m.id FROM medicamento m
   WHERE m.activo AND m.stock_actual < m.stock_minimo
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_abiertas = ROW_COUNT;

  -- Vencimiento próximo: lote activo con stock que vence en 60 días o menos
  INSERT INTO alerta (tipo, lote_id)
  SELECT 'VENCIMIENTO_PROXIMO', l.id FROM lote l
   WHERE l.activo AND l.stock_lote > 0 AND l.fecha_vencimiento <= current_date + 60
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; v_abiertas := v_abiertas + n;

  -- Dosis atrasada: programada con fecha pasada en un tratamiento vigente
  INSERT INTO alerta (tipo, dosis_id)
  SELECT 'DOSIS_ATRASADA', d.id FROM dosis d JOIN tratamiento t ON t.id = d.tratamiento_id
   WHERE d.estado = 'PROGRAMADA' AND d.fecha_programada < now() AND t.fecha_anulacion IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; v_abiertas := v_abiertas + n;

  -- Cierre automático de las que ya no se cumplen
  UPDATE alerta a SET estado = 'RESUELTA', fecha_resolucion = now(), comentario = 'Cerrada automáticamente: la condición ya no se cumple'
   WHERE a.estado = 'ABIERTA' AND (
        (a.tipo = 'STOCK_BAJO' AND NOT EXISTS (
           SELECT 1 FROM medicamento m WHERE m.id = a.medicamento_id AND m.activo AND m.stock_actual < m.stock_minimo))
     OR (a.tipo = 'VENCIMIENTO_PROXIMO' AND NOT EXISTS (
           SELECT 1 FROM lote l WHERE l.id = a.lote_id AND l.activo AND l.stock_lote > 0 AND l.fecha_vencimiento <= current_date + 60))
     OR (a.tipo = 'DOSIS_ATRASADA' AND NOT EXISTS (
           SELECT 1 FROM dosis d JOIN tratamiento t ON t.id = d.tratamiento_id
            WHERE d.id = a.dosis_id AND d.estado = 'PROGRAMADA' AND t.fecha_anulacion IS NULL)));
  GET DIAGNOSTICS v_resueltas = ROW_COUNT;

  RETURN jsonb_build_object('abiertas', v_abiertas, 'resueltas', v_resueltas);
END $$;

CREATE OR REPLACE FUNCTION fn_actualizar_alertas() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  RETURN fn_generar_alertas();
END $$;

CREATE OR REPLACE FUNCTION fn_resolver_alerta(p_id bigint, p_comentario text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
BEGIN
  IF NULLIF(btrim(p_comentario), '') IS NULL THEN PERFORM fn_error('Escribe un comentario para resolver la alerta.'); END IF;
  UPDATE alerta SET estado = 'RESUELTA', fecha_resolucion = now(), resuelta_por = v_u, comentario = left(btrim(p_comentario), 300)
   WHERE id = p_id AND estado = 'ABIERTA';
  IF NOT FOUND THEN PERFORM fn_error('La alerta no existe o ya está resuelta.'); END IF;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'alerta', p_id, 'Alerta resuelta: ' || btrim(p_comentario),
                     jsonb_build_object('estado', jsonb_build_array('ABIERTA', 'RESUELTA')));
END $$;

-- ---------------------------------------------------------------------
-- 3. Medicamentos (catálogo: solo ADMIN)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_guardar_medicamento(p_id bigint, p jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u      bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_ant    medicamento;
  v_nuevo  medicamento;
  v_nombre text := fn_texto(p, 'nombre_comercial');
BEGIN
  IF v_nombre IS NULL THEN PERFORM fn_error('El nombre comercial es obligatorio.'); END IF;
  IF fn_texto(p, 'unidad_base') NOT IN ('ML', 'G', 'UNIDAD') THEN PERFORM fn_error('La unidad debe ser ML, G o UNIDAD.'); END IF;
  IF COALESCE((p ->> 'contenido_envase')::numeric, 0) <= 0 THEN PERFORM fn_error('El contenido del envase debe ser mayor que 0.'); END IF;
  IF COALESCE((p ->> 'stock_minimo')::numeric, 0) < 0 THEN PERFORM fn_error('El stock mínimo no puede ser negativo.'); END IF;
  IF COALESCE((p ->> 'resguardo_leche_dias')::int, 0) NOT BETWEEN 0 AND 365 THEN
    PERFORM fn_error('Los días de resguardo de leche deben estar entre 0 y 365.');
  END IF;
  IF EXISTS (SELECT 1 FROM medicamento WHERE lower(nombre_comercial) = lower(v_nombre) AND id IS DISTINCT FROM p_id) THEN
    PERFORM fn_error('Ya existe un medicamento con ese nombre.');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO medicamento (nombre_comercial, principio_activo, tipo, via_administracion, unidad_base, contenido_envase,
                             requiere_receta, resguardo_leche_dias, stock_minimo)
    VALUES (v_nombre, fn_texto(p, 'principio_activo'), fn_texto(p, 'tipo'), fn_texto(p, 'via_administracion'),
            fn_texto(p, 'unidad_base'), (p ->> 'contenido_envase')::numeric, COALESCE((p ->> 'requiere_receta')::boolean, false),
            COALESCE((p ->> 'resguardo_leche_dias')::int, 0), COALESCE((p ->> 'stock_minimo')::numeric, 0))
    RETURNING * INTO v_nuevo;
    PERFORM fn_auditar(v_u, 'CREAR', 'medicamento', v_nuevo.id, 'Medicamento creado: ' || v_nombre);
  ELSE
    SELECT * INTO v_ant FROM medicamento WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM fn_error('El medicamento no existe.'); END IF;
    UPDATE medicamento SET
      nombre_comercial = v_nombre, principio_activo = fn_texto(p, 'principio_activo'), tipo = fn_texto(p, 'tipo'),
      via_administracion = fn_texto(p, 'via_administracion'), unidad_base = fn_texto(p, 'unidad_base'),
      contenido_envase = (p ->> 'contenido_envase')::numeric, requiere_receta = COALESCE((p ->> 'requiere_receta')::boolean, false),
      resguardo_leche_dias = COALESCE((p ->> 'resguardo_leche_dias')::int, 0), stock_minimo = COALESCE((p ->> 'stock_minimo')::numeric, 0),
      activo = COALESCE((p ->> 'activo')::boolean, true)
    WHERE id = p_id RETURNING * INTO v_nuevo;
    PERFORM fn_auditar(v_u, 'MODIFICAR', 'medicamento', p_id, 'Medicamento modificado: ' || v_nombre, jsonb_build_object(
      'nombre_comercial', jsonb_build_array(v_ant.nombre_comercial, v_nuevo.nombre_comercial),
      'principio_activo', jsonb_build_array(v_ant.principio_activo, v_nuevo.principio_activo),
      'unidad_base', jsonb_build_array(v_ant.unidad_base, v_nuevo.unidad_base),
      'contenido_envase', jsonb_build_array(v_ant.contenido_envase, v_nuevo.contenido_envase),
      'requiere_receta', jsonb_build_array(v_ant.requiere_receta, v_nuevo.requiere_receta),
      'resguardo_leche_dias', jsonb_build_array(v_ant.resguardo_leche_dias, v_nuevo.resguardo_leche_dias),
      'stock_minimo', jsonb_build_array(v_ant.stock_minimo, v_nuevo.stock_minimo),
      'activo', jsonb_build_array(v_ant.activo, v_nuevo.activo)));
  END IF;
  PERFORM fn_generar_alertas();
  RETURN v_nuevo.id;
END $$;

-- ---------------------------------------------------------------------
-- 4. Movimientos de inventario (ADMIN y OPERARIO)
-- ---------------------------------------------------------------------
-- Entrada de compra: crea el lote si no existe. Proveedor solo para ADMIN.
CREATE OR REPLACE FUNCTION fn_registrar_entrada(p_medicamento_id bigint, p_numero_lote text, p_fecha_vencimiento date,
                                                p_cantidad numeric, p_proveedor_id bigint, p_observaciones text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_lote lote;
  v_mov  bigint;
  v_nom  text;
BEGIN
  SELECT nombre_comercial INTO v_nom FROM medicamento WHERE id = p_medicamento_id AND activo;
  IF v_nom IS NULL THEN PERFORM fn_error('El medicamento no existe o está inactivo.'); END IF;
  IF NULLIF(btrim(p_numero_lote), '') IS NULL THEN PERFORM fn_error('El número de lote es obligatorio.'); END IF;
  IF p_fecha_vencimiento IS NULL THEN PERFORM fn_error('La fecha de vencimiento es obligatoria.'); END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN PERFORM fn_error('La cantidad debe ser mayor que 0.'); END IF;
  IF p_proveedor_id IS NOT NULL THEN
    IF fn_rol_actual() <> 'ADMIN' THEN PERFORM fn_error('Solo un administrador puede asignar el proveedor.'); END IF;
    IF NOT EXISTS (SELECT 1 FROM proveedor WHERE id = p_proveedor_id AND activo) THEN
      PERFORM fn_error('El proveedor no existe o está inactivo.');
    END IF;
  END IF;

  SELECT * INTO v_lote FROM lote WHERE medicamento_id = p_medicamento_id AND numero_lote = btrim(p_numero_lote) FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO lote (medicamento_id, numero_lote, fecha_vencimiento)
    VALUES (p_medicamento_id, btrim(p_numero_lote), p_fecha_vencimiento) RETURNING * INTO v_lote;
    PERFORM fn_auditar(v_u, 'CREAR', 'lote', v_lote.id, 'Lote ' || v_lote.numero_lote || ' de ' || v_nom);
  ELSIF v_lote.fecha_vencimiento <> p_fecha_vencimiento THEN
    PERFORM fn_error('El lote ' || v_lote.numero_lote || ' ya existe con vencimiento ' || to_char(v_lote.fecha_vencimiento, 'DD-MM-YYYY') || '. Revisa la fecha.');
  ELSIF NOT v_lote.activo THEN
    PERFORM fn_error('El lote ' || v_lote.numero_lote || ' está inactivo.');
  END IF;

  INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, proveedor_id, observaciones,
                                     usuario_id, origen, fecha_evento)
  VALUES (gen_random_uuid(), p_medicamento_id, v_lote.id, 'ENTRADA', p_cantidad, p_proveedor_id,
          left(NULLIF(btrim(p_observaciones), ''), 300), v_u, 'WEBAPP', now())
  RETURNING id INTO v_mov;
  PERFORM fn_auditar(v_u, 'CREAR', 'movimiento_inventario', v_mov,
                     'Entrada de ' || p_cantidad || ' en lote ' || v_lote.numero_lote || ' de ' || v_nom);
  PERFORM fn_generar_alertas();
  RETURN v_mov;
END $$;

-- Ajuste por conteo, vencimiento, rotura u otro motivo
CREATE OR REPLACE FUNCTION fn_registrar_ajuste(p_lote_id bigint, p_tipo text, p_cantidad numeric, p_motivo text,
                                               p_observaciones text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_lote lote;
  v_mov  bigint;
BEGIN
  SELECT * INTO v_lote FROM lote WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('El lote no existe.'); END IF;
  IF p_tipo NOT IN ('SALIDA_AJUSTE', 'ENTRADA_AJUSTE') THEN PERFORM fn_error('El ajuste debe ser de salida o de entrada.'); END IF;
  IF p_motivo NOT IN ('VENCIDO', 'ROTO_DERRAME', 'CONTEO', 'OTRO') THEN PERFORM fn_error('Elige un motivo de ajuste válido.'); END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN PERFORM fn_error('La cantidad debe ser mayor que 0.'); END IF;
  IF p_motivo = 'OTRO' AND NULLIF(btrim(p_observaciones), '') IS NULL THEN
    PERFORM fn_error('Con el motivo «Otro» debes explicar el ajuste en observaciones.');
  END IF;
  IF p_tipo = 'SALIDA_AJUSTE' AND p_cantidad > v_lote.stock_lote THEN
    PERFORM fn_error('Stock insuficiente: el lote ' || v_lote.numero_lote || ' tiene ' || v_lote.stock_lote || '.');
  END IF;

  INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, motivo, observaciones,
                                     usuario_id, origen, fecha_evento)
  VALUES (gen_random_uuid(), v_lote.medicamento_id, v_lote.id, p_tipo, p_cantidad, p_motivo,
          left(NULLIF(btrim(p_observaciones), ''), 300), v_u, 'WEBAPP', now())
  RETURNING id INTO v_mov;
  PERFORM fn_auditar(v_u, 'CREAR', 'movimiento_inventario', v_mov,
                     CASE p_tipo WHEN 'SALIDA_AJUSTE' THEN 'Ajuste de salida de ' ELSE 'Ajuste de entrada de ' END
                     || p_cantidad || ' en lote ' || v_lote.numero_lote || ' (' || p_motivo || ')');
  PERFORM fn_generar_alertas();
  RETURN v_mov;
END $$;

-- ---------------------------------------------------------------------
-- 5. Propietarios y proveedores
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_guardar_propietario(p_id bigint, p jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u   bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_ant propietario;
  v_n   propietario;
  v_rut text := upper(fn_texto(p, 'rut'));
BEGIN
  IF v_rut IS NULL OR v_rut !~ '^[0-9]{1,8}-[0-9K]$' THEN PERFORM fn_error('El RUT debe tener el formato 12345678-9.'); END IF;
  IF fn_texto(p, 'nombre_completo') IS NULL THEN PERFORM fn_error('El nombre es obligatorio.'); END IF;
  IF EXISTS (SELECT 1 FROM propietario WHERE rut = v_rut AND id IS DISTINCT FROM p_id) THEN
    PERFORM fn_error('Ya existe un propietario con ese RUT.');
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO propietario (rut, nombre_completo, telefono)
    VALUES (v_rut, fn_texto(p, 'nombre_completo'), fn_texto(p, 'telefono')) RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'CREAR', 'propietario', v_n.id, 'Propietario creado: ' || v_n.nombre_completo);
  ELSE
    SELECT * INTO v_ant FROM propietario WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM fn_error('El propietario no existe.'); END IF;
    UPDATE propietario SET rut = v_rut, nombre_completo = fn_texto(p, 'nombre_completo'), telefono = fn_texto(p, 'telefono'),
           activo = COALESCE((p ->> 'activo')::boolean, true)
     WHERE id = p_id RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'MODIFICAR', 'propietario', p_id, 'Propietario modificado: ' || v_n.nombre_completo, jsonb_build_object(
      'rut', jsonb_build_array(v_ant.rut, v_n.rut), 'nombre_completo', jsonb_build_array(v_ant.nombre_completo, v_n.nombre_completo),
      'telefono', jsonb_build_array(v_ant.telefono, v_n.telefono), 'activo', jsonb_build_array(v_ant.activo, v_n.activo)));
  END IF;
  RETURN v_n.id;
END $$;

CREATE OR REPLACE FUNCTION fn_guardar_proveedor(p_id bigint, p jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u     bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_ant   proveedor;
  v_n     proveedor;
  v_rut   text := upper(fn_texto(p, 'rut'));
  v_email text := lower(fn_texto(p, 'email'));
BEGIN
  IF v_rut IS NULL OR v_rut !~ '^[0-9]{1,8}-[0-9K]$' THEN PERFORM fn_error('El RUT debe tener el formato 12345678-9.'); END IF;
  IF fn_texto(p, 'razon_social') IS NULL THEN PERFORM fn_error('La razón social es obligatoria.'); END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN PERFORM fn_error('El correo no es válido.'); END IF;
  IF EXISTS (SELECT 1 FROM proveedor WHERE rut = v_rut AND id IS DISTINCT FROM p_id) THEN
    PERFORM fn_error('Ya existe un proveedor con ese RUT.');
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO proveedor (rut, razon_social, nombre_contacto, telefono, email)
    VALUES (v_rut, fn_texto(p, 'razon_social'), fn_texto(p, 'nombre_contacto'), fn_texto(p, 'telefono'), v_email)
    RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'CREAR', 'proveedor', v_n.id, 'Proveedor creado: ' || v_n.razon_social);
  ELSE
    SELECT * INTO v_ant FROM proveedor WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM fn_error('El proveedor no existe.'); END IF;
    UPDATE proveedor SET rut = v_rut, razon_social = fn_texto(p, 'razon_social'), nombre_contacto = fn_texto(p, 'nombre_contacto'),
           telefono = fn_texto(p, 'telefono'), email = v_email, activo = COALESCE((p ->> 'activo')::boolean, true)
     WHERE id = p_id RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'MODIFICAR', 'proveedor', p_id, 'Proveedor modificado: ' || v_n.razon_social, jsonb_build_object(
      'rut', jsonb_build_array(v_ant.rut, v_n.rut), 'razon_social', jsonb_build_array(v_ant.razon_social, v_n.razon_social),
      'nombre_contacto', jsonb_build_array(v_ant.nombre_contacto, v_n.nombre_contacto),
      'telefono', jsonb_build_array(v_ant.telefono, v_n.telefono), 'email', jsonb_build_array(v_ant.email, v_n.email),
      'activo', jsonb_build_array(v_ant.activo, v_n.activo)));
  END IF;
  RETURN v_n.id;
END $$;

-- ---------------------------------------------------------------------
-- 6. Animales (ADMIN y OPERARIO)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_guardar_animal(p_id bigint, p jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_ant  animal;
  v_n    animal;
  v_diio text := fn_texto(p, 'diio');
  v_cat  text := fn_texto(p, 'categoria');
  v_est  text := fn_texto(p, 'estado_productivo');
  v_madre bigint := (p ->> 'madre_id')::bigint;
  v_prop  bigint := (p ->> 'propietario_id')::bigint;
BEGIN
  IF v_diio IS NOT NULL AND v_diio !~ '^[0-9]{9}$' THEN PERFORM fn_error('El DIIO debe tener 9 dígitos.'); END IF;
  IF v_cat IS NULL OR v_cat NOT IN ('VACA', 'VAQUILLA', 'TERNERO', 'TORO') THEN PERFORM fn_error('Elige una categoría.'); END IF;
  IF v_est IS NOT NULL AND (v_cat <> 'VACA' OR v_est NOT IN ('LACTANCIA', 'SECA')) THEN
    PERFORM fn_error('El estado productivo solo aplica a vacas (Lactancia o Seca).');
  END IF;
  IF COALESCE(fn_texto(p, 'origen_ingreso'), 'NACIDO_EN_PREDIO') NOT IN ('NACIDO_EN_PREDIO', 'COMPRA', 'PRESTAMO_RECIBIDO') THEN
    PERFORM fn_error('Elige un origen de ingreso válido.');
  END IF;
  IF v_diio IS NOT NULL AND EXISTS (SELECT 1 FROM animal WHERE diio = v_diio AND id IS DISTINCT FROM p_id) THEN
    PERFORM fn_error('Ya existe un animal con el DIIO ' || v_diio || '.');
  END IF;
  IF v_madre IS NOT NULL AND (v_madre = p_id OR NOT EXISTS (SELECT 1 FROM animal WHERE id = v_madre AND categoria IN ('VACA', 'VAQUILLA'))) THEN
    PERFORM fn_error('La madre debe ser otra vaca o vaquilla registrada.');
  END IF;
  IF v_prop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM propietario WHERE id = v_prop AND activo) THEN
    PERFORM fn_error('El propietario no existe o está inactivo.');
  END IF;
  IF (p ->> 'fecha_nacimiento')::date > current_date THEN PERFORM fn_error('La fecha de nacimiento no puede ser futura.'); END IF;

  IF p_id IS NULL THEN
    INSERT INTO animal (diio, categoria, estado_productivo, propietario_id, fecha_nacimiento, observaciones, madre_id, origen_ingreso)
    VALUES (v_diio, v_cat, v_est, v_prop, (p ->> 'fecha_nacimiento')::date, fn_texto(p, 'observaciones'), v_madre,
            COALESCE(fn_texto(p, 'origen_ingreso'), 'NACIDO_EN_PREDIO'))
    RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'CREAR', 'animal', v_n.id, 'Animal registrado: ' || COALESCE(v_diio, 'sin DIIO') || ' (' || v_cat || ')');
  ELSE
    SELECT * INTO v_ant FROM animal WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM fn_error('El animal no existe.'); END IF;
    IF v_ant.fecha_baja IS NOT NULL THEN PERFORM fn_error('No se puede modificar un animal dado de baja.'); END IF;
    UPDATE animal SET diio = v_diio, categoria = v_cat, estado_productivo = v_est, propietario_id = v_prop,
           fecha_nacimiento = (p ->> 'fecha_nacimiento')::date, observaciones = fn_texto(p, 'observaciones'), madre_id = v_madre,
           origen_ingreso = COALESCE(fn_texto(p, 'origen_ingreso'), 'NACIDO_EN_PREDIO')
     WHERE id = p_id RETURNING * INTO v_n;
    PERFORM fn_auditar(v_u, 'MODIFICAR', 'animal', p_id, 'Animal modificado: ' || COALESCE(v_n.diio, 'sin DIIO'), jsonb_build_object(
      'diio', jsonb_build_array(v_ant.diio, v_n.diio), 'categoria', jsonb_build_array(v_ant.categoria, v_n.categoria),
      'estado_productivo', jsonb_build_array(v_ant.estado_productivo, v_n.estado_productivo),
      'propietario_id', jsonb_build_array(v_ant.propietario_id, v_n.propietario_id),
      'fecha_nacimiento', jsonb_build_array(v_ant.fecha_nacimiento, v_n.fecha_nacimiento),
      'madre_id', jsonb_build_array(v_ant.madre_id, v_n.madre_id),
      'origen_ingreso', jsonb_build_array(v_ant.origen_ingreso, v_n.origen_ingreso)));
  END IF;
  RETURN v_n.id;
END $$;

CREATE OR REPLACE FUNCTION fn_dar_baja_animal(p_id bigint, p_fecha date, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_a animal;
BEGIN
  SELECT * INTO v_a FROM animal WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('El animal no existe.'); END IF;
  IF v_a.fecha_baja IS NOT NULL THEN PERFORM fn_error('El animal ya está dado de baja.'); END IF;
  IF p_motivo NOT IN ('VENTA', 'MUERTE', 'DEVOLUCION', 'SACRIFICIO_SANITARIO') THEN PERFORM fn_error('Elige un motivo de baja.'); END IF;
  IF p_motivo = 'DEVOLUCION' AND v_a.propietario_id IS NULL THEN
    PERFORM fn_error('Solo un animal arrendado (con propietario) se puede devolver.');
  END IF;
  IF p_fecha IS NULL OR p_fecha > current_date THEN PERFORM fn_error('La fecha de baja es obligatoria y no puede ser futura.'); END IF;
  IF EXISTS (SELECT 1 FROM dosis d JOIN tratamiento t ON t.id = d.tratamiento_id
              WHERE t.animal_id = p_id AND t.fecha_anulacion IS NULL AND d.estado = 'PROGRAMADA') THEN
    PERFORM fn_error('El animal tiene dosis programadas. Aplícalas, omítelas o anula el tratamiento antes de darlo de baja.');
  END IF;
  UPDATE animal SET fecha_baja = p_fecha, motivo_baja = p_motivo WHERE id = p_id;
  PERFORM fn_auditar(v_u, 'DAR_DE_BAJA', 'animal', p_id, 'Baja de ' || COALESCE(v_a.diio, 'animal sin DIIO') || ': ' || p_motivo,
                     jsonb_build_object('fecha_baja', jsonb_build_array(NULL, p_fecha), 'motivo_baja', jsonb_build_array(NULL, p_motivo)));
END $$;

-- ---------------------------------------------------------------------
-- 7. Tratamientos y dosis
-- ---------------------------------------------------------------------
-- p_dosis: [{"medicamento_id": 1, "cantidad": 10, "fecha_programada": "2026-10-27T09:00:00-03:00"}, ...]
CREATE OR REPLACE FUNCTION fn_crear_tratamiento(p_animal_id bigint, p jsonb, p_dosis jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u   bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_a   animal;
  v_t   bigint;
  v_d   jsonb;
  v_n   integer := 0;
BEGIN
  SELECT * INTO v_a FROM animal WHERE id = p_animal_id;
  IF NOT FOUND THEN PERFORM fn_error('El animal no existe.'); END IF;
  IF v_a.fecha_baja IS NOT NULL THEN PERFORM fn_error('El animal está dado de baja.'); END IF;
  IF fn_texto(p, 'indicado_por') IS NULL THEN PERFORM fn_error('Indica quién prescribe el tratamiento.'); END IF;
  IF jsonb_typeof(p_dosis) IS DISTINCT FROM 'array' OR jsonb_array_length(p_dosis) = 0 THEN
    PERFORM fn_error('El tratamiento debe tener al menos una dosis.');
  END IF;
  IF jsonb_array_length(p_dosis) > 60 THEN PERFORM fn_error('Un tratamiento admite hasta 60 dosis.'); END IF;

  INSERT INTO tratamiento (uuid, animal_id, indicado_por, numero_receta, motivo, observaciones, creado_por)
  VALUES (gen_random_uuid(), p_animal_id, fn_texto(p, 'indicado_por'), fn_texto(p, 'numero_receta'), fn_texto(p, 'motivo'),
          fn_texto(p, 'observaciones'), v_u)
  RETURNING id INTO v_t;

  FOR v_d IN SELECT * FROM jsonb_array_elements(p_dosis) LOOP
    v_n := v_n + 1;
    IF NOT EXISTS (SELECT 1 FROM medicamento WHERE id = (v_d ->> 'medicamento_id')::bigint AND activo) THEN
      PERFORM fn_error('Dosis ' || v_n || ': el medicamento no existe o está inactivo.');
    END IF;
    IF COALESCE((v_d ->> 'cantidad')::numeric, 0) <= 0 THEN PERFORM fn_error('Dosis ' || v_n || ': la cantidad debe ser mayor que 0.'); END IF;
    IF (v_d ->> 'fecha_programada') IS NULL THEN PERFORM fn_error('Dosis ' || v_n || ': indica la fecha programada.'); END IF;
    INSERT INTO dosis (uuid, tratamiento_id, medicamento_id, cantidad, estado, fecha_programada)
    VALUES (gen_random_uuid(), v_t, (v_d ->> 'medicamento_id')::bigint, (v_d ->> 'cantidad')::numeric, 'PROGRAMADA',
            (v_d ->> 'fecha_programada')::timestamptz);
  END LOOP;

  PERFORM fn_auditar(v_u, 'CREAR', 'tratamiento', v_t,
                     'Tratamiento para ' || COALESCE(v_a.diio, 'animal sin DIIO') || ' con ' || v_n || ' dosis');
  PERFORM fn_generar_alertas();
  RETURN v_t;
END $$;

-- Aplica una dosis programada: descuenta el stock del lote y calcula el resguardo de leche.
CREATE OR REPLACE FUNCTION fn_aplicar_dosis(p_dosis_id bigint, p_lote_id bigint, p_fecha_aplicada timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_d    dosis;
  v_l    lote;
  v_t    tratamiento;
  v_resg smallint;
  v_mov  bigint;
  v_fecha timestamptz := COALESCE(p_fecha_aplicada, now());
BEGIN
  SELECT * INTO v_d FROM dosis WHERE id = p_dosis_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('La dosis no existe.'); END IF;
  IF v_d.estado <> 'PROGRAMADA' THEN PERFORM fn_error('Solo se puede aplicar una dosis programada.'); END IF;
  SELECT * INTO v_t FROM tratamiento WHERE id = v_d.tratamiento_id;
  IF v_t.fecha_anulacion IS NOT NULL THEN PERFORM fn_error('El tratamiento está anulado.'); END IF;
  IF v_fecha > now() + interval '5 minutes' THEN PERFORM fn_error('La fecha de aplicación no puede ser futura.'); END IF;

  SELECT * INTO v_l FROM lote WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND OR v_l.medicamento_id <> v_d.medicamento_id THEN PERFORM fn_error('Elige un lote del medicamento indicado.'); END IF;
  IF NOT v_l.activo THEN PERFORM fn_error('El lote está inactivo.'); END IF;
  IF v_l.fecha_vencimiento < v_fecha::date THEN PERFORM fn_error('El lote ' || v_l.numero_lote || ' está vencido.'); END IF;
  IF v_l.stock_lote < v_d.cantidad THEN
    PERFORM fn_error('Stock insuficiente: el lote ' || v_l.numero_lote || ' tiene ' || v_l.stock_lote || ' y la dosis requiere ' || v_d.cantidad || '.');
  END IF;

  SELECT resguardo_leche_dias INTO v_resg FROM medicamento WHERE id = v_d.medicamento_id;
  UPDATE dosis SET estado = 'APLICADA', lote_id = v_l.id, fecha_aplicada = v_fecha, aplicado_por = v_u, origen = 'WEBAPP',
         fin_resguardo_leche = CASE WHEN v_resg > 0 THEN v_fecha + make_interval(days => v_resg) END
   WHERE id = p_dosis_id;
  INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
  VALUES (gen_random_uuid(), v_d.medicamento_id, v_l.id, 'SALIDA_DOSIS', v_d.cantidad, v_d.id, v_u, 'WEBAPP', v_fecha)
  RETURNING id INTO v_mov;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'dosis', p_dosis_id, 'Dosis aplicada con lote ' || v_l.numero_lote,
                     jsonb_build_object('estado', jsonb_build_array('PROGRAMADA', 'APLICADA'),
                                        'lote_id', jsonb_build_array(NULL, v_l.id)));
  PERFORM fn_generar_alertas();
END $$;

CREATE OR REPLACE FUNCTION fn_omitir_dosis(p_dosis_id bigint, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
BEGIN
  IF NULLIF(btrim(p_motivo), '') IS NULL THEN PERFORM fn_error('Indica por qué se omite la dosis.'); END IF;
  UPDATE dosis SET estado = 'OMITIDA', motivo_estado = left(btrim(p_motivo), 300) WHERE id = p_dosis_id AND estado = 'PROGRAMADA';
  IF NOT FOUND THEN PERFORM fn_error('Solo se puede omitir una dosis programada.'); END IF;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'dosis', p_dosis_id, 'Dosis omitida: ' || btrim(p_motivo),
                     jsonb_build_object('estado', jsonb_build_array('PROGRAMADA', 'OMITIDA')));
  PERFORM fn_generar_alertas();
END $$;

-- Anula un tratamiento registrado por error: anula sus dosis y devuelve al lote el stock de las aplicadas.
CREATE OR REPLACE FUNCTION fn_anular_tratamiento(p_id bigint, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_d dosis;
  v_reversas integer := 0;
BEGIN
  IF NULLIF(btrim(p_motivo), '') IS NULL THEN PERFORM fn_error('Indica el motivo de la anulación.'); END IF;
  UPDATE tratamiento SET fecha_anulacion = now(), motivo_anulacion = left(btrim(p_motivo), 300)
   WHERE id = p_id AND fecha_anulacion IS NULL;
  IF NOT FOUND THEN PERFORM fn_error('El tratamiento no existe o ya está anulado.'); END IF;

  FOR v_d IN SELECT * FROM dosis WHERE tratamiento_id = p_id AND estado IN ('PROGRAMADA', 'APLICADA') FOR UPDATE LOOP
    IF v_d.estado = 'APLICADA' THEN
      INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento, observaciones)
      VALUES (gen_random_uuid(), v_d.medicamento_id, v_d.lote_id, 'REVERSA_DOSIS', v_d.cantidad, v_d.id, v_u, 'WEBAPP', now(),
              'Anulación del tratamiento ' || p_id);
      v_reversas := v_reversas + 1;
    END IF;
    UPDATE dosis SET estado = 'ANULADA', motivo_estado = 'Tratamiento anulado: ' || left(btrim(p_motivo), 270) WHERE id = v_d.id;
  END LOOP;

  PERFORM fn_auditar(v_u, 'ANULAR', 'tratamiento', p_id,
                     'Tratamiento anulado (' || v_reversas || ' dosis devueltas al stock): ' || btrim(p_motivo));
  PERFORM fn_generar_alertas();
END $$;

-- ---------------------------------------------------------------------
-- 8. Usuarios: el ADMIN cambia rol o estado (las cuentas se crean en Supabase Auth)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_usuario(p_id bigint, p_rol text, p_activo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u   bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_ant usuario;
BEGIN
  IF p_rol NOT IN ('ADMIN', 'OPERARIO', 'AUDITOR') THEN PERFORM fn_error('Rol no válido.'); END IF;
  IF p_id = v_u AND (p_rol <> 'ADMIN' OR NOT p_activo) THEN
    PERFORM fn_error('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.');
  END IF;
  SELECT * INTO v_ant FROM usuario WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('El usuario no existe.'); END IF;
  UPDATE usuario SET rol = p_rol, activo = p_activo WHERE id = p_id;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'usuario', p_id, 'Usuario modificado: ' || v_ant.email,
                     jsonb_build_object('rol', jsonb_build_array(v_ant.rol, p_rol), 'activo', jsonb_build_array(v_ant.activo, p_activo)));
END $$;

-- ---------------------------------------------------------------------
-- 9. Exportación: el panel genera el archivo y registra el intercambio
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_exportacion(p_alcance text, p_formato text, p_filas integer, p_sha256 text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text := fn_rol_actual();
  v_u   bigint := fn_exigir_rol(ARRAY['ADMIN', 'AUDITOR']);
  v_id  bigint;
BEGIN
  IF p_formato NOT IN ('CSV', 'JSON') THEN PERFORM fn_error('Formato no válido.'); END IF;
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN PERFORM fn_error('Huella del archivo no válida.'); END IF;
  IF COALESCE(p_filas, -1) < 0 THEN PERFORM fn_error('Cantidad de filas no válida.'); END IF;
  IF v_rol = 'AUDITOR' AND p_alcance NOT IN ('auditoria', 'auditoria_detalle', 'movimiento_inventario', 'tratamiento', 'dosis', 'alerta') THEN
    PERFORM fn_error('El auditor solo puede exportar las tablas de consulta.');
  END IF;
  INSERT INTO intercambio (uuid, usuario_id, tipo, alcance, formato, filas, sha256, resultado)
  VALUES (gen_random_uuid(), v_u, 'EXPORTACION', left(p_alcance, 40), p_formato, p_filas, p_sha256, 'OK')
  RETURNING id INTO v_id;
  PERFORM fn_auditar(v_u, 'EXPORTAR', 'intercambio', v_id, 'Exportación de ' || p_alcance || ' (' || p_filas || ' filas, ' || p_formato || ')');
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------
-- 10. Permisos: solo usuarios autenticados ejecutan las operaciones.
-- Las utilidades internas no se exponen por la API.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION fn_exigir_rol(text[]), fn_auditar(bigint, text, text, bigint, text, jsonb), fn_error(text),
                       fn_texto(jsonb, text), fn_generar_alertas() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'fn_actualizar_alertas()', 'fn_resolver_alerta(bigint, text)',
    'fn_guardar_medicamento(bigint, jsonb)', 'fn_registrar_entrada(bigint, text, date, numeric, bigint, text)',
    'fn_registrar_ajuste(bigint, text, numeric, text, text)', 'fn_guardar_propietario(bigint, jsonb)',
    'fn_guardar_proveedor(bigint, jsonb)', 'fn_guardar_animal(bigint, jsonb)', 'fn_dar_baja_animal(bigint, date, text)',
    'fn_crear_tratamiento(bigint, jsonb, jsonb)', 'fn_aplicar_dosis(bigint, bigint, timestamptz)',
    'fn_omitir_dosis(bigint, text)', 'fn_anular_tratamiento(bigint, text)', 'fn_actualizar_usuario(bigint, text, boolean)',
    'fn_registrar_exportacion(text, text, integer, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Las alertas se recalculan al aplicar la migración.
SELECT fn_generar_alertas();

COMMIT;
