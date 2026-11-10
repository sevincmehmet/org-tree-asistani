// İki ağaç görünümünün (Liste + Şema) ortak durumu: seçim, aç/kapa, odak modu.
// Hepsi yerel: hiçbiri LLM'i çağırmaz.
import { useCallback, useMemo, useState } from "react";
import type { AgacKisi } from "../api/tipler";
import { acilmasiGerekenler, atalar, cocuklariHesapla } from "../yardimci/agacGorunum";
import { efektKisileri } from "../viz/olayEslestir";
import type { EfektPaketi } from "./useAjan";

export type AgacGorunumuTuru = "liste" | "sema";

function kayitliGorunum(): AgacGorunumuTuru {
  try {
    const g = localStorage.getItem("agacGorunumu");
    if (g === "liste" || g === "sema") return g;
  } catch {
    /* depolama kapalı olabilir */
  }
  // Dar ekranda liste daha kullanışlı.
  return typeof window !== "undefined" && window.innerWidth < 640 ? "liste" : "sema";
}

type Ustune = Map<string, boolean>; // kullanıcının aç/kapa tercihleri (varsayılanın üstüne)

function acikHesapla(agac: AgacKisi[], varsayilan: Set<string>, ustune: Ustune): Set<string> {
  const s = new Set(varsayilan);
  for (const [id, acik] of ustune) {
    if (acik) s.add(id);
    else s.delete(id);
  }
  // Var olmayan id'leri at.
  const idler = new Set(agac.map((k) => k.id));
  return new Set([...s].filter((id) => idler.has(id)));
}

export function useAgacGorunumu(agac: AgacKisi[], aktif: string, efekt: EfektPaketi | null) {
  const [gorunum, setGorunumHam] = useState<AgacGorunumuTuru>(kayitliGorunum);
  const [secili, setSecili] = useState<string | null>(null);
  const [odak, setOdak] = useState(false);
  const [profil, setProfil] = useState(false);
  const [listeUstune, setListeUstune] = useState<Ustune>(() => new Map());
  const [semaUstune, setSemaUstune] = useState<Ustune>(() => new Map());

  const cocuklar = useMemo(() => cocuklariHesapla(agac), [agac]);

  // Yeni ajan efekti gelince ilgili kişileri her iki görünümde de açığa çıkar (render sırasında ayar).
  const [sonNonce, setSonNonce] = useState(0);
  if (efekt && efekt.nonce !== sonNonce) {
    setSonNonce(efekt.nonce);
    const ac = acilmasiGerekenler(agac, efektKisileri(efekt.liste));
    if (ac.size) {
      const ekle = (m: Ustune) => {
        const y = new Map(m);
        ac.forEach((id) => y.set(id, true));
        return y;
      };
      setListeUstune(ekle);
      setSemaUstune(ekle);
    }
  }

  const aktifAtalari = useMemo(() => atalar(agac, aktif), [agac, aktif]);

  // Liste: ilk iki seviye + aktif kullanıcının zinciri açık.
  const listeVarsayilan = useMemo(() => {
    const s = new Set<string>([...aktifAtalari, aktif]);
    for (const kok of cocuklar.get("") ?? []) {
      s.add(kok);
      (cocuklar.get(kok) ?? []).forEach((c) => s.add(c));
    }
    return s;
  }, [cocuklar, aktifAtalari, aktif]);

  // Şema: sadece aktif kullanıcının zinciri ve kendisi açık (derin seviyeler kapalı).
  const semaVarsayilan = useMemo(() => new Set<string>([...aktifAtalari, aktif]), [aktifAtalari, aktif]);

  const listeAcik = useMemo(() => acikHesapla(agac, listeVarsayilan, listeUstune), [agac, listeVarsayilan, listeUstune]);
  const semaAcik = useMemo(() => acikHesapla(agac, semaVarsayilan, semaUstune), [agac, semaVarsayilan, semaUstune]);

  const listeDegistir = useCallback((id: string, acik: boolean) => {
    setListeUstune((m) => new Map(m).set(id, acik));
  }, []);
  const semaDegistir = useCallback((id: string, acik: boolean) => {
    setSemaUstune((m) => new Map(m).set(id, acik));
  }, []);

  /** Kişiyi seç ve her iki görünümde zincirini aç. */
  const sec = useCallback(
    (id: string | null, profilAc = true) => {
      setSecili(id);
      setProfil(!!id && profilAc);
      if (!id) return;
      const ac = atalar(agac, id);
      const ekle = (m: Ustune) => {
        const y = new Map(m);
        ac.forEach((x) => y.set(x, true));
        return y;
      };
      setListeUstune(ekle);
      setSemaUstune(ekle);
    },
    [agac],
  );

  const setGorunum = useCallback((g: AgacGorunumuTuru) => {
    setGorunumHam(g);
    try {
      localStorage.setItem("agacGorunumu", g);
    } catch {
      /* depolama kapalı olabilir */
    }
  }, []);

  /** Şemada her şeyi aç / varsayılana dön. */
  const hepsiniAc = useCallback(() => {
    setSemaUstune(new Map([...cocuklar.keys()].filter(Boolean).map((id) => [id, true])));
  }, [cocuklar]);
  const varsayilanaDon = useCallback(() => setSemaUstune(new Map()), []);

  const seciliGecerli = secili && agac.some((k) => k.id === secili) ? secili : null;

  return {
    gorunum,
    setGorunum,
    secili: seciliGecerli,
    sec,
    profil: profil && !!seciliGecerli,
    profilKapat: () => setProfil(false),
    odak,
    setOdak,
    cocuklar,
    listeAcik,
    semaAcik,
    listeDegistir,
    semaDegistir,
    hepsiniAc,
    varsayilanaDon,
  };
}

export type AgacGorunumuApi = ReturnType<typeof useAgacGorunumu>;
