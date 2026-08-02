# DAHUA_TESTING_CHECKLIST

**Estado:** Checklist de prueba real contra hardware — pendiente de tu confirmación antes de conectar la cámara.
**Alcance actual implementado:** `DeviceInfo`, `KeepAlive`, `ParkingInfo` (sin imágenes, sin alertas). No existen todavía: guard de seguridad (allowlist IP/rate limit), pipeline de imágenes, alertas, endpoints administrativos, `AuditLog` para cámaras, métricas/health de cámaras. Este checklist valida lo implementado **y** deja constancia explícita de lo que todavía no aplica, para no reportar como "falla" algo que es simplemente no-implementado-aún.

---

## 0. Prerrequisitos y configuración de entorno

- [ ] **Rama y estado limpio.** `git status` en la raíz del repo — confirmar que seguimos en `feature/dahua-camera-integration` y que nada de este trabajo está comiteado todavía.
- [ ] **Migración aplicada.**
  ```
  cd apps/api && npx prisma migrate status
  ```
  → debe decir `Database schema is up to date!`.
- [ ] **Servidor arriba.**
  ```
  cd apps/api && npm run start:dev
  ```
  → confirmar `API running on http://localhost:3000/api/v1` y que las rutas `integrations/dahua/*` **no** llevan ese prefijo (excluidas en `main.ts`).
- [ ] **Riesgo de seguridad conocido — mitigación obligatoria para esta prueba.** El endpoint de ingesta no tiene allowlist de IP ni rate limiting todavía (commit futuro del roadmap). La cámara y el servidor **deben** estar en una red cerrada/aislada — no exponer el puerto a Internet bajo ninguna circunstancia durante esta prueba. Confirmar la topología de red antes de continuar.
- [ ] **Decisión de autoregistro.** Elegir explícitamente:
  - **Opción A (recomendada):** `DAHUA_PILOT_AUTOREGISTER_ENABLED=true` — la cámara se autoregistra en `pending_review` al primer `DeviceInfo`.
  - **Opción B:** dejarlo en `false` (default) e insertar manualmente la fila `Camera` con el `deviceId` real antes de conectar la cámara.
- [ ] **DeviceID real de la cámara** — visible en su interfaz web (`Red → ITSAPI` o equivalente). Anotarlo: se usa en todas las verificaciones SQL siguientes.
- [ ] **Configuración de la cámara** (según `docs/integracion-dahua.md`, ya validado contra hardware real):
  - `Red → Acceder a plataforma → ITSAPI` → Servidor = `http://<host-servidor>:3000/integrations/dahua`.
  - Interfaces activas: `DeviceInfo`, `KeepAlive`, `ParkingInfo`.
  - **`Red → Seguridad → Modo de autenticación del protocolo privado → Modo de compatibilidad`** — indispensable; en modo de seguridad estándar solo se observan `DeviceInfo`/`KeepAlive`, nunca `ParkingInfo`.
- [ ] **Fingerprint inicial** (antes de cualquier evento real) — guardar el resultado para comparar al final:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT (SELECT count(*) FROM tenants) tenants, (SELECT count(*) FROM cities) cities,
           (SELECT count(*) FROM users) users, (SELECT count(*) FROM parking_spaces) spaces,
           (SELECT count(*) FROM cameras) cameras, (SELECT count(*) FROM camera_events) events,
           (SELECT count(*) FROM camera_events_raw) raw, (SELECT count(*) FROM camera_snapshots) snaps,
           (SELECT count(*) FROM parking_space_status_history) history, (SELECT count(*) FROM alerts) alerts,
           (SELECT count(*) FROM audit_logs) audit;"'
  ```

---

## 1. DeviceInfo

- [ ] Encender/reconectar la cámara (fuerza el handshake). En el log del servidor debe verse `Cámara nueva registrada en pending_review deviceId=...` (autoregistro activo) o el descarte correspondiente (autoregistro desactivado y cámara no pre-insertada).
- [ ] Verificar la cámara creada:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT id, \"deviceId\", \"registrationStatus\", \"tenantId\", \"cityId\", \"zoneId\",
           \"ipAddress\", \"macAddress\", manufacturer, model
    FROM cameras WHERE \"deviceId\" = '"'"'<DeviceID real>'"'"';"'
  ```
  → debe existir; `registrationStatus='pending_review'`; `tenantId`/`cityId`/`zoneId` NULL; IP/MAC/fabricante/modelo poblados con los datos reales.
