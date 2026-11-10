// Tek talep kartı: durum rozeti + yatay durum zaman çizelgesi (gecmis'ten) + onaylayan için hızlı eylemler.
import { motion } from "framer-motion";
import { ArrowRight, Check, Clock, X } from "lucide-react";
import type { Talep, TalepDurumu } from "../../api/tipler";
import { turAdi, zamanGoster } from "../../yardimci/talep";

const DURUM: Record<TalepDurumu, { etiket: string; sinif: string; Ikon: typeof Check }> = {
  onay_bekliyor: { etiket: "Onay bekliyor", sinif: "bg-uyari-acik text-uyari", Ikon: Clock },
  onaylandi: { etiket: "Onaylandı", sinif: "bg-basari-acik text-basari", Ikon: Check },
  reddedildi: { etiket: "Reddedildi", sinif: "bg-tehlike-acik text-tehlike", Ikon: X },
};

export function DurumPill({ durum, kucuk }: { durum: TalepDurumu; kucuk?: boolean }) {
  const d = DURUM[durum];
  return (
    <span className={`cip ${d.sinif} ${kucuk ? "h-[18px] px-1.5 text-[11px]" : ""}`}>
      <d.Ikon size={kucuk ? 11 : 12} strokeWidth={2.5} aria-hidden />
      {d.etiket}
    </span>
  );
}

type AdimDurumu = "tamam" | "simdi" | "bekliyor" | "red";

interface Adim {
  etiket: string;
  alt?: string;
  durum: AdimDurumu;
}

/** gecmis + durum → 4 adımlı çizelge. */
function adimlar(t: Talep): Adim[] {
  const bul = (olay: string) => t.gecmis.find((g) => g.olay === olay);
  const gonderildi = bul("gonderildi");
  const karar = bul("onaylandi") ?? bul("reddedildi");
  const ik = bul("ik_bilgilendirildi");
  const ad = t.onaylayan.ad.split(" ")[0];
  const red = t.durum === "reddedildi";
  return [
    { etiket: "Gönderildi", alt: zamanGoster(gonderildi?.zaman ?? t.zaman), durum: "tamam" },
    { etiket: "Onay bekliyor", alt: ad, durum: t.durum === "onay_bekliyor" ? "simdi" : "tamam" },
    {
      etiket: red ? "Reddedildi" : "Onaylandı",
      alt: karar ? zamanGoster(karar.zaman) : t.karar ? zamanGoster(t.karar.zaman) : undefined,
      durum: red ? "red" : t.durum === "onaylandi" ? "tamam" : "bekliyor",
    },
    {
      etiket: red ? "Sahibine bildirildi" : "İK bilgilendirildi",
      alt: ik ? zamanGoster(ik.zaman) : undefined,
      durum: ik || red ? "tamam" : "bekliyor",
    },
  ];
}

const NOKTA: Record<AdimDurumu, string> = {
  tamam: "bg-basari text-panel border-basari",
  simdi: "bg-uyari-acik text-uyari border-uyari",
  bekliyor: "bg-panel text-soluk border-cizgi-guclu",
  red: "bg-tehlike text-panel border-tehlike",
};

export function DurumCizelgesi({ talep }: { talep: Talep }) {
  const liste = adimlar(talep);
  return (
    <ol className="grid grid-cols-4" aria-label="Talep durumu">
      {liste.map((a, i) => (
        <li key={a.etiket} className="relative flex flex-col items-center text-center" aria-current={a.durum === "simdi" ? "step" : undefined}>
          {i > 0 && (
            <span
              aria-hidden
              className={`absolute top-[9px] h-0.5 rounded-full ${a.durum === "bekliyor" ? "bg-cizgi" : a.durum === "red" ? "bg-tehlike/50" : "bg-basari/50"}`}
              style={{ left: "calc(-50% + 14px)", right: "calc(50% + 14px)" }}
            />
          )}
          <span className={`relative z-10 grid h-5 w-5 place-items-center rounded-full border-[1.5px] ${NOKTA[a.durum]}`}>
            {a.durum === "tamam" && <Check size={11} strokeWidth={3} />}
            {a.durum === "red" && <X size={11} strokeWidth={3} />}
            {a.durum === "simdi" && <motion.span className="h-1.5 w-1.5 rounded-full bg-uyari" animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />}
          </span>
          <span className={`mt-1.5 text-[11px] leading-tight font-medium ${a.durum === "bekliyor" ? "text-soluk" : "text-metin-2"}`}>{a.etiket}</span>
          {a.alt && <span className="text-[10.5px] leading-tight text-soluk">{a.alt}</span>}
        </li>
      ))}
    </ol>
  );
}

interface Props {
  talep: Talep;
  /** Onaylayan tarafında "Onayla / Reddet" hızlı eylemleri. */
  eylem?: { onayla: () => void; reddet: () => void; kapali: boolean };
  vurgulu?: boolean;
  sohbettenGuncel?: boolean;
}

export function TalepKarti({ talep: t, eylem, vurgulu, sohbettenGuncel }: Props) {
  const bekliyor = t.durum === "onay_bekliyor";
  return (
    <motion.article
      layout
      id={`talep-${t.no}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`kart p-4 transition-shadow ${vurgulu ? "ring-2 ring-vurgu/60" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-soluk">
            <span className="font-mono">#{t.no}</span>
            <span aria-hidden>·</span>
            <span>{turAdi(t.tur)}</span>
            <span aria-hidden>·</span>
            <span>{zamanGoster(t.zaman)}</span>
          </p>
          <h4 className="mt-1 text-sm leading-snug font-semibold">{t.aciklama || "Açıklama yok"}</h4>
        </div>
        <DurumPill durum={t.durum} />
      </header>

      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-soluk">
        <span className="font-medium text-metin-2">{t.sahip.ad}</span>
        <ArrowRight size={12} aria-hidden />
        <span>
          onaylayan <span className="font-medium text-metin-2">{t.onaylayan.ad}</span>
        </span>
        {t.yonlendirme && (
          <span className="cip bg-notr-acik text-soluk" title={t.yonlendirme.gerekce}>
            iş: {t.yonlendirme.hedef.ad.split(" ")[0]}
          </span>
        )}
      </p>

      <div className="mt-4">
        <DurumCizelgesi talep={t} />
      </div>

      {t.karar?.not && (
        <p className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-xs text-metin-2">
          <span className="text-soluk">Not ({t.karar.veren.ad.split(" ")[0]}): </span>
          {t.karar.not}
        </p>
      )}

      {eylem && bekliyor && (
        <div className="mt-4 flex items-center gap-2 border-t border-cizgi pt-3">
          <button type="button" className="btn btn-birincil btn-sm" disabled={eylem.kapali} onClick={eylem.onayla}>
            <Check size={14} strokeWidth={2.5} /> Onayla
          </button>
          <button type="button" className="btn btn-ikincil btn-sm" disabled={eylem.kapali} onClick={eylem.reddet}>
            <X size={14} strokeWidth={2.5} /> Reddet
          </button>
          <span className="ml-auto text-[11px] text-soluk">Sohbette onay kartı açılır</span>
        </div>
      )}
      {sohbettenGuncel && <p className="mt-3 text-[11px] text-soluk">↻ Sohbetteki araç sonucuyla güncellendi</p>}
    </motion.article>
  );
}
