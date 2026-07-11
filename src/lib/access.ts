import { apiGetAuth } from "@/lib/api";

export type Me = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  zones: { id: string; code: string; name: string; status: string }[];
};

export async function getMe(): Promise<Me> {
  return apiGetAuth<Me>("/auth/me");
}

export function hasPermission(me: Me | null, permission: string) {
  if (!me) return false;
  if (me.roles.includes("SUPER_ADMIN")) return true;
  return me.permissions.includes(permission);
}