- [ ] Verificar RAW:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT \"eventType\", \"validationStatus\", \"processingStatus\", \"deviceIdRaw\"
    FROM camera_events_raw WHERE \"eventType\"='"'"'DeviceInfo'"'"'
    ORDER BY \"receivedAt\" DESC LIMIT 5;"'
  ```
  → `validationStatus='VALID'`, `processingStatus='PROCESSED'`.
- [ ] Confirmar 200 (log del servidor; opcionalmente captura de red para verificar que la cámara no reintenta indefinidamente).
- [ ] **Paso manual, necesario para poder probar `ParkingInfo` completo** (no existe endpoint admin todavía — commit futuro). Asignar tenant/city/zona reales:
  ```sql
  UPDATE cameras SET "tenantId" = '<tenantId>', "cityId" = '<cityId>',
    "zoneId" = '<zoneId>', "registrationStatus" = 'active'
  WHERE "deviceId" = '<DeviceID real>';
  ```
  Documentar exactamente qué UPDATE se ejecutó — no queda registrado en `AuditLog` (ver sección 11).
- [ ] Forzar un segundo `DeviceInfo` de la misma cámara → confirmar que **actualiza** la fila existente (no duplica) y `lastSeenAt` avanza.

---

## 2. KeepAlive / Heartbeat

*(Mismo mecanismo en esta implementación — una sola sección para ambos.)*

- [ ] Esperar al menos 2 ciclos de `KeepAlive` periódico de la cámara.
- [ ] Verificar:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT \"lastSeenAt\", status FROM cameras WHERE \"deviceId\"='"'"'<DeviceID>'"'"';"'
  ```
  → `lastSeenAt` avanza en cada ciclo; `status='active'`.
- [ ] Verificar RAW: eventos `KeepAlive` con `processingStatus='PROCESSED'`.
- [ ] **Caso dispositivo desconocido** — simular con curl un `KeepAlive` de un `DeviceID` inexistente:
  ```
  curl -X POST http://localhost:3000/integrations/dahua/NotificationInfo/KeepAlive \
    -H "Content-Type: application/json" -d '{"DeviceID":"no-existe-123"}'
  ```
  → 200; RAW `processingStatus='FAILED'`; **ninguna fila nueva en `cameras`**.

---

## 3. ParkingInfo

- [ ] Prerrequisito: `Camera.zoneId` ya asignado (paso manual §1) y debe existir un `ParkingSpace` con `code` igual al `ParkingStallsNo` real que reporta la cámara, dentro de esa zona:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT id, code, status FROM parking_spaces WHERE \"zoneId\"='"'"'<zoneId>'"'"';"'
  ```
- [ ] Provocar una ocupación real (vehículo en la plaza monitoreada). Tiempos observados en hardware real: ocupación ≈7s, liberación ≈20s tras el evento físico — no asumir inmediatez.
- [ ] Verificar `CameraEvent` creado: `detectionScope='PLAZA'`, `parkingSpaceId` no nulo, `idempotencyKey` poblado.
- [ ] Verificar `ParkingSpace.status` → `occupied`.
- [ ] Retirar el vehículo, esperar liberación → `ParkingSpace.status` vuelve a `available`; nuevo `CameraEvent` + nueva fila de historial.
- [ ] Si la cámara tiene área ilegal configurada: provocar una detección ahí → `detectionScope='AREA_ILEGAL'`, `parkingSpaceId IS NULL`, y **confirmar que ninguna `ParkingSpace` cambió de estado**.
- [ ] Caso `ParkingStallsNo` no mapeado (código sin `ParkingSpace.code` correspondiente en la zona): el evento igual se registra (`parkingSpaceId IS NULL`), no se descarta.

---

## 4. Duplicados / Idempotencia

- [ ] Capturar el body exacto de un `ParkingInfo` real (del log o de `camera_events_raw.payload`) y reenviarlo dos veces por curl.
- [ ] Verificar: **una sola fila** en `camera_events` con ese `idempotencyKey` — el segundo envío no duplica evento ni historial.
- [ ] Verificar en logs: `ParkingInfo duplicado (idempotente) ignorado`.
- [ ] Confirmar que `ParkingSpace.status` no vuelve a cambiar en el segundo envío.

---

## 5. Imágenes — fuera de alcance en esta fase, validar que NO se procesan

- [ ] Confirmar explícitamente: **el pipeline de imágenes no está implementado** (requiere una dependencia nueva de storage S3-compatible, pendiente de aprobación aparte — commit futuro).
- [ ] Verificar que el Base64 de `NormalPic`/`VehiclePic`/etc. **sí** llega íntegro dentro de `camera_events_raw.payload` (evidencia cruda conservada, nada se pierde).
- [ ] Verificar que **no** se crea ninguna fila en `camera_snapshots` (tabla existe desde la migración, pero nada la alimenta todavía):
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "SELECT count(*) FROM camera_snapshots;"'
  ```
  → debe ser 0 antes y después de la prueba.
- [ ] Confirmar manualmente que ningún log de la aplicación imprime el contenido Base64 completo.

---

## 6. Errores

- [ ] JSON malformado:
  ```
  curl -X POST http://localhost:3000/integrations/dahua/NotificationInfo/ParkingInfo \
    -H "Content-Type: application/json" -d '{esto no es json'
  ```
  → 400 (Nest lo rechaza antes del controller) — único caso legítimo de no-200 en este diseño.
