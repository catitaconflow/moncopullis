-- =====================================================================
-- Agrícola Moncopulli: modelo de datos v2 (PostgreSQL / Supabase)
-- Fuente: docs/modelo-datos-v2.md
-- Notas:
--   * Las tablas no tienen políticas de escritura. Desde 0005 se escribe con
--     funciones SECURITY DEFINER que revisan el rol; aquí el panel solo lee.
--   * Todas las FK usan ON DELETE RESTRICT: nada con historial se borra.
--   * Las fechas con hora son timestamptz (UTC).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tablas maestras
-- ---------------------------------------------------------------------
CREATE TABLE propietario (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rut             varchar(10)  NOT NULL UNIQUE,
  nombre_completo varchar(120) NOT NULL,
  telefono        varchar(15),
  activo          boolean      NOT NULL DEFAULT true,
  CONSTRAINT propietario_rut_formato CHECK (rut ~ '^[0-9]{1,8}-[0-9Kk]$')
);

CREATE TABLE proveedor (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rut             varchar(10)  NOT NULL UNIQUE,
  razon_social    varchar(150) NOT NULL,
  nombre_contacto varchar(120),
  telefono        varchar(15),
  email           varchar(254),
  activo          boolean      NOT NULL DEFAULT true,
  CONSTRAINT proveedor_rut_formato CHECK (rut ~ '^[0-9]{1,8}-[0-9Kk]$')
);

CREATE TABLE usuario (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id       uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE RESTRICT,
  rut                varchar(10) NOT NULL UNIQUE,
  nombres            varchar(80) NOT NULL,
  apellidos          varchar(80) NOT NULL,
  email              varchar(254) NOT NULL,
  telefono           varchar(15),
  rol                varchar(10) NOT NULL,
  activo             boolean     NOT NULL DEFAULT true,
  intentos_fallidos  smallint    NOT NULL DEFAULT 0,
  bloqueado_hasta    timestamptz,
  telegram_user_id   bigint UNIQUE,
  telegram_codigo_hash      varchar(128),
  telegram_codigo_expira    timestamptz,
  telegram_codigo_intentos  smallint NOT NULL DEFAULT 0,
  fecha_creacion     timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso      timestamptz,
  CONSTRAINT usuario_rut_formato   CHECK (rut ~ '^[0-9]{1,8}-[0-9Kk]$'),
  CONSTRAINT usuario_email_minusc  CHECK (email = lower(email)),
  CONSTRAINT usuario_rol           CHECK (rol IN ('ADMIN', 'OPERARIO', 'AUDITOR')),
  CONSTRAINT usuario_intentos      CHECK (intentos_fallidos >= 0),
  CONSTRAINT usuario_codigo_int    CHECK (telegram_codigo_intentos BETWEEN 0 AND 3)
);
CREATE UNIQUE INDEX usuario_email_uk ON usuario (lower(email));

CREATE TABLE animal (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  diio              char(9) UNIQUE,
  categoria         varchar(10) NOT NULL,
  estado_productivo varchar(10),
  propietario_id    bigint REFERENCES propietario (id) ON DELETE RESTRICT,
  fecha_nacimiento  date,
  fecha_baja        date,
  motivo_baja       varchar(12),
  observaciones     text,
  fecha_creacion    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT animal_diio_formato   CHECK (diio IS NULL OR diio ~ '^[0-9]{9}$'),
  CONSTRAINT animal_categoria      CHECK (categoria IN ('VACA', 'VAQUILLA', 'TERNERO', 'TORO')),
  CONSTRAINT animal_estado_prod    CHECK (estado_productivo IS NULL
                                          OR (categoria = 'VACA' AND estado_productivo IN ('LACTANCIA', 'SECA'))),
  CONSTRAINT animal_motivo_baja    CHECK (motivo_baja IS NULL OR motivo_baja IN ('VENTA', 'MUERTE', 'DEVOLUCION')),
  CONSTRAINT animal_baja_completa  CHECK ((fecha_baja IS NULL) = (motivo_baja IS NULL)),
  CONSTRAINT animal_devolucion     CHECK (motivo_baja IS DISTINCT FROM 'DEVOLUCION' OR propietario_id IS NOT NULL)
);

