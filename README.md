# CCL FLOW

Sistema de gestión logística para operación de almacén de carga del aeropuerto. Administra transportes, despachos, portería, monitoreo en tiempo real, informes y control de acceso por roles.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Estado | Zustand 5 |
| UI | Tailwind CSS 4, Lucide React, Motion, Recharts |
| Backend | Supabase (PostgreSQL + RPC SECURITY DEFINER) |
| Auth | Sesión custom vía RPC (`ccl_login`, `ccl_validate_session`) |
| Sync | Google Apps Script (Sheets), Power Automate (Excel) |
| Testing | Vitest 4, Testing Library, jsdom |
| Linting | ESLint 10, Prettier 3, TypeScript |

## Arquitectura

```
src/
├── components/
│   ├── auth/          # Login y barra de sesión
│   ├── chat/          # Chat inter-módulo (Gemini AI)
│   ├── common/        # Primitivas UI reutilizables
│   ├── modules/       # Módulos feature (lazy-loaded)
│   ├── notifications/ # Campana de notificaciones
│   └── rbac/          # Matriz de permisos, roles, historial
├── hooks/             # Custom hooks (filtros, virtual list)
├── lib/               # Config Supabase, utilidades fechas, módulos
├── services/          # Capa de datos (wrappers RPC Supabase)
├── store/             # Zustand stores (auth, logistics, catálogos)
├── tests/             # 27 archivos de test (196 tests)
├── types/             # Definiciones TypeScript compartidas
└── utils/             # Utilidades (informes, portería, sonido)
```

## Módulos

| Módulo | Descripción |
|--------|------------|
| **Tablero** | Vista estilo aeropuerto con estado en tiempo real |
| **Planeación** | Gestión y programación de transportes |
| **Transportes** | CRUD de transportes con detalle por llave/placa |
| **Despachos** | Control de despachos y seguimiento |
| **Portería** | Control de puerta, muelles, horas de operación |
| **Monitoreo** | Vista operativa con registro de salida |
| **Informes** | Métricas, KPIs, exportación a Excel |
| **Personal** | Asignación de muelles por supervisor |
| **Usuarios** | Administración de usuarios y roles (RBAC) |

## Autenticación y RBAC

El sistema usa autenticación custom por RPC (no usa Supabase Auth):

- **Login**: `ccl_login(p_cedula, p_clave)` → valida credenciales y crea sesión de 24h
- **Validación**: `ccl_validate_session(p_token)` → valida token al recargar la app
- **Logout**: `ccl_logout(p_token)` → invalida la sesión

Las contraseñas se almacenan con **bcrypt** (pgcrypto). La comparación se hace server-side con `crypt()`.

**Roles predefinidos**: ADMIN, DESPACHADOR, PORTERO, PLANEADOR, SUPERVISOR, MONITOREO, TRANSPORTES, TABLERO, INFORMES.

**Matrix de permisos**: Cada rol tiene flags `canAccess` y `canEdit` por módulo. Admin tiene acceso total.

## Seguridad (RLS + RPC Guard)

- Todas las escrituras pasan por **RPCs SECURITY DEFINER** (13 funciones)
- El rol `anon` tiene **SELECT libre** pero está **bloqueado** para INSERT/UPDATE/DELETE
- El sync (Power Automate / Apps Script) usa `service_role` y no se afecta
- Contraseñas hasheadas con **pgcrypto/bcrypt**

Migraciones SQL (ejecutar en orden):
1. `supabase-migracion-region.sql`
2. `supabase-migracion-rls-rpc-guard.sql`
3. `supabase-migracion-pgcrypto.sql`

## Variables de entorno

| Variable | Descripción |
|----------|------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `GEMINI_API_KEY` | API key para chat AI (Gemini) |

Cuando no hay variables de Supabase configuradas, la app arranca en **modo demo** con usuarios predefinidos.

## Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (puerto 3000)
npm run dev

# Build de producción
npm run build

# Tests
npm run test
npm run test:coverage

# Lint + typecheck
npm run lint

# Solo ESLint
npm run lint:eslint
npm run lint:fix

# Formateo
npm run format
npm run format:check
```

## Sincronización de datos

La app recibe datos desde hojas de cálculo (Google Sheets / Excel) mediante dos flujos:

1. **Apps Script** (`sheets-sync/transportes-sync.gs`): sincroniza Google Sheets → Supabase. Respaldable y ejecutable manualmente.
2. **Power Automate** (`power-automate/migracion-rpc-sync-transportes.sql`): sincroniza Excel → Supabase vía RPC. Sync activo programado.

**Clave de upsert**: `(llave, placa)`. Cada llave puede tener múltiples placas (una fila por placa).

## Estructura de datos (tabla `transportes`)

Columnas principales: `llave`, `placa`, `fecha_hora`, `cita_cargue`, `transporte`, `denominacion`, `cajas`, `kg`, `destino`, `region`, `transportadora`, `vehiculo_tipo`, `estado_transporte`, `estado_porteria`, `muelle_asignado`, `cuadrilla`, horas de portería (`hora_llegada_porteria`, `hora_ingreso`, `hora_inicio_cargue`, `hora_fin_cargue`, `hora_salida`).

## Tests

27 archivos de test, 196 tests cubriendo:
- Integración de servicios (Supabase mockeado con `.rpc()`)
- RBAC y autenticación
- Módulos UI (render, interacción, permisos)
- Utilidades (fechas, informes, portería)
- Store de Zustand (estado, filtros, realtime)