- [ ] `ParkingInfo` sin `ParkingStatus` → RAW `validationStatus='INVALID'`, igual responde 200.
- [ ] Evento de `deviceId` nunca visto, con autoregistro desactivado → descarte silencioso, 200, sin crear `Camera`.
- [ ] Body de imagen grande (real: hasta ~2688×1584) → confirmar que el servidor no se cae ni degrada de forma anómala (no hay límite de tamaño configurado todavía — commit futuro; documentar el comportamiento observado, no asumido).
- [ ] Si es viable en el entorno: interrumpir la base de datos brevemente y enviar un evento → confirmar que el error se propaga como 500 real, no se enmascara ni se pierde silenciosamente.

---

## 7. Logs

- [ ] Cada log de ingesta incluye contexto suficiente para reconstruir el evento (`deviceId`, tipo de evento).
- [ ] Ningún log imprime `Authorization`, `Cookie`, ni Base64 completo — hacer `grep` sobre la salida del proceso durante toda la prueba.
- [ ] Niveles correctos: éxito → info/log; dispositivo desconocido o payload inválido → warn; `error` reservado a fallos de infraestructura, nunca a un payload de cámara simplemente inválido.

---

## 8. Base de Datos

- [ ] `npx prisma migrate status` sigue "up to date" al final — nada debe haber generado drift.
- [ ] Fingerprint final vs. inicial (mismo query de §0): confirmar que las tablas no relacionadas con cámaras (`tenants`, `cities`, `users`, `vehicles`, `parking_sessions`, etc.) no cambiaron.
- [ ] `camera_events_raw` acumula un registro por cada request real recibido, sin excepción — incluidos los inválidos.
- [ ] TTL/purga de Base64: **no implementado todavía** (commit futuro) — el contenido va a permanecer indefinidamente durante esta prueba; anotar el tamaño acumulado si la prueba se extiende.

---

## 9. ParkingSpace

- [ ] El `status` final de la plaza probada coincide con el estado físico real al cierre de la prueba.
- [ ] Ninguna otra `ParkingSpace` (de otra zona/cámara) fue tocada.
- [ ] Si hay más de un tenant de prueba disponible: confirmar que un evento de una cámara del tenant A nunca afecta plazas del tenant B — mismo principio de aislamiento ya validado en Fase 0.

---

## 10. Historial (ParkingSpaceStatusHistory)

- [ ] Una fila por cada **transición real** de estado — si el estado no cambia, no debe crearse fila nueva (ya cubierto en tests unitarios; ahora confirmar contra hardware real).
- [ ] `previousStatus`/`newStatus`/`source='CAMERA'`/`sourceEventId` apuntan al `CameraEvent` correcto:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT \"previousStatus\", \"newStatus\", source, \"sourceEventId\", \"changedAt\"
    FROM parking_space_status_history ORDER BY \"changedAt\" DESC LIMIT 10;"'
  ```
- [ ] Orden cronológico correcto vía `changedAt`.

---

## 11. Auditoría (AuditLog) — fuera de alcance en esta fase

- [ ] Confirmar explícitamente: **no hay endpoints administrativos todavía** (aprobar cámara, remapear zona — commit futuro), por lo que no se espera ninguna fila nueva en `audit_logs` como resultado de esta prueba.
- [ ] Verificar que `audit_logs` no cambió (cuenta de filas antes/después idéntica).
- [ ] El único cambio manual de esta prueba (asignar tenant/zona a la cámara, §1) se hizo por SQL directo — **no queda registrado en `AuditLog`**. Dejar constancia explícita en el reporte de la prueba de qué se ejecutó y cuándo.

---

## 12. Métricas — fuera de alcance en esta fase

- [ ] Confirmar explícitamente: no existe todavía `/camera-gateway/metrics` ni `/health/camera-gateway` (commits futuros).
- [ ] Sustituto manual para esta prueba — contar por tipo y estado de procesamiento:
  ```
  docker exec ai-postgres sh -c 'psql -U "$POSTGRES_USER" -d smart_city_platform -c "
    SELECT \"eventType\", \"processingStatus\", count(*)
    FROM camera_events_raw GROUP BY \"eventType\", \"processingStatus\" ORDER BY 1,2;"'
  ```
  → usar este resultado como línea base de referencia antes de que el endpoint de métricas exista.

---

## Cierre

- [ ] Documentar: `DeviceID` real usado, IP de la cámara, hora de inicio/fin, y **todos** los UPDATE/INSERT manuales ejecutados por fuera de la aplicación (no quedan en `AuditLog`).
- [ ] Fingerprint final completo, comparado línea por línea contra el inicial (§0).
- [ ] Decidir: ¿los datos generados por esta prueba se conservan como fixture real, o se limpian antes de continuar con el roadmap (commit de imágenes)?

---

**No se ha modificado ningún archivo, dependencia, migración ni commit al generar este checklist.** Queda a la espera de tu confirmación antes de conectar la cámara y comenzar la ejecución.
