import { useCallback, useState } from "react";

/**
 * İki görünüm:
 *  - "ogrenme":  dersler, kavram sözlüğü, "Ajan nasıl düşündü?" şeridi ve State sekmesi görünür.
 *  - "uygulama": gerçek kullanım; sadece sohbet + org tree.
 * Öncelik: URL (?mod=uygulama | ?mod=ogrenme) > kayıtlı seçim > "ogrenme".
 */
export type Mod = "ogrenme" | "uygulama";

const gecerli = (m: string | null): m is Mod => m === "ogrenme" || m === "uygulama";

function baslangicModu(): Mod {
  const url = new URLSearchParams(window.location.search).get("mod");
  if (gecerli(url)) return url;
  try {
    const kayitli = localStorage.getItem("mod");
    if (gecerli(kayitli)) return kayitli;
  } catch {
    /* depolama kapalı olabilir */
  }
  return "ogrenme";
}

export function useMod() {
  const [mod, setMod] = useState<Mod>(baslangicModu);

  const degistir = useCallback(() => {
    setMod((m) => {
      const yeni: Mod = m === "ogrenme" ? "uygulama" : "ogrenme";
      try {
        localStorage.setItem("mod", yeni);
      } catch {
        /* depolama kapalı olabilir */
      }
      const url = new URL(window.location.href);
      url.searchParams.set("mod", yeni);
      window.history.replaceState(null, "", url);
      return yeni;
    });
  }, []);

  return { mod, degistir };
}

/** Uygulama modunda boş sohbette gösterilen gerçek kullanım önerileri. */
export const ORNEK_SORULAR: Record<"org_asistani" | "calisan_asistani", string[]> = {
  org_asistani: [
    "Onayımı bekleyen talepler",
    "Bildirimlerim",
    "Ekibimde kimler var? Alt ekipler dahil",
    "İrem'i bul",
    "Emre'nin raporlama zincirini göster",
  ],
  calisan_asistani: [
    "Gelecek cuma izin almak istiyorum",
    "Taleplerim ne durumda?",
    "Bildirimlerim",
    "Yöneticim kim?",
    "Projede backend desteğine ihtiyacım var",
  ],
};
