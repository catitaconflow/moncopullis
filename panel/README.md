# Panel Moncopulli (solo lectura)

Webapp React + Vite + Supabase para consultar inventario, animales, tratamientos y auditoría.
No escribe en la base: usa solo la clave `anon` y las políticas RLS `SELECT` del rol `authenticated`.

## Instalar

```bash
cd panel
npm install
```

## Configurar

```bash
cp .env.example .env.local
```

Edita `.env.local` con la URL del proyecto y la clave **anon** (pública). Nunca uses la `service_role`.
`.env.local` está ignorado por git.

## Correr

```bash
npm run dev        # http://localhost:5173
```

Sin las variables, la app muestra un mensaje de configuración incompleta.
Para entrar necesitas un usuario de Supabase Auth vinculado a una fila de la tabla `usuario` (`auth_user_id`).

## Probar y construir

```bash
npm test           # pruebas de vencimiento y stock (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # genera dist/
```

## Criterios de negocio

- Bajo mínimo: `stock_actual < stock_minimo` (medicamentos activos).
- Lote por vencer: vence en 60 días o menos. En el Resumen se cuentan los lotes activos con stock, incluidos los ya vencidos.
- Animal activo: `fecha_baja` nula.
- Tratamiento abierto: no anulado y con al menos una dosis `PROGRAMADA`.
- Tratamiento anulado: `fecha_anulacion` no nula.
- Los tratamientos no tienen fecha propia: se muestra `fecha_creacion`.
