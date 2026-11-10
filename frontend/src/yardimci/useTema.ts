import { useCallback, useEffect, useState } from "react";

export type Tema = "light" | "dark";

const sistemTemasi = (): Tema => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function kayitliTema(): Tema | null {
  try {
    const t = localStorage.getItem("tema");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** Sistem temasını izler; kullanıcı seçerse onu hatırlar. */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => kayitliTema() ?? sistemTemasi());

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  const degistir = useCallback(() => {
    setTema((t) => {
      const yeni = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("tema", yeni);
      } catch {
        /* depolama kapalı olabilir */
      }
      return yeni;
    });
  }, []);

  return { tema, degistir };
}
