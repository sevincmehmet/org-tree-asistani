// Ağaç üzerinde saf yardımcılar: kapsam, zincir, yol. Hem arayüz hem mock kullanır.
import type { AgacKisi, Json, JsonNesne } from "../api/tipler";

export type KisiHaritasi = Map<string, AgacKisi>;

export const haritala = (agac: AgacKisi[]): KisiHaritasi => new Map(agac.map((k) => [k.id, k]));

/** state.agac'ı güvenli biçimde okur. */
export function agacOku(state: JsonNesne | undefined): AgacKisi[] | null {
  const ham = state?.agac;
  if (!Array.isArray(ham) || ham.length === 0) return null;
  return ham.filter((k): k is JsonNesne => !!k && typeof k === "object" && !Array.isArray(k)).map((k) => ({
    id: String(k.id),
    ad: String(k.ad ?? k.id),
    unvan: String(k.unvan ?? ""),
    departman_id: String(k.departman_id ?? ""),
    departman: String(k.departman ?? ""),
    yonetici: k.yonetici == null ? null : String(k.yonetici),
  }));
}

/** Kişi + bütün alt ağacı. */
export function altAgac(agac: AgacKisi[], id: string): Set<string> {
  const sonuc = new Set<string>([id]);
  let degisti = true;
  while (degisti) {
    degisti = false;
    for (const k of agac) {
      if (k.yonetici && sonuc.has(k.yonetici) && !sonuc.has(k.id)) {
        sonuc.add(k.id);
        degisti = true;
      }
    }
  }
  return sonuc;
}

/** Kişiden köke: [kişi, yöneticisi, ..., kök]. */
export function zincir(harita: KisiHaritasi, id: string): string[] {
  const yol: string[] = [];
  let simdiki: string | null = id;
  while (simdiki && harita.has(simdiki) && !yol.includes(simdiki)) {
    yol.push(simdiki);
    simdiki = harita.get(simdiki)!.yonetici;
  }
  return yol;
}

/** Aktif kullanıcıdan hedefe yukarıdan aşağı yol (hedef kapsam dışıysa null). */
export function asagiYol(harita: KisiHaritasi, aktif: string, hedef: string): string[] | null {
  const z = zincir(harita, hedef);
  const i = z.indexOf(aktif);
  return i < 0 ? null : z.slice(0, i + 1).reverse();
}

export interface Kapsam {
  kapsam: Set<string>;
  ustZincir: Set<string>;
}

export function kapsamHesapla(agac: AgacKisi[], aktif: string): Kapsam {
  const harita = haritala(agac);
  return { kapsam: altAgac(agac, aktif), ustZincir: new Set(zincir(harita, aktif).slice(1)) };
}

/** Argüman değerini kısa gösterir; kişi id'lerini adla yazar. */
export function degerGoster(v: Json, harita: KisiHaritasi): string {
  if (typeof v === "string") {
    const k = harita.get(v);
    return k ? k.ad : `"${v}"`;
  }
  return JSON.stringify(v);
}
