// Bir turdaki ardışık tool çağrıları: "3 araç çalıştı ▸" — açılınca çipler.
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check, ChevronRight, CircleDashed, Clock, Loader2, SearchX, ShieldAlert, Wrench } from "lucide-react";
import { useState } from "react";
import type { JsonNesne } from "../../api/tipler";
import type { AracDurumu, SohbetOgesi } from "../../durum/sohbet";
import { degerGoster, type KisiHaritasi } from "../../yardimci/org";

type AracOgesi = Extract<SohbetOgesi, { tur: "arac" }>;

const DURUM: Record<AracDurumu, { etiket: string; sinif: string; Ikon: typeof Check }> = {
  calisiyor: { etiket: "çalışıyor", sinif: "text-soluk", Ikon: Loader2 },
  ok: { etiket: "tamam", sinif: "text-basari", Ikon: Check },
  reddedildi: { etiket: "kod engelledi", sinif: "text-tehlike", Ikon: ShieldAlert },
  iptal: { etiket: "sen reddettin", sinif: "text-tehlike", Ikon: Ban },
  onay_bekliyor: { etiket: "onay bekliyor", sinif: "text-uyari", Ikon: Clock },
  bulunamadi: { etiket: "bulunamadı", sinif: "text-soluk", Ikon: SearchX },
  hata: { etiket: "hata", sinif: "text-soluk", Ikon: CircleDashed },
};

const argMetni = (args: JsonNesne, harita: KisiHaritasi) =>
  Object.entries(args)
    .map(([k, v]) => `${k}: ${degerGoster(v, harita)}`)
    .join(", ");

export function AracGrubu({ araclar, harita, acikBasla }: { araclar: AracOgesi[]; harita: KisiHaritasi; acikBasla?: boolean }) {
  const [acik, setAcik] = useState(!!acikBasla);
  const calisan = araclar.find((a) => a.durum === "calisiyor");
  const sorunlu = araclar.find((a) => a.durum === "reddedildi" || a.durum === "iptal");
  const ozet = calisan ? `${calisan.ad} çalışıyor…` : `${araclar.length} araç çalıştı`;

  return (
    <div className="pl-10">
      <button
        type="button"
        aria-expanded={acik}
        onClick={() => setAcik((x) => !x)}
        className="group inline-flex h-7 max-w-full items-center gap-2 rounded-full border border-cizgi bg-panel px-2.5 text-xs text-soluk shadow-yumusak hover:border-cizgi-guclu hover:text-metin"
      >
        {calisan ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Wrench size={13} aria-hidden />}
        <span className="truncate font-medium">{ozet}</span>
        <span className="flex items-center gap-0.5" aria-hidden>
          {araclar.map((a) => {
            const d = DURUM[a.durum];
            return <d.Ikon key={a.anahtar} size={12} strokeWidth={2.5} className={`${d.sinif} ${a.durum === "calisiyor" ? "animate-spin" : ""}`} />;
          })}
        </span>
        {sorunlu && !calisan && <span className={`${DURUM[sorunlu.durum].sinif} font-medium`}>· {DURUM[sorunlu.durum].etiket}</span>}
        <ChevronRight size={13} className={`transition-transform ${acik ? "rotate-90" : ""}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {acik && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 space-y-1 border-l-2 border-cizgi pl-3">
              {araclar.map((a) => {
                const d = DURUM[a.durum];
                const mesaj = a.cevap && typeof a.cevap.mesaj === "string" ? a.cevap.mesaj : null;
                return (
                  <li key={a.anahtar} className="text-xs">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <code className="font-mono font-semibold text-metin-2">{a.ad}</code>
                      <span className="min-w-0 truncate font-mono text-soluk">({argMetni(a.args, harita)})</span>
                      <span className={`inline-flex items-center gap-1 font-medium ${d.sinif}`}>
                        <d.Ikon size={11} strokeWidth={2.5} className={a.durum === "calisiyor" ? "animate-spin" : ""} aria-hidden /> {d.etiket}
                      </span>
                    </div>
                    {mesaj && <p className="mt-0.5 text-soluk">{mesaj}</p>}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
