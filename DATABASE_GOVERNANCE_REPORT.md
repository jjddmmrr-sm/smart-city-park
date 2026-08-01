# Database Governance Report — Smart City Park

**Generado**: 2026-08-01
**Autor**: Claude Code, actuando como Principal Database Architect / Lead Prisma Engineer
**Alcance**: Congelar y documentar el estado exacto del sistema (repositorio, base de datos, Prisma, historial de migraciones) antes de ejecutar cualquier reconciliación.
**Naturaleza de este documento**: evidencia de solo lectura. Ninguna sentencia DDL, `migrate resolve`, `migrate reset`, `migrate deploy`, `db push`, commit o push fue ejecutada para producirlo.

---

## 1. Estado del repositorio

| Campo | Valor |
|---|---|
| Rama | `main` |
| HEAD | `9811544f1439642c8d1a8ea0149e82a160f9c311` |
| Upstream | `origin/main` |
| Divergencia | 3 commits por delante de `origin/main`, 0 por detrás (`+3 -0`) — no pusheados |
| Árbol de trabajo | Limpio (sin cambios modificados, sin archivos sin seguimiento) |

**Últimos 5 commits:**
```
9811544 (HEAD -> main) test(parking): cover multi-tenant isolation and the new auth guards
110e335 fix(parking): enforce real tenant isolation in parking and frontend services
baa9f7f fix(auth): protect frontend endpoints and restrict CORS to an allowlist
3ea5e71 (tag: v0.2.0, origin/main, origin/HEAD) feat(platform): adopt AI Enterprise Platform v0.1.0 and integrate backend foundation (#1)
750f72b Refined footer with white bg
```

Los 3 commits no pusheados (`9811544`, `110e335`, `baa9f7f`) corresponden a la Fase 0 (aislamiento multi-tenant, guards de autenticación, CORS y sus tests) y **no tocan la base de datos** — son cambios de código de aplicación exclusivamente. El commit `3ea5e71` (`v0.2.0`) es el punto sobre el que se hizo la auditoría original y coincide con `origin/main`.

Este documento (`DATABASE_GOVERNANCE_REPORT.md`) queda como archivo sin seguimiento en el working tree — no fue commiteado.

---

## 2. Estado de la base de datos

| Campo | Valor |
|---|---|
| Host | `127.0.0.1` (loopback local) |
| Puerto | `5432` |
| Base de datos | `smart_city_platform` |
| Clasificación de entorno | Desarrollo local (no es el droplet del piloto en `167.99.119.186`) |
| Tamaño real | `9215 kB` (~9.2 MB) — vía `pg_database_size(current_database())` |
| Tablas reales (`information_schema.tables`, `base table`) | **23** (22 tablas de aplicación + `_prisma_migrations`) |

**Espacio en disco disponible para respaldo** (`df -h ~`):
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1       116G   14G  102G  12% /
```
102 GB disponibles frente a una base de 9.2 MB — el respaldo completo o schema-only no representa ningún riesgo de espacio.

**Listado completo de las 23 tablas reales:**
`_prisma_migrations`, `audit_logs`, `camera_events`, `cameras`, `cities`, `enforcement_cases`, `fine_types`, `fines`, `inspectors`, `parking_rates`, `parking_sessions`, `parking_spaces`, `parking_zones`, `payment_methods`, `payments`, `permissions`, `role_permissions`, `roles`, `tenants`, `user_roles`, `user_zone_access`, `users`, `vehicles`.

---

## 3. Estado de Prisma

- `schema.prisma`: 22 modelos, **sin modificar** en este documento (no se sobrescribió con la introspección).
- Introspección de solo lectura ejecutada: `npx prisma db pull --print`.
- El resultado se guardó como evidencia **temporal**, fuera del repositorio, en:
  `/tmp/claude-1000/-home-architect-ai-lab-projects-smart-city-park/b3c4c15e-a9f2-4235-8c80-691b6428fb51/scratchpad/prisma_introspected_snapshot_20260801_055339.prisma`
- Conclusión de la comparación `schema.prisma` (committeado) vs. introspección real: **coinciden exactamente** en los 22 modelos — mismas columnas, tipos, defaults, relaciones y `@@map`. La única diferencia detectada son los 10 `@@index([tenantId])` que ya están en `schema.prisma` (agregados en la Fase 0, commit `110e335`) pero **todavía no existen** en la base real — confirmado porque la introspección no reporta ningún `@@index` en ningún modelo.
- Sin `enum` en el schema (verificado, no aplica a este drift).

---

## 4. Estado del historial de migraciones

**Migraciones existentes en `prisma/migrations/`:**
```
20260527023824_init_foundation
20260529024829_add_parking_foundation
```
`migration_lock.toml` → `provider = "postgresql"` (correcto, sin cambios de proveedor).

**Contenido real de `_prisma_migrations`** (vía `SELECT` de solo lectura):
```json
{"migration_name":"20260527023824_init_foundation","started_at":"2026-05-27T02:38:24.086Z","finished_at":"2026-05-27T02:38:24.163Z","applied_steps_count":1,"rolled_back_at":null}
{"migration_name":"20260529024829_add_parking_foundation","started_at":"2026-05-29T02:48:29.979Z","finished_at":"2026-05-29T02:48:30.010Z","applied_steps_count":1,"rolled_back_at":null}
```
Exactamente 2 filas, ambas finalizadas, ninguna revertida. Sin rastro de las 13 tablas restantes.

**Salida de `npx prisma migrate status`:**
```
2 migrations found in prisma/migrations
Database schema is up to date!
```

> **Hallazgo de gobernanza crítico**: `prisma migrate status` reporta "up to date" a pesar del drift real. Esto **no es un error del comando** — `migrate status` solo verifica que las migraciones *listadas en la carpeta* estén *marcadas como aplicadas* en `_prisma_migrations`; no compara la estructura real de la base contra `schema.prisma` ni contra el catálogo de PostgreSQL. Como las 2 migraciones existentes sí están aplicadas, el comando da luz verde aunque falten 13 tablas de documentación. **No se puede confiar en `migrate status` como señal de salud del esquema en este proyecto** — el drift solo se detecta con `migrate dev` (que sí compara contra la base real, como se vio en la sesión anterior) o con `migrate diff --from-migrations ... --to-config-datasource`.

**Migraciones faltantes**: una migración de reconciliación retroactiva que documente las 13 tablas ya existentes en Postgres pero ausentes del historial (ver §5 y el análisis previo ya entregado en la conversación), y, por separado, una migración nueva para los 10 índices `@@index([tenantId])` de la Fase 0.

---

## 5. Evidencia del drift

| Fuente comparada | Resultado |
|---|---|
| Migraciones committeadas (A) | 9 tablas: `tenants`, `cities`, `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `parking_zones`, `parking_spaces` |
| `schema.prisma` actual (B) | 22 modelos (las 9 anteriores + 13 más) + 10 `@@index([tenantId])` no presentes en la base real |
| PostgreSQL real, vía introspección (C) | 22 tablas de aplicación, estructuralmente idénticas a (B) en columnas/tipos/FKs/únicos, **sin** los 10 índices nuevos |

