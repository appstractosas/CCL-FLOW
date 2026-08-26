# CCL FLOW — Torre de Control Logística

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
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite)                      │
│  React 19 · Zustand · Tailwind · Lazy-loaded modules     │
├──────────────────────────────────────────────────────────┤
│                     SERVICES LAYER                        │
│  authService · transportesService · rbacService · ...     │
│  Todas las escrituras usan .rpc('ccl_*')                 │
├──────────────────────────────────────────────────────────┤
│                    SUPABASE BACKEND                        │
│  PostgreSQL + pgcrypto · SECURITY DEFINER RPCs            │
│  13 funciones RPC · RLS: SELECT libre, writes bloqueados │
├──────────────────┬───────────────────────────────────────┤
│  Google Sheets   │         Excel (SharePoint)             │
│  Apps Script     │         Power Automate                 │
│  sheets-sync/    │         power-automate/                │
└──────────────────┴───────────────────────────────────────┘
```

## Estructura de carpetas

```
src/
├── components/
│   ├── auth/          # LoginScreen, barra de sesión
│   ├── chat/          # Chat inter-módulo (Gemini AI)
│   ├── common/        # Primitivas UI reutilizables (Badge, Button, etc.)
│   ├── modules/       # Módulos feature (lazy-loaded):
│   │   ├── PlaneacionModule.tsx
│   │   ├── TransportesModule.tsx
│   │   ├── PorteriaModule.tsx
│   │   ├── DespachosModule.tsx
│   │   ├── MonitoreoModule.tsx
│   │   ├── InformesModule.tsx
│   │   ├── PersonalModule.tsx
│   │   ├── UsuariosModule.tsx
│   │   ├── CrudModule.tsx
│   │   ├── TransporteFormModal.tsx
│   │   ├── TransporteDetailPanel.tsx
│   │   └── TransportesTable.tsx
│   ├── notifications/ # Campana de notificaciones
│   └── rbac/          # Matriz de permisos, roles, historial
├── hooks/             # Custom hooks (filtros, virtual list)
├── lib/               # Config Supabase, utilidades fechas, módulos
├── services/          # Capa de datos (wrappers RPC Supabase)
│   ├── authService.ts         # ccl_login, ccl_validate_session, ccl_logout
│   ├── transportesService.ts  # CRUD transportes + realtime + filtros
│   ├── rbacService.ts         # CRUD roles + usuarios
│   ├── chatService.ts         # Mensajes chat + realtime
│   ├── notificacionesService.ts  # Notificaciones + realtime
│   └── historialService.ts    # Auditoría de movimientos
├── store/             # Zustand stores
│   ├── useAuthStore.ts        # Sesión, RBAC, usuarios, historial
│   ├── useLogisticsStore.ts   # Transportes, filtros, portería
│   └── useCatalogStore.ts     # Catálogos (clientes, ciudades)
├── tests/             # 27 archivos, 196 tests
├── types/             # Definiciones TypeScript compartidas
└── utils/             # Utilidades (informes, portería, sonido)

supabase/
└── (archivos SQL de migración, ejecutar en orden — ver DEPLOYMENT.md)

sheets-sync/
└── transportes-sync.gs    # Google Apps Script → Supabase