CREATE TABLE medicamento (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_comercial    varchar(120) NOT NULL,
  principio_activo    varchar(120),
  tipo                varchar(20),
  via_administracion  varchar(15),
  unidad_base         varchar(6)   NOT NULL,
  contenido_envase    numeric(10,2) NOT NULL,
  requiere_receta     boolean      NOT NULL DEFAULT false,
  resguardo_leche_dias smallint    NOT NULL DEFAULT 0,
  stock_minimo        numeric(12,2) NOT NULL DEFAULT 0,
  stock_actual        numeric(12,2) NOT NULL DEFAULT 0,
  activo              boolean      NOT NULL DEFAULT true,
  CONSTRAINT medicamento_nombre_uk   UNIQUE (nombre_comercial),
  CONSTRAINT medicamento_unidad      CHECK (unidad_base IN ('ML', 'G', 'UNIDAD')),
  CONSTRAINT medicamento_contenido   CHECK (contenido_envase > 0),
  CONSTRAINT medicamento_resguardo   CHECK (resguardo_leche_dias BETWEEN 0 AND 365),
  CONSTRAINT medicamento_stock_min   CHECK (stock_minimo >= 0),
  CONSTRAINT medicamento_stock_ok    CHECK (stock_actual >= 0),
  CONSTRAINT medicamento_id_unico    UNIQUE (id)
);
CREATE UNIQUE INDEX medicamento_nombre_ci_uk ON medicamento (lower(nombre_comercial));

CREATE TABLE lote (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  medicamento_id    bigint NOT NULL REFERENCES medicamento (id) ON DELETE RESTRICT,
  numero_lote       varchar(40) NOT NULL,
  fecha_vencimiento date NOT NULL,
  stock_lote        numeric(12,2) NOT NULL DEFAULT 0,
  activo            boolean NOT NULL DEFAULT true,
  fecha_creacion    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lote_numero_uk  UNIQUE (medicamento_id, numero_lote),
  CONSTRAINT lote_stock_ok   CHECK (stock_lote >= 0),
  CONSTRAINT lote_id_unico   UNIQUE (id, medicamento_id)
);

-- ---------------------------------------------------------------------
-- 2. Sanidad: tratamiento y dosis
-- ---------------------------------------------------------------------
CREATE TABLE tratamiento (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid              uuid NOT NULL UNIQUE,
  animal_id         bigint NOT NULL REFERENCES animal (id) ON DELETE RESTRICT,
  indicado_por      varchar(120) NOT NULL,
  numero_receta     varchar(40),
  motivo            varchar(200),
  observaciones     text,
  creado_por        bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  fecha_creacion    timestamptz NOT NULL DEFAULT now(),
  fecha_anulacion   timestamptz,
  motivo_anulacion  varchar(300),
  CONSTRAINT tratamiento_anulacion CHECK ((fecha_anulacion IS NULL) = (motivo_anulacion IS NULL)),
  CONSTRAINT tratamiento_id_unico  UNIQUE (id)
);

