import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="h-full flex items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto h-12 w-12 rounded bg-secondary grid place-items-center text-primary">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[24px] font-semibold text-primary">403</h1>
        <h2 className="mt-1 text-[16px] font-semibold">Acceso denegado</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          No tiene permisos para acceder a este módulo.
        </p>
        <Link
          to="/overview"
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
