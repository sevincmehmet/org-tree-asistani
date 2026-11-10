// İşlem geçmişi (audit log) verisini güvenli okuma (saf fonksiyonlar). Kaynak: state.islem_gecmisi.
import type { Islem, Json, JsonNesne, KisiOzet } from "../api/tipler";
import { kisiOku } from "./talep";

const nesne = (d: Json | undefined): JsonNesne | null => (d && typeof d === "object" && !Array.isArray(d) ? d : null);
const sayiVeyaNull = (d: Json | undefined) => (typeof d === "number" ? d : d == null || d === "" ? null : Number.isFinite(Number(d)) ? Number(d) : null);
const BOS_KISI: KisiOzet = { id: "?", ad: "?", unvan: "", departman: "" };

export function islemOku(d: Json | undefined): Islem | null {
  const n = nesne(d);
  if (!n || typeof n.no !== "number") return null;
  return {
    no: n.no,
    zaman: typeof n.zaman === "string" ? n.zaman : "",
    tur: n.tur === "geri_alma" ? "geri_alma" : "tasima",
    kisi: kisiOku(n.kisi) ?? BOS_KISI,
    eski_yonetici: kisiOku(n.eski_yonetici) ?? BOS_KISI,
    yeni_yonetici: kisiOku(n.yeni_yonetici) ?? BOS_KISI,
    yapan: kisiOku(n.yapan) ?? BOS_KISI,
    geri_alindi: n.geri_alindi === true,
    geri_alan_no: sayiVeyaNull(n.geri_alan_no),
    hedef_no: sayiVeyaNull(n.hedef_no),
  };
}

/** state.islem_gecmisi → kayıtlar, EN YENİSİ ÖNCE. */
export function islemGecmisiOku(state: JsonNesne | undefined): Islem[] {
  const ham = state?.islem_gecmisi;
  if (!Array.isArray(ham)) return [];
  return ham
    .map(islemOku)
    .filter((x): x is Islem => x !== null)
    .sort((a, b) => b.no - a.no);
}

export type IslemDurumu = "aktif" | "geri_alindi" | "geri_alma";

export const islemDurumu = (i: Islem): IslemDurumu => (i.tur === "geri_alma" ? "geri_alma" : i.geri_alindi ? "geri_alindi" : "aktif");

/** Geri alınabilir mi? (sadece arayüz ipucu; asıl kural backend'de) */
export const geriAlinabilir = (i: Islem) => i.tur === "tasima" && !i.geri_alindi;

/** islemi_geri_al(islem_no) hangi kaydı hedefler? 0 = geri alınmamış en son taşıma. */
export function hedefIslem(liste: Islem[], no: number): Islem | undefined {
  if (!no) return liste.find(geriAlinabilir);
  return liste.find((i) => i.no === no);
}

/** Bir kişiyle ilgili kayıtlar (taşınan, eski ya da yeni yönetici). */
export const kisininIslemleri = (liste: Islem[], id: string) =>
  liste.filter((i) => i.kisi.id === id || i.eski_yonetici.id === id || i.yeni_yonetici.id === id);
