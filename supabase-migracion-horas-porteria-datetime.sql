-- =============================================================================
-- MIGRACIÓN: Horas de portería con fecha completa (v3)
-- Motivo: las columnas de control de tiempos solo guardaban "HH:MM" y el panel
--         mostraba únicamente la hora. Ahora se guarda "YYYY-MM-DD HH:MM"
--         (ej: 2026-08-15 07:40) para mostrar fecha + hora.
-- Cambios:
--   1) Amplía las 6 columnas de hora de VARCHAR(10) a VARCHAR(19).
--   2) Las filas existentes con "HH:MM" se rellenan con la fecha de
--      fecha_hora (yyyy-mm-dd de su registo).
-- IDEMPOTENTE: se puede ejecutar varias veces sin error (las filas ya con
-- fecha no se tocan).
-- Ejecutar en Supabase > SQL Editor.
-- =============================================================================

-- 1) Ampliar columnas para soportar "YYYY-MM-DD HH:MM" (19 caracteres).
ALTER TABLE public.transportes
  ALTER COLUMN hora_llegada_porteria TYPE VARCHAR(19),
  ALTER COLUMN hora_ingreso          TYPE VARCHAR(19),
  ALTER COLUMN hora_inicio_cargue    TYPE VARCHAR(19),
  ALTER COLUMN hora_fin_cargue       TYPE VARCHAR(19),
  ALTER COLUMN hora_salida           TYPE VARCHAR(19),
  ALTER COLUMN hora_muelle_asignado  TYPE VARCHAR(19);

-- 2) Backfill: solo filas cuyo valor actual es "HH:MM" pura (5 caracteres).
UPDATE public.transportes
SET
  hora_llegada_porteria = CASE WHEN hora_llegada_porteria ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_llegada_porteria
    ELSE hora_llegada_porteria END,
  hora_ingreso = CASE WHEN hora_ingreso ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_ingreso
    ELSE hora_ingreso END,
  hora_inicio_cargue = CASE WHEN hora_inicio_cargue ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_inicio_cargue
    ELSE hora_inicio_cargue END,
  hora_fin_cargue = CASE WHEN hora_fin_cargue ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_fin_cargue
    ELSE hora_fin_cargue END,
  hora_salida = CASE WHEN hora_salida ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_salida
    ELSE hora_salida END,
  hora_muelle_asignado = CASE WHEN hora_muelle_asignado ~ '^\d{2}:\d{2}$'
    THEN to_char(fecha_hora, 'YYYY-MM-DD') || ' ' || hora_muelle_asignado
    ELSE hora_muelle_asignado END
WHERE
  hora_llegada_porteria ~ '^\d{2}:\d{2}$'
  OR hora_ingreso ~ '^\d{2}:\d{2}$'
  OR hora_inicio_cargue ~ '^\d{2}:\d{2}$'
  OR hora_fin_cargue ~ '^\d{2}:\d{2}$'
  OR hora_salida ~ '^\d{2}:\d{2}$'
  OR hora_muelle_asignado ~ '^\d{2}:\d{2}$';