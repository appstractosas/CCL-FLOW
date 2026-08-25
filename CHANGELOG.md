# Changelog

Registro cronológico de los cambios principales de CCL FLOW.

## [Unreleased]

### Seguridad
- `84cce21` fix(security): use scalar INTO variables in ccl_validate_session
- `8b06527` fix(security): resolve column ambiguity in ccl_validate_session
- `8cd1b3b` feat(security): rate limiting + password policy + session timeout 30min
- `28b8b1c` fix(security): add 'extensions' to search_path for crypt() in all SQL functions

### Documentación
- `6723aef` docs: README técnico con arquitectura, setup, y guía de desarrollo
- `9d25697` chore(tooling): ESLint 10 + Prettier 3 configuration

## [1.2.0] - 2026-08-25

### Seguridad
- `6789f9f` feat(security): RPC Guard — SECURITY DEFINER RPCs + tightened RLS
- `e276c27` feat(security): hash de contraseñas con pgcrypto (bcrypt)
- `c3f49f6` fix(security): cast p_id::uuid en ccl_update_transporte

### Features
- `1c5fcb0` feat(region): add region column to transportes, forms, and sync
- `2a2b1f7` fix(sync): kg acepta decimales y se suma por placa en ambos flujos
- `2d8c0da` feat(rbac): roles de solo lectura TABLERO e INFORMES
- `98fea7f` ui(detalle): remove filasDeLlave below KG in detail panel

## [1.1.0] - 2026-08-24

### Features
- `6712d0f` ui(rbac): modulo Roles compacto alineado con el resto de modulos
- `d993da5` fix(usuarios): crear/editar usuario muestra el error real de la BD
- `2d8c0da` feat(rbac): roles TABLERO e INFORMES con migracion de permisos

### Fixes
- `7cb35e5` fix(porteria): persistencia real de horas/estados con optimistic updates
- `7e3c3f2` fix(app): updateTransporte lanza error cuando la BD afecta 0 filas

## [1.0.0] - 2026-08-22

### Features principales
- Modelo unificado de transportes, despachos y portería
- Autenticación por RPC con sesiones en BD
- RBAC con 9 roles predefinidos y matriz de permisos
- Chat inter-módulo con Gemini AI
- Notificaciones in-app con Realtime
- Tablero aeropuerto en vivo
- Informes con exportación Excel
- Sync Google Sheets → Supabase (Apps Script)
- Sync Excel → Supabase (Power Automate)
- 196 tests cubriendo servicios, RBAC, módulos y utilidades
