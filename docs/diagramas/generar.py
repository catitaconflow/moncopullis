"""Genera los diagramas del informe en formato draw.io (.drawio).

Uso: python docs/diagramas/generar.py
Exportar a PNG: draw.io.exe -x -f png -s 2 -b 20 -o <archivo>.png <archivo>.drawio
"""
from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

DIR = Path(__file__).parent
FUENTE = 'fontFamily=Helvetica;'
COLOR_TABLA = 'fillColor=#E8F0E9;strokeColor=#1F5C3A;'
COLOR_FK = 'fontColor=#1F5C3A;'

# Marcadores de cardinalidad (notación pata de gallo de draw.io)
MARCA = {'1': 'ERmandOne', '0..1': 'ERzeroToOne', '0..*': 'ERzeroToMany', '1..*': 'ERoneToMany', '0..2': 'ERzeroToMany'}


class Diagrama:
    def __init__(self, nombre: str, ancho: int, alto: int) -> None:
        self.nombre = nombre
        self.celdas: list[str] = []
        self.n = 1
        self.ancho, self.alto = ancho, alto
        self.tablas: dict[str, tuple[list[tuple[str, str, str]], int]] = {}
        self.pos: dict[str, tuple[float, float, float]] = {}

    def _id(self) -> str:
        self.n += 1
        return f'c{self.n}'

    def celda(self, valor: str, estilo: str, x: float, y: float, w: float, h: float, padre: str = '1') -> str:
        cid = self._id()
        self.celdas.append(
            f'<mxCell id="{cid}" value="{escape(valor, {chr(34): "&quot;"})}" style="{estilo}" vertex="1" parent="{padre}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return cid

    def tabla(self, nombre: str, filas: list[tuple[str, str, str]], x: float, y: float, w: float = 250) -> str:
        """filas: (clave, columna, tipo). clave: PK, FK, UK, PK,FK o ''."""
        alto_fila = 24
        tid = self.celda(nombre, f'shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;'
                                 f'rowLines=1;fontStyle=1;align=center;resizeLast=1;fontSize=13;{COLOR_TABLA}{FUENTE}',
                         x, y, w, 30 + alto_fila * len(filas))
        for i, (clave, col, tipo) in enumerate(filas):
            fila = self.celda('', 'shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;'
                                  'collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;'
                                  'right=0;bottom=0;', 0, 30 + i * alto_fila, w, alto_fila, tid)
            negrita = 'fontStyle=5;' if 'PK' in clave else ''
            color = COLOR_FK if 'FK' in clave else ''
            base = f'shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;overflow=hidden;fontSize=11;{FUENTE}'
            self.celda(clave, base + f'align=center;fontStyle=1;{color}', 0, 0, 44, alto_fila, fila)
            self.celda(col, base + f'align=left;spacingLeft=6;{negrita}{color}', 44, 0, w - 44 - 92, alto_fila, fila)
            self.celda(tipo, base + 'align=left;spacingLeft=4;fontColor=#55594F;', w - 92, 0, 92, alto_fila, fila)
        self.tablas[tid] = (filas, 30 + alto_fila * len(filas))
        self.pos[tid] = (x, y, w)
        return tid

    def relacion(self, o: str, card_o: str, d: str, card_d: str, etiqueta: str, lado_o: str, lado_d: str,
                 col_o: str = 'id', col_d: str = '', puntos: list[tuple[float, float]] | None = None) -> None:
        """Une la fila col_o de la tabla o con la fila col_d de la tabla d.

        card_o va en el extremo de o: cuántas filas de o se relacionan con una fila de d.
        lado: der, izq, arr o aba. En der e izq la línea llega a la altura exacta de la fila.
        """
        eid = self._id()
        estilo = (f'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;startArrow={MARCA[card_o]};endArrow={MARCA[card_d]};'
                  f'startFill=0;endFill=0;startSize=14;endSize=14;strokeWidth=1.4;strokeColor=#333333;'
                  f'{self._anclaje(o, lado_o, col_o, "exit")}{self._anclaje(d, lado_d, col_d, "entry")}')
        geo = '<mxGeometry relative="1" as="geometry">'
        if puntos:
            geo += '<Array as="points">' + ''.join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in puntos) + '</Array>'
        geo += '</mxGeometry>'
        self.celdas.append(f'<mxCell id="{eid}" value="{escape(etiqueta)}" style="{estilo}fontSize=11;labelBackgroundColor=#FFFFFF;'
                           f'fontStyle=1;{FUENTE}" edge="1" parent="1" source="{o}" target="{d}">{geo}</mxCell>')
        desplaza = {'der': (36, -15), 'izq': (-36, -15), 'aba': (22, 30), 'arr': (22, -30)}
        # Texto de cardinalidad junto al punto donde la línea toca la tabla, fuera del símbolo
        for valor, tabla, lado, col in ((card_o, o, lado_o, col_o), (card_d, d, lado_d, col_d)):
            px, py = self._punto(tabla, lado, col)
            dx, dy = desplaza[self._lado(lado)[0]]
            self.celda(valor, f'text;html=1;fontSize=12;fontStyle=1;fontColor=#9B2226;align=center;verticalAlign=middle;{FUENTE}',
                       px + dx - 20, py + dy - 9, 40, 18)

    @staticmethod
    def _lado(lado: str) -> tuple[str, float]:
        """'arr@0.2' es el borde superior al 20 % del ancho; sin @ es el centro."""
        base, _, frac = lado.partition('@')
        return base, float(frac or 0.5)

    def _punto(self, tabla: str, lado: str, col: str) -> tuple[float, float]:
        filas, alto = self.tablas[tabla]
        x, y, w = self.pos[tabla]
        base, frac = self._lado(lado)
        if base == 'arr':
            return x + w * frac, y
        if base == 'aba':
            return x + w * frac, y + alto
        fy = y + 30 + [f[1] for f in filas].index(col) * 24 + 12
        return (x + w if base == 'der' else x), fy

    def _anclaje(self, tabla: str, lado: str, col: str, tipo: str) -> str:
        base, frac = self._lado(lado)
        if base in ('arr', 'aba'):
            return f'{tipo}X={frac};{tipo}Y={0 if base == "arr" else 1};{tipo}Dx=0;{tipo}Dy=0;'
        filas, alto = self.tablas[tabla]
        idx = [f[1] for f in filas].index(col)
        return f'{tipo}X={1 if lado == "der" else 0};{tipo}Y={(30 + idx * 24 + 12) / alto:.4f};{tipo}Dx=0;{tipo}Dy=0;'

    def flecha(self, origen: str, destino: str, etiqueta: str = '', discontinua: bool = False,
               anclas: str = '', puntos: list[tuple[float, float]] | None = None) -> None:
        """anclas: exitX/exitY/entryX/entryY explícitos; puntos: recorrido fijo para no cruzar cajas."""
        estilo = ('edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;strokeWidth=1.4;strokeColor=#333333;'
                  f'fontSize=11;labelBackgroundColor=#FFFFFF;{FUENTE}{anclas}')
        if discontinua:
            estilo += 'dashed=1;'
        geo = '<mxGeometry relative="1" as="geometry">'
        if puntos:
            geo += '<Array as="points">' + ''.join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in puntos) + '</Array>'
        geo += '</mxGeometry>'
        self.celdas.append(f'<mxCell id="{self._id()}" value="{escape(etiqueta)}" style="{estilo}" edge="1" parent="1" '
                           f'source="{origen}" target="{destino}">{geo}</mxCell>')

    def linea(self, origen: str, destino: str, anclas: str = '') -> None:
        self.celdas.append(f'<mxCell id="{self._id()}" style="endArrow=none;html=1;strokeColor=#555555;{anclas}" edge="1" parent="1" '
                           f'source="{origen}" target="{destino}"><mxGeometry relative="1" as="geometry"/></mxCell>')

    def guardar(self) -> None:
        xml = (f'<mxfile host="drawio"><diagram name="{self.nombre}" id="{self.nombre}">'
               f'<mxGraphModel dx="1200" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
               f'fold="1" page="1" pageScale="1" pageWidth="{self.ancho}" pageHeight="{self.alto}" background="#FFFFFF" math="0" shadow="0">'
               f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(self.celdas)}</root></mxGraphModel></diagram></mxfile>')
        (DIR / f'{self.nombre}.drawio').write_text(xml, encoding='utf-8')


