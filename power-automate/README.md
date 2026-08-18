# Migración del sync Excel 365 → Supabase a Power Automate

Reemplazo del script `sheets-sync/transportes-sync.gs` (Apps Script de Google)
por una automatización equivalente en **Power Automate (Microsoft)**.

> DECISIÓN DE FUENTE (confirmada con el cliente): la empresa trabaja 100% con
> Microsoft y NO puede crear cuentas Google corporativas. Por eso la fuente de
> datos pasa de **Google Sheets** a **Excel 365 en OneDrive/SharePoint**, y el
> motor de sync pasa de **Apps Script** a **Power Automate**.

El repo queda así en la rama `dev`:

- `sheets-sync/transportes-sync.gs` → **NO se toca / NO se borra** (sigue en main y dev como respaldo).
- `power-automate/` → documentación y guías de la migración.

## Qué hace el script que vamos a reemplazar (lógica a replicar)

1. Leer la pestaña de operaciones del libro (antes Sheets, ahora Excel 365).
2. Mapear columnas → campos de la tabla `transportes` de Supabase.
3. Convertir fechas → ISO; `llave`/`placa` en mayúsculas; `cajas` a número.
4. Regla de conflicto: una llave no puede repetirse con placas reales distintas
   (esas filas NO se envían).
5. Estatus `CANCELADO` → la llave pasa a `estado_porteria = 'CANCELADO'`.
6. Consolidar: UN registro por llave; las `cajas` de todas las filas de la misma
   llave se suman; el resto de campos toma el último valor no vacío.
7. UPSERT a Supabase (PostgREST) usando `llave` como clave única con
   `on_conflict=llave` y `Prefer: resolution=merge-duplicates`.
8. Frecuencia: el script corría con un trigger temporal cada 1 minuto.

## Estado actual del flujo de Power Automate

| Dato | Valor |
| --- | --- |
| Proyecto | Power Automate (make.powerautomate.com), cuenta `auxadmincali@ccl.com.co` |
| Tipo de flujo | Flujo programado (Recurrence cada 1 min) |
| Conector de lectura | Excel Online (Business) → acción "Enumerar las filas de una tabla" |
| Origen | Excel 365 en OneDrive for Business con tabla `CONSOLIDADO` (Ctrl+T) |
| Estado | ✅ LECTURA OK · ✅ POST vía RPC `sync_transportes` (los datos requieren ejecutar la migración del script) |
| Pendiente | Migrar el RPC a Supabase y ejecutar prueba end-to-end |

### Flujo definitivo (3 pasos, sin bucle)

1. **Seleccionar** (Salida: array con todas las filas, incluida la clave `estatus` ← columna Estatus).
2. **Redactar** (la acción Compose aparece como "Redactar" en el diseñador en español) → Entradas (Expresión): `json(concat('{''_filas'':', string(body('Seleccionar')), '}'))` — envuelve el array como parámetro del RPC.
3. **HTTP** → `POST https://gklcxnlseghdqylvnkdb.supabase.co/rest/v1/rpc/sync_transportes`, Cuerpo = `outputs('Redactar')`, mismos 4 headers (`apikey`, `Authorization: Bearer`, `Prefer: resolution=merge-duplicates,return=minimal`, `Content-Type: application/json`).

> ⚠️ El nombre de la acción Compose en el diseñador en español es **Redactar**. Si la
> renombras (p. ej. a "Redactar"), el Cuerpo del HTTP debe usar `outputs('Redactar')`
> — siempre con el nombre EXACTO que muestra la pestaña de contenido dinámico.

> ⚠️ El `Select` puede enviar cada fila tanto con los nombres de campo de la BD
> (`transportadora`) como con los encabezados del Excel (`Olt Inicial`). La función
> `sync_transportes` ya tolera ambas (normaliza claves sin espacios/guiones), de modo
> que `transportadora` se llena con `Olt Inicial` aunque el `Select` mande el encabezado.

> 📌 `cajas` (y sus sumatorias): el Excel la fija solo cuando la llave es NUEVA
> (INSERT). Para llaves que ya existen, el sync NO sobreescribe `cajas`: si el
> despachador la edita en la app, ese valor persiste en la BD (no se escribe en el
> Excel). Así se evita que la corrida de cada minuto revierta la edición manual.

> 1 solo POST por corrida, igual que el `.gs`. La **suma de cajas y la conversión de fechas las hace la función** en Supabase (ver script `migracion-rpc-sync-transportes.sql`). El antiguo POST row-by-row con `Apply to each` se descartó: no puede sumar `cajas` entre llaves repetidas.

> Nota de permisos: SharePoint requiere ser MIEMBRO del sitio (no basta con
> compartir la carpeta). Una vez aprobado el acceso al sitio `AVERIASMONDELEZ`,
> se puede cambiar el origen de OneDrive → SharePoint. Por ahora se avanza con
> OneDrive para no bloquear.

## Setup del flujo (lo que ya está hecho)

**Disparador**: Recurrence → Frecuencia 1, minuto.

**Acción 1 — Enumerar las filas de una tabla** (Excel Online (Business)):
- Ubicación: OneDrive for Business.
- Biblioteca de documentos: Mis archivos.
- Archivo: `Consolidado planeación 2026.xlsx` (copia en OneDrive del dueño).
- Tabla: `CONSOLIDADO`.

## Datos de conexión a Supabase (para las siguientes acciones)

| Dato | Valor |
| --- | --- |
| Endpoint (POST) | `https://gklcxnlseghdqylvnkdb.supabase.co/rest/v1/rpc/sync_transportes` (RPC; ya no se usa `/rest/v1/transportes?on_conflict=llave` directo — ahora la consolidación/suma de cajas vive en la función) |
| Cabecera `apikey` | Service Role key (propiedad `SUPABASE_SERVICE_KEY` del script) |
| Cabecera `Authorization` | `Bearer <Service Role key>` |
| Cabecera `Prefer` | `resolution=merge-duplicates,return=minimal` |
| Cuerpo | `{"_filas": [ {columna: valor}, ... ]}` — el array completo de filas (armado por el Compose) |

