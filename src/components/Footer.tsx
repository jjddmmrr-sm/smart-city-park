import logoAxial from "@/assets/logo_axial.png";

export function Footer() {
  return (
    <footer className="shrink-0 bg-white border-t border-[#e5e7eb]">
      <div className="px-3 py-2 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1.5 sm:gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src={logoAxial}
            alt="Axial"
            className="h-5 sm:h-7 w-auto object-contain select-none"
            draggable={false}
          />
          <span>Desarrollado por Axial</span>
        </div>
        <div className="tabular-nums">© Derechos Reservados</div>
      </div>
    </footer>
  );
}
