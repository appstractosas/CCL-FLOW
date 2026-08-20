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
- En llaves existentes el sync **no sobreescribe** CAJAS; en filas nuevas sí las registra.
- Columnas de portería/operación (`hora_*_porteria`, `cuadrilla`, `muelle_asignado`, `observaciones`) las escribe la app, no el sync.

# Regla "actualiza github" (buenas prácticas de repositorio)

> Cuando el usuario diga **"actualiza github"** (o similar: publicar, subir cambios, push), además de ejecutar los push/merge solicitados, DEBO entregar en la misma respuesta las recomendaciones de flujo Git/GitHub acordadas:

1. **Commits atómicos**: un commit = una preocupación; si el trabajo mezcla temas (informes + tablero + sync), separarlos (sync con sus migraciones/RPC, según la regla de arriba).
2. **Mensajes convencionales en español**: `feat(ámbito): qué`, `fix(ámbito): qué`, `refactor(ámbito): qué`, `test(ámbito): qué` (ej. `feat(informes): indicador hora-hombre`).
3. **Verificación previa**: correr `npm run lint` (tsc) y la suite de tests (vitest con `--pool=forks --fileParallelism=false`) antes de publicar; reportar el resultado.
4. **Flujo recomendado**: rama `feature/<tarea>` desde `dev` → merge a `dev` (o push directo si es dev único); `main` solo vía PR con checks (branch protection recomendado) y tag de versión (`v1.x.x`) en cada deploy.
5. **No historia manipulada**: sin force-push ni rebase sobre ramas compartidas (dev/main); merges limpios.
6. **Estado del repo**: reportar `git status`, rama actual y discrepancias con `origin` antes de publicar.