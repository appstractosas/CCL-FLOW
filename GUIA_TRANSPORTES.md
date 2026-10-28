# Guía del módulo Transportes — CCL FLOW

## 1. Objetivo

Esta guía explica cómo usar el módulo **Transportes**: consultar la información de las llaves, verificar sus datos y corregir la **placa** cuando sea necesario.

El módulo Transportes **no programa llaves, no crea llaves, no cancela y no elimina**. Su función principal es la consulta operativa y la corrección de la placa antes de que la llave entre en operación.

La fuente de programación sigue siendo el Sheets `CONSOLIDADO` y el módulo **Planeación**. Transportes refleja esa información.

## 2. Regla de oro

1. **Transportes consulta y corrige la placa**; no reemplaza a Planeación ni al Sheets.
2. **No crear llaves ni cancelarlas desde Transportes**: para crear o cancelar, usar Planeación o el Sheets.
3. **Solo se puede editar la placa** mientras la llave esté en **Pendiente** o **Confirmado**.
4. Después de `LLEGO A PORTERIA`, la llave queda en operación y **no se edita** desde este módulo.
5. Los demás datos (OLT, cita, cliente, cajas, KG, MTS, muelle, cuadrilla, horas, observaciones) son de **solo lectura** aquí.
6. La placa editada en Transportes se guarda en la app/BD y queda protegida frente a la sincronización del Sheets. **No se envía al Sheets**.
7. Antes de guardar una placa, verificar que sea la correcta, que esté en mayúsculas y que no exista en otra fila de la misma llave.

## 3. Responsabilidades del usuario de Transportes

- Consultar las llaves y verificar que la información coincida con la operación.
- Corregir la placa cuando esté vacía o equivocada, siempre antes de que la llave avance a portería.
- Revisar el detalle de la llave antes de modificar.
- Reportar a Planeación o al administrador cualquier diferencia en OLT, cita, cliente, cajas, KG, MTS, región o estado.
- No intentar corregir desde Transportes datos que el módulo tiene bloqueados.
- Confirmar que la placa quedó guardada y que el estado cambió correctamente.

## 4. Funciones del módulo

### 4.1 Columnas de la tabla

| Columna | Qué muestra | ¿Se puede editar aquí? |
|---|---|---|
| `FECHA HORA CITA` | Fecha y hora de la cita de cargue. | No |
| `REGION` | Región del pedido. | No |
| `TIPO` | Tipo de vehículo: SENCILLO, TURBO, MINIMULA, LUV o MULA. | No |
| `PLACA` | Placa del vehículo; si no hay, muestra `-`. | **Sí** |
| `LLAVE` | Número de llave. | No |
| `MUELLE` | Muelle asignado por portería. | No |
| `CAJAS` | Total de cajas del par llave/placa. | No |
| `KG` | Peso informativo del fuente. | No |
| `MTS` | Metros informativos del fuente. | No |
| `ESTATUS` | Estado de mercancía: ALISTADO, EN PROCESO, DESPACHADO o `—`. | No |
| `ESTADO` | Estado operativo de portería. | No |
| `ACCIONES` | Botón de editar placa, si está permitido. | — |

> La tabla no muestra la OLT/transportadora ni el número de pedido. La OLT aparece en el **detalle** de la llave y el buscador sí puede encontrar pedido o cliente.

### 4.2 Buscador y filtros

- **Buscador:** busca por placa, llave, pedido, cliente o cualquier otro dato de la fila.
- **Filtro de estado:**
  - `Activas`: llaves no cerradas con cita hasta mañana; el rango de fechas no limita esta vista.
  - `Todas`: todas las llaves; el rango de fechas se aplica sobre la cita.
  - `Finalizadas`: llaves que salieron de portería; el rango se aplica sobre la hora de salida.
  - `Canceladas`: llaves canceladas; el rango se aplica sobre la cita.
- **Rango de fechas:** al entrar, está en el día de hoy.
- **Contador superior:** resume los resultados; una llave con varias placas cuenta varias filas.
- **Paginación:** se muestran 20 filas por página. Si hay más, usar los controles de página.

