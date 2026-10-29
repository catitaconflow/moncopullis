-- Moncopulli App: esquema de base de datos
-- PostgreSQL (Supabase). Se ejecuta completo en el editor SQL de Supabase.
-- No hay tablas propias del bot: lo que registra el bot se guarda en Tratamientos,
-- y la columna origen_registro indica si el dato vino del Bot, la App o la Web.
-- Orden: primero las tablas que no dependen de otras, después las que tienen claves foráneas.

-- 1. Roles
-- Los tres perfiles del sistema y lo que puede hacer cada uno.
CREATE TABLE Roles (
    id_rol       SERIAL PRIMARY KEY,
    nombre       VARCHAR(20)  NOT NULL UNIQUE,
    descripcion  VARCHAR(200)
);

INSERT INTO Roles (nombre, descripcion) VALUES
    ('Administrador', 'Todo: usuarios, medicamentos, proveedores, anular tratamientos, auditoría e importación'),
    ('Operario',      'Registra animales, tratamientos y movimientos de stock'),
    ('Auditor',       'Solo consulta la auditoría y exporta datos');

-- 2. Empleados
-- Personas que usan el sistema. El teléfono se usa para validar el acceso desde el bot de Telegram.
CREATE TABLE Empleados (
    id_empleado     SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    email           VARCHAR(100) UNIQUE,
    id_rol          INT          NOT NULL REFERENCES Roles (id_rol),
    telefono        VARCHAR(30)  UNIQUE,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_registro  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_retiro    DATE,        -- se llena cuando el empleado deja la empresa
    ultimo_acceso   TIMESTAMP
);

-- 3. Proveedores
-- Empresas o laboratorios que venden los medicamentos.
CREATE TABLE Proveedores (
    id_proveedor  SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    rut           VARCHAR(20)  UNIQUE,
    contacto      VARCHAR(100)
);

-- 4. Enfermedades
-- Lista cerrada de diagnósticos o motivos de tratamiento (mastitis, neumonía, desparasitación...).
CREATE TABLE Enfermedades (
    id_enfermedad  SERIAL PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL UNIQUE,
    descripcion    TEXT
);

