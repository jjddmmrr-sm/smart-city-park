import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { Lock, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
  ssr: false,
});

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
};

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@smartparking.com");
  const [password, setPassword] = useState("Admin12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiPost<LoginResponse>("/auth/login", { email, password });
      saveAuth(result.accessToken, result.user);
      navigate({ to: "/admin" });
    } catch {
      setError("Credenciales inválidas o API no disponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded bg-primary text-primary-foreground grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold text-primary">Administración</h1>
            <p className="text-[12px] text-muted-foreground">Smart Park Chone</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-[12px] font-medium">
            Correo
            <div className="mt-1 flex items-center gap-2 border border-border rounded-md bg-surface px-3 h-10">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent outline-none flex-1 text-[13px]"
              />
            </div>
          </label>

          <label className="block text-[12px] font-medium">
            Contraseña
            <div className="mt-1 flex items-center gap-2 border border-border rounded-md bg-surface px-3 h-10">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent outline-none flex-1 text-[13px]"
              />
            </div>
          </label>

          {error && <div className="text-[12px] text-destructive">{error}</div>}

          <button
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-muted-foreground">
          Acceso inicial: admin@smartparking.com / Admin12345
        </div>
      </div>
    </div>
  );
}
