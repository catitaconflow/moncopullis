# Panel Moncopulli

Panel React + Vite + Supabase para inventario, animales, tratamientos, alertas y auditoría.
Usa solo la clave `anon`: lee con las políticas RLS y escribe a través de las funciones `fn_*` de la base,
que revisan el rol. El alta de usuarios pasa por la función `crear-usuario`.

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
npm test           # pruebas de las reglas en src/lib (vitest)
npm run lint       # ESLint
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
