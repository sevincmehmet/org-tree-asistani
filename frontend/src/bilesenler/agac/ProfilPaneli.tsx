// Profil paneli (sağdan kayar): kişi bilgisi, yöneticisi, doğrudan ekibi, kapsam durumu, talepleri.
// Tamamen yerel: LLM çağrılmaz.
import { motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronRight, Focus, Lock, Route, X } from "lucide-react";
import { useEffect } from "react";
import type { AgacKisi, Islem, Talep } from "../../api/tipler";
import { departmanRengi } from "../../veri/org";
import { kisininIslemleri } from "../../yardimci/islem";
import { asagiYol, zincir, type Kapsam, type KisiHaritasi } from "../../yardimci/org";
import { turAdi } from "../../yardimci/talep";
import { Avatar } from "../Avatar";
import { DurumPill } from "../talepler/TalepKarti";
import { IslemSatiri } from "./GecmisListesi";

interface Props {
  kisi: AgacKisi;
  agac: AgacKisi[];
  harita: KisiHaritasi;
  aktif: string;
  kapsam: Kapsam;
  talepler: Talep[];
  kapat: () => void;
  sec: (id: string) => void;
  odakla: (id: string) => void;
  yolGoster: (id: string) => void;
  talepAc: (no: number) => void;
  /** v4: oturumun işlem geçmişi (en yenisi önce). */
  islemler?: Islem[];
  /** Verilirse geri alınabilir kayıtlarda "Geri al" düğmesi çıkar (sohbete istek gönderir). */
  geriAl?: (no: number) => void;
  calisiyor?: boolean;
}

