// Sohbet: balonlar, tur başına gruplanmış araç çipleri, karar kartı, yazıyor göstergesi,
// okurken zıplamayan otomatik kaydırma.
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Islem, Talep } from "../../api/tipler";
import type { SohbetOgesi } from "../../durum/sohbet";
import type { AgentAdi } from "../../icerik/tipler";
import { AGENT_BILGI } from "../../yardimci/agentBilgi";
import type { KisiHaritasi } from "../../yardimci/org";
import { MarkdownLite } from "../MarkdownLite";
import { AracGrubu } from "./AracGrubu";
import { OnayKarti } from "./OnayKarti";

type AracOgesi = Extract<SohbetOgesi, { tur: "arac" }>;
type Blok = { tur: "oge"; oge: Exclude<SohbetOgesi, AracOgesi> } | { tur: "araclar"; anahtar: string; araclar: AracOgesi[] };

/** Ardışık araç öğelerini tek grupta toplar. */
function bloklara(sohbet: SohbetOgesi[]): Blok[] {
  const bloklar: Blok[] = [];
  for (const o of sohbet) {
    const son = bloklar[bloklar.length - 1];
    if (o.tur === "arac") {
      if (son?.tur === "araclar") son.araclar.push(o);
      else bloklar.push({ tur: "araclar", anahtar: `g-${o.anahtar}`, araclar: [o] });
    } else bloklar.push({ tur: "oge", oge: o });
  }
  return bloklar;
}

export function AjanAvatari({ agent, boyut = 28 }: { agent: AgentAdi; boyut?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[9px] border border-cizgi bg-panel shadow-yumusak"
      style={{ width: boyut, height: boyut, fontSize: boyut * 0.5 }}
    >
      {AGENT_BILGI[agent].ikon}
    </span>
  );
}

