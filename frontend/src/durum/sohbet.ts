// Saf fonksiyon: ADK olayı → sohbet öğeleri (balonlar, tool çipleri, onay kartları).
import { ONAY_ARACI } from "../api/adk";
import type { AdkEvent, FunctionCall, JsonNesne } from "../api/tipler";
import { kullaniciReddiMi, onayBekliyorMu } from "../viz/adimlar";

export type AracDurumu = "calisiyor" | "ok" | "reddedildi" | "iptal" | "onay_bekliyor" | "bulunamadi" | "hata";

export type SohbetOgesi =
  | { tur: "kullanici"; anahtar: string; metin: string }
  | { tur: "asistan"; anahtar: string; metin: string; akiyor: boolean }
  | { tur: "arac"; anahtar: string; ad: string; args: JsonNesne; durum: AracDurumu; cevap?: JsonNesne }
  | { tur: "onay"; anahtar: string; ipucu: string; orijinal: FunctionCall; karar: boolean | null }
  | { tur: "hata"; anahtar: string; metin: string };

let sayac = 0;
export const anahtarUret = (on: string) => `${on}-${++sayac}`;

function aracDurumu(cevap: JsonNesne): AracDurumu {
  if (onayBekliyorMu(cevap)) return "onay_bekliyor";
  if (kullaniciReddiMi(cevap)) return "iptal";
  switch (cevap.status) {
    case "ok":
      return "ok";
    case "reddedildi":
      return "reddedildi";
    case "bulunamadi":
      return "bulunamadi";
    default:
      return cevap.error || cevap.status === "error" ? "hata" : "ok";
  }
}

export function sohbeteIsle(sohbet: SohbetOgesi[], olay: AdkEvent): SohbetOgesi[] {
  if (olay.author === "user") return sohbet;
  let sonuc = sohbet;
  const sonAkan = () => {
    const i = sonuc.length - 1;
    const son = sonuc[i];
    return son?.tur === "asistan" && son.akiyor ? i : -1;
  };

  for (const p of olay.content?.parts ?? []) {
    if (p.thought) continue;
    if (typeof p.text === "string" && p.text.length > 0) {
      const i = sonAkan();
      if (olay.partial) {
        if (i >= 0) {
          const son = sonuc[i] as Extract<SohbetOgesi, { tur: "asistan" }>;
          sonuc = [...sonuc.slice(0, i), { ...son, metin: son.metin + p.text }];
        } else {
          sonuc = [...sonuc, { tur: "asistan", anahtar: anahtarUret("a"), metin: p.text, akiyor: true }];
        }
      } else if (i >= 0) {
        sonuc = [...sonuc.slice(0, i), { ...(sonuc[i] as Extract<SohbetOgesi, { tur: "asistan" }>), metin: p.text, akiyor: false }];
      } else {
        sonuc = [...sonuc, { tur: "asistan", anahtar: anahtarUret("a"), metin: p.text, akiyor: false }];
      }
    } else if (p.functionCall) {
      const fc = p.functionCall;
      if (fc.name === ONAY_ARACI) {
        const args = fc.args ?? {};
        const orijinal = (args.originalFunctionCall ?? { id: "", name: "?", args: {} }) as unknown as FunctionCall;
        const ipucu = String((args.toolConfirmation as JsonNesne | undefined)?.hint ?? "");
        sonuc = sonuc.map((o) => (o.tur === "arac" && o.anahtar === orijinal.id ? { ...o, durum: "onay_bekliyor" } : o));
        sonuc = [...sonuc, { tur: "onay", anahtar: fc.id, ipucu, orijinal, karar: null }];
      } else if (!sonuc.some((o) => o.tur === "arac" && o.anahtar === fc.id)) {
        sonuc = [...sonuc, { tur: "arac", anahtar: fc.id, ad: fc.name, args: fc.args ?? {}, durum: "calisiyor" }];
      }
    } else if (p.functionResponse) {
      const fr = p.functionResponse;
      if (fr.name === ONAY_ARACI) continue;
      const cevap = fr.response ?? {};
      const durum = aracDurumu(cevap);
      if (sonuc.some((o) => o.tur === "arac" && o.anahtar === fr.id)) {
        sonuc = sonuc.map((o) => (o.tur === "arac" && o.anahtar === fr.id ? { ...o, durum, cevap } : o));
      } else {
        sonuc = [...sonuc, { tur: "arac", anahtar: fr.id, ad: fr.name, args: {}, durum, cevap }];
      }
    }
  }
  if (olay.errorMessage) sonuc = [...sonuc, { tur: "hata", anahtar: anahtarUret("h"), metin: olay.errorMessage }];
  return sonuc;
}

/** Tur bitince hâlâ akıyor görünen balonları kapatır. */
export const akislariKapat = (sohbet: SohbetOgesi[]): SohbetOgesi[] =>
  sohbet.map((o) => (o.tur === "asistan" && o.akiyor ? { ...o, akiyor: false } : o));
