// İnsan onayı (HITL) karar kartı: ne olacak, kimi etkiler, Onayla (birincil) / Reddet (ikincil).
import { motion } from "framer-motion";
import { Check, ChevronRight, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { AgacKisi, Islem, JsonNesne, Talep } from "../../api/tipler";
import type { SohbetOgesi } from "../../durum/sohbet";
import { hedefIslem } from "../../yardimci/islem";
import { degerGoster, type KisiHaritasi } from "../../yardimci/org";
import { turAdi } from "../../yardimci/talep";
import { Avatar } from "../Avatar";

type OnayOgesi = Extract<SohbetOgesi, { tur: "onay" }>;

interface Aciklama {
  baslik: string;
  kisa: string;
  ne: string;
  etkilenen: { id: string; rol: string }[];
  birincil: string;
  tehlikeli?: boolean;
}

function aciklamaUret(ad: string, args: JsonNesne, harita: KisiHaritasi, aktif: string, talepler: Map<number, Talep>, islemler: Islem[]): Aciklama {
  const k = (id: unknown) => (typeof id === "string" ? harita.get(id) : undefined);
  switch (ad) {
    case "calisani_tasi": {
      const c = k(args.calisan_id);
      const y = k(args.yeni_yonetici_id);
      const eski = c?.yonetici ? harita.get(c.yonetici) : undefined;
      return {
        baslik: "Çalışan taşınsın mı?",
        kisa: "Taşıma",
        ne: `${c?.ad ?? "Çalışan"}, ${y?.ad ?? "yeni yönetici"} ekibine taşınacak. Sadece bu oturumun ağacı değişir; gerçek veri değişmez.`,
        etkilenen: [
          ...(c ? [{ id: c.id, rol: "taşınacak" }] : []),
          ...(eski ? [{ id: eski.id, rol: "eski yönetici" }] : []),
          ...(y ? [{ id: y.id, rol: "yeni yönetici" }] : []),
        ],
        birincil: "Taşı",
      };
    }
    case "talebi_gonder": {
      const ben = harita.get(aktif);
      const yon = ben?.yonetici ? harita.get(ben.yonetici) : undefined;
      return {
        baslik: "Talep gönderilsin mi?",
        kisa: "Talep gönderimi",
        ne: yon
          ? `Taslağın, org tree'deki doğrudan yöneticin ${yon.ad}'in onayına gidecek. Onaylanınca İK bilgilendirilir.`
          : "Taslağın gönderilecek; üst yöneticin olmadığı için otomatik onaylanır.",
        etkilenen: [...(ben ? [{ id: ben.id, rol: "gönderen" }] : []), ...(yon ? [{ id: yon.id, rol: "onaylayacak" }] : [])],
        birincil: "Gönder",
      };
    }
    case "talebi_karara_bagla": {
      const no = Number(args.talep_no);
      const t = talepler.get(no);
      const red = args.karar === "red";
      return {
        baslik: red ? `#${no} reddedilsin mi?` : `#${no} onaylansın mı?`,
        kisa: red ? `#${no} için red kararı` : `#${no} için onay kararı`,
        ne: red
          ? `${t ? `${t.sahip.ad} adlı çalışanın ${turAdi(t.tur).toLocaleLowerCase("tr")} talebi` : "Talep"} reddedilecek; talep sahibine gerekçeyle bildirim gider.`
          : `${t ? `${t.sahip.ad} adlı çalışanın ${turAdi(t.tur).toLocaleLowerCase("tr")} talebi` : "Talep"} onaylanacak; İK'ya ve talep sahibine bildirim gider.`,
        etkilenen: [...(t ? [{ id: t.sahip.id, rol: "talep sahibi" }] : []), ...(!red ? [{ id: "e12", rol: "bilgilendirilecek" }] : [])],
        birincil: red ? "Reddet" : "Onayla",
        tehlikeli: red,
      };
    }
    case "islemi_geri_al": {
      const no = Number(args.islem_no ?? 0) || 0;
      const i = hedefIslem(islemler, no);
      const etiket = no ? `#${no}` : i ? `#${i.no}` : "Son taşıma";
      return {
        baslik: `${etiket} geri alınsın mı?`,
        kisa: `${etiket} geri alma`,
        ne: i
          ? `${i.kisi.ad}, ${i.yeni_yonetici.ad} ekibinden tekrar ${i.eski_yonetici.ad} ekibine dönecek. Ters taşımayı model değil kod kurar (işlem kaydından).`
          : `${no ? `#${no} numaralı işlem` : "Geri alınmamış en son taşıma"} kod tarafından işlem kaydından bulunup tersine çevrilecek.`,
        etkilenen: i
          ? [
              { id: i.kisi.id, rol: "geri dönecek" },
              { id: i.yeni_yonetici.id, rol: "şimdiki yönetici" },
              { id: i.eski_yonetici.id, rol: "önceki yönetici" },
            ]
          : [],
        birincil: "Geri al",
      };
    }
    default:
      return { baslik: "Bu işlem onay gerektiriyor", kisa: ad, ne: `Ajan ${ad} aracını çalıştırmak istiyor.`, etkilenen: [], birincil: "Onayla" };
  }
}

interface Props {
  oge: OnayOgesi;
  harita: KisiHaritasi;
  aktif: string;
  talepler: Map<number, Talep>;
  islemler?: Islem[];
  calisiyor: boolean;
  onayla: (id: string, k: boolean) => void;
}

export function OnayKarti({ oge, harita, aktif, talepler, islemler = [], calisiyor, onayla }: Props) {
  const [ayrinti, setAyrinti] = useState(false);
  const args = oge.orijinal.args ?? {};
  const a = aciklamaUret(oge.orijinal.name, args, harita, aktif, talepler, islemler);
  const bekliyor = oge.karar === null;

  if (!bekliyor) {
    return (
      <div className="flex justify-start pl-10">
        <span className={`cip h-7 px-3 text-[12.5px] ${oge.karar ? "bg-basari-acik text-basari" : "bg-notr-acik text-soluk"}`}>
          {oge.karar ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
          {a.kisa} · {oge.karar ? "onayladın" : "reddettin"}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="ml-10 overflow-hidden rounded-2xl border border-uyari/35 bg-panel shadow-buyuk"
      role="group"
      aria-label="Onay isteği"
    >
      <div className="flex items-center gap-2 border-b border-uyari/20 bg-uyari-acik px-4 py-2 text-xs font-semibold text-uyari">
        <ShieldCheck size={14} aria-hidden /> Kararını bekliyor · insan onayı
      </div>
      <div className="p-4">
        <h4 className="text-[15px] font-semibold tracking-tight">{a.baslik}</h4>
        <p className="mt-1 text-[13px] leading-relaxed text-metin-2">{a.ne}</p>

        {a.etkilenen.length > 0 && (
          <div className="mt-3">
            <p className="baslik-kucuk mb-1.5">Etkilenenler</p>
            <ul className="flex flex-wrap gap-1.5">
              {a.etkilenen.map(({ id, rol }) => {
                const kisi: AgacKisi | undefined = harita.get(id);
                if (!kisi) return null;
                return (
                  <li key={`${id}-${rol}`} className="flex items-center gap-2 rounded-full border border-cizgi bg-panel-2 py-0.5 pr-2.5 pl-0.5">
                    <Avatar kisi={kisi} boyut={22} />
                    <span className="text-xs font-medium">{kisi.ad}</span>
                    <span className="text-[11px] text-soluk">{rol}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button type="button" aria-expanded={ayrinti} onClick={() => setAyrinti((x) => !x)} className="mt-3 flex items-center gap-1 text-xs text-soluk hover:text-metin">
          <ChevronRight size={13} className={`transition-transform ${ayrinti ? "rotate-90" : ""}`} aria-hidden />
          Teknik ayrıntı
        </button>
        {ayrinti && (
          <div className="mt-2 rounded-lg bg-panel-2 p-3 font-mono text-[11.5px] leading-relaxed">
            <p>
              <span className="text-soluk">tool</span> {oge.orijinal.name}
            </p>
            {Object.entries(args).map(([k, v]) => (
              <p key={k}>
                <span className="text-soluk">{k}</span> {degerGoster(v, harita)}
              </p>
            ))}
            {oge.ipucu && <p className="mt-1 font-sans text-soluk">{oge.ipucu}</p>}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            autoFocus
            disabled={calisiyor}
            onClick={() => onayla(oge.anahtar, true)}
            className={`btn ${a.tehlikeli ? "bg-tehlike text-panel hover:brightness-110" : "btn-birincil"}`}
          >
            <Check size={15} strokeWidth={2.5} /> {a.birincil}
          </button>
          <button type="button" disabled={calisiyor} onClick={() => onayla(oge.anahtar, false)} className="btn btn-ikincil">
            {a.tehlikeli ? "Vazgeç" : "Reddet"}
          </button>
          <span className="ml-auto hidden text-[11px] text-soluk sm:inline">Onay vermezsen araç çalışmaz</span>
        </div>
      </div>
    </motion.div>
  );
}
