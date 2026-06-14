export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

export function saveAuth(accessToken: string, user: AuthUser) {
  localStorage.setItem("smartpark_token", accessToken);
  localStorage.setItem("smartpark_user", JSON.stringify(user));
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem("smartpark_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("smartpark_token"));
}

export function logout() {
  localStorage.removeItem("smartpark_token");
  localStorage.removeItem("smartpark_user");
  window.location.href = "/admin/login";
}
