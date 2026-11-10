import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "./Modal";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdkEvent } from "../api/tipler";
import { ADIM_BILGI, adimlariCikar } from "../viz/adimlar";

/** "Ajan nasıl düşündü?" — mevcut turun olaylarından renkli adım şeridi. */
export function DusunceCizelgesi({ olaylar, calisiyor }: { olaylar: AdkEvent[]; calisiyor: boolean }) {
  const adimlar = useMemo(() => adimlariCikar(olaylar), [olaylar]);
  const [secili, setSecili] = useState<string | null>(null);
  const serit = useRef<HTMLOListElement>(null);
  const seciliAdim = adimlar.find((a) => a.anahtar === secili);

  useEffect(() => {
    serit.current?.scrollTo({ left: serit.current.scrollWidth, behavior: "smooth" });
  }, [adimlar.length]);

  return (
    <section aria-labelledby="dusunce-baslik" className="kart px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="dusunce-baslik" className="text-[13.5px] font-semibold">
          🧠 Ajan nasıl düşündü?
        </h2>
        <p className="text-xs text-soluk">Bu turun olayları, sırayla. Bir adıma tıkla → ham olay JSON'u.</p>
        <div className="ml-auto hidden flex-wrap gap-2 text-[11px] text-soluk lg:flex">
          {(["mesaj", "karar", "red", "onay_istek", "sonuc", "cevap"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: ADIM_BILGI[t].renk }} />
              {ADIM_BILGI[t].etiket}
            </span>
          ))}
        </div>
      </div>

      {adimlar.length === 0 ? (
        <p className="py-2 text-center text-xs text-soluk">Henüz bir tur yok. Bir mesaj gönderince model kararları, tool çağrıları ve callback'ler burada görünür.</p>
      ) : (
        <ol ref={serit} className="flex items-stretch gap-1 overflow-x-auto pb-1" aria-label="Adımlar">
          <AnimatePresence initial={false}>
            {adimlar.map((a, i) => {
              const bilgi = ADIM_BILGI[a.tur];
              const aktif = secili === a.anahtar;
              return (
                <motion.li key={a.anahtar} className="flex shrink-0 items-center" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                  {i > 0 && (
                    <span className="mx-0.5 text-soluk" aria-hidden>
                      →
                    </span>
                  )}
                  <button
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => setSecili(aktif ? null : a.anahtar)}
                    className="w-44 rounded-lg border bg-panel-2 px-2.5 py-1.5 text-left transition-[transform,border-color] hover:-translate-y-0.5"
                    style={{ borderColor: aktif ? bilgi.renk : "var(--cizgi)", boxShadow: `inset 3px 0 0 ${bilgi.renk}` }}
                  >
                    <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: bilgi.renk }}>
                      <span aria-hidden>{a.ikon}</span>
                      {bilgi.etiket}
                    </span>
                    <span className="block truncate text-xs font-semibold" title={a.baslik}>
                      {a.baslik}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-soluk" title={a.alt}>
                      {a.alt || " "}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {calisiyor && (
            <li className="flex shrink-0 items-center gap-1 px-2" aria-label="Devam ediyor">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-soluk" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
              ))}
            </li>
          )}
        </ol>
      )}

      <Modal acik={!!seciliAdim} baslik={seciliAdim ? `${seciliAdim.ikon} ${ADIM_BILGI[seciliAdim.tur].etiket} — ham olay` : ""} kapat={() => setSecili(null)} genis>
        {seciliAdim && (
          <>
            <p className="mb-2 text-sm">
              {seciliAdim.baslik} <span className="text-soluk">· author: <span className="font-mono">{seciliAdim.olay.author ?? "?"}</span></span>
            </p>
            <pre className="max-h-[60vh] overflow-auto rounded-xl bg-panel-2 p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">{JSON.stringify(seciliAdim.olay, null, 2)}</pre>
          </>
        )}
      </Modal>
    </section>
  );
}
