# Progress Log: `@ajabadia/satellite-sdk`

Este archivo documenta los hitos históricos, decisiones técnicas y la evolución de `@ajabadia/satellite-sdk`.

---

## [2026-05-28] - Centralización DRY & Resiliencia de Correo (v1.0.4)

### Hitos
- **Centralización Completa de Lógica Duplicada**: Migrada la lógica duplicada de cifrado (`SecurityService`), branding (`color-utils.ts`, `css-generator.ts`), forensic hashing (`computeBlockHash`), y administrativo (`resolveTargetTenantContext`) desde las aplicaciones satélite hacia el SDK.
- **Limpieza de Inquilinos en API Routes**: Refactorizadas las rutas de consulta global de tenants en `ABDLogs`, `ABDQuiz` y `ABDAnalytics` para consumir `getGlobalModel` reduciendo redundancia.
- **Servicio Unificado de Resend**: Creado `ResendEmailService` sin dependencias externas usando `fetch` nativo para envíos de correo en microservicios.
- **Refactorización de Clientes**: Removido `resend-client.ts` de `ABDAuth` y adaptado `ABDtenantGobernance` para delegar envíos de correo al SDK.
- **Documentación Integral**: Actualizado `TECHNICAL_DOCUMENTATION.md` cubriendo la totalidad de los 12 submódulos expuestos por el SDK.

### Decisiones de Arquitectura
- **Cero Dependencias en Correo**: Decisión de usar peticiones HTTP nativas a `https://api.resend.com/emails` en lugar de instalar la biblioteca `@resend` npm para mantener el SDK ligero y evitar conflictos de runtime.
- **Conexiones Globales Cheadas**: Consolidar el acceso a bases de datos compartidas utilizando `getGlobalModel` para evitar la creación indiscriminada de conexiones Mongoose independientes.
