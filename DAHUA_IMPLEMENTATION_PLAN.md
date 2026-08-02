# DAHUA_IMPLEMENTATION_PLAN

**Estado:** Documento definitivo de implementación — arquitectura congelada, cero código, cero dependencias, cero migraciones, cero commits.
**Rama:** `feature/dahua-camera-integration`
**Fuentes revisadas para este documento:**

- `smart-city-park` — `schema.prisma`, `apps/api/src/{parking,auth,frontend,health,audit}`, `apps/api/src/main.ts`, `apps/api/package.json`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `architecture/{TARGET,BACKEND,CURRENT,DATABASE}_ARCHITECTURE.md`, `roadmap/IMPLEMENTATION_ROADMAP.md` (Epic 9 y Epic 10), `DATABASE_GOVERNANCE_REPORT.md`.
- `smartpark-dahua-reference` — los 6 documentos en `docs/*.md` (contexto, arquitectura, integración Dahua, decisiones técnicas, payloads reales, plan de trabajo) y su código fuente ya auditado.
- `DAHUA_INTEGRATION_AUDIT_V1` (artefacto `2ee2fc82-…`) — secciones A–P completas.
- `DAHUA_INTEGRATION_AUDIT_V2` (artefacto `2ee2fc82-…` sucesor, guardado en scratchpad de esta sesión) — secciones 01–16, incluida la validación contra el documento técnico oficial de Dahua aportado por el negocio.

Este documento **no repite** el razonamiento comparativo de las auditorías (por qué se descartó cada opción, qué se reutiliza del reference, etc.) salvo cuando es necesario para justificar una decisión final. Su función es distinta: fijar **una** decisión por cada punto abierto, en formato ejecutable, para que la implementación no requiera nuevas decisiones de diseño sobre la marcha.

---

## 0. Decisiones que este documento cierra (antes abiertas en V1/V2)

Estas son las únicas divergencias de este plan respecto a lo ya auditado — todas justificadas por el estado real del código de `smart-city-park`, no por preferencia:

| Punto abierto en V1/V2 | Decisión final | Motivo |
|---|---|---|
| ¿Zod o class-validator para los DTOs? | **class-validator + class-transformer**, no Zod | `apps/api/package.json` no tiene Zod instalado; el 100% del backend actual usa `class-validator`/`class-transformer`/Swagger. Introducir Zod sería una dependencia nueva no justificada — viola `AGENTS.md` ("avoid unnecessary dependencies"). La tolerancia a campos nuevos (`.passthrough()` en Zod) se replica invocando `class-validator` manualmente en el servicio, no vía el `ValidationPipe` global. |
| ¿Cómo tolerar campos no declarados si el `ValidationPipe` global usa `whitelist:true, forbidNonWhitelisted:true`? | La ruta de **ingesta de cámara nunca pasa por el `ValidationPipe` global** — ver §7. | El pipe global (`main.ts:34-40`) rechazaría cualquier payload con un campo nuevo de firmware, contradiciendo el requisito explícito de tolerancia de ambas auditorías. |
| ¿CIDR real con librería o propia? | Utilidad propia `ip-cidr.util.ts` (~30 líneas, solo IPv4) | Evita una dependencia nueva para una necesidad acotada; ya se identificó como bug real del reference que compara IP exacta como string — con esto se corrige sin agregar paquete. |
| ¿Rate limiting con `@nestjs/throttler` o propio? | Limitador propio en memoria dentro del guard, documentado como no apto para múltiples instancias | Evita una dependencia nueva para el volumen de piloto (pocas cámaras). Si el módulo escala horizontalmente, migrar a Redis — v2, no ahora. |
| ¿Cómo exponer health/métricas? | `@nestjs/terminus` (ya está en `package.json`, nunca usado) + endpoint JSON propio para métricas | Cero dependencias nuevas: se activa algo ya instalado en vez de sumar Prometheus ahora. |
| Almacenamiento de imágenes | **Requiere una dependencia nueva** (cliente S3, p. ej. `@aws-sdk/client-s3`, compatible con DigitalOcean Spaces) | No hay cliente de storage instalado hoy. Es la única pieza de este plan que necesita aprobación de dependencia aparte — commit 7, aislado del resto. |
| `Camera.imageUrl` (campo actual) | Se elimina en la misma migración que crea `CameraSnapshot` | `Camera`/`CameraEvent` están al 0% de implementación (confirmado por V1 §A) — no hay flujo real que dependa de ese campo. Verificación de 0 filas en `camera_events` es un paso obligatorio previo al `DROP` (commit 1). |
| Resolución de `ParkingStallsNo` → `ParkingSpace` cuando hay zonas ambiguas | `Camera.zoneId` es **obligatorio en la práctica** para el piloto; el mapeo se hace por `(zoneId, code)`, que ya es `@@unique` en `ParkingSpace` | `ParkingSpace.code` solo es único dentro de `zoneId`, no dentro de `cityId` — sin zona fija por cámara, `"A004"` podría ser ambiguo entre zonas de la misma ciudad. |
| Digest HTTP | Se deja el **campo y el punto de extensión** en el guard (`Camera.authMode`), pero **no se implementa el HMAC/nonce completo en el roadmap inicial** | La propia fuente oficial confirma que Digest permanece opcional mientras la cámara tenga la autenticación ITSAPI desactivada (caso real de piloto); y V2 ya advierte que `qop=auth` no protege integridad de payload, por lo que no es la defensa principal. Implementarlo completo ahora sería esfuerzo sin beneficio de seguridad proporcional — se prioriza allowlist CIDR + red cerrada. |
| Prefijo de rutas de ingesta | **Fuera de** `api/v1` — montadas en `/integrations/dahua/NotificationInfo/*` | El firmware Dahua solo permite configurar la URL base del servidor ITSAPI; los sufijos (`/NotificationInfo/ParkingInfo`, etc.) son fijos y no versionables como el resto de la API REST administrativa. |

---

## 1. Arquitectura final

**Opción A confirmada** (única compatible con el requisito de negocio explícito y con el estado real de la infraestructura): módulo nuevo `apps/api/src/camera-gateway`, dentro del monolito modular existente, diseñado como carpeta autocontenida desde el día uno para que una extracción futura a `apps/camera-gateway` (Opción B, v2) sea mecánica.

```text
apps/api/src/camera-gateway/
  camera-gateway.module.ts
  dahua/
    dahua-ingestion.controller.ts     # sin JWT — cámara → gateway
    dto/
      device-info.dto.ts
      keep-alive.dto.ts
      parking-info.dto.ts
      generic-event.dto.ts            # TimedParkingSpaceInfo/AlarmInfo/TollgateInfo (RAW-only)
    normalizer.ts                     # Dahua → CameraParkingEvent
    types.ts                          # CameraParkingEvent, tipos internos
  security/
    camera-request.guard.ts           # allowlist CIDR + DeviceID + rate limit + body size
    ip-cidr.util.ts
    rate-limiter.util.ts
    digest.util.ts                    # HMAC/nonce — implementado, no activado por defecto
  camera-ingestion.service.ts         # RAW-first + idempotencia + respuesta rápida
  camera-event-processor.service.ts   # async: plaza + historial + alertas + sesión
  storage/
    image-storage.service.ts          # decode + upload S3-compatible
  admin/
    camera-admin.controller.ts        # JWT + RBAC
    camera-admin.service.ts
    dto/
      approve-camera.dto.ts
      remap-camera.dto.ts
      list-events-query.dto.ts
  health/
    camera-health.indicator.ts        # se registra en HealthModule existente
  jobs/
    purge-raw-events.job.ts
  **/*.spec.ts
```

