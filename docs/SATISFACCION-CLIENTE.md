# Satisfacción del cliente — cierre técnico

Módulo: Satisfacción del Cliente  
Estado: IMPLEMENTADO  
Migración: `20260930180000_satisfaccion_cliente`  
Base local: MIGRADA (`127.0.0.1:55433` / `infinity_ops`)  
Producción: NO MODIFICADA  
WhatsApp producción: NO HABILITADO  
Prueba E2E real: PENDIENTE DE VALIDACIÓN FUNCIONAL

La prueba con una OT real no se ejecutó en este cierre. No se declara PASS funcional.

## Alcance

Cuando una OT queda `CERRADO` + `APROBADO` en `POST /api/tickets/[id]/revision/aprobar`, y el cierre no es por justificación técnica, el sistema crea una sola encuesta. El envío usa WhatsApp solo si `WHATSAPP_ENABLED=true`. Si el envío no sale, la OT permanece cerrada y la encuesta queda pendiente de reenvío.

`EvaluacionCliente` se conserva. No es la encuesta pública.

## Datos

Tablas en PostgreSQL local, creadas por la migración ya aplicada:

- `CustomerSatisfactionSurvey` — una fila por ticket (`ticketId` único, `token` único).
- `SatisfactionFollowUp` — seguimiento de una encuesta.

No volver a aplicar esa migración en esta base. No aplicarla en producción hasta un despliegue autorizado.

## Reglas que se conservan

- El cliente responde una vez. Una segunda respuesta no cambia la primera.
- El técnico no edita ni borra calificaciones. No hay API para eliminar encuestas.
- Alerta de baja satisfacción si `ratingGeneral` es 2 o menos, o si `solucionado` es `NO`.
- CSAT = respuestas con 4 o 5 estrellas / total de respuestas × 100.
- Menos de 10 respuestas: muestra insuficiente. No es un indicador representativo.
- SMS y correo sin proveedor quedan `NOT_CONFIGURED`. No se simula un envío exitoso.

## Pantallas

- `/satisfaccion/[token]` — encuesta pública.
- `/supervisor/satisfaccion` — CSAT, respuestas, tasa, promedio, distribución, técnico, servicio y zona.
- `/supervisor/satisfaccion/alertas` — baja satisfacción y seguimiento.
- `/supervisor/satisfaccion/mensual` — comparación mensual.

## APIs

`GET /api/satisfaccion`  
`GET /api/satisfaccion/dashboard`  
`GET /api/satisfaccion/monthly`  
`GET /api/satisfaccion/alerts`  
`GET /api/satisfaccion/export`  
`GET|PATCH /api/satisfaccion/[id]`  
`POST /api/satisfaccion/[id]/resend`  
`POST /api/satisfaccion/[id]/followup`  
`PUT /api/satisfaccion/followup/[id]`  
`GET /api/satisfaccion/public/[token]`  
`POST /api/satisfaccion/public/[token]/answer`

Admin y supervisor consultan, exportan y gestionan seguimiento. El reenvío es de supervisor o admin. Cancelar una encuesta sin respuesta es de admin. El cliente entra solo con el token.

## Exportación

`formato=csv` entrega CSV. `formato=xlsx` entrega HTML que Excel abre, con nombre `.xls`. No es un libro `.xlsx`. `formato=pdf` entrega PDF. El archivo no incluye el token ni el hash de IP.

## Backup

El respaldo lógico incluye `CustomerSatisfactionSurvey` y, con ella, el token en claro. Excluirlo sin una estrategia de restauración invalidaría enlaces ya enviados. Esa decisión queda fuera de este cierre.

## Pendiente

Validación funcional con una OT de prueba en la base local: aprobación, enlace, una respuesta, CSAT, alerta y seguimiento. Sin esa corrida el módulo no se considera probado de extremo a extremo.
