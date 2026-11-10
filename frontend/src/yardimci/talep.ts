// Talep / bildirim verisini güvenli okuma ve birleştirme (saf fonksiyonlar).
// Kaynak: state.talep_ozeti (her turun başında yazılır) + bu oturumdaki tool cevapları (daha taze olabilir).
import type { Bildirim, Json, JsonNesne, KisiOzet, Talep, TalepDurumu, TalepOzeti } from "../api/tipler";
import type { SohbetOgesi } from "../durum/sohbet";

const nesne = (d: Json | undefined): JsonNesne | null => (d && typeof d === "object" && !Array.isArray(d) ? d : null);
const metin = (d: Json | undefined, yedek = "") => (typeof d === "string" ? d : d == null ? yedek : String(d));

export function kisiOku(d: Json | undefined): KisiOzet | null {
  const n = nesne(d);
  if (!n || n.id == null) return null;
  return { id: String(n.id), ad: metin(n.ad, String(n.id)), unvan: metin(n.unvan), departman: metin(n.departman) };
}

const BOS_KISI: KisiOzet = { id: "?", ad: "?", unvan: "", departman: "" };
const DURUMLAR: TalepDurumu[] = ["onay_bekliyor", "onaylandi", "reddedildi"];

export function talepOku(d: Json | undefined): Talep | null {
  const n = nesne(d);
  if (!n || typeof n.no !== "number") return null;
  const karar = nesne(n.karar);
  const yon = nesne(n.yonlendirme);
  const durum = DURUMLAR.includes(n.durum as TalepDurumu) ? (n.durum as TalepDurumu) : "onay_bekliyor";
  return {
    no: n.no,
    zaman: metin(n.zaman),
    sahip: kisiOku(n.sahip) ?? BOS_KISI,
    tur: metin(n.tur),
    aciklama: metin(n.aciklama),
    durum,
    onaylayan: kisiOku(n.onaylayan) ?? BOS_KISI,
    karar: karar
      ? {
          karar: karar.karar === "red" ? "red" : "onay",
          not: metin(karar.not),
          zaman: metin(karar.zaman),
          veren: kisiOku(karar.veren) ?? BOS_KISI,
        }
      : null,
    yonlendirme: yon ? { hedef: kisiOku(yon.hedef) ?? BOS_KISI, gerekce: metin(yon.gerekce) } : null,
    bilgilendirilenler: Array.isArray(n.bilgilendirilenler) ? n.bilgilendirilenler.map(kisiOku).filter((k): k is KisiOzet => !!k) : [],
    gecmis: Array.isArray(n.gecmis)
      ? n.gecmis.map(nesne).filter((g): g is JsonNesne => !!g).map((g) => ({ zaman: metin(g.zaman), olay: metin(g.olay), kisi_id: metin(g.kisi_id) }))
      : [],
  };
}

export function bildirimOku(d: Json | undefined): Bildirim | null {
  const n = nesne(d);
  if (!n || typeof n.no !== "number") return null;
  return {
    no: n.no,
    zaman: metin(n.zaman),
    alici: kisiOku(n.alici) ?? BOS_KISI,
    talep_no: Number(n.talep_no ?? 0),
    tur: metin(n.tur, "bilgi"),
    mesaj: metin(n.mesaj),
    okundu: n.okundu === true,
  };
}

const liste = <T,>(d: Json | undefined, oku: (x: Json) => T | null): T[] =>
  Array.isArray(d) ? d.map(oku).filter((x): x is T => x !== null) : [];

export function talepOzetiOku(state: JsonNesne | undefined): TalepOzeti | null {
  const n = nesne(state?.talep_ozeti);
  if (!n) return null;
  return {
    gonderdiklerim: liste(n.gonderdiklerim, talepOku),
    onayimi_bekleyenler: liste(n.onayimi_bekleyenler, talepOku),
    bildirimler: liste(n.bildirimler, bildirimOku),
    guncellendi: typeof n.guncellendi === "string" ? n.guncellendi : null,
  };
}

/** Bu oturumdaki tool cevaplarında görülen talepler (sonraki görülen kazanır). */
export function sohbettenTalepler(sohbet: SohbetOgesi[]): Map<number, Talep> {
  const harita = new Map<number, Talep>();
  for (const o of sohbet) {
    if (o.tur !== "arac" || !o.cevap || o.cevap.status !== "ok") continue;
    const tekil = talepOku(o.cevap.talep);
    if (tekil) harita.set(tekil.no, tekil);
    for (const t of liste(o.cevap.talepler, talepOku)) harita.set(t.no, t);
  }
  return harita;
}

export interface BirlesikOzet extends TalepOzeti {
  /** Bilinen bütün talepler (özet + sohbet), no → talep. */
  hepsi: Map<number, Talep>;
  /** Sohbetteki tool cevabı özetten daha yeni bilgi verdi mi? */
  sohbettenGuncellendi: Set<number>;
}

/** Özet + sohbetteki daha taze talep bilgisi. Özet sadece tur başında tazelendiği için gerekli. */
export function ozetiBirlestir(ozet: TalepOzeti | null, sohbet: SohbetOgesi[]): BirlesikOzet {
  const taze = sohbettenTalepler(sohbet);
  const sohbettenGuncellendi = new Set<number>();
  const guncelle = (t: Talep): Talep => {
    const y = taze.get(t.no);
    if (y && (y.durum !== t.durum || y.gecmis.length > t.gecmis.length)) {
      sohbettenGuncellendi.add(t.no);
      return y;
    }
    return t;
  };
  const gonderdiklerim = (ozet?.gonderdiklerim ?? []).map(guncelle);
  const onayimi_bekleyenler = (ozet?.onayimi_bekleyenler ?? []).map(guncelle);
  const hepsi = new Map<number, Talep>();
  for (const t of [...taze.values(), ...gonderdiklerim, ...onayimi_bekleyenler]) hepsi.set(t.no, t);
  return {
    gonderdiklerim,
    onayimi_bekleyenler,
    bildirimler: ozet?.bildirimler ?? [],
    guncellendi: ozet?.guncellendi ?? null,
    hepsi,
    sohbettenGuncellendi,
  };
}

export const TUR_ADI: Record<string, string> = {
  izin: "İzin",
  ik: "İK",
  teknik_destek: "Teknik destek",
  ekip_destegi: "Ekip desteği",
};
export const turAdi = (t: string) => TUR_ADI[t] ?? t;

/** "2026-11-07T09:12:00" → "7 Kas 09:12" (bugünse sadece saat). */
export function zamanGoster(z: string | null | undefined): string {
  if (!z) return "";
  const d = new Date(z);
  if (Number.isNaN(d.getTime())) return z;
  const bugun = new Date();
  const ayniGun = d.toDateString() === bugun.toDateString();
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return ayniGun ? saat : `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${saat}`;
}