def titulo(d: Diagrama, texto: str, nota: str) -> None:
    d.celda(texto, f'text;html=1;fontSize=18;fontStyle=1;align=left;verticalAlign=top;{FUENTE}', 20, 10, 900, 28)
    d.celda(nota, f'text;html=1;fontSize=11;align=left;verticalAlign=top;fontColor=#55594F;{FUENTE}', 20, 38, 1100, 22)


NOTA_ER = ('Notación pata de gallo. En cada extremo se indica cuántas filas de esa tabla se relacionan con una fila de la otra. '
           'PK: clave primaria · FK: clave foránea · UK: valor único.')

# Columnas completas (migraciones 0001 y 0002)
T = {
    'propietario': [('PK', 'id', 'bigint'), ('UK', 'rut', 'varchar(10)'), ('', 'nombre_completo', 'varchar(120)'),
                    ('', 'telefono', 'varchar(15)'), ('', 'activo', 'boolean')],
    'animal': [('PK', 'id', 'bigint'), ('UK', 'diio', 'char(9)'), ('', 'categoria', 'varchar(10)'), ('', 'estado_productivo', 'varchar(10)'),
               ('FK', 'propietario_id', 'bigint'), ('FK', 'madre_id', 'bigint'), ('', 'origen_ingreso', 'varchar(20)'),
               ('', 'fecha_nacimiento', 'date'), ('', 'fecha_baja', 'date'), ('', 'motivo_baja', 'varchar(20)')],
    'tratamiento': [('PK', 'id', 'bigint'), ('UK', 'uuid', 'uuid'), ('FK', 'animal_id', 'bigint'), ('', 'indicado_por', 'varchar(120)'),
                    ('', 'numero_receta', 'varchar(40)'), ('', 'motivo', 'varchar(200)'), ('FK', 'creado_por', 'bigint'),
                    ('', 'fecha_creacion', 'timestamptz'), ('', 'fecha_anulacion', 'timestamptz'), ('', 'motivo_anulacion', 'varchar(300)')],
    'dosis': [('PK', 'id', 'bigint'), ('UK', 'uuid', 'uuid'), ('FK', 'tratamiento_id', 'bigint'), ('FK', 'medicamento_id', 'bigint'),
              ('FK', 'lote_id', 'bigint'), ('', 'cantidad', 'numeric(10,2)'), ('', 'estado', 'varchar(10)'),
              ('', 'fecha_programada', 'timestamptz'), ('', 'fecha_aplicada', 'timestamptz'), ('FK', 'aplicado_por', 'bigint'),
              ('', 'origen', 'varchar(8)'), ('', 'fin_resguardo_leche', 'timestamptz')],
    'medicamento': [('PK', 'id', 'bigint'), ('UK', 'nombre_comercial', 'varchar(120)'), ('', 'principio_activo', 'varchar(120)'),
                    ('', 'unidad_base', 'varchar(6)'), ('', 'contenido_envase', 'numeric(10,2)'), ('', 'requiere_receta', 'boolean'),
                    ('', 'resguardo_leche_dias', 'smallint'), ('', 'stock_minimo', 'numeric(12,2)'), ('', 'stock_actual', 'numeric(12,2)'),
                    ('', 'activo', 'boolean')],
    'lote': [('PK', 'id', 'bigint'), ('FK', 'medicamento_id', 'bigint'), ('UK', 'numero_lote', 'varchar(40)'),
             ('', 'fecha_vencimiento', 'date'), ('', 'stock_lote', 'numeric(12,2)'), ('', 'activo', 'boolean')],
    'movimiento_inventario': [('PK', 'id', 'bigint'), ('UK', 'uuid', 'uuid'), ('FK', 'medicamento_id', 'bigint'), ('FK', 'lote_id', 'bigint'),
                              ('', 'tipo', 'varchar(16)'), ('', 'cantidad', 'numeric(12,2)'), ('FK', 'proveedor_id', 'bigint'),
                              ('FK', 'dosis_id', 'bigint'), ('', 'motivo', 'varchar(20)'), ('FK', 'usuario_id', 'bigint'),
                              ('', 'origen', 'varchar(8)'), ('', 'fecha_evento', 'timestamptz')],
    'proveedor': [('PK', 'id', 'bigint'), ('UK', 'rut', 'varchar(10)'), ('', 'razon_social', 'varchar(150)'),
                  ('', 'nombre_contacto', 'varchar(120)'), ('', 'telefono', 'varchar(15)'), ('', 'email', 'varchar(254)'), ('', 'activo', 'boolean')],
    'usuario': [('PK', 'id', 'bigint'), ('UK', 'auth_user_id', 'uuid'), ('UK', 'rut', 'varchar(10)'), ('', 'nombres', 'varchar(80)'),
                ('', 'apellidos', 'varchar(80)'), ('UK', 'email', 'varchar(254)'), ('', 'rol', 'varchar(10)'), ('', 'activo', 'boolean'),
                ('', 'intentos_fallidos', 'smallint'), ('UK', 'telegram_user_id', 'bigint')],
    'mensaje_bot': [('PK', 'id', 'bigint'), ('UK', 'telegram_update_id', 'bigint'), ('FK', 'usuario_id', 'bigint'), ('', 'texto', 'text'),
                    ('', 'intencion', 'varchar(24)'), ('FK', 'medicamento_id', 'bigint'), ('', 'cantidad_propuesta', 'numeric(10,2)'),
                    ('', 'estado', 'varchar(12)'), ('FK,UK', 'dosis_id', 'bigint')],
    'alerta': [('PK', 'id', 'bigint'), ('', 'tipo', 'varchar(32)'), ('FK', 'medicamento_id', 'bigint'), ('FK', 'lote_id', 'bigint'),
               ('FK', 'dosis_id', 'bigint'), ('FK', 'tratamiento_id', 'bigint'), ('', 'estado', 'varchar(9)'),
               ('', 'fecha_resolucion', 'timestamptz'), ('FK', 'resuelta_por', 'bigint'), ('', 'comentario', 'varchar(300)')],
    'auditoria': [('PK', 'id', 'bigint'), ('FK', 'usuario_id', 'bigint'), ('', 'accion', 'varchar(40)'), ('', 'entidad', 'varchar(40)'),
                  ('', 'entidad_id', 'bigint'), ('', 'origen', 'varchar(8)'), ('', 'ip', 'inet'), ('', 'descripcion', 'varchar(300)'),
                  ('', 'fecha', 'timestamptz')],
    'auditoria_detalle': [('PK', 'id', 'bigint'), ('FK', 'auditoria_id', 'bigint'), ('', 'campo', 'varchar(60)'),
                          ('', 'valor_anterior', 'text'), ('', 'valor_nuevo', 'text')],
    'intercambio': [('PK', 'id', 'bigint'), ('UK', 'uuid', 'uuid'), ('FK', 'usuario_id', 'bigint'), ('', 'tipo', 'varchar(12)'),
                    ('', 'alcance', 'varchar(40)'), ('', 'formato', 'varchar(4)'), ('', 'filas', 'integer'), ('', 'sha256', 'char(64)'),
                    ('', 'resultado', 'varchar(10)')],
    'documento_veterinario': [('PK', 'id', 'bigint'), ('UK', 'uuid', 'uuid'), ('FK', 'animal_id', 'bigint'), ('FK', 'tratamiento_id', 'bigint'),
                              ('FK', 'usuario_id', 'bigint'), ('UK', 'ruta_almacenamiento', 'text'), ('', 'nombre_original', 'varchar(255)'),
                              ('', 'tipo', 'varchar(10)'), ('', 'origen', 'varchar(10)'), ('', 'fecha_subida', 'timestamptz')],
    'importacion': [('PK', 'id', 'bigint'), ('UK', 'export_id', 'varchar(100)'), ('FK', 'usuario_id', 'bigint'),
                    ('', 'cantidad_registros', 'integer'), ('', 'fecha', 'timestamptz')],
    'importacion_registro': [('PK', 'id', 'bigint'), ('FK', 'importacion_id', 'bigint'), ('UK', 'uuid', 'uuid'),
                             ('', 'entidad', 'varchar(20)'), ('', 'datos', 'jsonb')],
}


