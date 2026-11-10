// Dersler: akordeon. Açık ders tam gösterilir, diğerleri tek satır; ▶ Dene her satırda.
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronRight, FileCode2, Eye, PanelLeftClose, Play } from "lucide-react";
import { useState } from "react";
import type { Ders, Kavram } from "../icerik/tipler";
import { AGENT_BILGI } from "../yardimci/agentBilgi";
import { KavramSozlugu } from "./KavramSozlugu";
import { MarkdownLite } from "./MarkdownLite";
import { Modal } from "./Modal";

const benzetmeTemiz = (s: string) => s.replace(/^\s*🍽️\s*/u, "");

interface Props {
  dersler: Ders[];
  kavramlar: Kavram[];
  ilerleme: Record<number, number>;
  kisiAdi: (id: string) => string;
  calisiyor: boolean;
  dene: (d: Ders) => void;
  sonraki: (d: Ders) => void;
  /** Verilirse başlıkta "paneli kapat" düğmesi çıkar (sadece lg+). */
  daralt?: () => void;
}

function DersKarti({
  ders,
  acik,
  ac,
  gonderilen,
  kisiAdi,
  calisiyor,
  dene,
  sonraki,
  kodsuzAc,
}: {
  ders: Ders;
  acik: boolean;
  ac: () => void;
  gonderilen: number;
  kisiAdi: (id: string) => string;
  calisiyor: boolean;
  dene: () => void;
  sonraki: () => void;
  kodsuzAc: () => void;
}) {
  const [teknikAcik, setTeknikAcik] = useState(false);
  const siradaki = ders.ornekMesajlar[gonderilen];
  const basladi = gonderilen > 0;
  const bitti = basladi && !siradaki;
  return (
    <article className={`overflow-hidden rounded-xl border bg-panel transition-[border-color,box-shadow] ${acik ? "border-cizgi-guclu shadow-yumusak" : "border-cizgi"}`}>
      <button type="button" aria-expanded={acik} onClick={ac} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-hover">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12.5px] font-semibold tabular-nums ${
            bitti ? "bg-basari-acik text-basari" : basladi || acik ? "bg-vurgu-acik text-vurgu" : "bg-notr-acik text-soluk"
          }`}
        >
          {bitti ? "✓" : ders.no}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{ders.baslik}</span>
          <span className="block truncate text-[11.5px] text-soluk">{ders.kavram}</span>
        </span>
        <ChevronRight size={15} className={`shrink-0 text-soluk transition-transform ${acik ? "rotate-90" : ""}`} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {acik && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-3 px-3 pb-3">
              <p className="rounded-lg bg-panel-2 px-3 py-2.5 text-[13px] leading-relaxed text-metin-2">
                <span aria-hidden>🍽️ </span>
                {benzetmeTemiz(ders.benzetme)}
              </p>

              <div>
                <button type="button" aria-expanded={teknikAcik} onClick={() => setTeknikAcik((a) => !a)} className="flex items-center gap-1 text-xs font-semibold text-soluk hover:text-metin">
                  <ChevronRight size={13} className={`transition-transform ${teknikAcik ? "rotate-90" : ""}`} aria-hidden />
                  Teknik açıklama
                </button>
                <AnimatePresence initial={false}>
                  {teknikAcik && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="pt-1.5 text-[13px] text-soluk">
                        <MarkdownLite metin={ders.teknik} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="flex gap-2 text-[12.5px] leading-relaxed">
                <Eye size={14} className="mt-0.5 shrink-0 text-vurgu" aria-hidden />
                <span className="text-metin-2">
                  <span className="font-semibold text-metin">Neye bak: </span>
                  {ders.nedeBak}
                </span>
              </p>
              {ders.kodYeri && (
                <p className="flex items-center gap-1.5 truncate font-mono text-[11px] text-soluk" title={ders.kodYeri}>
                  <FileCode2 size={12} className="shrink-0" aria-hidden /> {ders.kodYeri}
                </p>
              )}

              {ders.agent ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={dene} disabled={calisiyor} className="btn btn-birincil btn-sm">
                      <Play size={13} fill="currentColor" /> {basladi ? "Baştan dene" : "Dene"}
                    </button>
                    {basladi && siradaki && (
                      <button type="button" onClick={sonraki} disabled={calisiyor} title={siradaki} className="btn btn-ikincil btn-sm max-w-full min-w-0">
                        <span className="truncate">Sonraki: “{siradaki}”</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11.5px] text-soluk">
                    {AGENT_BILGI[ders.agent].ikon} {AGENT_BILGI[ders.agent].ad}
                    {ders.kullanici && ` · ${kisiAdi(ders.kullanici)}`}
                    {ders.ornekMesajlar.length > 0 && ` · ${Math.min(gonderilen, ders.ornekMesajlar.length)}/${ders.ornekMesajlar.length} mesaj`}
                  </p>
                </div>
              ) : (
                <button type="button" onClick={kodsuzAc} className="btn btn-birincil btn-sm">
                  <BookOpen size={14} /> Oku
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

const MERDIVEN = [
  { ikon: "✍️", ad: "Prompt", not: "Persona ve talimat" },
  { ikon: "🧰", ad: "Tool / RAG", not: "Doğru bilgiye erişim" },
  { ikon: "📏", ad: "Eval", not: "Ölç, tahmin etme" },
  { ikon: "🧩", ad: "Few-shot", not: "Birkaç örnek" },
  { ikon: "🎓", ad: "Fine-tuning", not: "En son çare" },
];

function KodsuzDers({ ders }: { ders: Ders }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-xl bg-panel-2 p-3">
        <span aria-hidden>🍽️ </span>
        {benzetmeTemiz(ders.benzetme)}
      </p>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5" aria-label="Merdiven">
        {MERDIVEN.map((m, i) => (
          <motion.li
            key={m.ad}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12 }}
            className={`rounded-xl border p-2 text-center ${i === MERDIVEN.length - 1 ? "border-vurgu bg-vurgu-acik" : "border-cizgi bg-panel-2"}`}
            style={{ marginTop: `${(MERDIVEN.length - 1 - i) * 6}px` }}
          >
            <div className="text-xl" aria-hidden>
              {m.ikon}
            </div>
            <div className="font-semibold">{m.ad}</div>
            <div className="text-[11px] text-soluk">{m.not}</div>
          </motion.li>
        ))}
      </ol>
      <div className="text-soluk">
        <MarkdownLite metin={ders.teknik} />
      </div>
      <p className="text-xs">
        <span className="font-semibold">👀 Neye bak: </span>
        {ders.nedeBak}
      </p>
    </div>
  );
}

export function DerslerPaneli({ dersler, kavramlar, ilerleme, kisiAdi, calisiyor, dene, sonraki, daralt }: Props) {
  const [kodsuz, setKodsuz] = useState<Ders | null>(null);
  const [acik, setAcik] = useState<number | null>(dersler[0]?.no ?? null);
  const toplam = dersler.filter((d) => d.agent).length;
  const tamam = dersler.filter((d) => d.ornekMesajlar.length > 0 && (ilerleme[d.no] ?? 0) >= d.ornekMesajlar.length).length;
  return (
    <section aria-labelledby="dersler-baslik" className="kart flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-cizgi px-4">
        <h2 id="dersler-baslik" className="flex items-center gap-2 text-[13.5px] font-semibold">
          <BookOpen size={15} className="text-vurgu" aria-hidden /> Dersler
        </h2>
        <span className="flex items-center gap-2 text-xs text-soluk">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-notr-acik" aria-hidden>
            <span className="block h-full rounded-full bg-vurgu transition-[width]" style={{ width: `${(tamam / Math.max(1, toplam)) * 100}%` }} />
          </span>
          {tamam}/{toplam}
          {daralt && (
            <button type="button" onClick={daralt} className="btn btn-hayalet btn-ikon btn-sm -mr-2 hidden lg:inline-flex" aria-label="Dersler panelini kapat" title="Paneli kapat">
              <PanelLeftClose size={15} aria-hidden />
            </button>
          )}
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {dersler.map((d) => (
          <DersKarti
            key={d.no}
            ders={d}
            acik={acik === d.no}
            ac={() => setAcik((a) => (a === d.no ? null : d.no))}
            gonderilen={ilerleme[d.no] ?? 0}
            kisiAdi={kisiAdi}
            calisiyor={calisiyor}
            dene={() => dene(d)}
            sonraki={() => sonraki(d)}
            kodsuzAc={() => setKodsuz(d)}
          />
        ))}
        <div className="pt-2">
          <KavramSozlugu kavramlar={kavramlar} />
        </div>
      </div>
      <Modal acik={!!kodsuz} baslik={kodsuz ? `${kodsuz.no}. ${kodsuz.baslik}` : ""} kapat={() => setKodsuz(null)} genis>
        {kodsuz && <KodsuzDers ders={kodsuz} />}
      </Modal>
    </section>
  );
}
