import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AccessDenied } from "@/components/AccessDenied";
import { getMe, hasPermission, type Me } from "@/lib/access";
import { isAuthenticated } from "@/lib/auth";

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }

    getMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return <div className="h-full grid place-items-center bg-surface text-[13px] text-muted-foreground">Validando acceso...</div>;
  }

  if (!hasPermission(me, permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
