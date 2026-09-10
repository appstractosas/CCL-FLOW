# Regla de sincronización (deploy de ambos flujos)

> Regla permanente de CCL FLOW: **en cada desarrollo, siempre considerar/implementar AMBOS despliegues de sincronización**, no solo uno:

1. **Apps Script** — `sheets-sync/transportes-sync.gs` (respaldo Google Sheets → Supabase).
2. **Power Automate** — RPC `power-automate/migracion-rpc-sync-transportes.sql` (sync activo).

Requisitos al tocar un desarrollo:

- Si el cambio afecta el **contrato de sincronización** (columnas, clave de upsert `(llave, placa)`, valores, mapeos de columnas de Excel/Sheets), actualizar AMBOS al mismo tiempo y en el mismo commit.
- Mantener ambos coherentes: misma clave de upsert `(llave, placa)`, mismos mapeos (`Olt Inicial→transportadora`, `transporte`, `denominacion`, `cita_cargue`, `cajas`, `ESTATUS CANCELADO→estado_porteria='CANCELADO'`).
- Cambios puramente UI/app (informes, chat, notificaciones, etc.) **no** requieren tocar el sync, salvo que agreguen/quiten columnas de `transportes`.

Reglas de negocio del modelo (no romper):

- Una LLAVE puede tener varias PLACAS (una fila por placa). Un TRANSPORTE (nº pedido) solo puede estar en UNA llave (trigger `trg_transporte_una_llave`).
- CAJAS se refrescan en cada corrida desde el fuente (Excel/Sheets) con la suma del par `(llave, placa)`; si el fuente no trae cajas para el par, se conserva el valor existente. Cuando una fila pasa de placa vacía a placa llena, la fila `(llave,'')` deja de incluir esas cajas (se elimina el huérfano). Las cajas editadas por el despachador en la app quedan marcadas (`cajas_manual`) y el sync no las pisa hasta que el fuente trae ese mismo valor.
- KG es un campo OBSOLETO en la app (se quitó del formulario, el detalle y las dos sincronizaciones). La columna `kg` de la BD se conserva para compatibilidad (siempre NULL) y no debe volver a usarse en la app ni en el sync.
- Columnas de portería/operación (`hora_*_porteria`, `cuadrilla`, `muelle_asignado`, `observaciones`) las escribe la app, no el sync.

# Regla "actualiza github" (buenas prácticas de repositorio)

> Cuando el usuario diga **"actualiza github"** (o similar: publicar, subir cambios, push), además de ejecutar los push/merge solicitados, DEBO entregar en la misma respuesta las recomendaciones de flujo Git/GitHub acordadas:

1. **Commits atómicos**: un commit = una preocupación; si el trabajo mezcla temas (informes + tablero + sync), separarlos (sync con sus migraciones/RPC, según la regla de arriba).
2. **Mensajes convencionales en español**: `feat(ámbito): qué`, `fix(ámbito): qué`, `refactor(ámbito): qué`, `test(ámbito): qué` (ej. `feat(informes): indicador hora-hombre`).
3. **Verificación previa**: correr `npm run lint` (tsc) y la suite de tests (vitest con `--pool=forks --fileParallelism=false`) antes de publicar; reportar el resultado.
4. **Flujo recomendado**: rama `feature/<tarea>` desde `dev` → merge a `dev` (o push directo si es dev único); `main` solo vía PR con checks (branch protection recomendado) y tag de versión (`v1.x.x`) en cada deploy.
5. **No historia manipulada**: sin force-push ni rebase sobre ramas compartidas (dev/main); merges limpios.
6. **Estado del repo**: reportar `git status`, rama actual y discrepancias con `origin` antes de publicar.

# Regla de calidad obligatoria (aplica a CADA prompt de modificación)

> En **cada** solicitud de modificación/desarrollo, NO reiterar estas reglas: son permanentes y se aplican siempre.

1. **Refactorización**: al tocar un módulo, revisar y extraer lógica duplicada y eliminar wrappers/funciones redundantes (p.ej. `isOnline()`, `permissionsAllTrue`, aliases cortos obscuros), sin cambiar el comportamiento.
2. **Paginación**: en toda lista/consulta (fetch, RPC, tablas con muchos registros) revisar y aplicar paginación/ventanas/`.limit()` cuando aplique; no devolver/serializar todo sin control.
3. **Limpieza de código**: eliminar dead code, variables/imports sin uso y duplicados generados por la propia modificación, en el mismo paso (no como tarea separada ni opcional).
4. **Verificación final obligatoria**: antes de dar por cerrado un cambio, correr `npm run lint` (tsc) y la suite de tests (`vitest --pool=forks --fileParallelism=false`) y **reportar el resultado** (pasa/falla y cuántos). Si algo falla, corregirlo.
5. **Ingeniería/parámetros**: respetar convenciones del repo, no introducir comentarios salvo que aporten, no romper el contrato de sincronización (regla de arriba) ni las reglas de negocio del modelo.