def resumen(nombre: str, extra: list[str] | None = None) -> list[tuple[str, str, str]]:
    """Versión corta de una tabla para diagramas donde solo aparece como referencia."""
    filas = [f for f in T[nombre] if f[0] == 'PK' or f[1] in (extra or [])]
    return filas


def er1() -> None:
    d = Diagrama('er1_sanitario_inventario', 1480, 900)
    titulo(d, 'Diagrama ER 1: sanidad e inventario (R1 a R10)', NOTA_ER)
    prop = d.tabla('propietario', T['propietario'], 30, 90)
    ani = d.tabla('animal', T['animal'], 30, 330)
    tra = d.tabla('tratamiento', T['tratamiento'], 380, 90, 270)
    dos = d.tabla('dosis', T['dosis'], 380, 480, 270)
    med = d.tabla('medicamento', T['medicamento'], 770, 90, 270)
    lot = d.tabla('lote', T['lote'], 770, 480, 270)
    prv = d.tabla('proveedor', T['proveedor'], 1160, 90, 280)
    mov = d.tabla('movimiento_inventario', T['movimiento_inventario'], 1160, 400, 280)
    d.relacion(prop, '0..1', ani, '0..*', 'R1', 'aba', 'arr')
    d.relacion(ani, '1', tra, '0..*', 'R2', 'der', 'izq', col_d='animal_id')
    d.relacion(tra, '1', dos, '1..*', 'R3', 'aba', 'arr')
    d.relacion(med, '1', dos, '0..*', 'R4', 'izq', 'der', col_d='medicamento_id', puntos=[(715, 132), (715, 594)])
    d.relacion(med, '1', lot, '0..*', 'R5', 'aba', 'arr')
    d.relacion(lot, '0..1', dos, '0..*', 'R6', 'izq', 'der', col_d='lote_id', puntos=[(742, 522), (742, 618)])
    d.relacion(lot, '1', mov, '0..*', 'R7', 'der', 'izq', col_d='lote_id', puntos=[(1100, 522), (1100, 514)])
    d.relacion(med, '1', mov, '0..*', 'R8', 'der', 'izq', col_d='medicamento_id', puntos=[(1120, 132), (1120, 490)])
    d.relacion(prv, '0..1', mov, '0..*', 'R9', 'aba', 'arr')
    d.relacion(dos, '0..1', mov, '0..2', 'R10', 'aba', 'aba', puntos=[(515, 860), (1300, 860)])
    d.guardar()