### 4.3 Orden de la tabla

La tabla se ordena automáticamente por **estado operativo** y, dentro del mismo estado, por **número de llave**. No hay ordenamiento manual por columna.

### 4.4 Detalle de la llave

Al hacer clic en una fila se abre el panel lateral con:

- **Encabezado:** llave, placa, OLT/transportadora, tipo de vehículo y región.
- **Detalle por transporte:** denominación, destino y cita de entrega de cada línea de la llave. Si hay más de 7 líneas, aparece scroll interno.
- **Control de Tiempos:** cita, llegada a portería, muelle, hora de asignación, ingreso a muelle, inicio y fin de cargue, cuadrilla, cajas y salida.
- **Observaciones:** visibles en solo lectura.
- **Estado y ESTATUS:** badges informativos.

En Transportes, el detalle es **informativo**: no se editan horas, muelle, cuadrilla, cajas ni observaciones. El único botón de acción es **Editar**, y solo para la placa.

## 5. Paso a paso

### 5.1 Consultar una llave

1. Entrar al módulo **Transportes**.
2. Escribir en el buscador la placa, llave, pedido o cliente.
3. Ajustar el filtro de estado y el rango de fechas si es necesario.
4. Revisar la fila: placa, llave, cita, muelle, cajas, KG, MTS, ESTATUS y ESTADO.
5. Hacer clic en la fila para ver el detalle y confirmar la OLT, la región y las líneas de la llave.

Si la llave no aparece, cambiar el filtro a `Todas` y ampliar el rango de fechas.

### 5.2 Verificar la información

Antes de editar, confirmar en el detalle:

- La OLT/transportadora es la correcta.
- La cita de cargue coincide con la operación.
- La placa es la real.
- La llave tiene las placas que debe tener.
- El estado corresponde al momento operativo.

### 5.3 Corregir la placa

1. Verificar que la llave esté en **Pendiente** o **Confirmado**.
2. Hacer clic en el icono de lápiz de la fila o en **Editar** dentro del detalle.
3. En el modal **Editar Transporte**, solo estará habilitado el campo **PLACA** (Placa Remolque).
4. Escribir la placa en mayúsculas, sin espacios.
5. Revisar que no exista otra fila con la misma llave y placa.
6. Pulsar **Guardar Placa**.
7. Verificar en la tabla que la placa quedó guardada.
8. Revisar que el estado haya cambiado:
   - Con placa asignada: **Confirmado**.
   - Sin placa: **Pendiente**.

> El botón **Cancelar** del modal solo cierra el formulario; **no cancela la llave**.

> La edición de la placa queda registrada en el historial de la app. No se puede deshacer desde Transportes; si hay un error, volver a editar la placa.

### 5.4 Asignar una placa a una llave pendiente

1. Abrir la llave en **Pendiente**.
2. Editar la placa.
3. Escribir la placa correcta.
4. Guardar.
5. Confirmar que el estado pasó a **Confirmado**.

### 5.5 Cambiar o quitar una placa

- Para cambiar la placa: editar el campo y guardar la nueva.
- Para dejar la llave sin placa: borrar el contenido del campo y guardar.
- Al quitar la placa, la llave vuelve a **Pendiente**.
- La placa editada en Transportes queda protegida: la sincronización del Sheets no la reemplaza automáticamente.
- Si la corrección también debe quedar en el Sheets, avisar a Planeación. La app no escribe en el Sheets.

### 5.6 Cuándo no se puede editar

El icono de lápiz y el botón **Editar** desaparecen cuando:

- La llave está en `LLEGO A PORTERIA`, `INGRESO A MUELLE`, `CARGANDO`, `FINALIZO CARGUE` o `SALIO DE PORTERIA`.
- La llave está en `CANCELADO`.
- El usuario no tiene permiso de edición del módulo Transportes.

En esos casos, la información se consulta, pero no se modifica desde aquí. Si se necesita un cambio operativo, contactar a Portería, Despachos o al Supervisor según corresponda.

## 6. Estados del módulo

### 6.1 ESTADO operativo

Se deriva de las horas registradas:

