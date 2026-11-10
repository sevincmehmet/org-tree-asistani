// d3-hierarchy ile "tidy tree" yerleşimi (sadece hesap; çizim React'te).
// Kompakt org şeması: bütün çocukları yaprak olan yöneticinin ekibi, altında dikey bir
// yığın olarak dizilir. Böylece ağaç dar bir panele de okunur boyutta sığar.
import { stratify, tree } from "d3-hierarchy";
import type { AgacKisi } from "../api/tipler";

export const KART_G = 216;
export const KART_Y = 74;
const YATAY_ARA = 28;
const DIKEY_ARA = 56;
const YIGIN_GIRINTI = 28;
const YIGIN_ARA = 12;

export interface Konum {
  kisi: AgacKisi;
  x: number; // kartın orta noktası
  y: number; // kartın üst kenarı
  yigin: boolean; // yöneticisinin altında dikey yığında mı
}

export interface Duzen {
  konumlar: Map<string, Konum>;
  kenarlar: { ust: string; alt: string }[];
  sinir: { minX: number; maxX: number; minY: number; maxY: number };
}

type Satir = { id: string; yonetici: string | null };

export function duzenHesapla(agac: AgacKisi[]): Duzen {
  const idler = new Set(agac.map((k) => k.id));
  const kokler = agac.filter((k) => !k.yonetici || !idler.has(k.yonetici));
  const SANAL = "__kok__";
  const ustu = (k: AgacKisi) => (k.yonetici && idler.has(k.yonetici) ? k.yonetici : kokler.length > 1 ? SANAL : null);

  const cocuklar = new Map<string, AgacKisi[]>();
  for (const k of agac) {
    const u = ustu(k);
    if (u) cocuklar.set(u, [...(cocuklar.get(u) ?? []), k]);
  }
  // Bütün çocukları yaprak olan (ve sanal kök olmayan) yöneticiler yığın sahibi olur.
  const yiginSahibi = new Set(
    [...cocuklar.entries()].filter(([u, cs]) => u !== SANAL && cs.every((c) => !cocuklar.has(c.id))).map(([u]) => u),
  );
  const yigindaMi = (k: AgacKisi) => {
    const u = ustu(k);
    return !!u && yiginSahibi.has(u);
  };

  // Yığının kapladığı alanı d3'e anlatmak için yığın sahibinin altına görünmez "hayalet" zincir eklenir.
  const HAYALET = "__hayalet__";
  const hayaletler: Satir[] = [];
  for (const sahip of yiginSahibi) {
    const n = cocuklar.get(sahip)?.length ?? 0;
    const seviye = Math.ceil((22 + n * (KART_Y + YIGIN_ARA)) / (KART_Y + DIKEY_ARA));
    let ust = sahip;
    for (let i = 0; i < seviye; i++) {
      const id = `${HAYALET}${sahip}-${i}`;
      hayaletler.push({ id, yonetici: ust });
      ust = id;
    }
  }
  const satirlar: Satir[] = [
    ...(kokler.length > 1 ? [{ id: SANAL, yonetici: null }] : []),
    ...agac.filter((k) => !yigindaMi(k)).map((k) => ({ id: k.id, yonetici: ustu(k) })),
    ...hayaletler,
  ];
  const kok = stratify<Satir>()
    .id((d) => d.id)
    .parentId((d) => d.yonetici)(satirlar);
  kok.sort((a, b) => a.id!.localeCompare(b.id!));
  tree<Satir>()
    .nodeSize([KART_G + YATAY_ARA, KART_Y + DIKEY_ARA])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.1) + (a.id!.startsWith(HAYALET) || b.id!.startsWith(HAYALET) ? 0.16 : 0))(kok);

  const harita = new Map(agac.map((k) => [k.id, k]));
  const konumlar = new Map<string, Konum>();
  const kayma = kokler.length > 1 ? KART_Y + DIKEY_ARA : 0;
  for (const d of kok.descendants()) {
    if (d.id === SANAL || d.id!.startsWith(HAYALET)) continue;
    konumlar.set(d.id!, { kisi: harita.get(d.id!)!, x: d.x ?? 0, y: (d.y ?? 0) - kayma, yigin: false });
  }
  for (const sahip of yiginSahibi) {
    const s = konumlar.get(sahip);
    if (!s) continue;
    const ekip = [...(cocuklar.get(sahip) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    ekip.forEach((k, i) => {
      konumlar.set(k.id, { kisi: k, x: s.x + YIGIN_GIRINTI, y: s.y + KART_Y + 22 + i * (KART_Y + YIGIN_ARA), yigin: true });
    });
  }

  const kenarlar: Duzen["kenarlar"] = [];
  const sinir = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [id, k] of konumlar) {
    sinir.minX = Math.min(sinir.minX, k.x - KART_G / 2);
    sinir.maxX = Math.max(sinir.maxX, k.x + KART_G / 2);
    sinir.minY = Math.min(sinir.minY, k.y);
    sinir.maxY = Math.max(sinir.maxY, k.y + KART_Y);
    const u = ustu(k.kisi);
    if (u && u !== SANAL && konumlar.has(u)) kenarlar.push({ ust: u, alt: id });
  }
  return { konumlar, kenarlar, sinir };
}

/**
 * Yöneticiden (ust) çalışana (alt) dirsekli çizgi. Komut yapısı hep "M V H V" → taşımada
 * framer-motion `d`'yi sorunsuz ara değerler.
 */
export function dirsek(ust: Konum, alt: Konum): string {
  if (alt.yigin) {
    const sx = alt.x - KART_G / 2 - 12;
    const orta = alt.y + KART_Y / 2;
    return `M ${sx} ${ust.y + KART_Y} V ${orta} H ${alt.x - KART_G / 2} V ${orta}`;
  }
  const ay = ust.y + KART_Y;
  const orta = (ay + alt.y) / 2;
  return `M ${ust.x} ${ay} V ${orta} H ${alt.x} V ${alt.y}`;
}

/** Yol animasyonu için yönlü çizgi: a'dan b'ye (biri diğerinin yöneticisi). */
export function yonluDirsek(a: Konum, b: Konum, aUstte: boolean): string {
  if (aUstte) return dirsek(a, b);
  // Aşağıdan yukarı: aynı çizgiyi ters sırayla çiz.
  const [m, ...komutlar] = dirsek(b, a).split(/ (?=[VH])/);
  const sayilar = m.slice(2).split(" ").map(Number);
  let x = sayilar[0];
  let y = sayilar[1];
  const noktalar: [number, number][] = [[x, y]];
  for (const k of komutlar) {
    const v = Number(k.slice(2));
    if (k[0] === "V") y = v;
    else x = v;
    noktalar.push([x, y]);
  }
  noktalar.reverse();
  return `M ${noktalar.map(([px, py]) => `${px} ${py}`).join(" L ")}`;
}
