Guía del Planeador — CCL YMS

1. Objetivo

Esta guía explica, paso a paso, cómo el área de **Planeación** debe programar, modificar y cancelar llaves en el Sheets y cómo verificarlas en la aplicación.

La regla central es simple: **el Sheets es la fuente de verdad**. La aplicación refleja lo que el Sheets envía.

2. Regla de oro

1. **Programar y corregir en el Sheets.
2. **Nunca eliminar filas o llaves del Sheets** para “borrar” una llave. Para eso existe `Estado mercancia = CANCELADO`.
3. **Una fila por placa**. Una llave puede tener varias placas y, por tanto, varias filas. No duplicar la misma llave/placa salvo que sean líneas reales que deban sumar cajas.
4. **La OLT debe ser la correcta en cada fila** (`Olt Inicial`).
5. **No crear datos duplicados** ni reutilizar llaves canceladas.
6. Después de guardar en el Sheets, **esperar la sincronización (máximo 5 minutos)** y verificar en la app.

## 3. Responsabilidades del Planeador

- Mantener actualizado el Sheets `CONSOLIDADO`.
- Programar las placas de las llaves nuevas.
- Cancelar llaves con `Estado mercancia = CANCELADO`.
- Verificar en el módulo **Planeación** que la información llegó correctamente.
- Reportar al administrador cualquier dato que no se refleje o que requiera corrección en la app.
- `Estado mercancía` solo acepta los valores de la lista desplegable


## 5. Cómo funciona la sincronización

1. Planeación programa o corrige en la hoja `CONSOLIDADO`. El script no lee otras pestañas del archivo.
2. El script de Google Apps Script se ejecuta **cada 5 minutos**.
3. Lee las **últimas 200 filas** de la hoja `CONSOLIDADO`.
4. Envía los datos a la app y las sube por el par **`(llave, placa)`**:
   - Si la llave/placa ya existe, actualiza.
   - Si es nueva, la crea.
   - Si la misma llave/placa aparece en varias filas, las cajas se suman.
   - `KG` y `MTS` también se totalizan por par, pero son informativos y no se editan en la app.
5. La aplicación se actualiza y muestra la información en Planeación, Transportes, Portería, etc.

5.1. La sincronización **no elimina la llave completa** al borrar una fila del Sheets.

## 6. Paso a paso

### 6.1 Programar una llave nueva

1. Abrir el Sheets `CONSOLIDADO`.
2. Ubicarse en la parte inferior de los datos (lo más nuevo va abajo).
3. Agregar **una fila por cada placa** de la llave.
4. Completar todos los datos de a llave
5. Escribir `Estado mercancia` con un valor válido (`ALISTADO` o `EN PROCESO`).
6. Guardar el Sheets.
7. Esperar hasta 5 minutos.
8. Verificar en la app, módulo **Planeación**.

### 6.2 Verificar en la app

1. Entrar a **Planeación**.
2. Buscar por llave, placa, pedido o cliente.
3. Confirmar:
   - La llave aparece una sola vez por placa.
   - La **OLT/transportadora** es la correcta.
   - La cita, placa, cajas, denominación y destino coinciden con el Sheets.
4. Si algo está mal, corregirlo en el Sheets y volver a esperar la sincronización.

### 6.3 Modificar cualquier dato

1. Buscar la fila existente en el Sheets.
2. Editar el dato en esa misma fila. **No crear una fila nueva** para corregir.
3. Guardar.
4. Esperar la sincronización.
5. Verificar en la app.

> Si el dato ya fue editado desde la app, el sistema puede protegerlo y no reemplazarlo automáticamente con el valor del Sheets. En ese caso, avisar al administrador para conciliar.

### 6.4 Asignar o cambiar la placa

1. Editar la fila de la llave en el Sheets.
2. Escribir la placa en mayúsculas, sin espacios.
3. Guardar y esperar la sincronización.
4. Verificar que la placa aparezca en la app y que el estado pase a **Confirmado**.

Si la placa aún no se conoce, dejar la celda vacía; la llave quedará en **Pendiente**.

### 6.5 Cancelar una llave

1. **No eliminar la fila ni la llave.**
2. En la columna `Estado mercancia`, escribir exactamente `CANCELADO`.
3. Si la llave tiene varias placas, escribir `CANCELADO` en **todas** sus filas.
4. Guardar.
5. Esperar la sincronización.
6. Verificar que la llave quede en estado **CANCELADO** en la app.

Reglas de cancelación:

- La llave cancelada **no se reutiliza**.
- Una llave cancelada **no se reactiva** borrando la palabra `CANCELADO`; si se necesita de nuevo, crear una llave nueva con autorización.
- Si la llave ya ingresó a portería, coordinar con Portería/Supervisor antes de cancelar.
- El botón de cancelar de la app solo está habilitado en **Pendiente** o **Confirmado**; después de `LLEGO A PORTERIA` no permite cancelar desde la app.
- El Sheets sí puede enviar `CANCELADO` aunque la llave esté en portería; por eso la coordinación previa es obligatoria.
- Aunque se cancele, la fila permanece en el Sheets para conservar el historial.
- Si se canceló por error, **no borrar la fila**: avisar al administrador.


### 6.8 Observaciones

- Las observaciones se editan en el **detalle** de la llave, en la app.
- En Planeación solo se pueden editar mientras la llave esté en **Pendiente** o **Confirmado**.
- La sincronización no borra las observaciones.

## 7. Lo que NO se debe hacer

- Eliminar filas o llaves del Sheets para “borrarlas”.
- Reutilizar una llave cancelada.
- Usar `CANCELADO` para corregir un error de digitación; solo se usa para cancelar de verdad.
- Cambiar el nombre de los encabezados.
- Combinar celdas o dejar filas vacías en medio de los datos.
- Duplicar una llave/placa sin necesidad.
- Escribir texto en columnas numéricas (`Cajas`, `KG`, `MTS`).
- Poner una OLT incorrecta o dejar la OLT vacía.



## 9. Límites de la app

- Planeación puede editar/cancelar solo llaves en **Pendiente** o **Confirmado**.
- Después de `LLEGO A PORTERIA`, la llave ya está en operación y no se edita desde Planeación.
- El **ESTATUS** (`ALISTADO`, `EN PROCESO`, `DESPACHADO`) lo administra el **Supervisor**, no Planeación.
- La app no elimina llaves: solo las marca como **CANCELADO**.
- La app no reemplaza al Sheets: la fuente es el Sheets. Si un dato fue editado manualmente en la app, el sistema puede conservar ese valor hasta conciliar.