**Tablas presentes en (B) y (C) pero ausentes en (A) — 13:**
`audit_logs`, `camera_events`, `cameras`, `enforcement_cases`, `fine_types`, `fines`, `inspectors`, `parking_rates`, `parking_sessions`, `payment_methods`, `payments`, `user_zone_access`, `vehicles`.

**Objetos asociados a esas 13 tablas** (ya derivados por introspección directa en el turno anterior de esta conversación, no repetidos aquí por espacio): 13 `CREATE TABLE`, 6 `CREATE INDEX` (únicos), 37 `ALTER TABLE ... ADD CONSTRAINT` (FK). El SQL completo, extraído verbatim de `prisma migrate diff --from-empty --to-config-datasource --script` y filtrado a estos 13 objetos, ya fue entregado y validado en el mensaje anterior de esta conversación — se mantiene vigente y no fue modificado.

**Diferencia adicional, en sentido contrario** (presente en B, ausente en C): los 10 `@@index([tenantId])` de la Fase 0 — no forman parte del drift histórico, son trabajo nuevo pendiente de migración separada.

**Causa raíz probable**: las 13 tablas se crearon mediante `prisma db push` (o SQL manual equivalente) en algún momento posterior a `add_parking_foundation`, sin generar una migración committeada — consistente con el riesgo ya documentado en `PROJECT_CONTEXT.md`.

---

## 6. Riesgos

| Riesgo | Severidad | Detalle |
|---|---|---|
| Falsa sensación de seguridad de `migrate status` | Alta | Ya documentado en §4 — cualquier persona del equipo que confíe solo en ese comando asumirá que no hay drift. |
| Pérdida de trazabilidad histórica | Media | No hay forma de saber, a partir del historial de Git, cuándo ni por qué se crearon las 13 tablas — no hay migración ni commit que lo explique. |
| Migración de reconciliación con nombres incorrectos | Baja | Mitigado: el SQL propuesto se generó por introspección real, no a mano. |
| Aplicar la reconciliación como `CREATE` real en vez de `resolve` | Alta si ocurriera | Fallaría inmediatamente (`already exists`) porque los objetos ya existen — el procedimiento correcto es `migrate resolve --applied`, nunca ejecutar el SQL. |
| Entorno del piloto (`167.99.119.186`) con el mismo o distinto drift | Desconocido | Este informe **solo cubre la base local** (`127.0.0.1`). No hay visibilidad de si el entorno del piloto tiene el mismo problema, uno peor, o ninguno — requiere auditoría separada antes de aplicar nada allí. |
| Ventana entre este snapshot y la ejecución futura | Baja | Entorno local sin tráfico concurrente conocido; el riesgo de que la base cambie entre este informe y la reconciliación es bajo pero no nulo. |

---

## 7. Plan de reconciliación (propuesto, no ejecutado)