## Columnas reales de la tabla conforme Supabase (verificado con querys)

| Columna | Nullable | Default |
| --- | --- | --- |
| id | NO | gen_random_uuid() |
| llave | NO | — |
| fecha_hora | NO | now() |
| placa | NO | '' |
| vehiculo_tipo | NO | 'SENCILLO' |
| cita_cargue | SÍ | null |
| transportadora | NO | '' |
| estado_transporte | NO | 'ALISTADO' |
| estado_porteria | NO | 'Pendiente' |
| muelle_asignado | SÍ | null |
| hora_llegada_porteria | SÍ | '--:--' |
| hora_ingreso | SÍ | '--:--' |
| hora_inicio_cargue | SÍ | '--:--' |
| hora_fin_cargue | SÍ | '--:--' |
| hora_salida | SÍ | '--:--' |
| observaciones | SÍ | null |
| created_at | SÍ | now() |
| updated_at | SÍ | now() |
| cuadrilla | SÍ | null |
| hora_muelle_asignado | SÍ | '--:--' |
| transporte | SÍ | null |
| denominacion | SÍ | null |
| cajas | SÍ | 0 |

## Mapeo de columnas (encabezado Excel → campo de la BD)

| Encabezado del Excel | Campo de la BD | Nota |
| --- | --- | --- |
| `Fecha` | `fecha_hora` | dd/mm/aaaa → ISO `YYYY-MM-DDT00:00:00` |
| `Llave 2` | `llave` | clave única, mayúsculas |
| `Vehículo` | `vehiculo_tipo` | |
| `Cita de cargue` | `cita_cargue` | dd/mm/aaaa hh:mm → ISO |
| `Olt Inicial` | `transportadora` | |
| `Transporte` | `transporte` | nº de pedido |
| `Denominación` | `denominacion` | cliente |
| `Placa` | `placa` | mayúsculas; si está vacía se envía `''` |
| `Cajas` | `cajas` | número |
| `Estatus` | (no se envía) | solo señal: si dice `CANCELADO`, setear `estado_porteria='CANCELADO'` |

## Servicios/acciones de Power Automate a usar (lo que falta)

- **HTTP → "HTTP"**: el POST batch a Supabase (única escritura).
- **Compose / Initialize variable**: para construir el array de filas mapeadas y
  hacer la consolidación por llave.
- **Data Operations → Select / Filter array**: para normalizar fechas y valores.
- **Control → Apply to each**: solo para armar/agrupar filas (NO uno por POST).
- **Control → Do until** (si hiciera falta paginar el Excel).

## Desactivar el respaldo de Apps Script (¡hazlo ahora!)

> Motivo: el `.gs` tiene un temporal de 1 minuto que escribe desde el **Google Sheets
> viejo** y, junto con Power Automate (que lee el Excel), causaba parpadeo en la app
> (dos escritores sobre la misma tabla).

1. Abre el proyecto en **Google Apps Script** (el del `transportes-sync.gs`).
2. En la barra superior, en el selector de funciones elige **`uninstallTriggers`** → clic **▶ Ejecutar**.
   - Solo la primera vez pide autorizar. Termina con "Disparadores eliminados".
3. El script sigue intacto como respaldo. **No muevas ni borres el archivo**.

## Reactivar el respaldo si Power Automate falla

1. En Apps Script, elige **`installTriggers`** → **▶ Ejecutar**.
2. Vuelve a crear onEdit + temporal de 1 minuto leyendo el Google Sheets.

> El sync a mano (`syncTransportes`) siempre está disponible con ▶, para una corrida puntual sin triggers.

## Pasos restantes del plan

1. ✅ Registrar/abrir Power Automate y crear el flujo programado.
2. ✅ Acción "Enumerar las filas de una tabla" leyendo el Excel (probado OK).
3. ✅ Diagnóstico del error `PGRST102 "Empty or invalid json"` → el HTTP enviaba el
   cuerpo vacío porque estaba FUERA del bucle; el HTTP dentro del bucle llegaba bien y
   Supabase respondía por el tipo de dato (`timestamp with time zone: "46248"`).
4. **Ejecutar `power-automate/migracion-rpc-sync-transportes.sql` en Supabase** y
   convertir el flujo a los 3 pasos: Select (con `estatus`) → Compose (envuelve
   `{"_filas":[...]}`) → HTTP a `/rest/v1/rpc/sync_transportes`. **1 solo POST**.
5. **Probar con 1 fila de ejemplo** (llave `LL-TEST-001`) verificando suma de cajas,
   fechas ISO y `estado_porteria='CANCELADO'` cuando `estatus` diga CANCELADO.
6. Desactivar/limpiar: quitar el temporal de Apps Script cuando Power Automate
   esté estable y documentar.
7. Cambiar origen de OneDrive → SharePoint cuando se apruebe el acceso al sitio.

## Notas importantes

- La app React usa el **Realtime de Supabase**: al hacer el UPSERT desde Power
  Automate, la app se actualiza sola.
- `transportes` aún NO está en el publication de Realtime de la BD (solo
  `notificaciones`). Si se desea actualización en vivo junto con Excel, ejecutar
  en Supabase: `ALTER PUBLICATION supabase_realtime ADD TABLE public.transportes;`.
- Las filas con llaves en conflicto (misma llave, 2+ placas reales) deben
  omitirse igual que en el .gs.
- Mantener `main` con `sheets-sync` intacto: toda esta migración vive en `dev`.