# Guía de Deployment — CCL FLOW

Instrucciones paso a paso para desplegar la aplicación y la base de datos.

## Requisitos previos

- Proyecto Supabase creado (URL + anon key)
- Node.js 18+ instalado
- Acceso al SQL Editor de Supabase

## Paso 1: Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con las credenciales de tu proyecto Supabase:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
GEMINI_API_KEY=tu-api-key-opcional
```

## Paso 2: Ejecutar migraciones SQL

Ejecutar en orden en Supabase → SQL Editor → New Query → Run.

**IMPORTANTE:** Ejecutar UNA por una y verificar que no hay errores antes de continuar.

### Migración base (requerida)

| # | Archivo | Qué hace |
|---|---------|----------|
| 1 | `schema.sql` | Crea tablas base (transportes, users, roles, sessions, etc.) |
| 2 | `supabase-session-auth.sql` | Funciones de sesión: ccl_login, ccl_validate_session, ccl_logout |

### Migraciones de seguridad (requeridas)

| # | Archivo | Qué hace |
|---|---------|----------|
| 3 | `supabase-migracion-region.sql` | Agrega columna `region` a transportes |
| 4 | `supabase-migracion-rls-rpc-guard.sql` | RPC Guard: 13 funciones SECURITY DEFINER + RLS |
| 5 | `supabase-migracion-pgcrypto.sql` | pgcrypto/bcrypt + hash de contraseñas |
| 6 | `supabase-migracion-seguridad-login.sql` | Rate limiting + password policy + timeout 30min |

### Migraciones opcionales (features)

| # | Archivo | Qué hace |
|---|---------|----------|
| 7 | `supabase-migracion-roles-tablero-informes.sql` | Roles TABLERO e INFORMES |
| 8 | `supabase-migracion-notificaciones.sql` | Tabla de notificaciones |
| 9 | `supabase-migracion-chat-permisos.sql` | Permisos de chat en roles |
| 10 | `supabase-migracion-horas-porteria-datetime.sql` | Horas de portería como datetime |

### Migraciones de sync (requeridas para sync Excel/Sheets)

| # | Archivo | Qué hace |
|---|---------|----------|
| 11 | `power-automate/migracion-rpc-sync-transportes.sql` | RPC sync_transportes para Power Automate |

### Restaurar acceso (emergencia)

| Archivo | Qué hace |
|---------|----------|
| `supabase-restablecer-acceso-bd.sql` | Abre TODAS las políticas RLS (temporal, para debug) |

## Paso 3: Instalar y ejecutar la app

```bash
npm install
npm run dev
```

La app arranca en `http://localhost:3000`.

## Paso 4: Verificar login

1. Abrir la app en el navegador
2. Ingresar cédula: `0000000000`
3. Ingresar clave: `Admin1234`
4. Verificar que ingresa al tablero

### Si el login no funciona

```sql
-- 1. Verificar pgcrypto habilitado
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 2. Verificar función crypt existe
SELECT proname FROM pg_proc WHERE proname = 'crypt';

-- 3. Probar login directo
SELECT public.ccl_login('0000000000', 'Admin1234');

-- 4. Verificar search_path de las funciones
SELECT proname, proconfig FROM pg_proc WHERE proname = 'ccl_login';
-- Debe mostrar: {search_path=public,extensions}

-- 5. Limpiar rate limiting si está bloqueado
DELETE FROM public.login_attempts;
```

## Paso 5: Configurar sync (opcional)

### Google Sheets → Supabase

1. Abrir `sheets-sync/transportes-sync.gs` en el editor de Apps Script
2. Configurar ID de la hoja de cálculo
3. Ejecutar manualmente o configurar trigger

### Excel → Supabase

1. Verificar que la RPC `sync_transportes` existe en la BD
2. Configurar el flujo de Power Automate
3. Verificar `power-automate/migracion-rpc-sync-transportes.sql` fue ejecutado

## Credenciales por defecto

| Cédula | Clave | Rol |
|--------|-------|-----|
| 0000000000 | Admin1234 | ADMIN |
| 1000000001 | Despa1234 | DESPACHADOR |
| 1000000002 | Porte1234 | PORTERO |
| 1000000003 | Plane1234 | PLANEADOR |
| 1000000004 | Super1234 | SUPERVISOR |
| 1000000005 | Monit1234 | MONITOREO |
| 1000000006 | Trans1234 | TRANSPORTES |
| 1000000007 | Tablero1234 | TABLERO |
| 1000000008 | Inform1234 | INFORMES |

**Importante:** Cambiar estas credenciales en producción.

## Orden de ejecución SQL (resumen)

```
schema.sql
  → supabase-session-auth.sql
    → supabase-migracion-region.sql
      → supabase-migracion-rls-rpc-guard.sql
        → supabase-migracion-pgcrypto.sql
          → supabase-migracion-seguridad-login.sql
            → (migraciones opcionales)
              → migracion-rpc-sync-transportes.sql
```