power-automate/
└── migracion-rpc-sync-transportes.sql  # Power Automate → Supabase
```

## Módulos

| Módulo | Descripción | Edición |
|--------|------------|---------|
| **Tablero** | Vista estilo aeropuerto con estado en tiempo real | Solo lectura |
| **Planeación** | Gestión y programación de transportes | Lectura + edición |
| **Transportes** | CRUD de transportes con detalle por llave/placa | Lectura + edición |
| **Despachos** | Control de despachos y seguimiento | Lectura + edición |
| **Portería** | Control de puerta, muelles, horas de operación | Lectura + edición |
| **Monitoreo** | Vista operativa con registro de salida | Lectura + edición |
| **Informes** | Métricas, KPIs, exportación a Excel | Solo lectura |
| **Personal** | Asignación de muelles por supervisor | Lectura + edición |
| **Usuarios** | Administración de usuarios y roles (RBAC) | Lectura + edición |

## Autenticación

El sistema usa autenticación **custom por RPC** (no usa Supabase Auth):

```
Login:    ccl_login(p_cedula, p_clave) → token + user
Validate: ccl_validate_session(p_token) → user (renueva 30min)
Logout:   ccl_logout(p_token) → elimina sesión
```

**Flujo de sesión:**
1. Usuario ingresa cédula + clave → `ccl_login`
2. bcrypt valida la contraseña server-side
3. Se crea sesión con expiración 24h absoluta
4. Token se guarda en `localStorage`
5. Al recargar la app, `ccl_validate_session` valida el token
6. Si hay 30min de inactividad, la sesión expira automáticamente

**Rate limiting:** Máximo 5 intentos fallidos por cédula en 5 minutos.

**Password policy:** Mínimo 8 caracteres, 1 mayúscula, 1 número. Validado server-side (RPC) y client-side (UI).

## Seguridad (RLS + RPC Guard)

```
┌─────────────────────────────────────────────┐
│              capas de seguridad              │
├─────────────────────────────────────────────┤
│  1. pgcrypto/bcrypt      → contraseñas hash │
│  2. Rate limiting         → 5 intentos/5min │
│  3. Password policy       → 8+ chars, A-Z, 0-9│
│  4. Session timeout       → 30min inactividad│
│  5. RPC SECURITY DEFINER  → 13 funciones     │
│  6. RLS bloqueado         → anon: solo SELECT │
│  7. search_path fijo      → public, extensions│
└─────────────────────────────────────────────┘
```

- Todas las escrituras pasan por **RPCs SECURITY DEFINER** (13 funciones)
- El rol `anon` tiene **SELECT libre** pero está **bloqueado** para INSERT/UPDATE/DELETE
- El sync (Power Automate / Apps Script) usa `service_role` y no se afecta
- Contraseñas hasheadas con **pgcrypto/bcrypt**
- `search_path = public, extensions` para encontrar `crypt()` en Supabase

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|------------|-----------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (ej: `https://xxx.supabase.co`) | Sí (para BD) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase | Sí (para BD) |
| `GEMINI_API_KEY` | API key para chat AI (Gemini) | No (chat sin IA) |

**Modo demo:** Cuando no hay variables de Supabase configuradas, la app arranca en **modo demo** con usuarios predefinidos y datos locales (sin persistencia en BD).

Copia `.env.example` a `.env` y completa las variables.

## Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (puerto 3000)
npm run dev

# Build de producción
npm run build

# Tests (todos)
npx vitest run --pool=forks --fileParallelism=false

# Tests (archivo específico)
npx vitest run src/tests/useAuthStore.test.ts --pool=forks --fileParallelism=false

# Lint + typecheck
npm run lint

# Solo ESLint
npm run lint:eslint
npm run lint:fix