| Estado | Significado |
|---|---|
| `Pendiente` | Llave sin placa asignada. |
| `Confirmado` | Llave con placa asignada, aún sin llegada a portería. |
| `LLEGO A PORTERIA` | Se registró la llegada. |
| `INGRESO A MUELLE` | Se registró el ingreso al muelle. |
| `CARGANDO` | Se registró el inicio de cargue. |
| `FINALIZO CARGUE` | Se registró el fin de cargue. |
| `SALIO DE PORTERIA` | Se registró la salida. |
| `CANCELADO` | Llave cancelada; no se edita. |

### 6.2 ESTATUS de mercancía

Es un dato independiente del ESTADO operativo:

- `ALISTADO`
- `EN PROCESO`
- `DESPACHADO`
- `—` cuando no tiene valor.

En Transportes el ESTATUS es **solo lectura**. Lo administra el Supervisor.

## 7. Lo que NO se debe hacer

- Crear llaves desde Transportes.
- Cancelar o eliminar llaves desde Transportes. El botón **Cancelar** del modal solo cierra el formulario.
- Editar OLT, cita, cliente, cajas, KG, MTS, muelle, cuadrilla, horas u observaciones desde Transportes.
- Editar una llave que ya llegó a portería o que está cancelada.
- Poner una placa en minúsculas, con espacios o con caracteres incorrectos.
- Duplicar la misma llave/placa en otra fila.
- Cambiar la placa para “probar” sin confirmar la información real.
- Editar directamente en Supabase.
- Asumir que la placa editada en la app se actualizó también en el Sheets.

## 8. Errores comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No aparece el lápiz de edición | La llave ya avanzó, está cancelada o no tienes permiso | Verificar el estado; si ya está en operación, contactar al Supervisor |
| No aparece la llave | Filtro en `Activas`, fecha fuera de rango o dato mal digitado | Cambiar a `Todas`, ampliar fechas y revisar la búsqueda |
| No deja guardar la placa | Placa duplicada en la misma llave o error de conexión | Revisar duplicados y reintentar |
| La placa quedó mal | Se digitó mal o se guardó el valor equivocado | Volver a editar la placa; no borrar la fila del Sheets |
| El Sheets tiene otra placa | La placa de la app quedó protegida y el Sheets no la reemplaza | Coordinar con Planeación para dejar ambos canales alineados |
| La OLT está mal | El dato viene del Sheets y aquí es solo lectura | Reportar a Planeación |
| Las cajas no coinciden | El dato viene del fuente o fue editado en Despachos | Reportar a Despachos/Supervisor |
| El estado no cambia | La llave aún no tiene placa o no se ha registrado la hora | Revisar la placa y el módulo de portería correspondiente |

## 9. Límites del módulo

- No crea llaves.
- No cancela ni elimina llaves.
- No edita campos diferentes a la placa.
- Solo edita en **Pendiente** o **Confirmado**.
- No edita después de `LLEGO A PORTERIA`.
- No reemplaza al Sheets ni a Planeación.
- No permite editar observaciones, cajas, muelle, cuadrilla ni horas.
- No tiene ordenamiento manual por columnas.

## 10. Checklist antes de terminar

- [ ] La llave consultada es la correcta.
- [ ] La llave está en `Pendiente` o `Confirmado`.
- [ ] La placa está en mayúsculas y sin espacios.
- [ ] No existe otra fila con la misma llave y placa.
- [ ] Se guardó la placa y se verificó en la tabla.
- [ ] El estado quedó en `Confirmado` (con placa) o `Pendiente` (sin placa).
- [ ] Si la corrección debe estar también en el Sheets, se avisó a Planeación.
- [ ] Las demás diferencias quedaron reportadas al área correspondiente.

## 11. Escalamiento

Si no puedes corregir la placa o la información no coincide:

1. Verificar el estado de la llave y tus permisos.
2. Revisar si la placa está duplicada.
3. Confirmar si la llave ya ingresó a portería.
4. Reportar al administrador o Supervisor con: llave, placa actual, placa correcta y estado de la llave.
5. No intentar corregir directamente en la base de datos ni eliminar filas del Sheets.
