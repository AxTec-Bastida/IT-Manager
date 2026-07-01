# Manual De Usuario Warehouse IT Inventory

Este manual explica las herramientas diarias de Warehouse IT Inventory. Esta escrito para usuarios de IT que trabajan desde telefono, scanner o PC.

Responsable del proyecto: construido y entregado por Alejandro Bastida / AxTec Bastida. Repositorio fuente: https://github.com/AxTec-Bastida/IT-Manager

No guardes contrasenas, credenciales SMTP, llaves de recuperacion BitLocker, API keys o notas privadas en registros normales, etiquetas, tareas o recursos.

Nota de idioma: la app soporta ingles y espanol. Usa el selector de idioma en el sidebar o drawer movil. El manual en ingles se mantiene en `docs/USER-MANUAL.md`.

## 1. Navegacion Y Arranque Diario

![Navegacion general](/manual/user/01-navigation.svg)

Empieza desde:

- Inicio: estado diario y accesos rapidos.
- Escaneo: la forma mas rapida de encontrar registros y actuar.
- Inventario: activos por categoria o flujo de trabajo.
- Trabajo: tareas, recursos, PO tracker, cola offline, reportes y conflictos.

Usa el menu lateral o el drawer del telefono para herramientas mas especificas. Si una pagina pide credenciales inesperadamente, vuelve a iniciar sesion y avisa a un admin; la sesion normalmente debe mantenerse.

## 2. Escaneo

![Flujo de escaneo](/manual/user/02-quick-scan.svg)

Usa Escaneo cuando tengas:

- asset tag
- numero de serie
- barcode o QR
- ID o nombre de empleado
- codigo de stock
- ID de temporal
- alias legacy

Despues del match, revisa el resultado y elige la accion correcta: abrir activo, asignar, devolver, prestar, RMA, mover, agregar foto, entregar stock o abrir borrower.

## 3. Inventario Y Busqueda De Activos

![Flujo de inventario](/manual/user/03-inventory.svg)

Inventario no debe sentirse como un Excel crudo. Usa vistas por categoria y flujo:

- Laptops / desktops
- Dispositivos moviles
- Impresoras
- Basculas
- Scanners
- Red / activos fijos
- Asignados
- Prestados
- En RMA
- Necesita revision
- Fotos faltantes

Abre el detalle del activo para ver estado actual, fotos, etiquetas, historial de asignacion, prestamos, RMA, facturas, valor del activo y actividad.

## 4. Alta De Inventario Y Etiquetas

![Alta y etiquetas](/manual/user/04-intake-labels.svg)

Usa Intake para inventario nuevo:

- Alta de activo individual: un equipo serializado.
- Alta masiva: rangos como `J001-J100` o `Zebra-208-Zebra-250`.
- Alta de stock: consumibles y perifericos por cantidad.

Usa Etiquetas para generar QR/barcode. Por defecto las etiquetas codifican solo el asset tag. El codigo de serie es opcional y separado. Nunca codifiques secretos, datos de empleados, detalles de facturas o recovery keys.

## 5. Asignaciones, Prestamos Y Stock

![Responsabilidad](/manual/user/05-responsibility.svg)

Usa el flujo correcto:

- Asignacion: responsabilidad a largo plazo de equipo serializado.
- Prestamo de activo: checkout temporal con fecha esperada de retorno.
- Stock Issue: entrega o prestamo de articulos genericos por cantidad.
- Temporal: contratista, visitante o persona que todavia no esta en Empleados.

El historial de asignaciones, prestamos, stock y actividad debe conservarse.

## 6. RMA, Reparacion Y Mantenimiento

![Reparacion y mantenimiento](/manual/user/06-repair-maintenance.svg)

RMA / Reparacion:

- Crea un caso.
- Agrega dispositivos.
- Envia el lote.
- Recibe equipos como reparado, reemplazado, rechazado, perdido, retirado o devuelto igual.

Mantenimiento:

- Registra limpieza, supplies y servicio de impresoras.
- Registra checks y servicio de basculas.
- Usa alertas para fechas vencidas o por vencer.

La app actual no hace SNMP ni printer polling.

## 7. Fotos, Calidad De Datos Y Limpieza

![Cumplimiento](/manual/user/07-compliance.svg)

Las fotos ayudan a probar identidad y condicion del activo. Tipos recomendados:

- vista general
- etiqueta de activo
- etiqueta de serie
- condicion
- dano
- ubicacion instalada para activos fijos

Usa Calidad de datos para:

- IPs duplicadas
- campos faltantes
- nombres importados sospechosos
- stock/comment rows sospechosos
- revision de mobile/sled pairings
- fotos requeridas faltantes
- estados huerfanos de flujos

No arregles datos ambiguos automaticamente. Abre el registro, revisa y aplica solo acciones seguras.

## 8. Facturas, Partidas Y Valor Del Activo

![Facturas y valores](/manual/user/08-facturas-values.svg)

Facturas guarda registros y archivos de compra. Usa herramientas de extraccion como ayuda, pero revisa partidas antes de aplicar valores.

Usa facturas y valor del activo para:

- documentos de compra
- revision de partidas
- links a activos
- links a stock
- costo
- garantia
- depreciacion / ciclo de vida

No sobrescribas valores sin revisar.

## 9. Auditorias Fisicas Y Cola Offline

![Auditoria y offline](/manual/user/09-audits-offline.svg)

Las auditorias fisicas registran observaciones:

- activos esperados
- activos encontrados
- activos faltantes
- activos en area incorrecta
- etiquetas desconocidas
- escaneos duplicados
- necesita revision

Exports y tareas ayudan al seguimiento despues de una auditoria.

Offline Queue soporta trabajo limitado offline como scans, movimientos y cola de fotos de activos. Si el browser borra storage antes de sincronizar una foto, la app crea un conflicto y puede ser necesario tomar la foto de nuevo.

## 10. Alertas, Tareas, Jobs, Respaldos Y Admin

![Alertas y admin](/manual/user/10-alerts-admin.svg)

Alertas muestra problemas operativos:

- stock bajo
- prestamos de activos vencidos
- prestamos de stock vencidos
- seguimiento RMA
- mantenimiento de impresoras o basculas
- garantia por vencer
- advertencias de calidad de datos

Tareas son para seguimiento y responsabilidad.

Admins manejan:

- usuarios y roles
- settings
- notificaciones por email
- jobs programados
- backups
- acciones de calidad de datos
- imports
- acceso a BitLocker vault

Los backups deben incluir:

- `prisma/dev.db`
- `uploads/assets`
- `uploads/facturas`

## Notas De Entrega

Esta app es la fuente de verdad. Excel es referencia legacy salvo que un admin ejecute una importacion controlada.

Prefiere acciones seguras de ciclo de vida antes de borrar:

- devolver
- cerrar
- archivar
- desactivar
- marcar revisado
- crear tarea

Cambios futuros de codigo, nuevos flujos, ayuda de deployment, soporte de produccion o recuperacion deben manejarse como soporte/cambios pagados por el mantenedor de la app.
