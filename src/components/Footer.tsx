import logoAxial from "@/assets/logo_axial.png";

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border bg-surface-2/60 backdrop-blur-sm">
      <div className="px-3 py-1.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1 sm:gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>Desarrollado por</span>
          <img
            src={logoAxial}
            alt="Axial"
            className="h-5 sm:h-7 w-auto object-contain select-none"
            draggable={false}
          />
        </div>
        <div className="tabular-nums">© Derechos Reservados</div>
      </div>
    </footer>
  );
}