CREATE TABLE dosis (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid               uuid NOT NULL UNIQUE,
  tratamiento_id     bigint NOT NULL REFERENCES tratamiento (id) ON DELETE RESTRICT,
  medicamento_id     bigint NOT NULL REFERENCES medicamento (id) ON DELETE RESTRICT,
  lote_id            bigint,
  cantidad           numeric(10,2) NOT NULL,
  estado             varchar(10) NOT NULL,
  fecha_programada   timestamptz,
  fecha_aplicada     timestamptz,
  aplicado_por       bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  origen             varchar(8),
  fin_resguardo_leche timestamptz,
  motivo_estado     varchar(300),
  fecha_registro    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dosis_lote_fk FOREIGN KEY (lote_id, medicamento_id) REFERENCES lote (id, medicamento_id) ON DELETE RESTRICT,
  CONSTRAINT dosis_cantidad      CHECK (cantidad > 0),
  CONSTRAINT dosis_estado        CHECK (estado IN ('PROGRAMADA', 'APLICADA', 'OMITIDA', 'ANULADA')),
  CONSTRAINT dosis_origen        CHECK (origen IS NULL OR origen IN ('WEBAPP', 'TELEGRAM')),
  CONSTRAINT dosis_aplicada_ok   CHECK (estado <> 'APLICADA'
                                        OR (fecha_aplicada IS NOT NULL AND aplicado_por IS NOT NULL
                                            AND lote_id IS NOT NULL AND origen IS NOT NULL)),
  CONSTRAINT dosis_motivo        CHECK (estado NOT IN ('OMITIDA', 'ANULADA') OR motivo_estado IS NOT NULL),
  CONSTRAINT dosis_id_unica      UNIQUE (id, medicamento_id)
);
CREATE INDEX dosis_tratamiento_idx ON dosis (tratamiento_id);
CREATE INDEX dosis_medicamento_idx ON dosis (medicamento_id);
CREATE INDEX dosis_lote_idx        ON dosis (lote_id);
CREATE INDEX dosis_aplicado_idx    ON dosis (aplicado_por);
CREATE INDEX dosis_programadas_idx ON dosis (fecha_programada) WHERE estado = 'PROGRAMADA';

-- ---------------------------------------------------------------------
-- 3. Inventario por lote
-- ---------------------------------------------------------------------
CREATE TABLE movimiento_inventario (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid            uuid NOT NULL UNIQUE,
  medicamento_id  bigint NOT NULL,
  lote_id         bigint NOT NULL,
  tipo            varchar(16) NOT NULL,
  cantidad        numeric(12,2) NOT NULL,
  proveedor_id    bigint REFERENCES proveedor (id) ON DELETE RESTRICT,
  dosis_id        bigint,
  motivo          varchar(20),
  observaciones   varchar(300),
  usuario_id      bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  origen          varchar(8) NOT NULL,
  fecha_evento    timestamptz NOT NULL,
  fecha_registro  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mov_lote_fk  FOREIGN KEY (lote_id, medicamento_id) REFERENCES lote (id, medicamento_id) ON DELETE RESTRICT,
  CONSTRAINT mov_dosis_fk FOREIGN KEY (dosis_id, medicamento_id) REFERENCES dosis (id, medicamento_id) ON DELETE RESTRICT,
  CONSTRAINT mov_tipo     CHECK (tipo IN ('ENTRADA', 'SALIDA_DOSIS', 'REVERSA_DOSIS', 'SALIDA_AJUSTE', 'ENTRADA_AJUSTE')),
  CONSTRAINT mov_cantidad CHECK (cantidad > 0),
  CONSTRAINT mov_origen   CHECK (origen IN ('WEBAPP', 'TELEGRAM')),
  CONSTRAINT mov_motivo   CHECK (motivo IS NULL OR motivo IN ('VENCIDO', 'ROTO_DERRAME', 'CONTEO', 'OTRO')),
  CONSTRAINT mov_proveedor_solo_entrada CHECK (proveedor_id IS NULL OR tipo = 'ENTRADA'),
  CONSTRAINT mov_dosis_solo_salidas     CHECK (dosis_id IS NULL OR tipo IN ('SALIDA_DOSIS', 'REVERSA_DOSIS')),
  CONSTRAINT mov_salida_dosis_requiere  CHECK (tipo NOT IN ('SALIDA_DOSIS', 'REVERSA_DOSIS') OR dosis_id IS NOT NULL),
  CONSTRAINT mov_motivo_ajuste          CHECK (tipo NOT IN ('SALIDA_AJUSTE', 'ENTRADA_AJUSTE') OR motivo IS NOT NULL)
);
-- Una SALIDA_DOSIS y una REVERSA_DOSIS como máximo por dosis
CREATE UNIQUE INDEX mov_salida_dosis_uk  ON movimiento_inventario (dosis_id) WHERE tipo = 'SALIDA_DOSIS';
CREATE UNIQUE INDEX mov_reversa_dosis_uk ON movimiento_inventario (dosis_id) WHERE tipo = 'REVERSA_DOSIS';
CREATE INDEX mov_medicamento_fecha_idx ON movimiento_inventario (medicamento_id, fecha_evento);
CREATE INDEX mov_lote_idx     ON movimiento_inventario (lote_id);
CREATE INDEX mov_proveedor_idx ON movimiento_inventario (proveedor_id);
CREATE INDEX mov_usuario_idx  ON movimiento_inventario (usuario_id);

