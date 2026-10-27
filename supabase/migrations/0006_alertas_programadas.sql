-- R2: recalcular las alertas cada hora aunque nadie use el panel,
-- para que las dosis atrasadas y los vencimientos aparezcan a tiempo.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('moncopulli-alertas', '0 * * * *', 'SELECT public.fn_generar_alertas()');
