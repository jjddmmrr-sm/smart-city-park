import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SimProvider } from "@/lib/sim";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-primary tabular-nums">404</h1>
        <h2 className="mt-3 text-base font-semibold">Página no encontrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La página que busca no existe en el sistema.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Volver al Mapa en Vivo
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Smart Park Chone — Operations Control Center" },
      {
        name: "description",
        content:
          "Municipal smart parking operations control center for Chone, Ecuador. Real-time monitoring, enforcement and analytics.",
      },
      { property: "og:title", content: "Smart Park Chone — Operations Control Center" },
      { name: "twitter:title", content: "Smart Park Chone — Operations Control Center" },
      {
        property: "og:description",
        content:
          "Municipal smart parking operations control center for Chone, Ecuador. Real-time monitoring, enforcement and analytics.",
      },
      {
        name: "twitter:description",
        content:
          "Municipal smart parking operations control center for Chone, Ecuador. Real-time monitoring, enforcement and analytics.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eb6edbcb-4304-4337-bf1c-8def3f5b1dee/id-preview-1804c020--cb183c80-208d-49b8-bea9-eb818b6e05fe.lovable.app-1776739443797.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eb6edbcb-4304-4337-bf1c-8def3f5b1dee/id-preview-1804c020--cb183c80-208d-49b8-bea9-eb818b6e05fe.lovable.app-1776739443797.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <SimProvider>
      <div className="flex flex-col h-screen">
        <Navbar />
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
        <Footer />
      </div>
    </SimProvider>
  );
}
