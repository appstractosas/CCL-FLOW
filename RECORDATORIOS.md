# Recordatorios de CCL FLOW (revisar al inicio de cada sesión/madrugada)

> Regla: al comenzar una sesión, presentar este archivo al usuario COMPLETO (aquí mis recordatorios
> son los pendientes que el mismo usuario pidió que le recuerde cada mañana). Marcar con `[x]` lo
> ya resuelto, y borrar los ítems resueltos del inicio de la lista.

## Pendientes de hoy (siempre que la última sesión dejó algo sin terminar)

- Refactor de archivos grandes (pendiente desde la evaluación 8.5/10):
  - `src/utils/informes.ts` (870 líneas) — extraer lógica repetida.
  - `src/store/useLogisticsStore.ts` (736 líneas) — revisar carga completa (sin límite).
  - `src/components/modules/informes/panels.tsx` (1200 líneas) — dividir por panel si es útil.
- Paginación real de TRANSPORTES: `fetchTransportesPaginated`
  (`src/services/transportesService.ts`) está definida pero NADIE la usa; el store hace
  `.select('*')` sin límite. Conectar sin romper agregados (tablero/informes usan RPC por rango).
- Siguiente release: `v1.1.0` (tag en main vía PR con checks; instalar/autenticar `gh`).
- Llevar `main` por PR (branch protection) en futuros deploys (hoy fue merge directo por falta de `gh`).

## Decisiones acordadas (no repetir/deshacer)

- KG y MTS son INFORMATIVOS: columnas del fuente que se suman por par `(llave, placa_origen)` y
  se muestran solo en la tabla de TRANSPORTES (solo lectura). El sync las refresca como CAJAS;
  la app nunca las escribe.
- CAJAS: se refrescan del fuente por par `(llave, placa)`; `cajas_manual` no se pisa hasta que el
  fuente trae el mismo valor.
- Móvil: el scroll interno del mapa de calor se deja como está; los gráficos de INFORMES se apilan
  uno debajo del otro (`grid-cols-1 lg:grid-cols-*`).
- Sync: siempre en AMBOS flujos (Apps Script + RPC Power Automate) con la misma clave de upsert
  `(llave, placa)`.

## Reglas operativas rápidas (resumen)

- Commits atómicos convencionales en español, en `dev`; `main` solo vía PR + tag `v1.x.x`.
- Antes de cerrar un cambio: `npx tsc --noEmit`, `npx eslint src --max-warnings=0`,
  `npx vitest run --pool=forks --fileParallelism=false` → reportar resultado.
- Sin force-push ni rebase sobre `dev`/`main`.