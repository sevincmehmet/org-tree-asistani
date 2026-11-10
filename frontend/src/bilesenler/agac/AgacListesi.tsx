// 🗂️ Liste: girintili gezgin ağacı. Aç/kapa, arama (eşleşmelere otomatik açılır),
// klavye (↑↓ gez, → aç, ← kapat/üste çık, Enter seç, Home/End), kapsam ve efekt işaretleri.
import { motion } from "framer-motion";
import { ChevronRight, Lock, Search, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AgacKisi } from "../../api/tipler";
import type { AgacGorunumuApi } from "../../durum/useAgacGorunumu";
import type { EfektPaketi } from "../../durum/useAjan";
import { departmanRengi } from "../../veri/org";
import { acilmasiGerekenler } from "../../yardimci/agacGorunum";
import { haritala, type Kapsam } from "../../yardimci/org";
import { efektDurumu, satirEfekti, type SatirEfekti } from "../../viz/efektDurumu";

interface Props {
  agac: AgacKisi[];
  aktif: string;
  kapsam: Kapsam;
  efekt: EfektPaketi | null;
  g: AgacGorunumuApi;
  bekleyenler: Map<string, number>;
  tikla: (id: string) => void;
  /** Yanında profil paneli açıkken unvanları gizle. */
  dar?: boolean;
}

interface Satir {
  kisi: AgacKisi;
  seviye: number;
  ekip: number;
  acik: boolean;
}

const kucuk = (s: string) => s.toLocaleLowerCase("tr");

function Vurgula({ metin, arama }: { metin: string; arama: string }): ReactNode {
  if (!arama) return metin;
  const i = kucuk(metin).indexOf(kucuk(arama));
  if (i < 0) return metin;
  return (
    <>
      {metin.slice(0, i)}
      <mark className="rounded-[3px] bg-vurgu-acik text-vurgu">{metin.slice(i, i + arama.length)}</mark>
      {metin.slice(i + arama.length)}
    </>
  );
}

const EFEKT_SINIFI: Record<Exclude<SatirEfekti, null>, string> = {
  red: "bg-tehlike-acik",
  ret: "bg-tehlike-acik",
  onay: "bg-basari-acik",
  lca: "bg-[color-mix(in_srgb,var(--lca)_12%,transparent)]",
  yol: "bg-vurgu-acik",
  vurgu: "bg-vurgu-acik",
  nabiz: "bg-vurgu-acik",
};
const EFEKT_CIZGI: Record<Exclude<SatirEfekti, null>, string> = {
  red: "var(--tehlike)",
  ret: "var(--tehlike)",
  onay: "var(--basari)",
  lca: "var(--lca)",
  yol: "var(--vurgu)",
  vurgu: "var(--vurgu)",
  nabiz: "var(--vurgu)",
};

