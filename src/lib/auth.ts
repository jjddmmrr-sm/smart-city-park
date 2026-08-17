import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions?: string[];
  zones?: { id: string; code: string; name: string; status: string }[];
};

// Auth state lives in localStorage, which React doesn't observe by default —
// components that read isAuthenticated() once (e.g. in an effect with `[]`
// deps) go stale after login/logout because nothing tells them to re-render.
// This event is the explicit signal: saveAuth/logout fire it, useAuthState
// listens for it, so persistent components (like the root Navbar, which
// never remounts across client-side navigation) stay in sync without
// requiring a full page reload.
const AUTH_EVENT = "smartpark:auth-changed";

export function saveAuth(accessToken: string, user: AuthUser) {
  localStorage.setItem("smartpark_token", accessToken);
  localStorage.setItem("smartpark_user", JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT));
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
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("smartpark_token"));
}

export function logout() {
  localStorage.removeItem("smartpark_token");
  localStorage.removeItem("smartpark_user");
  window.dispatchEvent(new Event(AUTH_EVENT));
  window.location.href = "/admin/login";
}

/** Reactive counterpart to isAuthenticated() — re-renders on login/logout. */
export function useAuthState() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  useEffect(() => {
    const sync = () => setAuthenticated(isAuthenticated());
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return authenticated;
}