-- ---------------------------------------------------------------------
-- 4. Bot de Telegram
-- ---------------------------------------------------------------------
CREATE TABLE mensaje_bot (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_update_id    bigint NOT NULL UNIQUE,
  telegram_chat_id      bigint NOT NULL,
  telegram_from_id      bigint NOT NULL,
  usuario_id            bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  texto                 text,
  intencion             varchar(24),
  animal_diio_propuesto char(9),
  medicamento_id        bigint REFERENCES medicamento (id) ON DELETE RESTRICT,
  cantidad_propuesta    numeric(10,2),
  fecha_propuesta       timestamptz,
  estado                varchar(12) NOT NULL DEFAULT 'RECIBIDO',
  dosis_id              bigint UNIQUE REFERENCES dosis (id) ON DELETE RESTRICT,
  detalle_error         varchar(300),
  fecha_recepcion       timestamptz NOT NULL DEFAULT now(),
  fecha_respuesta       timestamptz,
  CONSTRAINT mensaje_intencion CHECK (intencion IS NULL
                                      OR intencion IN ('REGISTRAR_TRATAMIENTO', 'REGISTRAR_MOVIMIENTO', 'CONSULTA')),
  CONSTRAINT mensaje_estado    CHECK (estado IN ('RECIBIDO', 'CONFIRMADO', 'CANCELADO', 'ERROR')),
  CONSTRAINT mensaje_dosis_confirmada CHECK (dosis_id IS NULL OR estado = 'CONFIRMADO')
);

-- ---------------------------------------------------------------------
-- 5. Alertas
-- ---------------------------------------------------------------------
CREATE TABLE alerta (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo               varchar(32) NOT NULL,
  medicamento_id     bigint REFERENCES medicamento (id) ON DELETE RESTRICT,
  lote_id            bigint REFERENCES lote (id) ON DELETE RESTRICT,
  dosis_id           bigint REFERENCES dosis (id) ON DELETE RESTRICT,
  tratamiento_id     bigint REFERENCES tratamiento (id) ON DELETE RESTRICT,
  estado             varchar(9) NOT NULL DEFAULT 'ABIERTA',
  fecha_creacion     timestamptz NOT NULL DEFAULT now(),
  fecha_notificacion timestamptz,
  fecha_resolucion   timestamptz,
  resuelta_por       bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  comentario         varchar(300),
  CONSTRAINT alerta_tipo   CHECK (tipo IN ('STOCK_BAJO', 'VENCIMIENTO_PROXIMO', 'STOCK_PENDIENTE',
                                           'DOSIS_ATRASADA', 'RECETA_PENDIENTE', 'DOSIS_APLICADA_TRAS_ANULAR')),
  CONSTRAINT alerta_estado CHECK (estado IN ('ABIERTA', 'RESUELTA')),
  CONSTRAINT alerta_referencia CHECK (
       (tipo = 'STOCK_BAJO' AND medicamento_id IS NOT NULL)
    OR (tipo = 'VENCIMIENTO_PROXIMO' AND lote_id IS NOT NULL)
    OR (tipo IN ('STOCK_PENDIENTE', 'DOSIS_ATRASADA', 'DOSIS_APLICADA_TRAS_ANULAR') AND dosis_id IS NOT NULL)
    OR (tipo = 'RECETA_PENDIENTE' AND tratamiento_id IS NOT NULL)),
  CONSTRAINT alerta_resolucion CHECK (estado = 'ABIERTA' OR fecha_resolucion IS NOT NULL)
);
-- Una sola alerta ABIERTA por tipo y objeto
CREATE UNIQUE INDEX alerta_abierta_medicamento ON alerta (tipo, medicamento_id) WHERE estado = 'ABIERTA' AND medicamento_id IS NOT NULL;
CREATE UNIQUE INDEX alerta_abierta_lote        ON alerta (tipo, lote_id)        WHERE estado = 'ABIERTA' AND lote_id IS NOT NULL;
CREATE UNIQUE INDEX alerta_abierta_dosis       ON alerta (tipo, dosis_id)       WHERE estado = 'ABIERTA' AND dosis_id IS NOT NULL;
CREATE UNIQUE INDEX alerta_abierta_tratamiento ON alerta (tipo, tratamiento_id) WHERE estado = 'ABIERTA' AND tratamiento_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Auditoría e intercambio de datos (solo inserción)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint REFERENCES usuario (id) ON DELETE RESTRICT,
  accion      varchar(40) NOT NULL,
  entidad     varchar(40) NOT NULL,
  entidad_id  bigint,
  origen      varchar(8)  NOT NULL,
  ip          inet,
  descripcion varchar(300),
  fecha       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_origen CHECK (origen IN ('WEBAPP', 'TELEGRAM', 'SISTEMA'))
);
CREATE INDEX auditoria_entidad_idx ON auditoria (entidad, entidad_id);
CREATE INDEX auditoria_usuario_fecha_idx ON auditoria (usuario_id, fecha);

