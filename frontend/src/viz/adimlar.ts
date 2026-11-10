// Saf fonksiyon: bir turun olayları → "Ajan nasıl düşündü?" adımları.
import { ONAY_ARACI } from "../api/adk";
import type { AdkEvent, Json } from "../api/tipler";

export type AdimTuru = "mesaj" | "karar" | "onay_istek" | "onay_cevap" | "red" | "iptal" | "bekliyor" | "sonuc" | "hata" | "cevap";

export interface Adim {
  anahtar: string;
  tur: AdimTuru;
  ikon: string;
  baslik: string;
  alt: string;
  olay: AdkEvent;
}

export const ADIM_BILGI: Record<AdimTuru, { ikon: string; etiket: string; renk: string }> = {
  mesaj: { ikon: "🧑", etiket: "Mesaj", renk: "var(--adim-mesaj)" },
  karar: { ikon: "🧠", etiket: "Model karar", renk: "var(--adim-karar)" },
  onay_istek: { ikon: "🔘", etiket: "Onay isteği", renk: "var(--adim-onay)" },
  onay_cevap: { ikon: "🔘", etiket: "Senin kararın", renk: "var(--adim-onay)" },
  red: { ikon: "🛡️", etiket: "Callback reddi", renk: "var(--adim-red)" },
  iptal: { ikon: "⛔", etiket: "Çalışmadı", renk: "var(--adim-red)" },
  bekliyor: { ikon: "⏳", etiket: "Onay bekliyor", renk: "var(--adim-onay)" },
  sonuc: { ikon: "⚙️", etiket: "Tool sonucu", renk: "var(--adim-sonuc)" },
  hata: { ikon: "⚠️", etiket: "Hata", renk: "var(--adim-red)" },
  cevap: { ikon: "💬", etiket: "Cevap", renk: "var(--adim-cevap)" },
};

const kisalt = (s: string, n = 42) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const argOzet = (args: Record<string, Json> | undefined) =>
  kisalt(
    Object.entries(args ?? {})
      .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
      .join(", "),
    36,
  );

export const onayBekliyorMu = (cevap: Record<string, Json>) =>
  typeof cevap.error === "string" && /requires confirmation/i.test(cevap.error);

export const kullaniciReddiMi = (cevap: Record<string, Json>) =>
  typeof cevap.error === "string" && /reject/i.test(cevap.error);

export function adimlariCikar(olaylar: AdkEvent[]): Adim[] {
  const adimlar: Adim[] = [];
  olaylar.forEach((olay, i) => {
    if (olay.partial) return;
    const ekle = (tur: AdimTuru, baslik: string, alt: string, j: number) =>
      adimlar.push({ anahtar: `${i}-${j}`, tur, ikon: ADIM_BILGI[tur].ikon, baslik, alt, olay });
    (olay.content?.parts ?? []).forEach((p, j) => {
      if (p.thought) return;
      if (p.text?.trim()) {
        if (olay.author === "user") ekle("mesaj", "Sen yazdın", kisalt(p.text), j);
        else ekle("cevap", "Ajan cevap verdi", kisalt(p.text), j);
      } else if (p.functionCall) {
        const fc = p.functionCall;
        if (fc.name === ONAY_ARACI) {
          const orj = (fc.args?.originalFunctionCall ?? {}) as { name?: string };
          ekle("onay_istek", "ADK durdu, onay istiyor", orj.name ?? "", j);
        } else {
          ekle("karar", `${fc.name}(…) çağırmaya karar verdi`, argOzet(fc.args), j);
        }
      } else if (p.functionResponse) {
        const fr = p.functionResponse;
        const r = fr.response ?? {};
        if (fr.name === ONAY_ARACI) {
          ekle("onay_cevap", r.confirmed ? "Onayladın" : "Reddettin", fr.name, j);
        } else if (r.status === "reddedildi") {
          ekle("red", "before_tool_callback engelledi", kisalt(String(r.mesaj ?? fr.name)), j);
        } else if (onayBekliyorMu(r)) {
          ekle("bekliyor", `${fr.name} onay bekliyor`, "require_confirmation=True", j);
        } else if (kullaniciReddiMi(r)) {
          ekle("iptal", `${fr.name} çalıştırılmadı`, "Onay verilmedi", j);
        } else {
          ekle("sonuc", `${fr.name} döndü`, `status: ${String(r.status ?? "?")}`, j);
        }
      }
    });
    if (olay.errorMessage) ekle("hata", "Hata", kisalt(olay.errorMessage), 99);
  });
  return adimlar;
}
