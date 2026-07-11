import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getMe, hasPermission, type Me } from "@/lib/access";
import { AccessDenied } from "@/components/AccessDenied";
import { apiGetAuth, apiPatchAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Panel } from "@/components/ui-bits";

export const Route = createFileRoute("/admin/access-control")({
  component: AccessControlPage,
  ssr: false,
});

type Role = { id: string; code: string; name: string };
type Permission = { id: string; code: string; name: string; description?: string };
type User = { id: string; name: string; email: string; roles?: string[] };
type Zone = { id: string; name: string; code: string; status: string };

function AccessControlPage() {
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }

    getMe()
      .then((currentUser) => {
        setMe(currentUser);

        if (!hasPermission(currentUser, "MANAGE_ROLES")) {
          return;
        }

        return Promise.all([
          apiGetAuth<Role[]>("/roles"),
          apiGetAuth<Permission[]>("/permissions"),
          apiGetAuth<User[]>("/users"),
          apiGetAuth<Zone[]>("/parking/zones"),
        ]).then(([r, p, u, z]) => {
          setRoles(r);
          setPermissions(p);
          setUsers(u);
          setZones(z);
          setSelectedRoleId(r[0]?.id ?? "");
          setSelectedUserId(u[0]?.id ?? "");
        });
      })
      .catch((error) => console.error("Error loading access control", error))
      .finally(() => setCheckingAccess(false));
  }, [navigate]);

  useEffect(() => {
    if (!selectedRoleId) return;

    apiGetAuth<{ permissionCodes: string[] }>(`/roles/${selectedRoleId}/permissions`)
      .then((data) => setSelectedPermissionCodes(data.permissionCodes ?? []))
      .catch((error) => console.error("Error loading role permissions", error));
  }, [selectedRoleId]);

  useEffect(() => {
    if (!selectedUserId) return;

    apiGetAuth<{ zoneIds: string[] }>(`/users/${selectedUserId}/zones`)
      .then((data) => setSelectedZoneIds(data.zoneIds ?? []))
      .catch((error) => console.error("Error loading user zones", error));
  }, [selectedUserId]);

  const selectedRole = useMemo(() => roles.find((r) => r.id === selectedRoleId), [roles, selectedRoleId]);
  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId), [users, selectedUserId]);

  const togglePermission = (code: string) => {
    setSelectedPermissionCodes((current) =>
      current.includes(code) ? current.filter((x) => x !== code) : [...current, code]
    );
  };

  const toggleZone = (id: string) => {
    setSelectedZoneIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const saveRolePermissions = async () => {
    await apiPatchAuth(`/roles/${selectedRoleId}/permissions`, {
      permissionCodes: selectedPermissionCodes,
    });
    alert("Permisos del rol actualizados");
  };

  const saveUserZones = async () => {
    await apiPatchAuth(`/users/${selectedUserId}/zones`, {
      zoneIds: selectedZoneIds,
    });
    alert("Zonas del usuario actualizadas");
  };

  if (checkingAccess) {
    return <div className="h-full grid place-items-center bg-surface text-[13px] text-muted-foreground">Validando acceso...</div>;
  }

  if (!hasPermission(me, "MANAGE_ROLES")) {
    return <AccessDenied />;
  }

  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Gobierno de Acceso</h1>
            <p className="text-[12px] text-muted-foreground">
              Configuración de permisos por rol y zonas permitidas por usuario.
            </p>
          </div>
          <Link to="/admin" className="h-8 px-3 rounded-md border border-border text-[12px] inline-flex items-center hover:bg-secondary">
            Volver
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel title="Permisos por rol">
            <div className="space-y-3 text-[12px]">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Rol</span>
                <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.code}</option>)}
                </select>
              </label>

              <div className="text-[12px] text-muted-foreground">
                Rol seleccionado: <span className="font-medium text-foreground">{selectedRole?.code ?? "N/A"}</span>
              </div>

              <div className="max-h-[480px] overflow-auto border border-border rounded-md">
                {permissions.map((p) => (
                  <label key={p.id} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0 hover:bg-surface-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPermissionCodes.includes(p.code)}
                      onChange={() => togglePermission(p.code)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-mono text-[11px] font-medium">{p.code}</div>
                      <div className="text-[12px]">{p.name}</div>
                      {p.description && <div className="text-[11px] text-muted-foreground">{p.description}</div>}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">{selectedPermissionCodes.length} permisos seleccionados</span>
                <button onClick={saveRolePermissions} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
                  Guardar permisos
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Zonas por usuario">
            <div className="space-y-3 text-[12px]">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Usuario</span>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]">
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
                </select>
              </label>

              <div className="text-[12px] text-muted-foreground">
                Usuario seleccionado: <span className="font-medium text-foreground">{selectedUser?.name ?? "N/A"}</span>
              </div>

              <div className="max-h-[480px] overflow-auto border border-border rounded-md">
                {zones.map((z) => (
                  <label key={z.id} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0 hover:bg-surface-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedZoneIds.includes(z.id)}
                      onChange={() => toggleZone(z.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-mono text-[11px] font-medium">{z.code}</div>
                      <div className="text-[12px]">{z.name}</div>
                      <div className="text-[11px] text-muted-foreground">{z.status}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">{selectedZoneIds.length} zonas seleccionadas</span>
                <button onClick={saveUserZones} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] hover:bg-primary/90">
                  Guardar zonas
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
