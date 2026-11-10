// Efekt listesini kişi bazında görsel duruma çevirir (Şema ve Liste görünümleri ortak kullanır).
import type { KisiHaritasi } from "../yardimci/org";
import { zincir } from "../yardimci/org";
import type { Efekt } from "./olayEslestir";

export interface EfektDurumu {
  yol: Map<string, number>; // id → sıra
  yolKenarlari: { a: string; b: string; sira: number }[];
  vurgu: Set<string>;
  nabiz: Set<string>;
  red: Set<string>;
  ortak: Set<string>;
  lca: Set<string>;
  /** v3: talep akışı (sahip → … → onaylayan), aşağıdan yukarı sıralı. */
  akis: string[][];
  onay: Set<string>;
  ret: Set<string>;
  /** v3: onaylayan → İK kesikli bilgi çizgileri. */
  bilgi: { a: string; b: string }[];
  /** v4: "↶ geri alındı" rozeti. */
  geri: Set<string>;
}

export const ADIM_SURESI = 0.38; // saniye

export const bosEfektDurumu = (): EfektDurumu => ({
  yol: new Map(),
  yolKenarlari: [],
  vurgu: new Set(),
  nabiz: new Set(),
  red: new Set(),
  ortak: new Set(),
  lca: new Set(),
  akis: [],
  onay: new Set(),
  ret: new Set(),
  bilgi: [],
  geri: new Set(),
});

export function efektDurumu(liste: Efekt[], harita?: KisiHaritasi): EfektDurumu {
  const d = bosEfektDurumu();
  for (const e of liste) {
    switch (e.tur) {
      case "yol":
        e.idler.forEach((id, i) => {
          d.yol.set(id, i);
          if (i > 0) d.yolKenarlari.push({ a: e.idler[i - 1], b: id, sira: i });
        });
        break;
      case "vurgu":
        e.idler.forEach((id) => d.vurgu.add(id));
        break;
      case "nabiz":
        e.idler.forEach((id) => d.nabiz.add(id));
        break;
      case "red":
        d.red.add(e.id);
        break;
      case "ortak":
        e.kisiler.forEach((id) => d.ortak.add(id));
        d.lca.add(e.ortak);
        break;
      case "tasima":
        d.nabiz.add(e.calisan);
        d.vurgu.add(e.yeniYonetici);
        break;
      case "akis": {
        const z = harita ? zincir(harita, e.kaynak) : [e.kaynak, e.hedef];
        const i = z.indexOf(e.hedef);
        const yol = i >= 0 ? z.slice(0, i + 1) : [e.kaynak, e.hedef];
        d.akis.push(yol);
        yol.forEach((id) => d.vurgu.add(id));
        break;
      }
      case "onay":
        d.onay.add(e.onaylayan);
        e.bilgi.forEach((b) => {
          if (b !== e.onaylayan) d.bilgi.push({ a: e.onaylayan, b });
        });
        e.bilgilendirilenler.forEach((id) => d.nabiz.add(id));
        break;
      case "ret":
        d.ret.add(e.sahip);
        break;
      case "geri":
        d.geri.add(e.id);
        break;
    }
  }
  return d;
}

/** Liste görünümü için tek kelimelik efekt sınıfı (öncelik sırasıyla). */
export type SatirEfekti = "red" | "ret" | "onay" | "lca" | "yol" | "vurgu" | "nabiz" | null;

export function satirEfekti(d: EfektDurumu, id: string): SatirEfekti {
  if (d.red.has(id)) return "red";
  if (d.ret.has(id)) return "ret";
  if (d.onay.has(id)) return "onay";
  if (d.lca.has(id) || d.ortak.has(id)) return "lca";
  if (d.yol.has(id)) return "yol";
  if (d.vurgu.has(id)) return "vurgu";
  if (d.nabiz.has(id)) return "nabiz";
  return null;
}