-- 5. Medicamentos
-- El stock se cuenta en frascos o unidades cerradas, como pide la norma de bioseguridad.
CREATE TABLE Medicamentos (
    id_medicamento         SERIAL PRIMARY KEY,
    id_proveedor           INT REFERENCES Proveedores (id_proveedor) ON DELETE SET NULL,
    nombre                 VARCHAR(100) NOT NULL,
    tipo                   VARCHAR(50),   -- antibiótico, vacuna, vitamina...
    formato_presentacion   VARCHAR(50),   -- frasco 50 ml, caja 20 comprimidos...
    unidad_medida          VARCHAR(20),   -- ml, mg, unidad
    stock_actual           INT  NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo           INT  NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    fecha_vencimiento      DATE,
    resguardo_leche_horas  INT  NOT NULL DEFAULT 0 CHECK (resguardo_leche_horas >= 0),
    activo                 BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Animales
-- Cada animal se identifica por su DIIO. Guarda la madre, de dónde llegó y si salió del predio.
CREATE TABLE Animales (
    id_animal              SERIAL PRIMARY KEY,
    numero_identificacion  VARCHAR(50) NOT NULL UNIQUE,   -- DIIO o arete RFID
    especie                VARCHAR(50) NOT NULL DEFAULT 'Bovino',
    raza                   VARCHAR(50),
    fecha_nacimiento       DATE,
    id_madre               INT REFERENCES Animales (id_animal) ON DELETE SET NULL,
    origen_ingreso         VARCHAR(50) NOT NULL DEFAULT 'Nacido en predio'
                           CHECK (origen_ingreso IN ('Nacido en predio', 'Compra', 'Préstamo recibido')),
    categoria_propiedad    VARCHAR(30) NOT NULL DEFAULT 'Propio'
                           CHECK (categoria_propiedad IN ('Propio', 'Prestado', 'Mediería')),
    dueno_origen           VARCHAR(100),  -- vecino, predio o empresa que prestó o vendió el animal
    contacto_dueno         VARCHAR(100),
    estado                 VARCHAR(30) NOT NULL DEFAULT 'Presente'
                           CHECK (estado IN ('Presente', 'Vendido', 'Devuelto', 'Muerto')),
    estado_salud           VARCHAR(30) NOT NULL DEFAULT 'Sana'
                           CHECK (estado_salud IN ('Sana', 'En tratamiento', 'Cuarentena')),
    motivo_salida          VARCHAR(50)
                           CHECK (motivo_salida IN ('Venta para carne', 'Venta crianza/lechería',
                                                    'Devolución a dueño', 'Muerte natural', 'Sacrificio sanitario')),
    fecha_ingreso          DATE      NOT NULL DEFAULT CURRENT_DATE,
    fecha_salida           DATE,
    creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tratamientos
-- Cada dosis aplicada o programada. Lo que se registra por el bot también queda aquí;
-- origen_registro dice de dónde vino: Bot (Telegram), App (Android) o Web (panel).
-- Si el medicamento no está en la lista se escribe en medicamento_texto.
CREATE TABLE Tratamientos (
    id_tratamiento       SERIAL PRIMARY KEY,
    id_animal            INT NOT NULL REFERENCES Animales (id_animal) ON DELETE CASCADE,
    id_medicamento       INT REFERENCES Medicamentos (id_medicamento) ON DELETE SET NULL,
    medicamento_texto    VARCHAR(100),
    id_enfermedad        INT REFERENCES Enfermedades (id_enfermedad) ON DELETE SET NULL,
    id_empleado          INT REFERENCES Empleados (id_empleado) ON DELETE SET NULL,
    dosis_aplicada       VARCHAR(50) NOT NULL,   -- 15 ml, 2 comprimidos...
    unidades_consumidas  INT NOT NULL DEFAULT 1 CHECK (unidades_consumidas >= 0),
    estado_tratamiento   VARCHAR(30) NOT NULL DEFAULT 'Aplicado'
                         CHECK (estado_tratamiento IN ('Aplicado', 'Programado', 'Cancelado')),
    fecha_programada     DATE,
    fecha_aplicacion     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones        TEXT,
    origen_registro      VARCHAR(10) NOT NULL CHECK (origen_registro IN ('Bot', 'App', 'Web'))
);

-- 8. Control_de_Movimientos
-- Kárdex de bodega: cada entrada o salida de medicamentos queda registrada.
CREATE TABLE Control_de_Movimientos (
    id_movimiento     SERIAL PRIMARY KEY,
    id_medicamento    INT NOT NULL REFERENCES Medicamentos (id_medicamento) ON DELETE CASCADE,
    id_empleado       INT REFERENCES Empleados (id_empleado) ON DELETE SET NULL,
    id_proveedor      INT REFERENCES Proveedores (id_proveedor) ON DELETE SET NULL,  -- solo en las compras
    tipo_movimiento   VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('Entrada', 'Salida')),
    cantidad          INT NOT NULL CHECK (cantidad > 0),   -- frascos o unidades completas
    motivo            VARCHAR(50) NOT NULL
                      CHECK (motivo IN ('Compra', 'Uso en tratamiento', 'Vencimiento', 'Merma/desecho', 'Ajuste')),
    fecha_movimiento  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origen_registro   VARCHAR(10) NOT NULL CHECK (origen_registro IN ('Bot', 'App', 'Web'))
);

-- 9. Documentos_Veterinarios
-- Referencias a los archivos guardados en Supabase Storage (PDF, fotos, planillas).
CREATE TABLE Documentos_Veterinarios (
    id_documento     SERIAL PRIMARY KEY,
    id_animal        INT REFERENCES Animales (id_animal) ON DELETE SET NULL,
    id_empleado      INT REFERENCES Empleados (id_empleado) ON DELETE SET NULL,
    url_archivo      TEXT NOT NULL,
    nombre_original  VARCHAR(255),
    tipo_archivo     VARCHAR(50) CHECK (tipo_archivo IN ('PDF', 'Imagen', 'Excel', 'Word')),
    fecha_subida     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origen_registro  VARCHAR(10) NOT NULL DEFAULT 'Bot' CHECK (origen_registro IN ('Bot', 'App', 'Web'))
);

-- 10. RegistroLogs
-- Auditoría: quién hizo qué, sobre qué y desde dónde.
CREATE TABLE RegistroLogs (
    id_log           SERIAL PRIMARY KEY,
    id_empleado      INT REFERENCES Empleados (id_empleado) ON DELETE SET NULL,
    accion           VARCHAR(50) NOT NULL
                     CHECK (accion IN ('Creación', 'Modificación', 'Eliminación', 'Alerta', 'Sincronización')),
    entidad          VARCHAR(50) NOT NULL,   -- Animal, Medicamento, Tratamiento, Empleado, Documento
    detalle          TEXT NOT NULL,
    origen_registro  VARCHAR(10) NOT NULL CHECK (origen_registro IN ('Bot', 'App', 'Web')),
    fecha_hora       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para las búsquedas más comunes
CREATE INDEX idx_tratamientos_animal  ON Tratamientos (id_animal);
CREATE INDEX idx_movimientos_medic    ON Control_de_Movimientos (id_medicamento);
CREATE INDEX idx_logs_fecha           ON RegistroLogs (fecha_hora);


-- =====================================================================
-- Consultas que usa la aplicación
-- =====================================================================

-- Buscar un animal por los 5 últimos dígitos del DIIO (bot de Telegram)
-- SELECT * FROM Animales WHERE numero_identificacion LIKE '%' || '12345';

-- Tratamientos de un animal en los últimos 6 meses y los programados para los próximos 6
-- SELECT * FROM Tratamientos
-- WHERE id_animal = 1
--   AND COALESCE(fecha_aplicacion::date, fecha_programada)
--       BETWEEN CURRENT_DATE - INTERVAL '6 months' AND CURRENT_DATE + INTERVAL '6 months'
-- ORDER BY COALESCE(fecha_aplicacion::date, fecha_programada);

-- Medicamentos bajo el stock mínimo
-- SELECT nombre, stock_actual, stock_minimo FROM Medicamentos
-- WHERE activo AND stock_actual < stock_minimo;

-- Medicamentos que vencen en los próximos 30 días
-- SELECT nombre, fecha_vencimiento FROM Medicamentos
-- WHERE activo AND fecha_vencimiento <= CURRENT_DATE + 30;

-- Exportar la auditoría a un archivo de texto (CSV) desde psql
-- \copy (SELECT * FROM RegistroLogs ORDER BY fecha_hora) TO 'registro_logs.csv' WITH CSV HEADER