CREATE TABLE auditoria_detalle (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auditoria_id    bigint NOT NULL REFERENCES auditoria (id) ON DELETE RESTRICT,
  campo           varchar(60) NOT NULL,
  valor_anterior  text,
  valor_nuevo     text
);
CREATE INDEX auditoria_detalle_idx ON auditoria_detalle (auditoria_id);

CREATE TABLE intercambio (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid        uuid NOT NULL UNIQUE,
  usuario_id  bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  tipo        varchar(12) NOT NULL,
  alcance     varchar(40) NOT NULL,
  formato     varchar(4)  NOT NULL,
  filas       integer     NOT NULL,
  sha256      char(64),
  resultado   varchar(10) NOT NULL,
  fecha       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intercambio_tipo      CHECK (tipo IN ('EXPORTACION', 'IMPORTACION')),
  CONSTRAINT intercambio_formato   CHECK (formato IN ('CSV', 'JSON')),
  CONSTRAINT intercambio_resultado CHECK (resultado IN ('OK', 'RECHAZADO')),
  CONSTRAINT intercambio_filas     CHECK (filas >= 0)
);
CREATE INDEX intercambio_usuario_idx ON intercambio (usuario_id, fecha);

-- ---------------------------------------------------------------------
-- 7. Funciones y triggers
-- ---------------------------------------------------------------------

-- Coherencia del lote de la salida con el lote de la dosis
CREATE OR REPLACE FUNCTION fn_mov_lote_de_dosis() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  lote_dosis bigint;
BEGIN
  IF NEW.dosis_id IS NOT NULL THEN
    SELECT lote_id INTO lote_dosis FROM dosis WHERE id = NEW.dosis_id;
    IF lote_dosis IS DISTINCT FROM NEW.lote_id THEN
      RAISE EXCEPTION 'El lote del movimiento debe ser el lote de la dosis';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mov_lote_de_dosis
  BEFORE INSERT ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_mov_lote_de_dosis();

-- Stock por lote y stock total del medicamento, en la misma transacción
CREATE OR REPLACE FUNCTION fn_mov_actualiza_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  signo numeric;
BEGIN
  signo := CASE WHEN NEW.tipo IN ('ENTRADA', 'REVERSA_DOSIS', 'ENTRADA_AJUSTE') THEN 1 ELSE -1 END;
  UPDATE lote SET stock_lote = stock_lote + signo * NEW.cantidad
   WHERE id = NEW.lote_id;   -- CHECK stock_lote >= 0 rechaza la salida si no alcanza
  PERFORM set_config('app.stock_update', 'on', true);
  UPDATE medicamento m
     SET stock_actual = (SELECT COALESCE(SUM(l.stock_lote), 0) FROM lote l WHERE l.medicamento_id = m.id)
   WHERE m.id = NEW.medicamento_id;
  PERFORM set_config('app.stock_update', 'off', true);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mov_actualiza_stock
  AFTER INSERT ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_mov_actualiza_stock();

