# Simulador de eventos Dahua (Fase 0.9)

Herramienta permanente del proyecto — no es código temporal. Ejercita los
mismos endpoints HTTP que usará la cámara física
(`POST /integrations/dahua/NotificationInfo/*`) contra un servidor real ya
corriendo, sin mocks ni capas salteadas, y deja un reporte estructurado en
`apps/api/test-results/simulation-report.json`. Pensado para correr tanto en
la máquina de un desarrollador como en CI/CD.

Diseño aprobado en `DAHUA_IMPLEMENTATION_PLAN.md` (Fase 0) y refinado en la
conversación de Fase 0.9 — antes de conectar cualquier cámara física, este
simulador debe quedar completamente en verde.

## Cómo ejecutarlo

Prerrequisito: el servidor de `apps/api` tiene que estar corriendo.

```bash
cd apps/api
npm run start:dev
```

En otra terminal:

```bash
cd apps/api
DAHUA_SIM_AUTO_APPROVE=true npm run test:dahua
```

Exit code `0` si el resultado es `PASS`, `1` si hay algún `FAIL` — utilizable
tal cual en un pipeline de CI.

## Variables de entorno

Todas opcionales salvo `DATABASE_URL` (ya requerida por el resto de la app).
Nada queda hardcodeado — host, puerto, rutas y credenciales son siempre
configurables.

| Variable | Default | Descripción |
|---|---|---|
| `DAHUA_SIM_BASE_URL` | `http://localhost:3000` | Host:puerto del servidor a probar — el mismo que se configurará en la cámara real. |
| `DAHUA_SIM_AUTO_APPROVE` | `false` | `true`: el simulador aprueba la cámara automáticamente (SQL directo — ver abajo). `false`: exige que la cámara ya esté aprobada y se detiene con un mensaje claro si no lo está. |
| `DAHUA_SIM_REPORT_DIR` | `apps/api/test-results` | Directorio de salida de `simulation-report.json`. |
| `DAHUA_SIM_SERVER_LOG` | *(vacío)* | Ruta a un archivo con la salida de `npm run start:dev`, para que el simulador revise automáticamente que no haya `Authorization`/`Bearer`/Base64 expuesto. Sin esta variable, ese check queda marcado `MANUAL` en el reporte — no se fabrica un PASS falso. |
| `DAHUA_SIM_DEVICE_ID` | `SIMULATOR-DAHUA-0001` | DeviceID de la cámara simulada — deliberadamente distinto de cualquier DeviceID real, para que nunca colisione con la cámara física una vez conectada. |
| `DAHUA_SIM_UNKNOWN_DEVICE_ID` | `SIMULATOR-DAHUA-UNKNOWN` | DeviceID usado en el caso `ParkingInfo_InvalidDevice` — garantizado inexistente. |
| `DAHUA_SIM_PARKING_SPACE_CODE` | `CENTRO-005` | Código de `ParkingSpace` (de los datos sembrados por `npm run seed`) usado como plaza de referencia. |
| `DAHUA_SIM_TENANT_CODE` | `MUNI_DEMO` | Código de `Tenant` sembrado, usado en la aprobación de cámara. |
| `DAHUA_SIM_CITY_CODE` | `SMART_CITY` | Código de `City` sembrada. |
| `DAHUA_SIM_ZONE_CODE` | `CENTRO` | Código de `ParkingZone` sembrada. |

## Flujo

```
Preflight (GET /api/v1/health)
  ↓
1. POST DeviceInfo          → Camera creada en pending_review
  ↓
Paso 0 — Aprobación de cámara (según DAHUA_SIM_AUTO_APPROVE)
  ↓
2. POST KeepAlive            → lastSeenAt actualizado
  ↓
3. POST ParkingInfo Occupied → ParkingSpace → occupied, 1 CameraEvent, 1 historial
  ↓
4. POST ParkingInfo Duplicate → mismo objeto en memoria del paso 3, sin releer
   el archivo — prueba idempotencia real: 0 filas nuevas
  ↓
5. POST ParkingInfo Free     → ParkingSpace → available, 1 CameraEvent, 1 historial
  ↓
6. POST ParkingInfo Illegal  → CameraEvent AREA_ILEGAL, ParkingSpace intacta
  ↓
7. POST ParkingInfo InvalidDevice → descartado, 0 efectos, RAW = FAILED
  ↓
Validación de BD: Camera, CameraEventRaw, CameraEvent, ParkingSpace,
ParkingSpaceStatusHistory, AuditLogs (debe quedar sin cambios)
  ↓
Validación de logs (automática si DAHUA_SIM_SERVER_LOG está seteada, si no MANUAL)
  ↓
simulation-report.json + resultado PASS/FAIL
```

