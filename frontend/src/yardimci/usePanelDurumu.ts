import { useCallback, useState } from "react";

/**
 * Sol (Dersler) ve sağ (Ağaç/Talepler) panellerin açık/kapalı durumu.
 * Sadece geniş ekranda (lg+) etkilidir; mobilde paneller alt alta ve hep açıktır.
 * Seçim tarayıcıda hatırlanır (localStorage kapalıysa varsayılan: ikisi de açık).
 */
export type PanelAdi = "sol" | "sag";

const ANAHTAR = "panelDurumu";

function oku(): Record<PanelAdi, boolean> {
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Partial<Record<PanelAdi, unknown>>;
    return { sol: ham.sol !== false, sag: ham.sag !== false };
  } catch {
    return { sol: true, sag: true };
  }
}

export function usePanelDurumu() {
  const [acik, setAcik] = useState(oku);

  const degistir = useCallback((panel: PanelAdi, deger?: boolean) => {
    setAcik((a) => {
      const yeni = { ...a, [panel]: deger ?? !a[panel] };
      try {
        localStorage.setItem(ANAHTAR, JSON.stringify(yeni));
      } catch {
        /* depolama kapalı olabilir */
      }
      return yeni;
    });
  }, []);

  return { acik, degistir };
}