# Formateo
npm run format
npm run format:check
```

**Nota:** En Windows, usar `npm.cmd` o `npx.cmd` en vez de `npm`/`npx` si PowerShell no encuentra los comandos.

## Sincronización de datos

La app recibe datos desde hojas de cálculo mediante dos flujos paralelos:

### Apps Script → Supabase (`sheets-sync/transportes-sync.gs`)

- **Origen:** Google Sheets
- **Método:** Lectura de filas → upsert por `(llave, placa)`
- **Respaldo:** Ejecutable manual desde el editor de Apps Script
- **Sync:** Por lotes agrupados (evita cuota URLFetch)

### Power Automate → Supabase (`power-automate/`)

- **Origen:** Excel en SharePoint/OneDrive
- **Método:** Lectura de filas → RPC `sync_transportes`
- **Sync activo:** Programado, ejecuta periódicamente

### Reglas de sincronización

- **Clave de upsert:** `(llave, placa)` — cada llave puede tener varias placas
- **CAJAS:** El sync NO sobreescribe cajas en llaves existentes (solo en nuevas)
- **KG:** Se suma por `(llave, placa)` usando `SUM(kg) OVER PARTITION BY`
- **Columnas de portería:** Las escribe la app, no el sync

## Credenciales por defecto

| Usuario | Cédula | Clave | Rol |
|---------|--------|-------|-----|
| ADMIN | 0000000000 | Admin1234 | Admin total |
| Juan Pérez | 1000000001 | Despa1234 | Despachador |
| Ramiro Torres | 1000000002 | Porte1234 | Portero |
| Ana Gómez | 1000000003 | Plane1234 | Planeador |
| Luis Mora | 1000000004 | Super1234 | Supervisor |
| Carlos Montero | 1000000005 | Monit1234 | Monitoreo |
| Diana Ríos | 1000000006 | Trans1234 | Transportes |
| Consultor Tablero | 1000000007 | Tablero1234 | Tablero (solo lectura) |
| Consultor Informes | 1000000008 | Inform1234 | Informes (solo lectura) |

**Importante:** Estas son credenciales de demostración. Cambiar en producción.

## Estructura de datos

Tabla principal `transportes`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `llave` | text | Identificador de la llave (agrupa placas) |
| `placa` | text | Placa del vehículo |
| `fecha_hora` | timestamptz | Fecha/hora del registro |
| `cita_cargue` | text | Fecha/hora de cita de cargue |
| `transporte` | text | Número de pedido |
| `denominacion` | text | Nombre del cliente |
| `cajas` | numeric | Cantidad de cajas |
| `kg` | numeric | Peso en kilogramos |
| `destino` | text | Ciudad/destino del pedido |
| `region` | text | Región del pedido |
| `transportadora` | text | Transportadora |
| `vehiculo_tipo` | text | SENCILLO/TURBO/MINIMULA/LUV/MULA |
| `estado_transporte` | text | DESPACHADO/ALISTADO/PENDIENTE |
| `estado_porteria` | text | Pendiente → Confirmado → ... → SALIO DE PORTERIA |
| `muelle_asignado` | text | Número de muelle |
| `cuadrilla` | text | Cuadrilla asignada |
| `hora_*` | text | Timestamps de portería (6 campos) |
| `observaciones` | text | Notas libres |

## Tests

27 archivos de test, 196 tests cubriendo:

| Categoría | Archivos | Qué cubre |
|-----------|----------|-----------|
| Servicios | `servicesIntegration.test.ts` | CRUD vía RPC (.rpc mock) |
| Auth/RBAC | `rbacAuthServices.test.ts` | Roles, usuarios, seed, sesión |
| Store | `useAuthStore.test.ts`, `useLogisticsStore.test.ts` | Estado, filtros, login |
| Módulos UI | 8 archivos `*Module.test.tsx` | Render, interacción, permisos |
| Componentes | `TransporteDetailPanel.test.tsx`, `LayoutAndCommon.test.tsx` | UI componentes |
| Utilidades | `ChatWidget.test.tsx`, `HistorialView.test.tsx` | Funciones auxiliares |

**Correr tests:**
```bash
npx vitest run --pool=forks --fileParallelism=false
```

**Nota conocida:** Vitest puede fallar con timeout de workers en el primer intento; re-ejecutar el archivo específico si falla.

## Troubleshooting

### Login no funciona

1. Verificar que `supabase-migracion-seguridad-login.sql` se ejecutó completo
2. Verificar que `pgcrypto` está habilitado: `SELECT * FROM pg_extension WHERE extname = 'pgcrypto';`
3. Verificar que `crypt()` existe: `SELECT proname FROM pg_proc WHERE proname = 'crypt';`
4. Verificar search_path: las funciones deben tener `SET search_path = public, extensions`
5. Verificar rate limiting: `SELECT count(*) FROM login_attempts WHERE cedula = 'TU_CEDULA';`

### Datos no persisten

1. Verificar RLS en Supabase: debe tener políticas SELECT abiertas y writes bloqueados
2. Verificar que los RPCs existen: `SELECT proname FROM pg_proc WHERE proname LIKE 'ccl_%';`
3. Verificar que el frontend usa `.rpc()` y no `.from().insert/update/delete`

### Sync no funciona

1. Verificar que el sync usa `service_role` (no `anon`)
2. Verificar que las funciones `sync_transportes` existen en la BD
3. Verificar el log de Apps Script o Power Automate para errores
