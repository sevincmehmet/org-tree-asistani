import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

interface Props {
  acik: boolean;
  baslik: string;
  kapat: () => void;
  children: ReactNode;
  genis?: boolean;
}

export function Modal({ acik, baslik, kapat, children, genis }: Props) {
  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [acik, kapat]);

  return (
    <AnimatePresence>
      {acik && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={kapat}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={baslik}
            className={`max-h-[85vh] w-full ${genis ? "max-w-3xl" : "max-w-lg"} overflow-auto rounded-2xl border border-cizgi bg-panel p-6 shadow-buyuk`}
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">{baslik}</h2>
              <button
                type="button"
                onClick={kapat}
                aria-label="Kapat"
                className="rounded-lg px-2 py-1 text-soluk hover:bg-notr-acik hover:text-metin"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