function KisiSatiri({ kisi, sec, ek }: { kisi: AgacKisi; sec: (id: string) => void; ek?: string }) {
  return (
    <button type="button" onClick={() => sec(kisi.id)} className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-hover">
      <Avatar kisi={kisi} boyut={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{kisi.ad}</span>
        <span className="block truncate text-xs text-soluk">{kisi.unvan}</span>
      </span>
      {ek && <span className="cip bg-notr-acik text-soluk">{ek}</span>}
      <ChevronRight size={14} className="text-soluk opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </button>
  );
}

export function ProfilPaneli({ kisi, agac, harita, aktif, kapsam, talepler, kapat, sec, odakla, yolGoster, talepAc, islemler = [], geriAl, calisiyor = false }: Props) {
  const yonetici = kisi.yonetici ? harita.get(kisi.yonetici) : undefined;
  const ekip = agac.filter((k) => k.yonetici === kisi.id);
  const renk = departmanRengi(kisi.departman_id);
  const kapsamda = kapsam.kapsam.has(kisi.id);
  const ustte = kapsam.ustZincir.has(kisi.id);
  const yol = kapsamda ? asagiYol(harita, aktif, kisi.id) : ustte ? (() => {
    const z = zincir(harita, aktif);
    return z.slice(0, z.indexOf(kisi.id) + 1);
  })() : null;
  const sonDegisiklikler = kisininIslemleri(islemler, kisi.id);
  const kendiTalepleri = talepler.filter((t) => t.sahip.id === kisi.id || t.onaylayan.id === kisi.id).sort((a, b) => b.no - a.no);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [kapat]);

  return (
    <motion.aside
      key="profil"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      aria-label={`${kisi.ad} profili`}
      className="absolute inset-y-2 right-2 z-20 flex w-[min(340px,calc(100%-16px))] flex-col overflow-hidden rounded-2xl border border-cizgi bg-panel shadow-buyuk"
    >
      <div className="relative px-5 pt-5 pb-4">
        <div className="absolute inset-x-0 top-0 h-16" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${renk} 10%, transparent), transparent)` }} aria-hidden />
        <button type="button" onClick={kapat} aria-label="Profili kapat" className="btn btn-hayalet btn-ikon absolute top-3 right-3 h-8 w-8">
          <X size={16} />
        </button>
        <div className="relative flex items-center gap-3">
          <Avatar kisi={kisi} boyut={48} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight">{kisi.ad}</h3>
            <p className="truncate text-[13px] text-soluk">{kisi.unvan}</p>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          <span className="cip" style={{ color: renk, background: `color-mix(in srgb, ${renk} 13%, transparent)` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: renk }} />
            {kisi.departman}
          </span>
          {kisi.id === aktif ? (
            <span className="cip bg-vurgu text-vurgu-metin">Sen</span>
          ) : kapsamda ? (
            <span className="cip bg-basari-acik text-basari">
              <Check size={12} /> Kapsamında
            </span>
          ) : ustte ? (
            <span className="cip bg-bilgi-acik text-bilgi">
              <ArrowUpRight size={12} /> Üst zincirin
            </span>
          ) : (
            <span className="cip bg-notr-acik text-soluk">
              <Lock size={11} /> Kapsam dışı
            </span>
          )}
          <span className="cip font-mono text-soluk">{kisi.id}</span>
        </div>
        <div className="relative mt-4 flex gap-2">
          <button type="button" className="btn btn-ikincil btn-sm" onClick={() => odakla(kisi.id)}>
            <Focus size={14} /> Odakla
          </button>
          {yol && yol.length > 1 && (
            <button type="button" className="btn btn-ikincil btn-sm" onClick={() => yolGoster(kisi.id)}>
              <Route size={14} /> Yolu göster
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-cizgi px-3 py-4">
        {!kapsamda && !ustte && (
          <p className="mx-2 rounded-lg bg-notr-acik px-3 py-2 text-xs leading-relaxed text-soluk">
            🔒 Bu kişi senin alt ağacında değil. Arayüz gösterir ama ajan bu kişi için işlem yapmaz: <strong className="text-metin-2">arayüz gizler, kod engeller.</strong>
          </p>
        )}
        {yol && yol.length > 1 && (
          <section>
            <h4 className="baslik-kucuk mb-1.5 px-2">{kapsamda ? "Senden yol" : "Zincirin"}</h4>
            <p className="mx-2 flex flex-wrap items-center gap-1 text-xs text-metin-2">
              {yol.map((id, i) => (
                <span key={id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} className={`text-soluk ${kapsamda ? "rotate-90" : "-rotate-90"}`} aria-hidden />}
                  <span className={id === kisi.id ? "font-semibold text-metin" : ""}>{harita.get(id)?.ad.split(" ")[0]}</span>
                </span>
              ))}
            </p>
          </section>
        )}
        <section>
          <h4 className="baslik-kucuk mb-1 px-2">Yöneticisi</h4>
          {yonetici ? <KisiSatiri kisi={yonetici} sec={sec} /> : <p className="px-2 text-[13px] text-soluk">En üst yönetici</p>}
        </section>
        <section>
          <h4 className="baslik-kucuk mb-1 px-2">Doğrudan ekip · {ekip.length}</h4>
          {ekip.length ? (
            <div>
              {ekip.map((k) => (
                <KisiSatiri key={k.id} kisi={k} sec={sec} ek={(() => {
                  const n = agac.filter((x) => x.yonetici === k.id).length;
                  return n ? `${n} kişi` : undefined;
                })()} />
              ))}
            </div>
          ) : (
            <p className="px-2 text-[13px] text-soluk">Ekibi yok</p>
          )}
        </section>
        <section>
          <h4 className="baslik-kucuk mb-1 px-2">Talepler · {kendiTalepleri.length}</h4>
          {kendiTalepleri.length ? (
            <div className="space-y-1">
              {kendiTalepleri.map((t) => (
                <button key={t.no} type="button" onClick={() => talepAc(t.no)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover">
                  <span className="font-mono text-xs text-soluk">#{t.no}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {turAdi(t.tur)} · <span className="text-soluk">{t.sahip.id === kisi.id ? `onaylayan ${t.onaylayan.ad.split(" ")[0]}` : `${t.sahip.ad.split(" ")[0]} gönderdi`}</span>
                  </span>
                  <DurumPill durum={t.durum} kucuk />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-2 text-[13px] leading-relaxed text-soluk">Bilinen talep yok. Talepler, giriş yapan kişinin özetinden ve bu oturumdaki araç sonuçlarından gelir.</p>
          )}
        </section>
        {sonDegisiklikler.length > 0 && (
          <section>
            <h4 className="baslik-kucuk mb-1 px-2">🕘 Son değişiklikler · {sonDegisiklikler.length}</h4>
            <ul className="space-y-0.5">
              {sonDegisiklikler.map((i) => (
                <IslemSatiri key={i.no} islem={i} geriAl={geriAl} pasif={calisiyor} />
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="border-t border-cizgi px-5 py-2.5 text-[11px] text-soluk">Yerel hesap · LLM çağrılmadı</p>
    </motion.aside>
  );
}
