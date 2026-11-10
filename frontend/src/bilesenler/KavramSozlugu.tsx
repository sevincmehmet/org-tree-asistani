import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Kavram } from "../icerik/tipler";
import { MarkdownLite } from "./MarkdownLite";

/** Kavram çipleri; tıklanınca açıklama baloncuğu açılır. */
export function KavramSozlugu({ kavramlar }: { kavramlar: Kavram[] }) {
  const [acik, setAcik] = useState<string | null>(null);
  const kutu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    const disTik = (e: PointerEvent) => {
      if (kutu.current && !kutu.current.contains(e.target as Node)) setAcik(null);
    };
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setAcik(null);
    window.addEventListener("pointerdown", disTik);
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("pointerdown", disTik);
      window.removeEventListener("keydown", tus);
    };
  }, [acik]);

  if (!kavramlar.length) return null;
  const secili = kavramlar.find((k) => k.terim === acik);

  return (
    <div ref={kutu} className="px-1">
      <h3 className="baslik-kucuk mb-2">Kavram sözlüğü</h3>
      <div className="flex flex-wrap gap-1.5">
        {kavramlar.map((k) => (
          <button
            key={k.terim}
            type="button"
            aria-expanded={acik === k.terim}
            onClick={() => setAcik((a) => (a === k.terim ? null : k.terim))}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${acik === k.terim ? "border-vurgu/50 bg-vurgu-acik text-vurgu" : "border-cizgi bg-panel text-metin-2 hover:border-cizgi-guclu hover:bg-hover"}`}
          >
            {k.terim}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {secili && (
          <motion.div
            key={secili.terim}
            role="note"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 space-y-2 rounded-xl border border-cizgi bg-panel-2 p-3 text-[13px]"
          >
            <p className="font-semibold">{secili.terim}</p>
            <p>
              <span aria-hidden>🍽️ </span>
              {secili.benzetme.replace(/^\s*🍽️\s*/u, "")}
            </p>
            <div className="text-soluk">
              <MarkdownLite metin={secili.aciklama} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
