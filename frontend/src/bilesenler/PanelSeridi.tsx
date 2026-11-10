// Kapatılmış bir panelin yerinde kalan ince şerit (sadece lg+). Tıklayınca panel geri açılır.
import { PanelLeftOpen, PanelRightOpen, type LucideIcon } from "lucide-react";

interface Props {
  taraf: "sol" | "sag";
  etiket: string;
  Ikon: LucideIcon;
  ac: () => void;
  /** Şeritte gösterilecek küçük sayı (ör. bekleyen talepler). */
  rozet?: number;
}

export function PanelSeridi({ taraf, etiket, Ikon, ac, rozet = 0 }: Props) {
  const AcIkon = taraf === "sol" ? PanelLeftOpen : PanelRightOpen;
  return (
    <button
      type="button"
      onClick={ac}
      aria-label={`${etiket} panelini aç`}
      title={`${etiket} panelini aç`}
      className="kart group flex h-full w-full flex-col items-center gap-3 py-3 text-soluk transition-colors hover:bg-hover hover:text-metin"
    >
      <AcIkon size={16} aria-hidden />
      <span className="relative">
        <Ikon size={16} className="text-vurgu" aria-hidden />
        {rozet > 0 && (
          <span className="absolute -top-2 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-vurgu px-1 text-[10px] font-semibold text-vurgu-metin tabular-nums">
            {rozet}
          </span>
        )}
      </span>
      <span className="text-[12.5px] font-semibold tracking-wide [writing-mode:vertical-rl]">{etiket}</span>
    </button>
  );
}
