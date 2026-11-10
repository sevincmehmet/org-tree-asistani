import type { AgacKisi } from "../api/tipler";
import { departmanRengi } from "../veri/org";
import { basHarfler } from "../yardimci/agacGorunum";

/** Baş harfli, departman renginde yuvarlak avatar. */
export function Avatar({ kisi, boyut = 40 }: { kisi: Pick<AgacKisi, "ad" | "departman_id">; boyut?: number }) {
  const renk = departmanRengi(kisi.departman_id);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{ width: boyut, height: boyut, fontSize: boyut * 0.36, color: renk, background: `color-mix(in srgb, ${renk} 16%, transparent)` }}
    >
      {basHarfler(kisi.ad)}
    </span>
  );
}