def er2() -> None:
    d = Diagrama('er2_usuario', 1330, 900)
    titulo(d, 'Diagrama ER 2: usuario como tabla central (R11 a R14, R17, R23 y R24)', NOTA_ER)
    usu = d.tabla('usuario', T['usuario'], 560, 330, 270)
    tra = d.tabla('tratamiento', resumen('tratamiento', ['creado_por']), 120, 100)
    dos = d.tabla('dosis', resumen('dosis', ['aplicado_por']), 120, 306)
    mov = d.tabla('movimiento_inventario', resumen('movimiento_inventario', ['usuario_id']), 120, 640)
    bot = d.tabla('mensaje_bot', resumen('mensaje_bot', ['usuario_id']), 1030, 100)
    aud = d.tabla('auditoria', resumen('auditoria', ['usuario_id']), 1030, 306)
    ale = d.tabla('alerta', resumen('alerta', ['resuelta_por']), 1030, 640)
    inter = d.tabla('intercambio', resumen('intercambio', ['usuario_id']), 560, 790, 270)
    d.relacion(usu, '1', tra, '0..*', 'R11', 'arr@0.2', 'der', col_d='creado_por', puntos=[(614, 166)])
    d.relacion(usu, '0..1', dos, '0..*', 'R12', 'izq', 'der', col_d='aplicado_por')
    d.relacion(usu, '1', mov, '0..*', 'R13', 'aba@0.2', 'der', col_d='usuario_id', puntos=[(614, 706)])
    d.relacion(usu, '0..1', bot, '0..*', 'R14', 'arr@0.8', 'izq', col_d='usuario_id', puntos=[(776, 166)])
    d.relacion(usu, '0..1', aud, '0..*', 'R17', 'der', 'izq', col_d='usuario_id')
    d.relacion(usu, '0..1', ale, '0..*', 'R23', 'aba@0.8', 'izq', col_d='resuelta_por', puntos=[(776, 706)])
    d.relacion(usu, '0..1', inter, '0..*', 'R24', 'aba', 'arr')
    d.guardar()