export function AgacListesi({ agac, aktif, kapsam, efekt, g, bekleyenler, tikla, dar }: Props) {
  const [arama, setArama] = useState("");
  const [odakId, setOdakId] = useState<string | null>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const harita = useMemo(() => haritala(agac), [agac]);
  const durum = useMemo(() => efektDurumu(efekt?.liste ?? [], harita), [efekt, harita]);
  const q = arama.trim();

  const eslesen = useMemo(() => {
    if (!q) return null;
    const m = kucuk(q);
    return new Set(agac.filter((k) => kucuk(`${k.ad} ${k.unvan} ${k.departman}`).includes(m)).map((k) => k.id));
  }, [agac, q]);

  const satirlar = useMemo(() => {
    const goster = eslesen ? new Set([...eslesen, ...acilmasiGerekenler(agac, eslesen)]) : null;
    const acikMi = (id: string) => (goster ? true : g.listeAcik.has(id));
    const sonuc: Satir[] = [];
    const gez = (ust: string, seviye: number) => {
      for (const id of g.cocuklar.get(ust) ?? []) {
        if (goster && !goster.has(id)) continue;
        const kisi = harita.get(id);
        if (!kisi) continue;
        const ekip = (g.cocuklar.get(id) ?? []).length;
        const acik = ekip > 0 && acikMi(id);
        sonuc.push({ kisi, seviye, ekip, acik });
        if (acik) gez(id, seviye + 1);
      }
    };
    gez("", 0);
    return sonuc;
  }, [eslesen, agac, g.listeAcik, g.cocuklar, harita]);

  const odakGecerli = odakId && satirlar.some((s) => s.kisi.id === odakId) ? odakId : (g.secili ?? aktif);

  const odakla = (id: string) => {
    setOdakId(id);
    requestAnimationFrame(() => {
      const el = kutu.current?.querySelector<HTMLElement>(`[data-satir="${id}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    });
  };

  const tus = (e: KeyboardEvent, s: Satir, i: number) => {
    const id = s.kisi.id;
    switch (e.key) {
      case "ArrowDown":
        if (i < satirlar.length - 1) odakla(satirlar[i + 1].kisi.id);
        break;
      case "ArrowUp":
        if (i > 0) odakla(satirlar[i - 1].kisi.id);
        else document.getElementById("agac-arama")?.focus();
        break;
      case "ArrowRight":
        if (s.ekip && !s.acik && !eslesen) g.listeDegistir(id, true);
        else if (s.acik && satirlar[i + 1]) odakla(satirlar[i + 1].kisi.id);
        break;
      case "ArrowLeft":
        if (s.acik && !eslesen) g.listeDegistir(id, false);
        else if (s.kisi.yonetici && harita.has(s.kisi.yonetici)) odakla(s.kisi.yonetici);
        break;
      case "Home":
        odakla(satirlar[0].kisi.id);
        break;
      case "End":
        odakla(satirlar[satirlar.length - 1].kisi.id);
        break;
      case "Enter":
      case " ":
        tikla(id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <div className="px-3 pt-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Kişi ara</span>
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-soluk" aria-hidden />
          <input
            id="agac-arama"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && satirlar[0]) {
                e.preventDefault();
                odakla(satirlar[0].kisi.id);
              }
              if (e.key === "Escape") setArama("");
            }}
            placeholder="Ad, unvan ya da departman ara…"
            autoComplete="off"
            className="girdi h-9 pr-8 pl-9"
          />
          {arama && (
            <button type="button" onClick={() => setArama("")} aria-label="Aramayı temizle" className="btn btn-hayalet btn-ikon absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2">
              <X size={14} />
            </button>
          )}
        </label>
        {eslesen && (
          <p className="mt-1.5 px-1 text-xs text-soluk" aria-live="polite">
            {eslesen.size ? `${eslesen.size} eşleşme` : "Eşleşme yok"}
          </p>
        )}
      </div>

      <div ref={kutu} role="tree" aria-label="Organizasyon listesi" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {satirlar.map((s, i) => {
          const id = s.kisi.id;
          const kilitli = !kapsam.kapsam.has(id) && !kapsam.ustZincir.has(id);
          const ef = satirEfekti(durum, id);
          const secili = g.secili === id;
          const bekleyen = bekleyenler.get(id) ?? 0;
          const renk = departmanRengi(s.kisi.departman_id);
          const soluk = eslesen && !eslesen.has(id);
          return (
            <motion.div
              key={id}
              layout="position"
              transition={{ duration: 0.18 }}
              role="treeitem"
              data-satir={id}
              tabIndex={odakGecerli === id ? 0 : -1}
              aria-level={s.seviye + 1}
              aria-expanded={s.ekip ? s.acik : undefined}
              aria-selected={secili}
              onClick={() => {
                setOdakId(id);
                tikla(id);
              }}
              onKeyDown={(e) => tus(e, s, i)}
              className={`group relative flex h-10 cursor-pointer items-center gap-2 rounded-lg pr-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-vurgu ${
                secili ? "bg-notr-acik" : ef ? EFEKT_SINIFI[ef] : "hover:bg-hover"
              }`}
              style={{ paddingLeft: 8 + s.seviye * 20 }}
            >
              {/* Girinti kılavuz çizgileri */}
              {Array.from({ length: s.seviye }, (_, l) => (
                <span key={l} aria-hidden className="absolute top-0 bottom-0 w-px bg-cizgi" style={{ left: 8 + l * 20 + 10 }} />
              ))}
              {ef && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full" style={{ background: EFEKT_CIZGI[ef] }} />}

              {s.ekip ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={s.acik ? "Kapat" : "Aç"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!eslesen) g.listeDegistir(id, !s.acik);
                  }}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-soluk hover:bg-cizgi hover:text-metin"
                >
                  <ChevronRight size={14} className={`transition-transform duration-150 ${s.acik ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="w-5 shrink-0" aria-hidden />
              )}

              <motion.span
                key={ef === "red" ? `red-${efekt?.nonce}` : "s"}
                initial={false}
                animate={ef === "red" ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}
                className={`flex min-w-0 flex-1 items-center gap-2 ${soluk ? "opacity-45" : ""} ${kilitli ? "text-soluk" : ""}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: renk }} aria-hidden />
                <span className={`truncate text-[13.5px] ${kilitli ? "" : "text-metin"} ${secili || id === aktif ? "font-semibold" : "font-medium"}`}>
                  <Vurgula metin={s.kisi.ad} arama={q} />
                </span>
                <span className={`truncate text-xs text-soluk ${dar ? "hidden" : "hidden min-[420px]:inline"}`}>
                  <Vurgula metin={s.kisi.unvan} arama={q} />
                </span>
              </motion.span>

              <span className="flex shrink-0 items-center gap-1.5">
                {ef === "onay" && <span className="cip bg-basari text-panel">✓</span>}
                {ef === "ret" && <span className="cip bg-tehlike text-panel">✕</span>}
                {durum.geri.has(id) && (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="cip bg-bilgi-acik text-bilgi" title="Bu taşıma geri alındı">
                    ↶ geri alındı
                  </motion.span>
                )}
                {bekleyen > 0 && (
                  <span className="cip bg-uyari-acik text-uyari" title={`${bekleyen} talep onay bekliyor`}>
                    {bekleyen} onay
                  </span>
                )}
                {id === aktif && <span className="cip bg-vurgu text-vurgu-metin">Sen</span>}
                {kilitli && <Lock size={13} className="text-soluk" aria-label="Kapsam dışı" />}
                {s.ekip > 0 && (
                  <span className="min-w-5 rounded-md bg-notr-acik px-1.5 text-center text-[11px] font-semibold tabular-nums text-soluk" title={`${s.ekip} doğrudan ekip`}>
                    {s.ekip}
                  </span>
                )}
              </span>
            </motion.div>
          );
        })}
        {satirlar.length === 0 && <p className="px-3 py-8 text-center text-sm text-soluk">“{q}” için kimse bulunamadı.</p>}
      </div>
    </div>
  );
}
