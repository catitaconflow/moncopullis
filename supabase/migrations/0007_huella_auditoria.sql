-- R4: huella encadenada de la auditoría.
-- El trigger de solo inserción no corre con session_replication_role = replica (P21).
-- Esta huella no lo impide, pero lo deja a la vista: cada fila (con su detalle) se encadena
-- con SHA-256 a la anterior. El respaldo diario guarda (id, huella) y al día siguiente la
-- recalcula; si alguien borró o cambió una fila hasta ese id, la huella ya no coincide.
CREATE OR REPLACE FUNCTION fn_huella_auditoria(p_hasta bigint) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_huella bytea := '\x'::bytea;
  v_fila   text;
BEGIN
  FOR v_fila IN
    SELECT a::text || coalesce((SELECT string_agg(d::text, '|' ORDER BY d.id)
                                FROM auditoria_detalle d WHERE d.auditoria_id = a.id), '')
    FROM auditoria a WHERE a.id <= p_hasta ORDER BY a.id
  LOOP
    v_huella := sha256(v_huella || convert_to(v_fila, 'UTF8'));
  END LOOP;
  RETURN encode(v_huella, 'hex');
END $$;

-- Solo la usa el respaldo con la conexión de administración
REVOKE ALL ON FUNCTION fn_huella_auditoria(bigint) FROM PUBLIC, anon, authenticated;