function Yaziyor({ agent }: { agent: AgentAdi }) {
  return (
    <div className="flex items-end gap-3" aria-label="Ajan yazıyor">
      <AjanAvatari agent={agent} />
      <div className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-md bg-notr-acik px-4">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-soluk"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1, delay: i * 0.14, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  agent: AgentAdi;
  sohbet: SohbetOgesi[];
  calisiyor: boolean;
  hazir: boolean;
  harita: KisiHaritasi;
  aktif: string;
  talepler: Map<number, Talep>;
  /** v4: işlem geçmişi (geri alma onay kartında hangi taşımanın çevrileceğini göstermek için). */
  islemler?: Islem[];
  gonder: (m: string) => void;
  onayla: (id: string, k: boolean) => void;
  yeniOturum: () => void;
  /** Uygulama modu: boş sohbette ders yerine bu öneriler gösterilir. */
  oneriler?: string[];
}

export function Sohbet({ agent, sohbet, calisiyor, hazir, harita, aktif, talepler, islemler = [], gonder, onayla, yeniOturum, oneriler }: Props) {
  const [taslak, setTaslak] = useState("");
  const kaydirici = useRef<HTMLDivElement>(null);
  const girdi = useRef<HTMLTextAreaElement>(null);
  const alttaRef = useRef(true);
  const [yeniVar, setYeniVar] = useState(false);
  const bekleyenOnay = sohbet.some((o) => o.tur === "onay" && o.karar === null);
  const bloklar = useMemo(() => bloklara(sohbet), [sohbet]);
  const sonOge = sohbet[sohbet.length - 1];
  const akiyor = sonOge?.tur === "asistan" && sonOge.akiyor;

  const enAlta = useCallback((yumusak = false) => {
    const el = kaydirici.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: yumusak ? "smooth" : "auto" });
    setYeniVar(false);
  }, []);

  // Kullanıcı alttaysa takip et; yukarıda okuyorsa zıplatma, "yeni mesaj" düğmesi göster.
  useLayoutEffect(() => {
    if (alttaRef.current) enAlta(false);
    else setYeniVar(true);
  }, [sohbet, calisiyor, enAlta]);

  const kaydirildi = () => {
    const el = kaydirici.current;
    if (!el) return;
    alttaRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (alttaRef.current) setYeniVar(false);
  };

  // Textarea yüksekliği içeriğe göre (en fazla ~5 satır).
  useEffect(() => {
    const el = girdi.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [taslak]);

  const kapali = calisiyor || !hazir || bekleyenOnay;
  const yolla = (metin: string) => {
    if (!metin.trim() || kapali) return;
    alttaRef.current = true;
    gonder(metin);
    setTaslak("");
  };
  const gonderForm = (e: FormEvent) => {
    e.preventDefault();
    yolla(taslak);
  };
  const tus = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      yolla(taslak);
    }
  };

  const bilgi = AGENT_BILGI[agent];
  return (
    <section aria-label="Sohbet" className="kart flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-cizgi px-4">
        <AjanAvatari agent={agent} boyut={26} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13.5px] font-semibold">{bilgi.ad}</p>
          <p className="truncate font-mono text-[11px] text-soluk">{agent}</p>
        </div>
        <button type="button" onClick={yeniOturum} disabled={calisiyor} className="btn btn-hayalet btn-sm ml-auto" title="Bu agent için yeni oturum başlat">
          <RotateCcw size={14} /> <span className="hidden sm:inline">Yeni oturum</span>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={kaydirici} onScroll={kaydirildi} className="h-full overflow-y-auto px-4 py-5" aria-live="polite" aria-busy={calisiyor}>
          {sohbet.length === 0 && (
            <div className="mx-auto mt-8 flex max-w-sm flex-col items-center text-center">
              <AjanAvatari agent={agent} boyut={44} />
              <p className="mt-3 text-[15px] font-semibold">{bilgi.ad}</p>
              {oneriler ? (
                <>
                  <p className="mt-1 text-[13px] text-soluk">Ne yapmak istersin? Bir öneri seç ya da aşağıya yaz.</p>
                  <div className="mt-5 grid w-full gap-2">
                    {oneriler.map((o) => (
                      <button
                        key={o}
                        type="button"
                        disabled={calisiyor || !hazir}
                        onClick={() => yolla(o)}
                        className="group flex items-center gap-3 rounded-xl border border-cizgi bg-panel px-3.5 py-2.5 text-left text-[13.5px] shadow-yumusak transition-colors hover:border-cizgi-guclu hover:bg-hover disabled:opacity-50"
                      >
                        <Sparkles size={14} className="shrink-0 text-vurgu" aria-hidden />
                        <span className="flex-1">{o}</span>
                        <ArrowUp size={14} className="rotate-45 text-soluk opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[13px] leading-relaxed text-soluk">
                  Bir dersi <strong className="text-metin">▶ Dene</strong> ile başlat ya da aşağıya bir mesaj yaz.
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {bloklar.map((b) => {
                if (b.tur === "araclar") {
                  return (
                    <motion.div key={b.anahtar} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <AracGrubu araclar={b.araclar} harita={harita} />
                    </motion.div>
                  );
                }
                const o = b.oge;
                return (
                  <motion.div key={o.anahtar} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {o.tur === "kullanici" && (
                      <div className="flex justify-end">
                        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-vurgu px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap text-vurgu-metin shadow-yumusak">{o.metin}</div>
                      </div>
                    )}
                    {o.tur === "asistan" && (
                      <div className="flex items-start gap-3">
                        <AjanAvatari agent={agent} />
                        <div className={`max-w-[88%] min-w-0 rounded-2xl rounded-tl-md bg-notr-acik px-3.5 py-2.5 text-[14px] ${o.akiyor ? "imlec" : ""}`}>
                          <MarkdownLite metin={o.metin} />
                        </div>
                      </div>
                    )}
                    {o.tur === "onay" && <OnayKarti oge={o} harita={harita} aktif={aktif} talepler={talepler} islemler={islemler} calisiyor={calisiyor} onayla={onayla} />}
                    {o.tur === "hata" && (
                      <div role="alert" className="ml-10 flex items-start gap-2 rounded-xl border border-tehlike/30 bg-tehlike-acik px-3 py-2 text-[13px] text-tehlike">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /> <span className="min-w-0 break-words">{o.metin}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {calisiyor && !akiyor && <Yaziyor agent={agent} />}
          </div>
        </div>

        <AnimatePresence>
          {yeniVar && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={() => {
                alttaRef.current = true;
                enAlta(true);
              }}
              className="btn btn-ikincil btn-sm absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-buyuk"
            >
              <ArrowDown size={14} /> Yeni mesajlar
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={gonderForm} className="shrink-0 border-t border-cizgi p-3">
        <div className="flex items-end gap-2 rounded-xl border border-cizgi bg-panel px-3 py-2 shadow-yumusak transition-[border-color,box-shadow] focus-within:border-[color-mix(in_srgb,var(--vurgu)_55%,var(--cizgi))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vurgu)_14%,transparent)]">
          <label htmlFor="mesaj" className="sr-only">
            Mesaj
          </label>
          <textarea
            id="mesaj"
            ref={girdi}
            rows={1}
            value={taslak}
            onChange={(e) => setTaslak(e.target.value)}
            onKeyDown={tus}
            placeholder={bekleyenOnay ? "Önce yukarıdaki karar kartını yanıtla…" : !hazir ? "Bağlantı kontrol ediliyor…" : `${bilgi.kisa} asistanına yaz…`}
            disabled={kapali}
            autoComplete="off"
            className="max-h-[132px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-6 outline-none placeholder:text-soluk disabled:opacity-60"
          />
          <button type="submit" disabled={kapali || !taslak.trim()} aria-label="Gönder" className="btn btn-birincil btn-ikon h-8 w-8 shrink-0 rounded-lg">
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1.5 hidden px-1 text-[11px] text-soluk sm:block">Enter gönderir · Shift + Enter yeni satır</p>
      </form>
    </section>
  );
}