**Paso 0 — aprobación de cámara.** No existe todavía un endpoint administrativo
para aprobar cámaras (`Camera.tenantId/cityId/zoneId` solo se asignan hoy por
SQL directo). Con `DAHUA_SIM_AUTO_APPROVE=true`, el simulador hace ese
`UPDATE` él mismo, usando el tenant/ciudad/zona sembrados por `npm run seed`
— es la única escritura del simulador que no pasa por los endpoints HTTP,
está claramente señalada en la salida y en el reporte (`camera.autoApprove`).
Con `DAHUA_SIM_AUTO_APPROVE=false`, el simulador no toca la base y espera que
la cámara ya esté aprobada (por ejemplo, siguiendo el paso manual de
`DAHUA_TESTING_CHECKLIST.md` §1) — si no lo está, se detiene antes de enviar
ningún `ParkingInfo`.

**Por qué `SnapTime` es dinámico.** La clave de idempotencia es
`DeviceID + ParkingStallsNo + ParkingStatus + SnapTime`. Si los payloads de
`ParkingInfo` tuvieran un `SnapTime` fijo en disco, la segunda vez que se
corriera el simulador todo sería tratado como duplicado del run anterior, y
las aserciones de cambio de estado fallarían por diseño, no por un bug real.
El script sobrescribe `SnapTime` con el instante de ejecución antes de cada
envío — igual que hace una cámara real, que nunca reenvía un `SnapTime` viejo
salvo en un reintento genuino.

## Payloads

`apps/api/test/dahua/payloads/` — misma forma exacta que los payloads reales
documentados en `smartpark-dahua-reference/docs/payloads-reales.md`.

| Archivo | Qué valida |
|---|---|
| `DeviceInfo.json` | Handshake y auto-registro de cámara. |
| `KeepAlive.json` | Latido / actualización de `lastSeenAt`. |
| `ParkingInfo_Occupied.json` | Ocupación real de una plaza (`ParkingStatus=0`). |
| `ParkingInfo_Free.json` | Liberación de una plaza (`ParkingStatus=1`). |
| `ParkingInfo_Illegal.json` | Área ilegal (`ParkingStatus=7`, sin `ParkingStallsNo`) — nunca debe tocar una `ParkingSpace`. |
| `ParkingInfo_Duplicate.json` | **Referencia documental únicamente** — `simulate.ts` no lo lee. El paso de duplicado reenvía el objeto en memoria de `Occupied` ya con el `SnapTime` inyectado en ese run. |
| `ParkingInfo_InvalidDevice.json` | `DeviceID` desconocido — debe descartarse sin crear `Camera`. |

## Cómo interpretar `simulation-report.json`

Se escribe en `apps/api/test-results/simulation-report.json` en cada corrida
(se sobrescribe). Estructura:

- `executionId`, `startedAt`, `finishedAt`, `durationMs` — identificación y
  tiempos de la corrida.
- `camera` — estado final de la cámara simulada (aprobación, tenant/city/zone).
- `deviceInfo`, `keepAlive`, `parkingOccupied`, `parkingDuplicate`,
  `parkingFree`, `parkingIllegal`, `parkingInvalidDevice` — resultado HTTP y
  efectos observados de cada paso del flujo.
- `database` — fingerprint completo (conteo de filas relevantes) antes y
  después de la corrida.
- `history` — todas las filas de `ParkingSpaceStatusHistory` de la plaza
  usada, en orden cronológico.
- `logs` — modo (`automated`/`manual`), y patrones prohibidos encontrados si
  aplica.
- `result` — `{ pass, totalChecks, passedChecks, failedChecks, manualChecks,
  checks[] }`. `checks[]` es la lista completa de verificaciones individuales
  con su `status` (`PASS`/`FAIL`/`MANUAL`) y `detail`.

Un resultado con `manualChecks > 0` no es un `FAIL` — significa que hay
verificaciones (como el chequeo de logs sin `DAHUA_SIM_SERVER_LOG`) que
requieren revisión humana antes de dar por cerrada la fase.

## Cómo preparar la primera prueba con una cámara real

1. El simulador debe quedar en verde (`result.pass = true`, y los `MANUAL`
   revisados a ojo) antes de tocar hardware — condición ya acordada.
2. Seguir `DAHUA_TESTING_CHECKLIST.md` desde §0: red cerrada/aislada
   verificada, `DeviceID` real anotado, modo de compatibilidad activado en la
   cámara.
3. La cámara real usa su propio `DeviceID` (no `SIMULATOR-DAHUA-0001`) y
   probablemente un `ParkingStallsNo` con formato distinto al sembrado
   (p. ej. `A004` en vez de `CENTRO-005`) — ese mapeo cámara-física↔catastro
   municipal no lo resuelve el simulador; es responsabilidad de un endpoint
   administrativo todavía no implementado. Verificar/crear el `ParkingSpace`
   correspondiente antes de esperar que la cámara real mueva una plaza.
4. Con la cámara real, `DAHUA_SIM_AUTO_APPROVE` no aplica — la aprobación de
   la cámara real sigue siendo el paso manual documentado en
   `DAHUA_TESTING_CHECKLIST.md` §1.
