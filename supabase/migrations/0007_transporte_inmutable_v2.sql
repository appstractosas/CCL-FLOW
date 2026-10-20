-- =============================================================================
-- MIGRACIÓN: Inmutabilidad desde LLEGO A PORTERIA + Excepción cajas (CARGANDO/FINALIZO)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_transporte_inmutable ON public.transportes;
DROP FUNCTION IF EXISTS public.trg_transporte_inmutable();

CREATE OR REPLACE FUNCTION public.trg_transporte_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  estados_inmutables constant text[] := ARRAY[
    'LLEGO A PORTERIA','INGRESO A MUELLE','CARGANDO',
    'FINALIZO CARGUE','SALIO DE PORTERIA','CANCELADO'
  ];
  estados_cajas_editables constant text[] := ARRAY['CARGANDO','FINALIZO CARGUE'];
  campos_fijos constant text[] := ARRAY[
    'llave','placa','transporte','vehiculo_tipo',
    'transportadora','destino','region','cita_cargue','fecha_hora',
    'denominacion'
  ];
  campo text;
BEGIN
  -- Solo actuar si el estado ANTERIOR ya es inmutable
  IF OLD.estado_porteria = ANY(estados_inmutables) THEN
    
    -- 1. Permitir siempre el avance del estado_porteria (flujo)
    -- 2. Permitir siempre campos operativos de portería
    -- (hora_llegada_porteria, hora_ingreso, hora_inicio_cargue, 
    --  hora_fin_cargue, hora_salida, muelle_asignado, cuadrilla, observaciones)
    -- -> No están en 'campos_fijos', por lo que se permiten implícitamente.

    -- 3. Validar campos fijos (identidad, planeación, cajas)
    FOREACH campo IN ARRAY campos_fijos LOOP
      IF NEW[campo] IS DISTINCT FROM OLD[campo] THEN
        
        -- EXCEPCIÓN ÚNICA: 'cajas' editable SOLO en CARGANDO / FINALIZO CARGUE
        IF campo = 'cajas' AND OLD.estado_porteria = ANY(ARRAY['CARGANDO','FINALIZO CARGUE']) THEN
          CONTINUE; -- Permitir cambio de cajas (viene de la App)
        END IF;
        
        -- TODO LO DEMÁS BLOQUEADO
        RAISE EXCEPTION 'No se puede modificar %: estado % no permite cambios', campo, OLD.estado_porteria;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transporte_inmutable ON public.transportes;
CREATE TRIGGER trg_transporte_inmutable
  BEFORE UPDATE ON public.transportes
  FOR EACH ROW EXECUTE FUNCTION public.trg_transporte_inmutable();