def er3() -> None:
    d = Diagrama('er3_bot_alertas_auditoria', 1220, 1100)
    titulo(d, 'Diagrama ER 3: bot, alertas y auditoría (R15, R16 y R18 a R22)', NOTA_ER)
    bot = d.tabla('mensaje_bot', T['mensaje_bot'], 40, 100, 270)
    med = d.tabla('medicamento', resumen('medicamento', ['nombre_comercial']), 470, 100)
    dos = d.tabla('dosis', resumen('dosis', ['estado']), 470, 330)
    tra = d.tabla('tratamiento', resumen('tratamiento', ['animal_id']), 470, 560)
    lot = d.tabla('lote', resumen('lote', ['numero_lote']), 900, 100, 270)
    ale = d.tabla('alerta', T['alerta'], 900, 280, 270)
    aud = d.tabla('auditoria', T['auditoria'], 40, 470, 270)
    det = d.tabla('auditoria_detalle', T['auditoria_detalle'], 40, 820, 270)
    d.relacion(med, '0..1', bot, '0..*', 'R15', 'izq', 'der', col_d='medicamento_id', puntos=[(390, 142), (390, 262)])
    d.relacion(dos, '0..1', bot, '0..1', 'R16', 'izq', 'der', col_d='dosis_id', puntos=[(410, 372), (410, 334)])
    d.relacion(aud, '1', det, '0..*', 'R18', 'aba', 'arr')
    d.relacion(med, '0..1', ale, '0..*', 'R19', 'der', 'izq', col_d='medicamento_id', puntos=[(870, 142), (870, 370)])
    d.relacion(lot, '0..1', ale, '0..*', 'R20', 'aba', 'arr')
    d.relacion(dos, '0..1', ale, '0..*', 'R21', 'der', 'izq', col_d='dosis_id', puntos=[(840, 372), (840, 418)])
    d.relacion(tra, '0..1', ale, '0..*', 'R22', 'der', 'izq', col_d='tratamiento_id', puntos=[(810, 602), (810, 442)])
    d.guardar()


def er4() -> None:
    d = Diagrama('er4_trazabilidad_importacion', 1200, 760)
    titulo(d, 'Diagrama ER 4: trazabilidad, documentos veterinarios e importación (R25 a R30)', NOTA_ER)
    ani = d.tabla('animal', resumen('animal', ['diio', 'madre_id', 'origen_ingreso']), 40, 110)
    tra = d.tabla('tratamiento', resumen('tratamiento', ['animal_id']), 40, 420)
    doc = d.tabla('documento_veterinario', T['documento_veterinario'], 450, 200, 290)
    usu = d.tabla('usuario', resumen('usuario', ['rol']), 870, 110)
    imp = d.tabla('importacion', T['importacion'], 870, 330, 270)
    reg = d.tabla('importacion_registro', T['importacion_registro'], 870, 560, 270)
    d.relacion(ani, '0..1', ani, '0..*', 'R25 (madre)', 'der', 'der', col_d='madre_id', puntos=[(340, 152), (340, 200)])
    d.relacion(ani, '0..1', doc, '0..*', 'R26', 'aba', 'izq', col_d='animal_id', puntos=[(165, 290)])
    d.relacion(tra, '0..1', doc, '0..*', 'R27', 'der', 'izq', col_d='tratamiento_id', puntos=[(400, 462), (400, 314)])
    d.relacion(usu, '1', doc, '0..*', 'R28', 'izq', 'der', col_d='usuario_id', puntos=[(800, 152), (800, 338)])
    d.relacion(usu, '1', imp, '0..*', 'R29', 'aba', 'arr')
    d.relacion(imp, '1', reg, '0..*', 'R30', 'aba', 'arr')
    d.guardar()


CAJA = f'rounded=0;whiteSpace=wrap;html=1;fontSize=12;strokeColor=#333333;fillColor=#FFFFFF;align=center;{FUENTE}'
GRUPO = f'rounded=0;whiteSpace=wrap;html=1;fontSize=13;fontStyle=1;verticalAlign=top;align=left;spacingLeft=10;spacingTop=6;{FUENTE}'


