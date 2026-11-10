// Saf fonksiyon: bir ADK olayı → ağaç efektleri listesi (CONTRACT.md → "Olay → ağaç efekti", v2 + v3).
// Yan etkisi yok; kolayca birim testi yazılabilir.
import type { AdkEvent, Json, JsonNesne } from "../api/tipler";

export type Efekt =
  | { tur: "yol"; idler: string[]; yon: "asagi" | "yukari" }
  | { tur: "vurgu"; idler: string[] }
  | { tur: "ortak"; kisiler: string[]; ortak: string }
  | { tur: "nabiz"; idler: string[] }
  | { tur: "red"; id: string }
  | { tur: "tasima"; calisan: string; yeniYonetici: string }
  /** v3: talep sahipten onaylayana doğru yukarı akar. */
  | { tur: "akis"; kaynak: string; hedef: string }
  /** v3: onay → onaylayan yeşil ✓, onaylayan → İK kesikli "bilgi" çizgisi, bilgilendirilenler nabız. */
  | { tur: "onay"; onaylayan: string; bilgi: string[]; bilgilendirilenler: string[] }
  /** v3: red → talep sahibinde kırmızı ✕ rozeti. */
  | { tur: "ret"; sahip: string }
  /** v4: islemi_geri_al → kişide "↶ geri alındı" rozeti (taşıma efektiyle birlikte gelir). */
  | { tur: "geri"; id: string };

/** Olayı yorumlamak için gereken küçük bağlam (ör. talebi gönderen = aktif kullanıcı). */
export interface EslestirmeBaglami {
  aktif?: string;
}

export const IK_MUDURU = "e12";

const nesne = (d: Json | undefined): JsonNesne | null =>
  d && typeof d === "object" && !Array.isArray(d) ? d : null;

const kisiId = (d: Json | undefined): string | null => {
  const n = nesne(d);
  return n && typeof n.id === "string" ? n.id : null;
};

const kisiIdleri = (d: Json | undefined): string[] =>
  Array.isArray(d) ? d.map(kisiId).filter((x): x is string => x !== null) : [];

/** departman_agaci cevabındaki bütün kisi_idleri (alt departmanlar dahil). */
function departmanIdleri(d: Json | undefined): string[] {
  const n = nesne(d);
  if (!n) return [];
  const kendi = Array.isArray(n.kisi_idleri) ? n.kisi_idleri.filter((x): x is string => typeof x === "string") : [];
  const altlar = Array.isArray(n.alt_departmanlar) ? n.alt_departmanlar.flatMap(departmanIdleri) : [];
  return [...new Set([...kendi, ...altlar])];
}

