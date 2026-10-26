# Guía del Monitor — CCL FLOW

## 1. Alcance

Esta versión solo opera vehículos de **MONDELEZ**. **IMPORTADOS** y **KENVUE** se habilitarán en una próxima versión y **no se registran aún** en la app: si requieren atención, se manejan por el canal del Supervisor y se deja la novedad por el chat, sin marcar el checkbox.

## 2. Acceso y turno

- Entrar con la **cédula propia** y la **clave que asigna el Administrador** a su usuario (la clave única de porteros **no** se usa en este rol).
- Verificar en el menú de sesión (arriba a la derecha) que el nombre y la cédula mostrados sean los propios.
- La app registra cada movimiento con el usuario y la cédula de la sesión abierta.
- El control de errores u omisiones se hace **por turno**: al iniciar, registrarse en el cuadro de turnos de la operación; al terminar, entregar novedades y **cerrar sesión**.
- La app no administra turnos: aporta el registro individual por cédula para cruzarlo con el turno y el historial (**ROLES → Historial**).

## 3. Tu función: un solo checkbox

En **Monitoreo**, hacer clic en la fila para abrir el detalle y usar únicamente el control `H. Salida Portería`.

| Checkbox | Se habilita cuando | Deja la llave en |
|---|---|---|
| `H. Salida Portería` | Ya están registrados llegada, ingreso, inicio y fin de cargue (estado `FINALIZO CARGUE`) | `SALIO DE PORTERIA` |

- Al marcar aparece **Confirmar registro** con la pregunta “¿Seguro que el vehículo salió de portería?”. Pulsar **Sí** solo si el vehículo está saliendo realmente del patio; la app guarda fecha y hora actuales.
- **No se puede desmarcar.** La hora del último paso marcado se puede corregir; no se aceptan horas futuras.
- Los demás pasos se ven en **solo lectura**: son de Portería y Despachos. El monitor no los marca.
- Al cerrar la llave, esta **desaparece de `Activas`**. Es lo esperado: se consulta en **`Finalizadas`**.

## 4. Paso a paso

1. Entrar a **Monitoreo** y dejar el filtro en **Activas** (vista de trabajo del turno).
2. Revisar la campana y el chat para conocer las novedades del turno anterior.
3. Ubicar las llaves en proceso por placa o llave y seguir su `ESTADO`.
4. Cuando el `ESTADO` sea `FINALIZO CARGUE`, verificar llave, placa, muelle y horas en el detalle.
5. Confirmar que el vehículo esté saliendo físicamente del patio.
6. Marcar `H. Salida Portería` y confirmar **Sí**.
7. Verificar que el checkbox quedó marcado, que hay hora y que el `ESTADO` cambió a `SALIO DE PORTERIA`.
8. Para consultarla después, cambiar el filtro a **Finalizadas** y ajustar el rango de fechas.
9. Entregar el turno con las llaves cerradas o con la novedad reportada.

> Solo se habilita el paso que sigue: si falta el fin de cargue, el checkbox permanece deshabilitado. No insistir ni pedir a otra área que marque por marcar.

## 5. Notificaciones y chat

- **Campana (barra superior):** contador de no leídas, panel con las más recientes (hasta 30), banner y sonido con cada aviso nuevo. **Leer todas** solo marca como leídas.
- **“Vehículo en portería”:** se registró una llegada; la llave entró al flujo.
- **“Muelle asignado”:** el Supervisor asignó muelle (distinto de `MUELLE CERO`, que no genera aviso).
- **La app no notifica el “fin de cargue”.** Ese cambio se ve en la columna `ESTADO` (`CARGANDO` → `FINALIZO CARGUE`) y se coordina por el chat.
- **Chat Operativo:** coordina cierres y novedades con Portería, Despachos y Supervisor. Se habilita según el permiso del rol (**CHAT** en `ROLES`) y se deshabilita cuando todas las llaves están en `SALIO DE PORTERIA`.
- Campana y chat son apoyo: **la fuente de verdad es la columna `ESTADO`**.

## 6. Errores frecuentes

| Síntoma | Causa | Qué hacer |
|---|---|---|
| El checkbox de salida está deshabilitado | Falta un paso anterior (llegada, ingreso, inicio o fin de cargue) | Revisar `ESTADO` y horas; coordinar con Despachos o Portería por el chat |
| La llave no aparece en `Activas` | Ya salió o fue cancelada | Revisar `Finalizadas` o `Canceladas` con el rango correcto |
| La llave desapareció después de marcarla | La salida cerró la llave | Es lo esperado: consultarla en `Finalizadas` |
| “No se puede registrar una hora futura” | Hora mayor a la actual | Usar la hora real del evento |
| El check quedó mal (llave u hora equivocada) | Se marcó por error o antes de tiempo | Corregir la hora si aplica y reportar de inmediato al Supervisor |
| No se pudo grabar | Falla de conexión | Avisar de inmediato y verificar; no asumir que quedó guardado |
| No hay notificación de fin de cargue | La app no genera ese aviso | Seguir el `ESTADO` y coordinar por el chat |
| El chat no aparece | El rol no tiene CHAT habilitado | Solicitar al Administrador que lo active en `ROLES` |
| La sesión se cerró | Inactividad o tiempo máximo | Volver a entrar con cédula y clave |

## 7. Reglas

- No marcar la salida antes de que el vehículo esté saliendo realmente.
- No marcar para “forzar” el cierre con el flujo anterior incompleto.
- No marcar por otra persona ni prestar la sesión; no compartir la clave.
- No asignar ni cambiar muelle, placa, cuadrilla, cajas u observaciones.
- No marcar llegada, ingreso, inicio o fin de cargue.
- No operar llaves `Canceladas` ni vehículos **IMPORTADOS** o **KENVUE**.
- No intentar “compensar” un error marcando otra llave: reportarlo.
- No editar directamente en la base de datos.

## 8. Checklist del turno

- [ ] Entré con mi propia cédula y mi clave.
- [ ] Revisé las llaves del turno en `Activas`.
- [ ] Cada salida se marcó con el vehículo saliendo y el estado `FINALIZO CARGUE`.
- [ ] Cada llave cerrada quedó en `SALIO DE PORTERIA`.
- [ ] Reporté las novedades y diferencias de placa, muelle, cuadrilla o cajas.
- [ ] Entregué el turno y cerré sesión.

## 9. Escalamiento

Reportar por el **Chat Operativo** al Supervisor con: **llave, placa, estado actual, qué paso no se puede marcar, hora real, cédula y turno**. Si el error ya quedó registrado, no intentar corregirlo por fuera de la app.