Capas y responsabilidad de cada una (equivalente conceptual de `arquitectura.md` del reference, reescrito para NestJS):

```text
Cámara Dahua
    │  HTTP POST, sin JWT
    ▼
DahuaIngestionController          (dahua/dahua-ingestion.controller.ts)
    │  guard: CameraRequestGuard  (security/camera-request.guard.ts)
    ▼
CameraIngestionService            (camera-ingestion.service.ts)
    │  1. persiste CameraEventRaw (síncrono, antes de validar)
    │  2. valida con class-validator (tolerante a campos extra)
    │  3. resuelve tenant/city/camera por deviceId
    │  4. normaliza → CameraParkingEvent (dahua/normalizer.ts)
    │  5. calcula idempotencyKey
    │  6. responde 200 a la cámara
    ▼  (async, fuera del ciclo de request)
CameraEventProcessorService       (camera-event-processor.service.ts)
    │  mapea ParkingStallsNo→ParkingSpace, transacción de estado+historial,
    │  evalúa ParkingSession activa, genera Alert si corresponde
    ▼
ImageStorageService               (storage/image-storage.service.ts)
    │  decodifica Base64, sube a storage S3-compatible, crea CameraSnapshot
    ▼
PostgreSQL (Prisma) → CameraAdminController (JWT+RBAC) → Backoffice/Dashboard
```

"Gateway" es un módulo interno, no un salto de red — coherente con la decisión de la Opción A en ambas auditorías. El patrón de desacoplamiento (Opción D: outbox → broker real) queda incorporado desde el diseño vía el estado `PENDING/PROCESSED/FAILED` en `CameraEventRaw`, sin infraestructura de colas adicional para el piloto.

---

## 2. Flujo definitivo

1. **Handshake** — cámara envía `POST /integrations/dahua/NotificationInfo/DeviceInfo`. El `CameraRequestGuard` permite el handshake incluso de un `deviceId` desconocido, solo si `DAHUA_PILOT_AUTOREGISTER_ENABLED=true`.
2. **Registro condicionado** — si el `deviceId` no existe y el auto-registro está activo, se crea `Camera` con `registrationStatus=pending_review`, `tenantId`/`cityId`/`zoneId` **nulos**. Nunca se asigna tenant automáticamente.
3. **Validación de origen** — en toda request subsecuente (`KeepAlive`, `ParkingInfo`, etc.): IP dentro del allowlist CIDR configurado **y** (`Camera` existe y `status=active`, o es el handshake de `DeviceInfo`).
4. **Latido** — `KeepAlive` actualiza `Camera.lastSeenAt`. Se acepta con 200 incluso de dispositivos desconocidos (no se bloquea el latido), pero no crea `Camera`.
5. **Captura RAW** — `ParkingInfo`/`TimedParkingSpaceInfo`/`AlarmInfo`/`TollgateInfo`: el body se lee **una sola vez**, se persiste íntegro en `CameraEventRaw` (incluye Base64 temporal) **antes de cualquier validación**.
6. **Validación estructural** — `class-validator` sobre el payload capturado, tolerante a campos no declarados (ver §7). Un fallo de validación no impide que el RAW ya persistido quede registrado.
7. **Resolución de tenant/cámara** — exclusivamente por `Camera.deviceId` contra la base de datos. Si no resuelve (cámara inexistente, no aprobada, o `status≠active`), el evento queda en `CameraEventRaw` con `validationStatus=UNRESOLVED_DEVICE` y se genera una `Alert` de tipo `UNRESOLVED_DEVICE` — nunca se infiere tenant del payload.
8. **Normalización** — solo para `ParkingInfo`: función pura Dahua → `CameraParkingEvent` (§3). `TimedParkingSpaceInfo`/`AlarmInfo`/`TollgateInfo` quedan en ingesta RAW pura (`camera.event.unclassified`), sin normalización de negocio, según la reclasificación oficial de V2.
9. **Cálculo de idempotencia** — ver §10.
10. **Respuesta rápida** — 200 a la cámara **antes** de que termine el procesamiento de negocio. SLA objetivo: <300 ms, medido desde la recepción del body hasta el envío de la respuesta (excluye subida de imágenes).
11. **Procesamiento asíncrono** (`CameraEventProcessorService`, disparado tras el commit de la transacción de ingesta, no bloqueante para la cámara):
    - Si `ParkingStatus=7` → crea `Alert(type=ILLEGAL_AREA)`, **ninguna** `ParkingSpace` se toca.
    - En caso contrario → resuelve `ParkingSpace` por `(Camera.zoneId, ParkingStallsNo)`; si no existe, el evento queda `NEEDS_MAPPING` y se genera `Alert(type=UNMAPPED_SPACE)`.
    - Transacción única: `ParkingSpace.status` + `ParkingSpaceStatusHistory` + evaluación de `ParkingSession` activa (si `OCCUPIED` y no hay sesión activa pagada → `Alert(type=UNPAID_OCCUPANCY)`).
12. **Imágenes** — decodificación y subida asíncrona, desacoplada de la respuesta a la cámara (§12).
13. **Auditoría y logs** — acciones administrativas → `AuditLog` (ya existente). Ingesta técnica → `CameraEventRaw` + logs estructurados (§8).
14. **Errores y reintentos** — 200 siempre que el RAW quedó persistido, incluso si la normalización o el mapeo fallan después (comportamiento de reintento del firmware no está documentado; se evita provocar reintentos indefinidos). 400 solo ante un fallo de validación Zod-equivalente estructuralmente irrecuperable (JSON malformado), y aun así el RAW ya quedó guardado. El procesador asíncrono reintenta con backoff exponencial acotado (5 intentos) antes de marcar `FAILED`.
15. **Consumo** — backoffice/dashboard consultan vía `CameraAdminController`, ya protegido con `JwtAuthGuard`/`RolesGuard`. La actualización en vivo del dashboard depende de Epic 9 (Realtime/WebSockets), **no implementado hoy** — este módulo no la bloquea ni la asume; el frontend seguirá consultando por polling hasta que Epic 9 exista.

Nota operativa de hardware (confirmada en `docs/integracion-dahua.md`): la cámara requiere **Modo de compatibilidad** del protocolo privado (`Red → Seguridad → Modo de autenticación`) para emitir `ParkingInfo`; en modo de seguridad estándar solo se observan `DeviceInfo`/`KeepAlive`. Latencias reales observadas: ocupación ≈7s, liberación ≈20s tras el evento físico — las notificaciones no son instantáneas, y ningún timeout del gateway debe asumir menos.

---

## 3. Modelo de dominio final

### Camera — modelo único, sin `Device` separado

Toda la evidencia real usa `Channel: 0`. Separar `Device` de `Camera` sin evidencia de multi-canal real sería complejidad prematura (`AGENTS.md`: *"avoid unnecessary dependencies and abstractions"*). Se mantiene `Camera` único, con `channel` agregado para no requerir migración disruptiva si aparece evidencia futura de multi-canal.

`Camera.zoneId` es **obligatorio en la práctica** (nullable en el schema solo durante `pending_review`, pero un `Camera` no puede pasar a `status=active` sin `zoneId` asignado) — es la única forma de resolver `ParkingStallsNo → ParkingSpace` sin ambigüedad, dado que `ParkingSpace.code` es único por `zoneId`, no por `cityId`.

### CameraEventRaw — nuevo

Registro de verdad de toda ingesta, resuelto o no. `tenantId`/`cameraId` nulos son un estado válido (dispositivo no resuelto).

### CameraEvent — extendido