def despliegue() -> None:
    d = Diagrama('despliegue', 1500, 820)
    titulo(d, 'Diagrama de despliegue', 'Vista física. Línea continua: implementado. Línea discontinua: planificado (respaldo diario).')
    # Columna 1: usuarios y servicios externos
    d.celda('Usuarios', GRUPO + 'fillColor=#F4F2EC;strokeColor=#999999;', 20, 80, 270, 400)
    nav = d.celda('<b>Navegador</b><br>ADMIN, OPERARIO y AUDITOR<br>(escritorio o móvil)', CAJA, 45, 130, 220, 80)
    app = d.celda('<b>App de Telegram</b><br>Operario en terreno', CAJA, 45, 390, 220, 70)
    d.celda('Servicios externos', GRUPO + 'fillColor=#F4F2EC;strokeColor=#999999;', 20, 500, 270, 230)
    tapi = d.celda('<b>Telegram Bot API</b>', CAJA, 45, 540, 220, 60)
    gem = d.celda('<b>Google Gemini API</b><br>Interpreta el texto del operario', CAJA, 45, 640, 220, 60)
    # Columna 2: Cloudflare
    d.celda('Cloudflare', GRUPO + 'fillColor=#FFF4E5;strokeColor=#E8A33D;', 340, 80, 380, 710)
    panel = d.celda('<b>Worker moncopulli-panel</b><br>Sitio estático React + Vite<br>moncopulli-panel.itskay666.workers.dev',
                    CAJA, 370, 130, 320, 80)
    api = d.celda('<b>Worker de la API</b> (Hono, TypeScript)<br>POST /telegram/webhook · POST /importar<br>Cabeceras de seguridad',
                  CAJA, 370, 380, 320, 90)
    r2 = d.celda('<b>R2</b><br>Respaldo diario cifrado con age', CAJA + 'dashed=1;', 370, 700, 320, 60)
    # Columna 3: Supabase
    d.celda('Supabase', GRUPO + 'fillColor=#E3F0E7;strokeColor=#1F5C3A;', 770, 80, 380, 710)
    auth = d.celda('<b>Supabase Auth</b><br>Inicio de sesión y JWT', CAJA, 800, 130, 320, 60)
    rest = d.celda('<b>PostgREST (API REST)</b><br>Lectura con RLS por rol · escritura solo por funciones RPC', CAJA, 800, 240, 320, 70)
    db = d.celda('<b>PostgreSQL 17</b><br>17 tablas con RLS · funciones RPC (0005)<br>Triggers de stock e inmutabilidad',
                 CAJA, 800, 380, 320, 90)
    sto = d.celda('<b>Storage</b><br>Documentos veterinarios (bucket privado)', CAJA, 800, 560, 320, 60)
    # Columna 4: GitHub
    d.celda('GitHub', GRUPO + 'fillColor=#EEF1F5;strokeColor=#4A5A70;', 1200, 80, 280, 310)
    repo = d.celda('<b>Repositorio moncopullis</b>', CAJA, 1225, 130, 230, 50)
    ci = d.celda('<b>GitHub Actions (CI)</b><br>Pruebas, build, npm audit<br>y Gitleaks en cada push', CAJA, 1225, 250, 230, 80)

    d.flecha(nav, panel, 'HTTPS: descarga el panel', anclas='exitX=1;exitY=0.5;entryX=0;entryY=0.5;')
    d.flecha(panel, auth, 'HTTPS: inicio de sesión', anclas='exitX=1;exitY=0.375;entryX=0;entryY=0.5;')
    d.flecha(panel, rest, 'HTTPS + JWT: consultas y RPC', anclas='exitX=1;exitY=0.8;entryX=0;entryY=0.5;', puntos=[(735, 194), (735, 275)])
    d.flecha(rest, db, 'SQL', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(db, sto, '', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(api, rest, 'HTTPS + JWT del usuario', anclas='exitX=1;exitY=0.2;entryX=0;entryY=0.85;', puntos=[(755, 398), (755, 300)])
    d.flecha(app, tapi, 'Mensajes', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(tapi, api, 'Webhook HTTPS + secret_token', anclas='exitX=1;exitY=0.5;entryX=0.15;entryY=1;', puntos=[(418, 570)])
    d.flecha(api, gem, 'HTTPS', anclas='exitX=0.3;exitY=1;entryX=1;entryY=0.5;', puntos=[(466, 670)])
    d.flecha(db, r2, 'pg_dump diario', discontinua=True, anclas='exitX=0;exitY=0.85;entryX=1;entryY=0.5;',
             puntos=[(740, 456), (740, 730)])
    d.flecha(repo, ci, 'push', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.guardar()


def componentes() -> None:
    d = Diagrama('componentes', 1400, 800)
    titulo(d, 'Diagrama de componentes', 'Vista de desarrollo: carpetas del repositorio, sus módulos y las dependencias entre ellos.')
    d.celda('panel/ (React + TypeScript)', GRUPO + 'fillColor=#E3F0E7;strokeColor=#1F5C3A;', 20, 80, 700, 420)
    pag = d.celda('<b>pages/</b>  Resumen, Inventario, Animales, Tratamientos, Alertas, Maestros, Exportar y Auditoría',
                  CAJA, 45, 125, 650, 60)
    comp = d.celda('<b>components/</b><br>Tabla, Filtros, Diálogo, Vista', CAJA, 45, 245, 150, 80)
    datos = d.celda('<b>data/</b><br>consultas (lectura)<br>ejecutar (RPC)', CAJA, 210, 245, 150, 80)
    ses = d.celda('<b>auth/</b><br>Sesión y rol', CAJA, 375, 245, 150, 80)
    lib = d.celda('<b>lib/</b><br>vencimiento, RUT, CSV, formato', CAJA, 540, 245, 155, 80)
    sdk = d.celda('<b>@supabase/supabase-js</b>', CAJA + 'fillColor=#F4F2EC;', 210, 410, 315, 50)
    for destino in (comp, datos, ses, lib):
        d.flecha(pag, destino, '', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(datos, sdk, '', anclas='exitX=0.5;exitY=1;entryX=0.25;entryY=0;')
    d.flecha(ses, sdk, '', anclas='exitX=0.5;exitY=1;entryX=0.78;entryY=0;')

    d.celda('bot/ (Cloudflare Worker)', GRUPO + 'fillColor=#FFF4E5;strokeColor=#E8A33D;', 20, 540, 700, 230)
    wh = d.celda('<b>Webhook de Telegram</b><br>Verifica secret_token<br>e idempotencia por update_id', CAJA, 45, 590, 300, 80)
    imp = d.celda('<b>Importación</b><br>Valida entidades y uuid', CAJA, 395, 590, 300, 80)
    d.celda('<b>Cabeceras de seguridad</b>: HSTS, CSP, nosniff, CORP (en todas las respuestas)', CAJA, 45, 700, 650, 45)
    d.flecha(wh, imp, '', anclas='exitX=1;exitY=0.5;entryX=0;entryY=0.5;')

    d.celda('supabase/', GRUPO + 'fillColor=#EEF1F5;strokeColor=#4A5A70;', 770, 80, 610, 690)
    tst = d.celda('<b>tests/0001 a 0005</b><br>Pruebas SQL con ROLLBACK', CAJA, 795, 125, 270, 70)
    mig = d.celda('<b>migrations/0001 a 0005</b><br>Tablas, RLS, triggers y funciones', CAJA, 1085, 125, 270, 70)
    rpc = d.celda('<b>Funciones RPC (0005)</b><br>Medicamentos, entradas, ajustes, animales, tratamientos,<br>'
                  'dosis, alertas, usuarios y exportación · validan el rol y auditan', CAJA, 795, 260, 560, 90)
    trg = d.celda('<b>Triggers (0001)</b><br>Stock por lote · historial y auditoría de solo inserción', CAJA, 795, 420, 560, 70)
    tab = d.celda('<b>Tablas con RLS</b><br>17 tablas; lectura según el rol', CAJA, 795, 560, 560, 70)
    d.flecha(tst, rpc, 'prueba', discontinua=True, anclas='exitX=0.5;exitY=1;entryX=0.24;entryY=0;')
    d.flecha(mig, rpc, 'define', anclas='exitX=0.5;exitY=1;entryX=0.76;entryY=0;')
    d.flecha(rpc, trg, 'escribe y dispara', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(trg, tab, 'actualiza', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    d.flecha(sdk, rpc, 'HTTPS + JWT', anclas='exitX=1;exitY=0.5;entryX=0;entryY=0.6667;', puntos=[(735, 435), (735, 320)])
    d.flecha(imp, rpc, 'RPC', anclas='exitX=1;exitY=0.5;entryX=0;entryY=0.9;', puntos=[(750, 630), (750, 341)])
    d.guardar()


def casos_uso() -> None:
    d = Diagrama('casos_de_uso', 1420, 920)
    titulo(d, 'Diagrama de casos de uso',
           'Vista de escenarios. La flecha con triángulo es herencia: ADMIN puede todo lo de OPERARIO y AUDITOR, '
           'y ambos heredan lo de Usuario autenticado (matriz 8.1).')
    d.celda('Sistema de trazabilidad Moncopulli', GRUPO + 'fillColor=#FFFFFF;strokeColor=#333333;align=center;', 250, 110, 900, 740)
    izq = f'shape=umlActor;html=1;fontSize=13;fontStyle=1;labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;{FUENTE}'
    der = f'shape=umlActor;html=1;fontSize=13;fontStyle=1;labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;{FUENTE}'
    usu = d.celda('Usuario<br>autenticado', izq, 150, 150, 40, 80)
    ope = d.celda('OPERARIO', izq, 150, 500, 40, 80)
    aud = d.celda('AUDITOR', der, 1220, 150, 40, 80)
    adm = d.celda('ADMIN', der, 1220, 400, 40, 80)
    sis = d.celda('Sistema<br>(tarea programada)', der, 1220, 680, 40, 80)
    elipse = f'ellipse;whiteSpace=wrap;html=1;fontSize=12;fillColor=#E8F0E9;strokeColor=#1F5C3A;{FUENTE}'

    def columna(x: float, y0: float, textos: list[str]) -> list[str]:
        return [d.celda(t, elipse, x, y0 + i * 64, 320, 50) for i, t in enumerate(textos)]

    c_usu = columna(290, 140, ['Iniciar sesión', 'Consultar stock, animales y tratamientos'])
    c_ope = columna(290, 300, ['Registrar animales y propietarios', 'Dar de baja un animal', 'Registrar entrada de stock',
                               'Ajustar stock de un lote', 'Registrar tratamiento y dosis', 'Aplicar u omitir dosis',
                               'Registrar por Telegram con confirmación', 'Consultar y resolver alertas'])
    c_aud = columna(790, 140, ['Consultar auditoría', 'Exportar datos (CSV o JSON)'])
    c_adm = columna(790, 300, ['Gestionar usuarios y roles', 'Gestionar proveedores', 'Gestionar catálogo de medicamentos',
                               'Anular tratamiento', 'Importar datos'])
    c_sis = columna(790, 700, ['Generar alertas de stock, vencimiento y dosis atrasadas'])
    # Cada línea llega al borde de la elipse que mira al actor, así ninguna cruza otra elipse
    for actor, casos, borde in ((usu, c_usu, 0), (ope, c_ope, 0), (aud, c_aud, 1), (adm, c_adm, 1), (sis, c_sis, 1)):
        for caso in casos:
            d.linea(actor, caso, f'exitX={1 - borde};exitY=0.5;entryX={borde};entryY=0.5;')
    hereda = 'endArrow=block;endFill=0;endSize=14;'
    d.flecha(ope, usu, '', anclas=hereda + 'exitX=0.5;exitY=0;entryX=0.5;entryY=1;')
    d.flecha(aud, usu, '', anclas=hereda + 'exitX=0.5;exitY=0;entryX=0.5;entryY=0;', puntos=[(1240, 95), (170, 95)])
    d.flecha(adm, aud, '', anclas=hereda + 'exitX=0.5;exitY=0;entryX=0.5;entryY=1;')
    d.flecha(adm, ope, '', anclas=hereda + 'exitX=1;exitY=0.1;entryX=0.5;entryY=1;', puntos=[(1330, 408), (1330, 885), (170, 885)])
    d.guardar()


def flujo_bot() -> None:
    d = Diagrama('flujo_bot', 1000, 1180)
    titulo(d, 'Flujo de registro por Telegram', 'Vista de procesos. Nada se guarda sin la confirmación del operario; cada paso queda en la auditoría.')
    paso = CAJA + 'rounded=1;fillColor=#E8F0E9;strokeColor=#1F5C3A;fontStyle=1;'
    fin = CAJA + 'rounded=1;fillColor=#D9EAD3;strokeColor=#1F5C3A;fontStyle=1;'
    rombo = f'rhombus;whiteSpace=wrap;html=1;fontSize=12;fillColor=#FFF4D6;strokeColor=#8A5A00;{FUENTE}'
    error = CAJA + 'rounded=1;fillColor=#FBE9E7;strokeColor=#9B2226;'
    x, w = 250, 300
    nodos = [
        ('paso', '1. Llega el mensaje al webhook', None),
        ('rombo', '¿secret_token válido?', 'Rechazar con HTTP 403'),
        ('rombo', '¿Cuenta vinculada y activa?', 'Responder: usar /vincular'),
        ('paso', '2. Botones: animal, medicamento y cantidad (o texto leído por Gemini o reglas)', None),
        ('rombo', '¿Animal, medicamento y dosis válidos?', 'Pedir corrección al operario'),
        ('paso', '3. Mostrar resumen con botones Confirmar y Cancelar', None),
        ('rombo', '¿El operario confirma?', 'Cancelar: no se guarda nada'),
        ('rombo', '¿Stock suficiente en el lote?', 'Rechazar: stock insuficiente'),
        ('fin', '4. Transacción: dosis aplicada, salida del lote y auditoría con origen TELEGRAM', None),
    ]
    y, previo = 90, None
    for tipo, texto, no in nodos:
        alto = 90 if tipo == 'rombo' else 60
        estilo = {'paso': paso, 'rombo': rombo, 'fin': fin}[tipo]
        nid = d.celda(texto, estilo, x, y, w, alto)
        if previo:
            d.flecha(previo[0], nid, 'Sí' if previo[1] == 'rombo' else '', anclas='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
        if no:
            eid = d.celda(no, error, 650, y + 15, 280, 60)
            d.flecha(nid, eid, 'No', anclas='exitX=1;exitY=0.5;entryX=0;entryY=0.5;')
        previo = (nid, tipo)
        y += alto + 40
    d.guardar()


if __name__ == '__main__':
    for f in (er1, er2, er3, er4, despliegue, componentes, casos_uso, flujo_bot):
        f()
    print('Diagramas generados en', DIR)
