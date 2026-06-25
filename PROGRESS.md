# Progress Log: `@ajabadia/satellite-sdk`

Este archivo documenta los hitos históricos, decisiones técnicas y la evolución de `@ajabadia/satellite-sdk`.

## [2026-06-25] - Hitos de la Fase 9 & Estabilización de Tests (v1.0.75)

### Hitos
- **Hito 9.1 — Almacenamiento S3/R2**: Añadido soporte dinámico para proveedores de almacenamiento en `StorageService` (`uploadFile`, `getSignedUrl`, `deleteFile`) permitiendo a los tenants configurar proveedores compatibles con S3/R2 a través de conectores, con fallback dinámico.
- **Hito 9.5 — Plugin Mongoose para Cifrado PII**: Creado `encryptionPlugin` para cifrado transparente AES-256-CBC de campos identificativos en pre-save y descifrado en post-init/post-find. Aplicado a modelos clave de Gobernanza (`Tenant`, `AuditLog`, `LicenseRequest`).
- **Hito 9.4 — Middleware ABAC para APIs**: Implementado el decorador `withGuardianAccess` para Next.js que consulta dinámicamente al motor de políticas Guardian Engine central y cachea las autorizaciones en Upstash Redis (TTL 5 min).
- **Hito 9.2 — Event Bus en Redis Streams**: Diseñado un sistema ligero de mensajería asíncrona mediante comandos `XADD`/`XREAD` para flujos asíncronos y 10 eventos críticos del sistema en `SystemEventType`.
- **Resolución de Pruebas Unitarias Preexistentes**: Corregidos todos los fallos preexistentes en `tenant-resolver.test.ts` alineándolos con la nueva abstracción de conexión centralizada a través de `connectAuthDB()`.
- **Nuevas Pruebas de Integridad**: Creadas suites de pruebas para el plugin de encriptación (`encryption-plugin.test.ts`), middleware de guardian (`guardian-middleware.test.ts`), y bus de eventos (`event-bus.test.ts`).

### Decisiones de Arquitectura
- **Independencia del Conector de Base de Datos en Tests**: Adaptado el mock de Mongoose/MongoDB en las suites de testing para evitar dependencias con bases de datos en vivo y garantizar velocidad mediante espías de prototipos y mocks hoisteados correctamente.

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