Se agrega `parkingSpaceId` (nullable — null si es `ILLEGAL_AREA` o `NEEDS_MAPPING`), `detectionScope`, `idempotencyKey` (`@unique`), `rawEventId` (FK a `CameraEventRaw`). Se **elimina** `imageUrl` (ver §0 y §4).

### CameraSnapshot — nuevo (reemplaza `imageUrl`)

Un evento real puede traer hasta 5 imágenes (`NormalPic`, `VehiclePic`, `CutoutPic`, `CombinPic[]`, `Plate.Content`) — un campo único no alcanza. Relación 1:N con `CameraEvent`.

### ParkingSpaceStatusHistory — nuevo

Historial de transiciones de estado de plaza, con `source` para distinguir origen (`CAMERA | CONTROLLER | SESSION | MANUAL`) — reconcilia el rol de "occupancy detections" mencionado en `BACKEND_ARCHITECTURE.md` sin crear una tabla redundante: `CameraEvent` es el evento de detección; `ParkingSpaceStatusHistory` es el efecto sobre la plaza. `BACKEND_ARCHITECTURE.md` se actualiza en el commit de documentación (§commits, #12) para usar esta nomenclatura real en vez de `occupancy_detections`.

### Alert — nuevo

Tabla propia, no reutiliza `AuditLog` (ciclo de vida `OPEN → ACKNOWLEDGED → CLOSED` vs. registro inmutable de auditoría). Tipos: `ILLEGAL_AREA | UNRESOLVED_DEVICE | UNMAPPED_SPACE | UNPAID_OCCUPANCY | CAMERA_OFFLINE`.

### Contrato interno — `CameraParkingEvent`

```ts
// apps/api/src/camera-gateway/dahua/types.ts
export interface CameraParkingEvent {
  source: 'DAHUA_ITSAPI';
  tenantId: string;               // derivado de Camera.deviceId, nunca del payload
  cityId: string;                  // ídem
  cameraId: string;                // id interno de Camera
  deviceId: string;                // DeviceID físico Dahua
  detectionScope: 'PARKING_SPACE' | 'ILLEGAL_AREA';
  parkingSpaceCode?: string;       // ParkingStallsNo — ausente si es área ilegal
  occupancyStatus?: 'OCCUPIED' | 'FREE' | 'UNKNOWN' | 'ILLEGAL' | 'DETECTION';
  illegalAreaName?: string;        // DetectRegionName — solo si detectionScope=ILLEGAL_AREA
  detectedAt?: string;             // SnapTime — puede faltar
  plate?: { exists: boolean; number?: string; confidence?: number; color?: string; region?: string };
  vehicle?: { type?: string; color?: string; brand?: string };
  images?: Array<{ kind: 'PANORAMIC' | 'VEHICLE' | 'PLATE' | 'COMBINED'; width?: number; height?: number; contentBase64?: string }>;
  idempotencyKey: string;
  rawEventId: string;
  channel?: number;
  timezoneOffset?: number;
  allowedUser?: boolean;
  entryRecordId?: string;
}
```

Nombres de evento del outbox (para logs/métricas, no colas reales todavía): `camera.parking.occupancy.updated`, `camera.parking.illegal.detected`, `camera.device.registered`, `camera.device.heartbeat`, `camera.event.unclassified`.

### Mapa de estados `ParkingStatus` (confirmado contra hardware real)

| Valor | Significado | Efecto |
|---|---|---|
| 0 | OCUPADA | Actualiza plaza a `occupied` |
| 1 | LIBRE | Actualiza plaza a `available` |
| 2 | DESCONOCIDA | Registra evento, no cambia plaza sin confirmación adicional |
| 3 | ILEGAL (genérico) | Trata como `ILLEGAL_AREA` si no hay `ParkingStallsNo` |
| 4 | DETECCIÓN | Registra evento, informativo |
| 7 | ILEGAL en área configurada | `Alert(ILLEGAL_AREA)`, nunca toca `ParkingSpace` |

---

## 4. Modelo Prisma definitivo

Bloques finales, listos para convertirse en migración en el commit 1. `Camera`/`CameraEvent` se muestran como diff sobre lo existente; el resto son modelos nuevos.

```prisma
model Camera {
  id        String   @id @default(uuid())
  tenantId  String?                          // nullable: pending_review sin tenant
  cityId    String?
  zoneId    String?
  code      String?                          // código operativo interno — se asigna al aprobar
  name      String?
  location  String?
  latitude  Float?
  longitude Float?
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // --- nuevos campos ---
  deviceId           String    @unique        // DeviceID físico Dahua
  channel             Int       @default(0)
  manufacturer         String?
  model                String?
  firmwareVersion      String?
  ipAddress            String?
  macAddress           String?
  lastSeenAt           DateTime?
  registrationStatus   String    @default("pending_review") // pending_review | active | rejected | disabled
  authMode             String    @default("ip_allowlist")   // ip_allowlist | digest | mtls

  tenant Tenant?       @relation(fields: [tenantId], references: [id])
  city   City?         @relation(fields: [cityId], references: [id])
  zone   ParkingZone?  @relation(fields: [zoneId], references: [id])
  events CameraEvent[]
  rawEvents CameraEventRaw[]

  @@index([tenantId])
  @@index([tenantId, cityId])
  @@map("cameras")
}

model CameraEvent {
  id          String   @id @default(uuid())
  tenantId    String
  cityId      String
  cameraId    String
  plateNumber String?
  eventType   String
  confidence  Float?
  metadata    Json?
  occurredAt  DateTime @default(now())
  createdAt   DateTime @default(now())

  // --- nuevos campos ---
  parkingSpaceId  String?
  detectionScope  String            // PLAZA | AREA_ILEGAL
  idempotencyKey  String   @unique
  rawEventId      String

  tenant       Tenant          @relation(fields: [tenantId], references: [id])
  city         City            @relation(fields: [cityId], references: [id])
  camera       Camera          @relation(fields: [cameraId], references: [id])
  parkingSpace ParkingSpace?   @relation(fields: [parkingSpaceId], references: [id])
  rawEvent     CameraEventRaw  @relation(fields: [rawEventId], references: [id])
  snapshots    CameraSnapshot[]

  @@index([tenantId, cityId, occurredAt])
  @@index([parkingSpaceId])
  @@map("camera_events")
}

model CameraEventRaw {
  id                String    @id @default(uuid())
  tenantId          String?
  cameraId          String?
  deviceIdRaw       String
  eventType         String    // DeviceInfo | KeepAlive | ParkingInfo | TimedParkingSpaceInfo | AlarmInfo | TollgateInfo
  payload           Json
  contextIp         String
  contextHeaders    Json
  receivedAt        DateTime  @default(now())
  validationStatus  String    // VALID | INVALID | UNRESOLVED_DEVICE
  processingStatus  String    @default("PENDING") // PENDING | PROCESSED | FAILED
  processedAt       DateTime?
  error             String?

  tenant Tenant? @relation(fields: [tenantId], references: [id])
  camera Camera? @relation(fields: [cameraId], references: [id])

  @@index([processingStatus, receivedAt])
  @@index([tenantId])
  @@map("camera_events_raw")
}

model CameraSnapshot {
  id            String   @id @default(uuid())
  tenantId      String
  cameraEventId String
  kind          String   // PANORAMIC | VEHICLE | PLATE | COMBINED
  storageUrl    String?
  width         Int?
  height        Int?
  contentType   String   @default("image/jpeg")
  capturedAt    DateTime @default(now())

  cameraEvent CameraEvent @relation(fields: [cameraEventId], references: [id])

  @@index([cameraEventId])
  @@index([tenantId])
  @@map("camera_snapshots")
}

model ParkingSpaceStatusHistory {
  id             String   @id @default(uuid())
  tenantId       String
  cityId         String
  spaceId        String
  previousStatus String
  newStatus      String
  source         String   // CAMERA | CONTROLLER | SESSION | MANUAL
  sourceEventId  String?
  changedAt      DateTime @default(now())

  tenant Tenant       @relation(fields: [tenantId], references: [id])
  city   City         @relation(fields: [cityId], references: [id])
  space  ParkingSpace @relation(fields: [spaceId], references: [id])

  @@index([spaceId, changedAt])
  @@index([tenantId])
  @@map("parking_space_status_history")
}

model Alert {
  id             String   @id @default(uuid())
  tenantId       String
  cityId         String
  type           String   // ILLEGAL_AREA | UNRESOLVED_DEVICE | UNMAPPED_SPACE | UNPAID_OCCUPANCY | CAMERA_OFFLINE
  cameraId       String?
  parkingSpaceId String?
  status         String   @default("OPEN") // OPEN | ACKNOWLEDGED | CLOSED
  payload        Json
  createdAt      DateTime @default(now())
  acknowledgedAt DateTime?
  closedAt       DateTime?

  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  city         City          @relation(fields: [cityId], references: [id])
  camera       Camera?       @relation(fields: [cameraId], references: [id])
  parkingSpace ParkingSpace? @relation(fields: [parkingSpaceId], references: [id])

  @@index([tenantId, status])
  @@map("alerts")
}
```

Cambios de relación necesarios en modelos existentes: `Tenant`, `City`, `ParkingSpace` deben agregar los arrays inversos (`cameraEventsRaw`, `parkingSpaceStatusHistory`, `alerts`, `cameraSnapshots` vía `Tenant`) — mecánicos, se generan junto con el resto en el commit 1.

**Pre-flight obligatorio antes de escribir la migración real (commit 1):** confirmar `SELECT count(*) FROM camera_events` = 0 antes de emitir el `DROP COLUMN "imageUrl"`. Si no es 0, este plan requiere revisión antes de proceder (no asumir).

---

## 5. Endpoints definitivos

### Ingesta (sin JWT, guard propio, fuera de `api/v1`)

| Método | Ruta | Rol |
|---|---|---|
| POST | `/integrations/dahua/NotificationInfo/DeviceInfo` | Handshake / auto-registro condicionado |
| POST | `/integrations/dahua/NotificationInfo/KeepAlive` | Latido — actualiza `lastSeenAt` |
| POST | `/integrations/dahua/NotificationInfo/ParkingInfo` | Evento de ocupación — único con normalización de negocio |
| POST | `/integrations/dahua/NotificationInfo/TimedParkingSpaceInfo` | RAW-only (exploratorio, sin lógica de negocio — §0) |
| POST | `/integrations/dahua/NotificationInfo/AlarmInfo` | RAW-only |
| POST | `/integrations/dahua/NotificationInfo/TollgateInfo` | RAW-only |

Todas responden `200` mientras el RAW se persista; `400` únicamente ante JSON malformado.

### Administración (`/api/v1/camera-gateway/*`, `JwtAuthGuard` + `RolesGuard`)

| Método | Ruta | Roles | Función |
|---|---|---|---|
| GET | `/camera-gateway/cameras` | SUPER_ADMIN, ADMIN, OPERADOR | Listar cámaras (filtro por `status`, `registrationStatus`) |
| GET | `/camera-gateway/cameras/:id` | SUPER_ADMIN, ADMIN, OPERADOR | Detalle de cámara |
| PATCH | `/camera-gateway/cameras/:id/approve` | SUPER_ADMIN, ADMIN | Asigna `tenantId`/`cityId`/`zoneId`, pasa a `active` |
| PATCH | `/camera-gateway/cameras/:id/reject` | SUPER_ADMIN, ADMIN | Pasa a `rejected` |
| PATCH | `/camera-gateway/cameras/:id/remap-zone` | SUPER_ADMIN, ADMIN | Reasigna `zoneId` (fuerza recomprobación de mapeo de plazas) |
| GET | `/camera-gateway/events` | SUPER_ADMIN, ADMIN, OPERADOR | Lista `CameraEvent` (filtros: cámara, rango de fecha, `detectionScope`) |
| GET | `/camera-gateway/events/:id` | SUPER_ADMIN, ADMIN, OPERADOR | Detalle + snapshots |
| GET | `/camera-gateway/raw-events` | SUPER_ADMIN, ADMIN | Cola RAW (filtro por `processingStatus`) — soporte operativo |
| GET | `/camera-gateway/alerts` | SUPER_ADMIN, ADMIN, OPERADOR | Bandeja de alertas (filtro por `status`, `type`) |
| PATCH | `/camera-gateway/alerts/:id/acknowledge` | SUPER_ADMIN, ADMIN, OPERADOR | Marca `ACKNOWLEDGED` |
| PATCH | `/camera-gateway/alerts/:id/close` | SUPER_ADMIN, ADMIN | Marca `CLOSED` |
| GET | `/camera-gateway/metrics` | SUPER_ADMIN, ADMIN | Contadores en memoria (§14) |

Todas las acciones administrativas de escritura (`approve`, `reject`, `remap-zone`, `acknowledge`, `close`) generan una entrada en `AuditLog` reutilizando el patrón ya existente en `frontend.service.ts`/`parking.service.ts`.

### Health (`/api/v1/health/*`, ya existente — se extiende)

| Método | Ruta | Función |
|---|---|---|
| GET | `/health/camera-gateway` | Indicador Terminus: cámaras offline + backlog de `CameraEventRaw` PENDING |

---

## 6. DTOs

Todos en `camera-gateway/**/dto/*.ts`, `class-validator` + `@ApiProperty`, siguiendo exactamente el patrón de `apps/api/src/parking/dto/create-vehicle.dto.ts`.

```ts
// dahua/dto/device-info.dto.ts
export class DeviceInfoDto {
  @IsString() DeviceID: string;
  @IsOptional() @IsString() DeviceModel?: string;
  @IsOptional() @IsString() DeviceName?: string;
  @IsOptional() @IsString() DeviceType?: string;
  @IsOptional() @IsString() IPAddress?: string;
  @IsOptional() @IsString() MACAddress?: string;
  @IsOptional() @IsString() Manufacturer?: string;
}

// dahua/dto/parking-info.dto.ts
class PlateDto {
  @IsBoolean() IsExist: boolean;
  @IsOptional() @IsString() PlateNumber?: string;
  @IsOptional() @IsNumber() Confidence?: number;
  @IsOptional() @IsString() PlateColor?: string;
  @IsOptional() @IsString() Region?: string;
  @IsOptional() @IsArray() BoundingBox?: number[];
}
class VehicleDto {
  @IsOptional() @IsString() VehicleSeries?: string;
  @IsOptional() @IsArray() VehicleBoundingBox?: number[];
}
class PictureBlockDto {
  @IsOptional() @IsString() Content?: string;   // Base64 — nunca se loguea
  @IsOptional() @IsNumber() Width?: number;
  @IsOptional() @IsNumber() Height?: number;
  @IsOptional() @IsString() PicName?: string;
}
class ParkingInfoBlockDto {
  @IsString() DeviceID: string;
  @IsOptional() @IsString() ParkingStallsNo?: string;
  @IsNumber() ParkingStatus: number;
  @IsOptional() @IsString() DetectRegionName?: string;
  @IsOptional() @IsString() SnapTime?: string;
  @IsOptional() @IsNumber() Channel?: number;
  @IsOptional() @IsNumber() TimeZone?: number;
  @IsOptional() @IsBoolean() AllowUser?: boolean;
  @IsOptional() @IsString() inRecordId?: string;
}
export class ParkingInfoDto {
  @ValidateNested() @Type(() => Object) Picture: {
    ParkingInfo: ParkingInfoBlockDto;
    NormalPic?: PictureBlockDto;
    VehiclePic?: PictureBlockDto;
    CutoutPic?: PictureBlockDto;
    CombinPic?: PictureBlockDto[];
    Plate?: PlateDto;
    Vehicle?: VehicleDto;
  };
}

// dahua/dto/generic-event.dto.ts — TimedParkingSpaceInfo / AlarmInfo / TollgateInfo
export class GenericDahuaEventDto {
  // sin forma fija — solo se exige que sea un objeto JSON válido;
  // se persiste íntegro en CameraEventRaw sin normalización de negocio.
}
```

DTOs administrativos:

```ts
// admin/dto/approve-camera.dto.ts
export class ApproveCameraDto {
  @IsString() tenantId: string;
  @IsString() cityId: string;
  @IsString() zoneId: string;
  @IsString() code: string;         // código operativo interno de la cámara
  @IsOptional() @IsString() name?: string;
}

// admin/dto/remap-camera.dto.ts
export class RemapCameraZoneDto {
  @IsString() zoneId: string;
}

// admin/dto/list-events-query.dto.ts
export class ListEventsQueryDto {
  @IsOptional() @IsString() cameraId?: string;
  @IsOptional() @IsIn(['PLAZA', 'AREA_ILEGAL']) detectionScope?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) limit?: number;
}
```

---

## 7. Validaciones

**Decisión central (ver §0):** la ruta de ingesta de cámara **no usa el `ValidationPipe` global** de `main.ts` (`whitelist:true, forbidNonWhitelisted:true`), porque rechazaría cualquier campo no declarado y porque exigiría validar antes de persistir el RAW (viola el principio "RAW-first").

Patrón exacto en `DahuaIngestionController`:

```ts
@Post('NotificationInfo/ParkingInfo')
async handleParkingInfo(@Req() req: RawBodyRequest, @Ip() ip: string) {
  // 1. captura RAW cruda (una sola lectura del body) → persiste CameraEventRaw
  // 2. plainToInstance(ParkingInfoDto, rawBody) + validate(instance) manualmente,
  //    SIN whitelist/forbidNonWhitelisted → campos extra se ignoran, no rechazan
  // 3. si validate() devuelve errores estructurales graves → 400, RAW ya persistido
  // 4. si es válido (con o sin campos extra) → continúa el flujo normal
}
```

Reglas de negocio validadas en el servicio (no en el DTO, porque dependen de datos cruzados):

- `ParkingStallsNo` obligatorio salvo cuando `ParkingStatus=7` (o 3), donde `DetectRegionName` lo reemplaza — replica el `superRefine` correcto del reference, ahora como validación de dominio explícita en `CameraIngestionService`.
- `DeviceID` debe resolver a una `Camera` con `registrationStatus=active` para que el evento salga de `CameraEventRaw` y se normalice; si no, el evento queda `UNRESOLVED_DEVICE`.
- Límite de tamaño de body configurable (`DAHUA_MAX_BODY_MB`, propuesta 8 MB) — rechazo temprano vía `express.json({ limit })` a nivel de módulo, antes de leer el body completo.
- Endpoints administrativos: DTOs pasan por el `ValidationPipe` global existente, sin cambios — mismo comportamiento que `parking`/`frontend` hoy.

---

## 8. Logs

Reutiliza `Logger` de `@nestjs/common` con contexto por clase (patrón NestJS estándar, ya implícito en el resto del backend). Reglas no negociables, heredadas del `resumirContenidoSeguro` del reference:

- **Nunca** loguear Base64 completo — se reemplaza por `{ length, contentType }`.
- **Nunca** loguear headers `Authorization`, cookies, ni encabezados de firma.
- Cada log de ingesta incluye: `deviceId`, `eventType`, `ip`, `bodySizeDeclared`, `bodySizeReal`, `idempotencyKey` (una vez calculado), `rawEventId`.
- Nivel `warn` para: IP fuera de allowlist, `deviceId` desconocido, evento `UNRESOLVED_DEVICE`/`NEEDS_MAPPING`.
- Nivel `error` solo para fallos de infraestructura (DB no disponible, storage no disponible) — nunca para un payload de cámara inválido, que es un evento esperado, no una excepción del sistema.
- Correlación: `rawEventId` (o `idempotencyKey` cuando existe) se propaga en todos los logs de un mismo evento a través de ingesta → procesador → storage, para poder reconstruir el flujo completo de un evento en logs sin necesidad de tracing distribuido todavía.

---

## 9. Seguridad

Consolidación de §H (V1) y §10 (V2), sin reabrir debate — solo la versión final:

- **Principio rector:** `tenantId`/`cityId` **nunca** se aceptan del payload de la cámara — ni siquiera existen en el protocolo ITSAPI. Se derivan exclusivamente de `Camera.deviceId`, resuelto server-side.
- **Autenticación de la cámara, no JWT:** allowlist de IP con CIDR real (`ip-cidr.util.ts`, propio) + `DeviceID` registrado y `active`. Digest queda como punto de extensión (`Camera.authMode='digest'`) pero no se activa por defecto — ver §0.
- **Hallazgo de integridad (V2, no resuelto por Digest):** `qop=auth` protege método+URI, no el cuerpo. Mitigación operativa real: red cerrada/VPN entre cámara y gateway + allowlist de IP — se documenta explícitamente, no se promete una protección de integridad que Digest no da.
- **Bootstrap controlado:** auto-registro por `DeviceInfo` solo detrás de `DAHUA_PILOT_AUTOREGISTER_ENABLED`; crea la cámara siempre en `pending_review`, nunca con tenant asignado.
- **Rate limiting** por IP y por `deviceId`, en memoria, dentro de `CameraRequestGuard` (ver §0 — no apto para múltiples instancias, documentado como limitación conocida).
- **Límite de tamaño de body** explícito (§7).
- **Endpoints administrativos** exigen `JwtAuthGuard` + `RolesGuard`, reutilizados tal cual — ningún código nuevo de autenticación para esa ruta.
- **Auditoría:** toda acción administrativa sobre cámaras/alertas pasa por `AuditLog`.
- **Capturadores universales tipo `[...ruta]`:** explícitamente **descartados** — no se portan del reference bajo ninguna forma. Cada ruta de ingesta se declara explícitamente en el controller.
- **Variables de entorno:** cada una referenciada en código se declara en `.env.example` en el mismo commit que la introduce — corrige explícitamente el bug real encontrado en el reference (`DAHUA_DEVICE_IDS_PERMITIDOS` nunca declarada).

---

## 10. Idempotencia

Clave, confirmada de forma idéntica por `docs/plan-trabajo.md` del reference y por el documento oficial de negocio:

```text
DeviceID + (ParkingStallsNo || DetectRegionName) + ParkingStatus + SnapTime
```

Implementación final:

```ts
function computeIdempotencyKey(e: ParkingInfoBlockDto): string {
  const spaceOrArea = e.ParkingStallsNo || e.DetectRegionName || '';
  const base = `${e.DeviceID}|${spaceOrArea}|${e.ParkingStatus}|${e.SnapTime ?? ''}`;
  if (e.SnapTime) {
    return createHash('sha256').update(base).digest('hex');
  }
  // SnapTime ausente (riesgo abierto, no resuelto ni por V1 ni por el documento oficial):
  // fallback documentado explícitamente como no definitivo — hash del payload completo como desempate.
  const payloadHash = createHash('sha256').update(JSON.stringify(e)).digest('hex');
  return createHash('sha256').update(`${base}|${payloadHash}`).digest('hex');
}
```

- Constraint `@unique` en `CameraEvent.idempotencyKey` a nivel de base de datos — es la garantía real, no el chequeo en código.
- Inserción vía `create()` capturando el error `P2002` de Prisma; ante duplicado, el gateway responde 200 "ya procesado" sin repetir efectos de negocio (sin `upsert`, para no sobrescribir silenciosamente un evento ya procesado).
- `TimedParkingSpaceInfo` queda fuera de esta lógica en el roadmap inicial (RAW-only, §0) — cuando se promueva a lógica de negocio (v2), se idempotiza por elemento individual del arreglo con la misma fórmula.

---

## 11. Persistencia

- **Escritura RAW síncrona, procesamiento asíncrono:** todo evento entrante se persiste en `CameraEventRaw` antes de cualquier validación.
- **Retención diferenciada:**
  - `CameraEventRaw` (incluye Base64 temporal): TTL 14 días (`DAHUA_RAW_RETENTION_DAYS`, configurable), purgado por job periódico.
  - `CameraEvent` / `ParkingSpaceStatusHistory`: sin TTL — registro operativo.
  - `CameraSnapshot`: retención a definir junto a negocio/legal según si la imagen es evidencia de infracción (no se asume un número sin confirmación).
- **Transaccionalidad:** `ParkingSpace.status` + `ParkingSpaceStatusHistory` + `Alert` (si aplica) se ejecutan en una única transacción Prisma (`$transaction`).
- **Idempotencia como constraint de escritura**, no de aplicación (§10).
- **Purga:** job periódico (`jobs/purge-raw-events.job.ts`, fuera del ciclo de request) limpia el Base64 de `CameraEventRaw` una vez confirmada la subida a storage externo, y aplica el TTL general.

---

## 12. Manejo de imágenes

Pipeline confirmado casi textualmente por el documento oficial de negocio: *"Guardar imágenes en almacenamiento externo (URL, tipo, dimensiones y metadatos; no Base64)"*.

1. El Base64 llega y se guarda temporalmente en `CameraEventRaw.payload`.
2. `ImageStorageService` (proceso asíncrono) decodifica y sube a almacenamiento compatible S3 — **DigitalOcean Spaces**, coherente con la infraestructura ya provisionada del proyecto.
3. Por cada imagen recibida (hasta 5: `NormalPic`, `VehiclePic`, `CutoutPic`, cada elemento de `CombinPic[]`, `Plate.Content`) se crea un `CameraSnapshot` independiente.
4. Ancho/alto ya vienen en el payload (`Width`/`Height`) — se persisten tal cual, sin reprocesar la imagen.
5. Nomenclatura del objeto: `<tenantId>/<cityId>/<cameraId>/<yyyy-mm-dd>/<idempotencyKey>-<kind>.jpg`.
6. Nunca se sirve una imagen directamente desde el proceso Node — URLs firmadas o CDN.
7. El Base64 se purga de `CameraEventRaw` por TTL una vez confirmada la subida (§11).

**Dependencia nueva requerida** (única de todo este plan): cliente S3-compatible, p. ej. `@aws-sdk/client-s3`. Se aísla en el commit 7 exclusivamente, para que la aprobación de esa dependencia no bloquee el resto del roadmap.

---

## 13. Health checks

`@nestjs/terminus` ya está en `apps/api/package.json` (`^11.1.1`) y no se usa hoy — se activa, sin dependencia nueva.

```ts
// health/camera-health.indicator.ts
@Injectable()
export class CameraHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const offlineThresholdMinutes = 15; // configurable
    const offlineCameras = await this.prisma.camera.count({
      where: {
        status: 'active',
        lastSeenAt: { lt: new Date(Date.now() - offlineThresholdMinutes * 60_000) },
      },
    });
    const pendingBacklog = await this.prisma.cameraEventRaw.count({
      where: { processingStatus: 'PENDING' },
    });
    const healthy = offlineCameras === 0 && pendingBacklog < 500; // umbral configurable
    return this.getStatus(key, healthy, { offlineCameras, pendingBacklog });
  }
}
```

Expuesto en `GET /api/v1/health/camera-gateway`, registrado en el `HealthModule` existente junto al chequeo de base de datos ya implementado en `health.service.ts`.

---

## 14. Métricas

**Piloto (este roadmap):** sin dependencia nueva. Contadores en memoria dentro de `CameraIngestionService`/`CameraEventProcessorService`, expuestos como JSON en `GET /camera-gateway/metrics` (RBAC, no público):

```ts
interface CameraGatewayMetrics {
  eventsReceivedTotal: Record<string, number>;      // por eventType
  eventsProcessedTotal: Record<string, number>;      // por status (PROCESSED/FAILED)
  idempotentDuplicatesTotal: number;
  unresolvedDeviceTotal: number;
  ingestionLatencyMsP50: number;
  ingestionLatencyMsP95: number;
  imageUploadDurationMsAvg: number;
  camerasOnline: number;
  camerasOffline: number;
}
```

**v2 (explícitamente diferido, no en este roadmap):** exportador Prometheus real (`@willsoto/nestjs-prometheus` o equivalente) + Grafana, cuando el volumen de piloto lo justifique — requiere su propia aprobación de dependencia cuando llegue el momento, igual que el broker de mensajería (Opción D, §1 de la auditoría V2).

---

## 15. Roadmap final

Consolidación de los roadmaps de V1 (§M) y V2 (§14), ajustado a las decisiones de §0. 12 commits, cada uno pequeño, revisable y validable de forma independiente. El detalle exacto de cada uno (objetivo, archivos, migraciones, pruebas, rollback) está en la sección siguiente — esta tabla es solo el resumen de secuencia y dependencias.

| # | Commit | Depende de | Requiere aprobación aparte |
|---|---|---|---|
| 1 | `feat(db): extend Camera/CameraEvent, add CameraEventRaw/CameraSnapshot/ParkingSpaceStatusHistory/Alert` | — | Sí — migración Prisma |
| 2 | `feat(camera-gateway): scaffold module, DTOs and normalizer` | 1 | No |
| 3 | `feat(camera-gateway): ITSAPI ingestion controller + camera security guard` | 2 | No |
| 4 | `feat(camera-gateway): persist raw events + idempotency key` | 3 | No |
| 5 | `feat(camera-gateway): async processor for space state + history` | 4 | No |
| 6 | `feat(camera-gateway): illegal-area alerting` | 5 | No |
| 7 | `feat(camera-gateway): image pipeline (S3-compatible storage)` | 5 | **Sí — dependencia nueva** |
| 8 | `feat(camera-gateway): admin endpoints with RBAC` | 5 | No |
| 9 | `feat(camera-gateway): purge job + exploratory RAW-only endpoints` | 4 | No |
| 10 | `feat(camera-gateway): health indicator + metrics endpoint` | 5, 8 | No |
| 11 | `test(camera-gateway): multi-tenant isolation + real payload fixtures` | 1–10 | No |
| 12 | `docs(camera-gateway): runbook + update architecture docs` | 11 | No |

No negociable desde el commit 1 (checklist final de V2, sin cambios): persistencia RAW antes de validar, resolución de tenant exclusivamente server-side, idempotencia con constraint único en base de datos, allowlist CIDR real, purga/TTL de Base64 desde el primer despliegue, tests de aislamiento multi-tenant en el mismo alcance que el módulo — no como tarea posterior.

---

## 16. Lista exacta de commits

### Commit 1 — `feat(db): extend Camera/CameraEvent, add CameraEventRaw/CameraSnapshot/ParkingSpaceStatusHistory/Alert`

- **Objetivo:** Materializar el modelo de dominio final (§4) en `schema.prisma` y generar la migración correspondiente, siguiendo la gobernanza vigente documentada en `DATABASE_GOVERNANCE_REPORT.md` (nunca `db push`; `migrate dev` revisado y aprobado aparte).
- **Archivos:**
  - MOD `apps/api/prisma/schema.prisma`
  - NEW `apps/api/prisma/migrations/<timestamp>_camera_gateway_foundation/migration.sql`
- **Migraciones:** Sí — una migración `migrate dev --create-only` primero (revisión manual del SQL generado antes de aplicar), luego aplicación con el mismo protocolo pre/post-verificación usado en Fase 0 (conteo de tablas, fingerprint de filas, `migrate status`). Pre-flight obligatorio: `SELECT count(*) FROM camera_events` = 0 antes de aceptar el `DROP COLUMN "imageUrl"` generado.
- **Pruebas:** `npx prisma validate`; `npx prisma migrate dev` genera únicamente el diff esperado (verificar SQL manualmente, sin sorpresas de otras tablas); `npm run build` en `apps/api` pasa con el client regenerado.
- **Rollback:** Si no se ha hecho push — `git commit --amend` o nuevo commit corrector, igual que el precedente de Fase 0. Si la migración ya se aplicó localmente y se detecta un error, **no** usar `migrate resolve --rolled-back` sobre una migración ya aplicada (lección de Fase 0); generar una migración correctiva nueva. Nunca revertir editando el archivo de una migración ya aplicada en la base real.

### Commit 2 — `feat(camera-gateway): scaffold module, DTOs and normalizer`

- **Objetivo:** Crear el esqueleto del módulo, los DTOs de `DeviceInfo`/`ParkingInfo`/`KeepAlive`/genérico (§6) y la función pura de normalización Dahua → `CameraParkingEvent` (§3), sin conectar todavía a ninguna ruta HTTP real.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/camera-gateway.module.ts`
  - NEW `apps/api/src/camera-gateway/dahua/dto/*.ts`
  - NEW `apps/api/src/camera-gateway/dahua/normalizer.ts`
  - NEW `apps/api/src/camera-gateway/dahua/types.ts`
  - MOD `apps/api/src/app.module.ts` (registra `CameraGatewayModule`, sin rutas activas aún)
- **Migraciones:** Ninguna.
- **Pruebas:** Unitarias del normalizador contra los payloads reales de §L (V1) — incluye el caso de área ilegal y el nuevo caso A001/LIBRE de V2. Sin plaza, sin `DeviceID`, sin `SnapTime` (fallback) como casos explícitos.
- **Rollback:** `git revert` del commit — no toca base de datos ni rutas públicas, sin efecto en producción.

### Commit 3 — `feat(camera-gateway): ITSAPI ingestion controller + camera security guard`

- **Objetivo:** Exponer las rutas de ingesta (§5) protegidas por `CameraRequestGuard` (allowlist CIDR propio + resolución de `DeviceID` + rate limiting en memoria + límite de tamaño de body), sin `JwtAuthGuard`.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/dahua/dahua-ingestion.controller.ts`
  - NEW `apps/api/src/camera-gateway/security/camera-request.guard.ts`
  - NEW `apps/api/src/camera-gateway/security/ip-cidr.util.ts`
  - NEW `apps/api/src/camera-gateway/security/rate-limiter.util.ts`
  - NEW `apps/api/src/camera-gateway/security/digest.util.ts` (punto de extensión, no activado)
  - MOD `apps/api/src/main.ts` (excluir `integrations/dahua/*` del prefijo `api/v1`; configurar límite de body para esas rutas)
  - MOD `apps/api/.env.example` (`DAHUA_IP_ALLOWLIST`, `DAHUA_PILOT_AUTOREGISTER_ENABLED`, `DAHUA_MAX_BODY_MB`, `DAHUA_RATE_LIMIT_PER_MINUTE`)
- **Migraciones:** Ninguna.
- **Pruebas:** Request desde IP fuera de allowlist → 401. `DeviceInfo` de cámara nueva con auto-registro activo → `Camera` creada en `pending_review`. `DeviceInfo` con auto-registro desactivado → 401 o descarte silencioso (a decidir en implementación, documentar el elegido). Ráfaga simulada por encima del umbral → 429.
- **Rollback:** `git revert`. Sin cambios de base de datos. El único riesgo es que `main.ts` cambie el prefijo global — revert restaura el comportamiento anterior exacto.

### Commit 4 — `feat(camera-gateway): persist raw events + idempotency key`

- **Objetivo:** Persistencia RAW-first en `CameraEventRaw` para todo evento entrante, validación tolerante (§7), resolución de tenant/cámara por `deviceId`, y cálculo de `idempotencyKey` (§10) — el gateway ya responde 200 de forma completa, sin procesamiento de negocio todavía.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/camera-ingestion.service.ts`
  - MOD `apps/api/src/camera-gateway/dahua/dahua-ingestion.controller.ts`
- **Migraciones:** Ninguna (usa el modelo ya migrado en commit 1).
- **Pruebas:** Mismo `ParkingInfo` enviado dos veces → una sola fila en `CameraEventRaw` procesada como duplicado en el segundo intento (RAW se guarda siempre, pero no se reprocesa negocio); `DeviceID` no registrado → RAW persistido, `validationStatus=UNRESOLVED_DEVICE`, evento rechazado antes de normalizar. JSON malformado → 400, RAW igual persistido.
- **Rollback:** `git revert`. Sin migraciones nuevas que revertir.

### Commit 5 — `feat(camera-gateway): async processor for space state + history`

- **Objetivo:** Procesador asíncrono que mapea `ParkingStallsNo → ParkingSpace` por `(Camera.zoneId, code)`, ejecuta la transacción de estado + `ParkingSpaceStatusHistory`, y evalúa `ParkingSession` activa para detectar ocupación sin pago.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/camera-event-processor.service.ts`
- **Migraciones:** Ninguna.
- **Pruebas:** `ParkingInfo` real status=0 (A004) → `ParkingSpace A004` pasa a `occupied`, fila en `ParkingSpaceStatusHistory` con `source=CAMERA`. `ParkingStallsNo` que no existe como `ParkingSpace.code` en la zona de la cámara → evento `NEEDS_MAPPING`, `Alert(UNMAPPED_SPACE)`, no se descarta. Ocupación sin `ParkingSession` activa → `Alert(UNPAID_OCCUPANCY)`.
- **Rollback:** `git revert`. Riesgo real: si ya procesó eventos y se revierte, quedan `ParkingSpace`/historiales ya escritos — evaluar caso a caso si conviene una migración de datos correctiva o aceptar el estado como válido (los datos en sí son correctos, solo el código que los generó se revierte).

### Commit 6 — `feat(camera-gateway): illegal-area alerting`

- **Objetivo:** Manejar `ParkingStatus=7` como `Alert(ILLEGAL_AREA)` sin tocar ninguna `ParkingSpace`.
- **Archivos:**
  - MOD `apps/api/src/camera-gateway/camera-event-processor.service.ts`
- **Migraciones:** Ninguna.
- **Pruebas:** Payload real con `ParkingStatus=7` y `DetectRegionName="Área de detección ilegal 0"` → `Alert` creada, ninguna `ParkingSpace` modificada, `ParkingStallsNo` vacío no rompe el flujo.
- **Rollback:** `git revert`, sin efecto en datos existentes de plazas (este commit nunca las toca por diseño).

### Commit 7 — `feat(camera-gateway): image pipeline (S3-compatible storage)`

- **Objetivo:** Decodificar Base64, subir a almacenamiento compatible S3 (DigitalOcean Spaces) y crear los `CameraSnapshot` correspondientes, desacoplado del path de respuesta a la cámara.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/storage/image-storage.service.ts`
  - MOD `apps/api/package.json` (**dependencia nueva** — requiere aprobación explícita separada antes de `npm install`)
  - MOD `apps/api/.env.example` (`CAMERA_STORAGE_ENDPOINT`, `CAMERA_STORAGE_BUCKET`, `CAMERA_STORAGE_REGION`, `CAMERA_STORAGE_ACCESS_KEY`, `CAMERA_STORAGE_SECRET_KEY`)
- **Migraciones:** Ninguna.
- **Pruebas:** Evento con `NormalPic` + `Vehicle` + `Plate.Content` → 3 `CameraSnapshot` creados con URLs válidas; imagen ~1-2 MB (2688×1584 real) → la respuesta 200 a la cámara no espera la subida (verificar latencia de respuesta vs. latencia de subida en el test).
- **Rollback:** `git revert`; si la dependencia ya se instaló, `npm uninstall` en un commit separado explícito, nunca silencioso.

### Commit 8 — `feat(camera-gateway): admin endpoints with RBAC`

- **Objetivo:** Endpoints administrativos (§5) reutilizando `JwtAuthGuard`/`RolesGuard`/`AuditLog` tal cual.
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/admin/camera-admin.controller.ts`
  - NEW `apps/api/src/camera-gateway/admin/camera-admin.service.ts`
  - NEW `apps/api/src/camera-gateway/admin/dto/*.ts`
- **Migraciones:** Ninguna.
- **Pruebas:** Usuario sin rol adecuado → 403. `approve` sobre cámara `pending_review` → pasa a `active` con `tenantId`/`cityId`/`zoneId` asignados, registrado en `AuditLog`. `remap-zone` → fuerza que el siguiente evento use la nueva zona para resolver plaza.
- **Rollback:** `git revert`, sin impacto en ingesta (rutas independientes).

### Commit 9 — `feat(camera-gateway): purge job + exploratory RAW-only endpoints`

- **Objetivo:** Job de purga por TTL de `CameraEventRaw` (§11), y las rutas `TimedParkingSpaceInfo`/`AlarmInfo`/`TollgateInfo` en modo RAW-only (sin normalización de negocio, per §0/§3).
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/jobs/purge-raw-events.job.ts`
  - MOD `apps/api/src/camera-gateway/dahua/dahua-ingestion.controller.ts`
  - MOD `apps/api/src/camera-gateway/dahua/dto/generic-event.dto.ts`
  - MOD `apps/api/.env.example` (`DAHUA_RAW_RETENTION_DAYS`)
- **Migraciones:** Ninguna.
- **Pruebas:** `CameraEventRaw` con `receivedAt` mayor a N días → purgado (Base64 eliminado, fila conservada o eliminada según política final a confirmar). `TollgateInfo`/`AlarmInfo` reales → 200, RAW persistido, sin efecto sobre `ParkingSpace`.
- **Rollback:** `git revert`. El job de purga es destructivo por diseño (elimina Base64 antiguo) — si se revierte el commit *después* de que el job ya corrió, los datos purgados no se recuperan; esto es la política esperada (TTL), no un bug a revertir.

### Commit 10 — `feat(camera-gateway): health indicator + metrics endpoint`

- **Objetivo:** Activar `CameraHealthIndicator` sobre `@nestjs/terminus` ya instalado y exponer `GET /camera-gateway/metrics` (§13, §14).
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/health/camera-health.indicator.ts`
  - MOD `apps/api/src/health/health.controller.ts`
  - MOD `apps/api/src/health/health.module.ts`
  - MOD `apps/api/src/camera-gateway/admin/camera-admin.controller.ts` (endpoint `/metrics`)
- **Migraciones:** Ninguna.
- **Pruebas:** Cámara sin `KeepAlive` por más del umbral → `/health/camera-gateway` reporta `offlineCameras>0`. `/camera-gateway/metrics` requiere JWT+RBAC, devuelve contadores coherentes con eventos de prueba enviados.
- **Rollback:** `git revert`, sin impacto en ingesta ni en otros endpoints de salud existentes.

### Commit 11 — `test(camera-gateway): multi-tenant isolation + real payload fixtures`

- **Objetivo:** Suite de pruebas dedicada de extremo a extremo, con los 13 casos del plan de pruebas de V1 (§L) más el caso A001/LIBRE de V2, y aislamiento multi-tenant como primer ciudadano (siguiendo el precedente de los tests de Fase 0 en `parking.service.spec.ts`).
- **Archivos:**
  - NEW `apps/api/src/camera-gateway/**/*.spec.ts` (todos los servicios/controllers/guards)
  - MOD `apps/api/test/app.e2e-spec.ts`
  - NEW `apps/api/test/fixtures/dahua-payloads/*.json` (payloads reales de §L, redactados de datos sensibles si aplica)
- **Migraciones:** Ninguna.
- **Pruebas:** Los 13 casos de §L de V1 + el caso adicional de V2, cobertura de aislamiento tenant (evento de cámara de un tenant nunca es visible/afecta a otro), 401 sin JWT en endpoints administrativos, 401 en ingesta sin IP allowlist.
- **Rollback:** `git revert`, sin riesgo — solo pruebas.

### Commit 12 — `docs(camera-gateway): runbook + update architecture docs`

- **Objetivo:** Documentación operativa (cómo dar de alta una cámara, cómo leer/cerrar una alerta, cómo purgar manualmente) y actualización de `architecture/BACKEND_ARCHITECTURE.md`/`architecture/CURRENT_ARCHITECTURE.md` para reflejar el módulo real implementado, incluida la reconciliación de nomenclatura "occupancy_detections" → `ParkingSpaceStatusHistory` (§3).
- **Archivos:**
  - NEW `docs/camera-gateway/runbook.md`
  - MOD `architecture/BACKEND_ARCHITECTURE.md`
  - MOD `architecture/CURRENT_ARCHITECTURE.md`
- **Migraciones:** Ninguna.
- **Pruebas:** Revisión manual, sin cambios de código de aplicación.
- **Rollback:** `git revert`, sin ningún riesgo operativo.

---

## Criterios de aceptación (heredados de V1 §O, vigentes sin cambios)

- Un `ParkingInfo` real produce un `CameraEvent` con `tenantId`/`cityId` derivados exclusivamente de la `Camera` registrada, nunca del payload.
- El mismo evento reenviado con clave idéntica no duplica `CameraEvent` ni `ParkingSpaceStatusHistory`.
- Un `DeviceID` no registrado nunca puede alterar una `ParkingSpace` de ningún tenant.
- Un `ParkingStatus=7` nunca modifica `ParkingSpace.status`.
- Ninguna imagen Base64 completa aparece en logs ni permanece indefinidamente en la base transaccional.
- Los endpoints administrativos exigen JWT+RBAC; los de ingesta de cámara exigen allowlist/DeviceID conocido, no JWT.
- Toda acción administrativa sobre cámaras queda en `AuditLog`.
- El gateway responde 200 a la cámara en <300ms, independientemente de la latencia del storage de imágenes.

---

**Este documento queda pendiente de aprobación explícita, commit por commit, siguiendo el orden de §16.** No se ha modificado ningún archivo del proyecto salvo la creación de este documento. No se instalaron dependencias, no se generaron migraciones, no se crearon commits.
