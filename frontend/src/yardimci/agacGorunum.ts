// Ağaç görünümleri (Liste + Şema) için saf yardımcılar: çocuklar, aç/kapa, görünür alt küme, odak.
import type { AgacKisi } from "../api/tipler";
import { haritala, zincir } from "./org";

export type CocukHaritasi = Map<string, string[]>;

/** yönetici id → doğrudan ekip id'leri (id sırasıyla). Kökler "" anahtarında. */
export function cocuklariHesapla(agac: AgacKisi[]): CocukHaritasi {
  const idler = new Set(agac.map((k) => k.id));
  const c: CocukHaritasi = new Map();
  for (const k of agac) {
    const u = k.yonetici && idler.has(k.yonetici) ? k.yonetici : "";
    c.set(u, [...(c.get(u) ?? []), k.id]);
  }
  for (const liste of c.values()) liste.sort();
  return c;
}

/** Kişinin üstleri (kendisi hariç), en yakından köke. */
export function atalar(agac: AgacKisi[], id: string): string[] {
  return zincir(haritala(agac), id).slice(1);
}

/** Verilen kişileri görünür kılmak için açık olması gereken bütün yöneticiler. */
export function acilmasiGerekenler(agac: AgacKisi[], idler: Iterable<string>): Set<string> {
  const harita = haritala(agac);
  const s = new Set<string>();
  for (const id of idler) zincir(harita, id).slice(1).forEach((x) => s.add(x));
  return s;
}

/** Açık olmayan yöneticilerin altını gizler. Kökler hep görünür. */
export function gorunurAgac(agac: AgacKisi[], acik: Set<string>): AgacKisi[] {
  const harita = haritala(agac);
  const gorunur = (k: AgacKisi): boolean => {
    let u = k.yonetici;
    const gorulen = new Set<string>();
    while (u && harita.has(u) && !gorulen.has(u)) {
      if (!acik.has(u)) return false;
      gorulen.add(u);
      u = harita.get(u)!.yonetici;
    }
    return true;
  };
  return agac.filter(gorunur);
}

/** Odak modu: kişi + yöneticisi + doğrudan ekibi. */
export function odakAgaci(agac: AgacKisi[], id: string): AgacKisi[] {
  const kisi = agac.find((k) => k.id === id);
  if (!kisi) return agac;
  const idler = new Set([id, ...(kisi.yonetici ? [kisi.yonetici] : []), ...agac.filter((k) => k.yonetici === id).map((k) => k.id)]);
  return agac.filter((k) => idler.has(k.id)).map((k) => (k.id === kisi.yonetici ? { ...k, yonetici: null } : k));
}

/** Ağaçta bir kişinin seviyesi (kök = 0). */
export const seviye = (agac: AgacKisi[], id: string) => atalar(agac, id).length;

export function basHarfler(ad: string): string {
  const p = ad.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase("tr");
}