1. Ejecutar el respaldo completo (§Backup) y el respaldo schema-only, y verificarlos.
2. Crear la carpeta y el archivo de migración retroactiva con el SQL de §5 (ya validado en el turno anterior).
3. `npx prisma migrate resolve --applied <migración_de_reconciliación>` — marca como aplicada sin ejecutar DDL.
4. `npx prisma migrate status` — confirmar "up to date" de forma ahora sí consistente con la realidad.
5. Recién entonces, `npx prisma migrate dev --create-only --name add_tenant_scoping_indexes` para generar la migración de los 10 índices de la Fase 0, ya sin bloqueo por drift.
6. Revisar ese archivo generado (debe contener únicamente los 10 `CREATE INDEX`).
7. Aplicar los índices solo con aprobación explícita separada (`migrate dev` en local o `migrate deploy` en cualquier entorno compartido).
8. Repetir un ejercicio de auditoría equivalente contra el entorno del piloto antes de replicar cualquier paso ahí.

Ningún paso de este plan fue ejecutado.

---

## 8. Estrategia de rollback

- **Respaldo completo** (`pg_dump` formato custom): permite restauración total con `pg_restore` si algo sale mal en cualquier paso posterior, incluso fuera del alcance de Prisma.
- **Migración de reconciliación**: al ser `migrate resolve` (metadata pura, sin DDL), revertirla es `DELETE FROM "_prisma_migrations" WHERE migration_name = '<nombre>';` — no hay riesgo de pérdida de datos porque nunca se ejecuta SQL estructural.
- **Migración de índices**: reversible con `DROP INDEX` por cada uno (aditiva, sin pérdida de datos).
- **Snapshot Prisma temporal**: sirve como referencia de verificación post-reconciliación (comparar una nueva introspección contra este snapshot para confirmar que nada cambió salvo lo esperado).

---

## 9. Recomendaciones

1. Mantener las 2 migraciones existentes; agregar la reconciliación como migración adicional (no reemplazar el historial) — no hay razón técnica para un baseline nuevo.
2. Tratar `prisma migrate status` como insuficiente por sí solo; incorporar `prisma migrate diff --from-migrations ... --to-config-datasource --script --exit-code` (o equivalente) como chequeo periódico de verdad — devuelve código de salida distinto si hay diferencias, apto para CI.
3. Prohibir `prisma db push` contra cualquier base que no sea completamente descartable — es la causa raíz de este drift.
4. Antes de tocar el entorno del piloto, repetir este mismo informe de gobernanza contra su `DATABASE_URL` real.
5. Una vez reconciliado el historial local, considerar commitear la migración de reconciliación y este informe juntos, con un mensaje de commit explícito que documente la causa raíz para futuros lectores del historial de Git.

---

## 10. Checklist para ejecutar la reconciliación (cuando se apruebe)

- [ ] Confirmar ruta y nombre de archivo del backup completo
- [ ] Ejecutar `pg_dump` completo (formato custom)
- [ ] Ejecutar `pg_dump` schema-only
- [ ] Verificar ambos backups (`pg_restore --list`)
- [ ] Crear carpeta `prisma/migrations/<timestamp>_reconcile_undocumented_schema/`
- [ ] Escribir `migration.sql` con el SQL validado en §5
- [ ] `npx prisma migrate resolve --applied <timestamp>_reconcile_undocumented_schema`
- [ ] `npx prisma migrate status` → confirmar "up to date"
- [ ] Nueva introspección (`db pull --print`) y comparar contra el snapshot de este informe → deben coincidir
- [ ] `npx prisma migrate dev --create-only --name add_tenant_scoping_indexes`
- [ ] Revisar que el archivo generado contenga únicamente los 10 `CREATE INDEX`
- [ ] Aprobación explícita separada antes de aplicar los índices
- [ ] Aprobación explícita separada antes de `git add` / `git commit` de la migración de reconciliación

---

## Anexo — Comandos de respaldo (preparados, no ejecutados)

### Backup completo (formato custom, restaurable selectivamente)
```bash
cd apps/api
mkdir -p ~/db-backups
set -a
source .env
set +a
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$HOME/db-backups/smart_city_platform_full_$(date +%Y%m%d_%H%M%S).dump"
```
- **Ruta**: `~/db-backups/` (fuera del repositorio, evita repetir el problema de archivos `.backup.*` sueltos ya encontrado en la Fase 0).
- **Nombre**: `smart_city_platform_full_<YYYYMMDD_HHMMSS>.dump` — timestamped, no colisiona con respaldos previos.
- **Espacio**: 102 GB disponibles vs. 9.2 MB de base — sin riesgo.
- **Credenciales**: nunca se imprimen; `source .env` las exporta al shell sin mostrarlas, `pg_dump "$DATABASE_URL"` las referencia sin expandirlas en pantalla.

### Backup schema-only (SQL plano, legible, para diff manual)
```bash
cd apps/api
mkdir -p ~/db-backups
set -a
source .env
set +a
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="$HOME/db-backups/smart_city_platform_schema_$(date +%Y%m%d_%H%M%S).sql"
```
Mismas validaciones de ruta/espacio/credenciales que el backup completo.

**Ninguno de los dos comandos fue ejecutado.**
