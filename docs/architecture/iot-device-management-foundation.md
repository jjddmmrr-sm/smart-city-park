# IoT Device Management — Fundación Multi-Fabricante

**Estado:** Documento de decisiones — arquitectura aprobada, cero código, cero migraciones, cero commits de implementación al momento de escribir esto.
**Rama:** `feature/iot-device-management-foundation`, creada desde `main` (incluye ya el merge de la integración Dahua, PR #3).
**PR asociado:** Fundación arquitectónica multi-fabricante del Camera Gateway. Primer paso de la evolución hacia el Centro de Administración de Dispositivos IoT de Smart City Park.

Este documento fija las decisiones ya discutidas y aprobadas antes de tocar una sola línea de código. No repite el razonamiento comparativo completo de las revisiones de arquitectura previas — esas ya están aprobadas — su función es dejar un registro ejecutable y verificable de qué se construye en este PR, qué se excluye deliberadamente, y qué queda para después.

---

## 1. Principio rector: Dahua es el primer adapter, no el núcleo

Hasta este PR, la integración Dahua y el "camera gateway" eran, en la práctica, el mismo código. `CameraIngestionService` mezclaba en una sola clase: parseo de payloads Dahua, validación de DTOs Dahua, traducción de vocabulario Dahua (`ParkingStatus`, `ParkingStallsNo`, `SnapTime`), y la lógica de negocio genérica (persistencia RAW, resolución de tenant, idempotencia, actualización de plaza, historial).

Esa fusión fue una decisión razonable mientras solo existía un fabricante — no fue un error, fue un MVP correcto para su momento. Este PR separa esas dos responsabilidades sin cambiar el comportamiento observable desde el exterior:

- **Dahua pasa a ser un adapter** — una implementación concreta de un contrato genérico (`CameraProviderAdapter`), aislada en `apps/api/src/camera-gateway/providers/dahua/`.
- **El núcleo (`core/`) queda libre de cualquier conocimiento de Dahua** — no importa DTOs, ni el normalizador, ni el controller de ningún proveedor concreto.
- Agregar un segundo fabricante en el futuro (Hikvision, Axis, Uniview, ...) significa escribir un adapter nuevo bajo `providers/<fabricante>/`, sin tocar el núcleo ni ningún archivo de Dahua.

---

## 2. Arquitectura multi-fabricante

```text
apps/api/src/camera-gateway/
  core/
    contracts/     → CameraProviderAdapter, CanonicalCameraEvent (agnósticos de fabricante)
    services/       → CameraIngestionCoreService (agnóstico de fabricante)
  providers/
    dahua/          → DahuaAdapter + DTOs + normalizer + controller (específico de Dahua)
    (futuro) hikvision/, axis/, uniview/, ...
```

Flujo de una solicitud, una vez completada la fundación (Commits 1–4 de este PR):

```text
Cámara Dahua
    │ HTTP POST (rutas sin cambios — ver §11)
    ▼
DahuaIngestionController          (providers/dahua/)
    ▼
DahuaAdapter                       (providers/dahua/)
    │ parseEvent · validate · normalize · computeIdempotencyKey
    ▼
CanonicalCameraEvent                (core/contracts/, agnóstico de fabricante)
    ▼
CameraIngestionCoreService          (core/services/)
    │ persistencia RAW, resolución de dispositivo, tenant/city/zone server-side,
    │ idempotencia, resolución de plaza, transacción de negocio
    ▼
PostgreSQL (Prisma)
```

El núcleo nunca ve un payload Dahua crudo, solo el evento canónico. Un futuro adapter Hikvision se conecta al mismo núcleo sin que el núcleo cambie una sola línea.

---

## 3. `CameraProviderAdapter` — contrato

Interfaz que cualquier fabricante debe implementar. Definida en `core/contracts/`, sin lógica de Prisma:

- `code` — identificador del proveedor (ej. `DAHUA_ITSAPI`).
- `parseEvent()` — interpreta el payload crudo del fabricante y extrae el sobre mínimo (identificador de dispositivo, tipo de evento) necesario para persistir el RAW antes de validar.
- `validate()` — validación estructural tolerante a campos no declarados, específica del formato de ese fabricante.
- `resolveDeviceIdentifier()` — extrae el identificador de dispositivo en el vocabulario propio del fabricante (para Dahua, `DeviceID`).
- `normalize()` — función pura, sin I/O, que traduce el payload validado a un `CanonicalCameraEvent`.
- `computeIdempotencyKey()` — fórmula de idempotencia específica del fabricante (para Dahua: `DeviceID|ParkingStallsNo/DetectRegionName|ParkingStatus|SnapTime`, heredada tal cual del diseño ya validado).
- `getCapabilities()` — qué tipos de evento declara soportar ese fabricante.
- `getAuthStrategy()` — estrategia de autenticación soportada (`ip_allowlist`, `digest`, ...).

El `DahuaAdapter` implementa este contrato y **no** actualiza `ParkingSpace`, no escribe historial, no resuelve tenant y no conoce la existencia de otros fabricantes — esas responsabilidades son exclusivas del núcleo.

---

## 4. `CanonicalCameraEvent` — evento agnóstico de fabricante

Reemplaza, como contrato de negocio, al tipo `CameraParkingEvent` actual (que hoy vive fusionado con Dahua en `dahua/types.ts` y no se elimina en este PR — ver §12). Campos:

- `providerCode` — qué adapter produjo el evento.
- `externalDeviceId` — identificador del dispositivo en el vocabulario del fabricante.
- `externalEventType` — tipo de evento tal como lo nombra el fabricante (`DeviceInfo`, `KeepAlive`, `ParkingInfo`, ...).
- `eventType` — tipo de evento canónico de la plataforma.
- `externalStallCode` (opcional) — código de plaza en el vocabulario del fabricante (para Dahua, `ParkingStallsNo`) — nunca el UUID interno de `ParkingSpace`.
- `parkingStatus` — estado canónico de ocupación.
- `occurredAt` — momento del evento, ya normalizado a un tipo de fecha estándar.
- `channel` (opcional).
- `plate` (opcional).
- `vehicle` (opcional).
- `evidenceMetadata` (opcional) — metadatos de imágenes/evidencia, sin decodificar contenido.
- `rawEventId` — referencia al `CameraEventRaw` de origen.
- `metadata` — bolsa de datos adicionales no normalizados (ej. IP/MAC/fabricante/modelo reportados en un handshake).
- `idempotencyKey`.

**Estados canónicos mínimos:** `OCCUPIED`, `AVAILABLE`, `ILLEGAL`, `DETECTION`, `UNKNOWN`.

Nota de traducción explícita: el código Dahua actual usa internamente el valor `FREE` (no `AVAILABLE`) para plaza libre. Esa diferencia de nombre debe quedar contenida dentro del `DahuaAdapter`/núcleo — en ningún caso debe cambiar el string literal `'available'` que hoy se escribe en `ParkingSpace.status`, verificado por el simulador.

---

## 5. `CameraIngestionCoreService` — núcleo agnóstico

Concentra exactamente la porción de `CameraIngestionService` que ya era genérica antes de este PR, sin cambio de comportamiento:

- Persistencia RAW síncrona (antes de cualquier validación).
- Resolución de dispositivo por identificador (sin conocer el nombre de campo original del fabricante).
- Derivación de `tenantId`/`cityId`/`zoneId` exclusivamente server-side — nunca del payload.
- Cálculo/uso de idempotencia (constraint único a nivel de base de datos, como ya existe).
- Resolución de plaza — en este PR, **se mantiene la búsqueda actual por `(zoneId, code)`**, sin migrar todavía a `CameraStallMapping` (ver §12).
- Creación de `CameraEvent`.
- Actualización transaccional de `ParkingSpace` + creación de `ParkingSpaceStatusHistory`.
- Estados de procesamiento `PROCESSED` / `FAILED` / duplicado idempotente.
- Logging y correlación (`rawEventId`), reutilizando `CameraGatewayLogger`, ya agnóstico de fabricante.

Restricción estructural: el núcleo no importa DTOs, normalizadores ni controllers de ningún `providers/<fabricante>/`. Se evalúa reforzar esto con una regla de lint (`no-restricted-imports`) localizada al paquete, si puede aplicarse sin afectar el resto del proyecto.

---

## 6–9. Nuevas entidades de dominio (diseño funcional; modelo Prisma en Commit 5)

Este documento fija su propósito funcional. El modelo de datos concreto, con matriz de riesgo/compatibilidad/rollback, se entrega y se aprueba aparte en el Commit 5 — nada de esto se traduce a `schema.prisma` en el Commit 1.

- **`CameraProvider`** — catálogo de fabricantes/protocolos soportados por la plataforma (ej. `DAHUA_ITSAPI`). Una fila por adapter implementado.
- **`CameraGateway`** — punto de entrada técnico concreto de un proveedor (ruta base, protocolo). Conceptualmente separado de `CameraProvider` para no requerir rediseño si un fabricante llega a necesitar más de un punto de entrada.
- **`CameraGroup`** — agrupación operativa de cámaras por criterio de negocio (sitio, lote de instalación), distinta de `ParkingZone`.
- **`CameraStallMapping`** — vínculo explícito y administrable entre el código de plaza que reporta la cámara (`externalStallCode`, en el vocabulario del fabricante) y el `ParkingSpace` real, con estados propios (`DISCOVERED`, `MAPPED`, `ACTIVE`, `DISABLED`, `CONFLICT`). Reemplaza, en un PR posterior, la dependencia implícita de que el código de plaza de la cámara coincida textualmente con `ParkingSpace.code`.

---

## 10. Configuración jerárquica

```text
Global → Provider → Gateway → Group → Camera
```

- **Global** — valores por defecto de toda la plataforma: límites de seguridad conservadores, retención de datos crudos, política de autoregistro por defecto, umbral de "cámara offline."
- **Provider** — intrínseco al fabricante/protocolo: ruta base, eventos que puede emitir, estrategia de autenticación soportada.
- **Gateway** — configuración del punto de entrada técnico específico.
- **Group** — compartido por un conjunto de cámaras por razones operativas (límite de tasa ajustado, ventana de mantenimiento, plantilla de mapeo).
- **Camera** — overrides puntuales por unidad (allowlist de IP específica, modo de autenticación reforzado, umbral de offline distinto).

El valor efectivo de cualquier parámetro es el más específico definido, subiendo por la jerarquía hasta encontrar uno. El motor de resolución (`CameraConfigResolver`) y su almacenamiento en base de datos quedan explícitamente fuera del alcance de este PR (ver §12) — hoy la configuración sigue viviendo en variables de entorno, sin cambios.

---

## 11. Compatibilidad obligatoria con lo ya implementado (no negociable en todo el PR)

- Rutas HTTP sin cambios:
  - `POST /integrations/dahua/NotificationInfo/DeviceInfo`
  - `POST /integrations/dahua/NotificationInfo/KeepAlive`
  - `POST /integrations/dahua/NotificationInfo/ParkingInfo`
- Mismos payloads aceptados, misma tolerancia a campos no declarados.
- Mismas respuestas HTTP (200 siempre que el RAW se persista; 400 solo ante JSON malformado).
- Mismo simulador (`apps/api/test/dahua/simulate.ts`) — sin modificar sus endpoints ni su contrato — debe seguir en `PASS` sin cambios en el propio simulador.
- Misma lógica observable de `DeviceInfo`, `KeepAlive`, `ParkingInfo`: mismo criterio de autoregistro, misma idempotencia, mismo mapeo de plaza por `(zoneId, code)`, mismos efectos en `ParkingSpace`/`ParkingSpaceStatusHistory`.
- `CameraEventRaw` sigue guardando el payload original íntegro.
- `tenantId`/`cityId`/`zoneId` nunca se aceptan del payload — se derivan exclusivamente server-side, sin excepción, en ningún commit de este PR.

---

## 12. Alcance y exclusiones de este PR

**Incluido:**
- Contratos `CameraProviderAdapter` / `CanonicalCameraEvent`.
- Aislamiento de Dahua como adapter (`providers/dahua/`).
- Extracción de `CameraIngestionCoreService`, agnóstico de fabricante.
- Modelo Prisma mínimo: `CameraProvider`, `CameraGateway`, `CameraGroup`, `CameraStallMapping`, extensión de `Camera` (con aprobación aparte de la migración).
- Seed de `CameraProvider(DAHUA_ITSAPI)` y vínculo de las cámaras existentes.

**Explícitamente excluido de este PR** (queda para PRs posteriores, según el roadmap ya aprobado):
- BackOffice / pantallas administrativas.
- Endpoints administrativos con JWT/RBAC (aprobar/rechazar cámara, remapear zona).
- Reemplazo real de la búsqueda `(zoneId, code)` por `CameraStallMapping` en la resolución de plaza — la tabla se crea, no se conecta al flujo todavía.
- `CameraConfigResolver` y almacenamiento de configuración en base de datos — la configuración sigue en variables de entorno.
- Guard de seguridad real (allowlist de IP, rate limiting) — los getters existentes en `CameraGatewayConfigService` siguen sin aplicarse; no es un gap introducido por este PR, ya existía antes.
- Procesamiento asíncrono / colas — el núcleo permanece 100% síncrono, igual que hoy.
- `Device` genérico, sensores, actuadores, comandos, firmware, inventario, mantenimiento preventivo, topología, estadísticas nuevas.
- Segundo fabricante real (Hikvision u otro) — este PR deja la arquitectura lista, no agrega el segundo adapter.

---

## 13. Riesgos conocidos

1. **Commit 4 (extracción del núcleo) es el de mayor riesgo real** — es donde se invierte el flujo de llamadas (`controller → adapter → core` en vez de `controller → servicio monolítico`). Mitigación: mantener el núcleo síncrono de punta a punta y validar `npm run test:dahua` inmediatamente después de ese commit, no solo al final.
2. **Rename interno `FREE` → `AVAILABLE`** en el vocabulario canónico — riesgo de fuga hacia el string persistido en `ParkingSpace.status` si no queda correctamente contenido en la capa de traducción del adapter/núcleo (§4).
3. **Cambio accidental en la fórmula de `idempotencyKey`** al moverla de `normalizer.ts` al `DahuaAdapter` — rompería específicamente el caso de duplicados que valida el simulador.
4. **`camera-ingestion.service.ts` como fachada temporal** (Commit 4) — mientras exista, hay dos caminos de código para el mismo comportamiento; debe eliminarse o consolidarse en un PR de limpieza posterior para no dejar deuda permanente.
5. **Unicidad global de `Camera.deviceId`** — el Commit 5 debe migrarla a una estrategia segura por proveedor sin perder la cámara ya sembrada (`SIMULATOR-DAHUA-0001`) ni ningún dato del piloto de hardware ya ejecutado.

---

## 14. Roadmap de los siguientes commits (este PR)

| # | Commit | Estado |
|---|---|---|
| 1 | `docs(iot): define multi-provider device management foundation` | Este commit |
| 2 | `refactor(camera-gateway): add provider adapter and canonical event contracts` | Pendiente de aprobación |
| 3 | `refactor(camera-gateway): isolate Dahua ITSAPI provider adapter` | Pendiente |
| 4 | `refactor(camera-gateway): extract provider-agnostic ingestion core` | Pendiente |
| 5 | `feat(db): add multi-provider camera management foundation` (migración `--create-only`, matriz de riesgo previa, aplicación solo con aprobación explícita) | Pendiente |
| 6 | `feat(camera-gateway): seed Dahua provider and preserve pilot compatibility` | Pendiente |

Cada commit se valida individualmente (lint + build + test de raíz y de `apps/api`) antes de avanzar al siguiente, según ya quedó acordado.

---

## 15. Decisiones diferidas para PRs posteriores

- Segundo adapter real (Hikvision u otro fabricante) como prueba de que el desacople funciona.
- `CameraConfigResolver` + configuración jerárquica administrable desde base de datos (hoy solo diseñada funcionalmente, no implementada).
- Guard de seguridad real (allowlist de IP, rate limiting) aplicando los valores ya configurables.
- Endpoints administrativos (aprobar/rechazar cámara, asignar tenant/city/zone/group, remapear) con `AuditLog`.
- Conexión real de `CameraStallMapping` al flujo de resolución de plaza (descubrimiento automático, mapeo manual, importación/exportación).
- Procesador asíncrono (`CameraEventProcessorService`) para desacoplar la latencia de ingesta de la de procesamiento.
- Health indicator (`/health/camera-gateway`) y endpoint de métricas.
- Ruta `AlarmInfo` (RAW-only) — gap funcional ya identificado contra `docs/integracion-dahua.md`.
- BackOffice de administración de dispositivos IoT (todas las pantallas y módulos ya diseñados funcionalmente en documentos previos).
- Extensión del modelo a actuadores (barreras, paneles LED, semáforos) — requiere diseño de comandos bidireccionales, fuera del alcance de la ingesta pura actual.
- Reconciliación de nomenclatura en `architecture/BACKEND_ARCHITECTURE.md`/`TARGET_ARCHITECTURE.md` (`occupancy_detections` → `ParkingSpaceStatusHistory`).

---

**Este documento no modifica código, no genera migraciones, no crea commits de implementación por sí mismo.** Fija las decisiones ya aprobadas para que los Commits 2–6 se ejecuten sin nuevas decisiones de diseño sobre la marcha.