-- stock_actual solo cambia por el trigger anterior
CREATE OR REPLACE FUNCTION fn_medicamento_protege_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stock_actual := 0;
  ELSIF NEW.stock_actual IS DISTINCT FROM OLD.stock_actual
        AND current_setting('app.stock_update', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'stock_actual solo cambia mediante movimientos de inventario';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_medicamento_protege_stock
  BEFORE INSERT OR UPDATE ON medicamento
  FOR EACH ROW EXECUTE FUNCTION fn_medicamento_protege_stock();

-- Inmutabilidad: historial de inventario, auditoría e intercambio
CREATE OR REPLACE FUNCTION fn_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_movimiento_inmutable
  BEFORE UPDATE OR DELETE ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();
CREATE TRIGGER trg_auditoria_detalle_inmutable
  BEFORE UPDATE OR DELETE ON auditoria_detalle
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();
CREATE TRIGGER trg_intercambio_inmutable
  BEFORE UPDATE OR DELETE ON intercambio
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

-- ---------------------------------------------------------------------
-- 8. Vistas de consulta y control
-- ---------------------------------------------------------------------
CREATE VIEW v_stock_medicamento AS
SELECT m.id AS medicamento_id, m.nombre_comercial, m.stock_actual, m.stock_minimo,
       (m.stock_actual <= m.stock_minimo) AS stock_bajo
  FROM medicamento m;

-- Dosis aplicadas que todavía no tienen salida de stock
CREATE VIEW v_dosis_stock_pendiente AS
SELECT d.id AS dosis_id, d.medicamento_id, d.cantidad, d.fecha_aplicada
  FROM dosis d
 WHERE d.estado = 'APLICADA'
   AND NOT EXISTS (SELECT 1 FROM movimiento_inventario mi
                    WHERE mi.dosis_id = d.id AND mi.tipo = 'SALIDA_DOSIS');

-- Control de consistencia: debe estar vacía
CREATE VIEW v_control_stock AS
SELECT m.id AS medicamento_id, m.stock_actual,
       COALESCE(SUM(l.stock_lote), 0) AS suma_lotes
  FROM medicamento m
  LEFT JOIN lote l ON l.medicamento_id = m.id
 GROUP BY m.id, m.stock_actual
HAVING m.stock_actual <> COALESCE(SUM(l.stock_lote), 0);

-- ---------------------------------------------------------------------
-- 9. Seguridad por rol (RLS): políticas solo de lectura
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rol_actual() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.rol FROM usuario u WHERE u.auth_user_id = auth.uid() AND u.activo
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['propietario', 'proveedor', 'usuario', 'animal', 'medicamento', 'lote',
                           'tratamiento', 'dosis', 'movimiento_inventario', 'mensaje_bot', 'alerta',
                           'auditoria', 'auditoria_detalle', 'intercambio'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Lectura de catálogos y operación para ADMIN y OPERARIO
CREATE POLICY lectura_operacion ON animal FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON propietario FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON medicamento FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON lote FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON tratamiento FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON dosis FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));
CREATE POLICY lectura_operacion ON movimiento_inventario FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));

-- Proveedores solo para ADMIN
CREATE POLICY lectura_admin ON proveedor FOR SELECT TO authenticated
  USING (fn_rol_actual() = 'ADMIN');

-- Auditoría, intercambio y usuarios: ADMIN y AUDITOR (usuarios: también su propia fila)
CREATE POLICY lectura_auditoria ON auditoria FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'AUDITOR'));
CREATE POLICY lectura_auditoria ON auditoria_detalle FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'AUDITOR'));
CREATE POLICY lectura_intercambio ON intercambio FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'AUDITOR'));
CREATE POLICY lectura_usuario ON usuario FOR SELECT TO authenticated
  USING (fn_rol_actual() = 'ADMIN' OR auth_user_id = auth.uid());

-- Alertas y bot: ADMIN y OPERARIO
CREATE POLICY lectura_alertas ON alerta FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO'));
CREATE POLICY lectura_bot ON mensaje_bot FOR SELECT TO authenticated
  USING (fn_rol_actual() = 'ADMIN');

-- Sin políticas de escritura: las escrituras pasan por funciones (0005).
COMMIT;
