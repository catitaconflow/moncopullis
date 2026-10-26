# Manual de usuario — Panel Moncopulli

Dirección: https://moncopulli-panel.itskay666.workers.dev
Funciona en computador y en celular. Cada persona entra con su correo y contraseña.

## Qué puede hacer cada rol

| Acción | ADMIN | OPERARIO | AUDITOR |
|--------|:-----:|:--------:|:-------:|
| Ver resumen, inventario, animales y tratamientos | Sí | Sí | Sí |
| Registrar entradas y ajustes de stock | Sí | Sí | No |
| Registrar animales, propietarios y tratamientos | Sí | Sí | No |
| Aplicar u omitir dosis | Sí | Sí | No |
| Ver y resolver alertas | Sí | Sí | No |
| Crear o editar medicamentos y proveedores | Sí | No | No |
| Anular tratamientos y gestionar usuarios | Sí | No | No |
| Ver auditoría y exportar datos | Sí | No | Sí |

Si un botón no aparece, es porque su rol no tiene esa acción.

## Resumen

Al entrar se ven cuatro tarjetas. El borde rojo indica que algo requiere atención; el verde, que está en orden. Pulse una tarjeta para ir al detalle. Debajo aparecen los medicamentos bajo el mínimo, los lotes por vencer y los últimos tratamientos.

## Inventario

**Registrar la llegada de medicamentos**
1. Inventario → pulse el medicamento → **Registrar entrada**.
2. Elija un lote existente o escriba uno nuevo con su fecha de vencimiento.
3. Escriba la cantidad en la unidad indicada (ml, g o unidades) y guarde.

**Corregir el stock después de un conteo**
1. En la tabla de lotes, pulse **Ajustar** en el lote.
2. Elija *Salida (descontar)* o *Entrada (sumar)*, el motivo y la cantidad. Con el motivo *Otro* hay que explicar qué pasó.

El stock no se escribe a mano: cambia solo con entradas, ajustes y dosis aplicadas. Así queda el historial completo en la parte de abajo del detalle.

**Nuevo medicamento (ADMIN):** botón **Nuevo medicamento**. Incluya los días de resguardo de leche, porque con ellos el sistema calcula hasta cuándo no se puede entregar leche.

## Animales

- **Nuevo animal:** DIIO de 9 dígitos (opcional si aún no tiene), categoría, propietario si es arrendado y madre si se conoce.
- **Dar de baja:** pulse el animal → **Dar de baja** → motivo y fecha. No se puede si tiene dosis pendientes.
- **Nuevo tratamiento:** desde el detalle del animal, para no tener que buscarlo de nuevo.

## Tratamientos

**Registrar un tratamiento**
1. **Nuevo tratamiento** → elija el animal y escriba quién lo indicó.
2. Agregue las dosis: medicamento, cantidad y fecha. Para varias dosis iguales use *Repetir cada N horas, X veces*.
3. Guarde. Las dosis quedan programadas.

**Aplicar una dosis**
1. Pulse el tratamiento → en la dosis, **Aplicar**.
2. Elija el lote. Solo aparecen lotes vigentes con stock suficiente.
3. Confirme. El stock se descuenta y, si el medicamento tiene resguardo, aparece el aviso **"No entregar leche hasta…"**.

Si una dosis no se aplicó, use **Omitir** y escriba el motivo. El ADMIN puede **Anular** un tratamiento registrado por error; el stock de las dosis aplicadas vuelve al lote.

## Alertas

Se crean solas cuando un medicamento baja del mínimo, un lote vence en 60 días o menos, o una dosis se atrasa. Se cierran solas cuando el problema se resuelve. También se pueden cerrar a mano con **Resolver** y un comentario. Si el problema sigue (por ejemplo, el stock sigue bajo), la alerta se vuelve a abrir en el siguiente cálculo, para que no se olvide.

## Maestros

Propietarios (ADMIN y OPERARIO), proveedores y usuarios (solo ADMIN). El RUT se valida con su dígito verificador.

## Exportar (ADMIN y AUDITOR)

Elija la tabla y el formato (CSV para Excel o JSON). El sistema guarda quién exportó, cuántas filas y la huella SHA-256 del archivo, que permite comprobar después que no fue modificado.

## Mensajes comunes

| Mensaje | Qué hacer |
|---------|-----------|
| Stock insuficiente | Elija otro lote o registre la entrada pendiente |
| No tienes permiso para esta acción | Pida al administrador que revise su rol |
| No se pudo guardar. Revisa tu conexión | Revise la señal y vuelva a intentarlo; no se guardó nada a medias |
