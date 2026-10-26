# Guía del Portero — CCL FLOW

## 1. Alcance

Esta versión solo opera vehículos de **MONDELEZ**. **IMPORTADOS** y **KENVUE** se habilitarán en una próxima versión y **no se registran aún** en la app.

## 2. Acceso y turno

- Entrar con la **cédula propia** y la **clave única de porteros** asignada por el Administrador.
- La cédula es individual; la clave es compartida **solo** por portería. No se comparte con otros roles ni se presta la sesión.
- Verificar en el menú de sesión (arriba a la derecha) que la cédula mostrada sea la propia.
- El control de errores u omisiones se hace **por turno**. El historial de la app guarda usuario, cédula, llave, acción y hora.
- **Cerrar sesión al terminar el turno.**

## 3. Tu función: dos checkbox

En **Portería**, hacer clic en la fila para abrir el detalle y usar únicamente estos dos controles:

| Checkbox | Se habilita cuando | Deja la llave en |
|---|---|---|
| `H. Llegada Portería` | El `ESTADO` es `Confirmado` (tiene placa) | `LLEGO A PORTERIA` |
| `H. Ingreso a Muelle` | La llegada ya está marcada y hay muelle asignado | `INGRESO A MUELLE` |

- El **muelle lo asigna el Supervisor**. Si `MUELLE` está en `—`, pedirlo por el **Chat Operativo** indicando llave y placa.
- Al marcar, aparece **Confirmar registro**. Pulsar **Sí** solo si el vehículo está físicamente en el sitio. La app guarda la fecha y hora actuales.
- **No se puede desmarcar.** La hora del último paso marcado se puede corregir; no se aceptan horas futuras.
- Si la llave está en `Pendiente` (sin placa), aparece un aviso y el proceso no se puede iniciar.

## 4. Paso a paso

1. Entrar a **Portería** y dejar el filtro en **Activas**.
2. Buscar por placa o llave y verificar placa, llave, cita y transportadora.
3. Confirmar que el `ESTADO` sea `Confirmado`.
4. Abrir la fila y marcar `H. Llegada Portería`; confirmar **Sí**.
5. Verificar que el `ESTADO` cambió a `LLEGO A PORTERIA`.
6. Si no hay muelle, solicitarlo por el chat.
7. Con muelle asignado y el vehículo en el muelle, marcar `H. Ingreso a Muelle`; confirmar **Sí**.
8. Verificar que el `ESTADO` cambió a `INGRESO A MUELLE`.
9. Seguir el avance por la columna `ESTADO` y atender el chat durante el turno.

> El inicio y fin de cargue son de **Despachos**; la salida es de **Monitoreo**. El portero no los marca.

## 5. Notificaciones y chat

- **Campana (barra superior):** muestra contador, banner y sonido con cada notificación nueva. **Leer todas** solo marca como leídas.
- **“Vehículo en portería”:** se registró una llegada. Si es tuya, confirma que quedó guardada.
- **“Muelle asignado”:** el Supervisor asignó muelle; ya puedes marcar el ingreso. `MUELLE CERO` no genera aviso: verificar la columna `MUELLE`.
- **Chat Operativo:** coordina muelle y novedades con Despachos y Supervisor. Se deshabilita cuando todas las llaves están en `SALIO DE PORTERIA`.
- La campana y el chat son apoyo: **la fuente de verdad es la columna `ESTADO`**.

## 6. Errores frecuentes

| Síntoma | Causa | Qué hacer |
|---|---|---|
| No aparece el checkbox de llegada | Llave `Pendiente` (sin placa) | Avisar a Planeación/Transportes o al Supervisor |
| El ingreso está deshabilitado | Falta la llegada o el muelle | Marcar la llegada o pedir el muelle por el chat |
| La llave no aparece | Filtro `Activas`, fecha o búsqueda | Cambiar a `Todas`, ampliar fechas o borrar la búsqueda |
| “No se puede registrar una hora futura” | Hora mayor a la actual | Usar la hora real del evento |
| No se pudo grabar | Falla de conexión | Avisar de inmediato y verificar; no asumir que quedó guardado |
| La sesión se cerró | Inactividad | Volver a entrar con cédula y clave |

## 7. Reglas

- No marcar antes de que el vehículo llegue o ingrese realmente.
- No prestar la sesión ni compartir la clave con otros roles.
- No asignar muelle, cajas, cuadrilla ni horas de otras áreas.
- No operar llaves `Pendientes`, `Canceladas` ni vehículos **IMPORTADOS** o **KENVUE**.
- No intentar “compensar” un error marcando otro paso: reportarlo.
- No editar directamente en la base de datos.

## 8. Checklist del turno

- [ ] Entré con mi cédula y la clave única.
- [ ] Revisé las llaves del turno en `Activas`.
- [ ] Cada llegada quedó marcada con hora real.
- [ ] Cada ingreso quedó marcado solo con muelle asignado.
- [ ] Reporté novedades y cerré sesión.

## 9. Escalamiento

Reportar por el chat al Supervisor con: **llave, placa, estado actual, hora real, cédula y turno**. Si el error ya quedó registrado, no intentar corregirlo por fuera de la app.