/** Tek bir tool cevabını efekte çevirir. */
export function cevaptanEfekt(arac: string, cevap: JsonNesne, baglam: EslestirmeBaglami = {}): Efekt[] {
  if (cevap.status === "reddedildi") {
    const hedef = typeof cevap.hedef_id === "string" ? cevap.hedef_id : null;
    // Yanlış kişi karar vermeye çalıştı: gerçek onaylayan vurgulanır, aktif kişi kırmızı titrer.
    if (arac === "talebi_karara_bagla") {
      const liste: Efekt[] = [];
      if (hedef) liste.push({ tur: "vurgu", idler: [hedef] });
      if (baglam.aktif) liste.push({ tur: "red", id: baglam.aktif });
      return liste;
    }
    return hedef ? [{ tur: "red", id: hedef }] : [];
  }
  if (cevap.status !== "ok") return [];
  switch (arac) {
    case "altimda_bul": {
      const idler = kisiIdleri(cevap.yol_yukaridan_asagi);
      return idler.length ? [{ tur: "yol", idler, yon: "asagi" }] : [];
    }
    case "raporlama_zinciri": {
      const c = kisiId(cevap.calisan);
      const zincir = kisiIdleri(cevap.zincir_alttan_uste);
      const idler = c && zincir[0] !== c ? [c, ...zincir] : zincir;
      return idler.length ? [{ tur: "yol", idler, yon: "yukari" }] : [];
    }
    case "ekibi_listele": {
      const y = kisiId(cevap.yonetici);
      const idler = [...(y ? [y] : []), ...kisiIdleri(cevap.ekip)];
      return idler.length ? [{ tur: "vurgu", idler }] : [];
    }
    case "departman_agaci": {
      const idler = departmanIdleri(cevap.agac);
      return idler.length ? [{ tur: "vurgu", idler }] : [];
    }
    case "ortak_yonetici": {
      const ortak = kisiId(cevap.ortak_yonetici);
      const kisiler = kisiIdleri(cevap.kisiler);
      return ortak ? [{ tur: "ortak", kisiler, ortak }] : [];
    }
    case "calisan_ara": {
      const idler = kisiIdleri(cevap.sonuclar);
      return idler.length ? [{ tur: "nabiz", idler }] : [];
    }
    case "calisani_tasi": {
      const c = kisiId(cevap.calisan);
      const y = kisiId(cevap.yeni_yonetici);
      return c && y ? [{ tur: "tasima", calisan: c, yeniYonetici: y }] : [];
    }
    case "islemi_geri_al": {
      // Yeni geri_alma kaydı: kisi, eski_yonetici (taşındığı yer) → yeni_yonetici (geri döndüğü yer).
      const islem = nesne(cevap.islem);
      const c = kisiId(islem?.kisi);
      const y = kisiId(islem?.yeni_yonetici);
      return c && y ? [{ tur: "tasima", calisan: c, yeniYonetici: y }, { tur: "geri", id: c }] : [];
    }
    case "islem_gecmisi": {
      // Hâlâ geçerli (geri alınmamış) taşımaların kişileri nabız atar.
      const islemler = Array.isArray(cevap.islemler) ? cevap.islemler.map(nesne) : [];
      const idler = [
        ...new Set(islemler.filter((i) => i && i.tur === "tasima" && i.geri_alindi !== true).map((i) => kisiId(i?.kisi)).filter((x): x is string => x !== null)),
      ];
      return idler.length ? [{ tur: "nabiz", idler }] : [];
    }
    case "talebi_gonder": {
      const onaylayan = kisiId(cevap.onaylayan);
      const sahip = baglam.aktif;
      if (!onaylayan || !sahip) return [];
      if (onaylayan === sahip) return [{ tur: "onay", onaylayan, bilgi: [IK_MUDURU], bilgilendirilenler: [IK_MUDURU] }];
      return [{ tur: "akis", kaynak: sahip, hedef: onaylayan }];
    }
    case "onayimi_bekleyenler":
    case "ekibimin_talepleri":
    case "taleplerim": {
      const talepler = Array.isArray(cevap.talepler) ? cevap.talepler : [];
      const idler = [...new Set(talepler.map((t) => kisiId(nesne(t)?.sahip)).filter((x): x is string => x !== null))];
      return idler.length ? [{ tur: "nabiz", idler }] : [];
    }
    case "talebi_karara_bagla": {
      const t = nesne(cevap.talep);
      if (!t) return [];
      const onaylayan = kisiId(t.onaylayan) ?? kisiId(nesne(t.karar)?.veren);
      const sahip = kisiId(t.sahip);
      if (t.durum === "reddedildi") return sahip ? [{ tur: "ret", sahip }] : [];
      if (t.durum === "onaylandi" && onaylayan) {
        return [{ tur: "onay", onaylayan, bilgi: [IK_MUDURU], bilgilendirilenler: kisiIdleri(t.bilgilendirilenler) }];
      }
      return [];
    }
    default:
      return [];
  }
}

export function olayEslestir(olay: AdkEvent, baglam: EslestirmeBaglami = {}): Efekt[] {
  if (olay.partial) return [];
  const parcalar = olay.content?.parts ?? [];
  return parcalar.flatMap((p) => (p.functionResponse ? cevaptanEfekt(p.functionResponse.name, p.functionResponse.response ?? {}, baglam) : []));
}

/** Efektin dokunduğu bütün kişiler (ağaçta görünür kılmak için). */
export function efektKisileri(liste: Efekt[]): string[] {
  const s = new Set<string>();
  for (const e of liste) {
    switch (e.tur) {
      case "yol":
      case "vurgu":
      case "nabiz":
        e.idler.forEach((i) => s.add(i));
        break;
      case "ortak":
        e.kisiler.forEach((i) => s.add(i));
        s.add(e.ortak);
        break;
      case "red":
        s.add(e.id);
        break;
      case "tasima":
        s.add(e.calisan);
        s.add(e.yeniYonetici);
        break;
      case "akis":
        s.add(e.kaynak);
        s.add(e.hedef);
        break;
      case "onay":
        s.add(e.onaylayan);
        e.bilgi.forEach((i) => s.add(i));
        e.bilgilendirilenler.forEach((i) => s.add(i));
        break;
      case "ret":
        s.add(e.sahip);
        break;
      case "geri":
        s.add(e.id);
        break;
    }
  }
  return [...s];
}
