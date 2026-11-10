// Üst bar: tek satır, 1280px'de sarmaz. Dar ekranda ikincil eylemler "⋯" menüsüne taşınır.
import { motion } from "framer-motion";
import { Briefcase, ChevronsUpDown, GraduationCap, Moon, MoreHorizontal, RotateCcw, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AgacKisi } from "../api/tipler";
import type { Baglanti } from "../durum/useAjan";
import type { AgentAdi } from "../icerik/tipler";
import { AGENT_BILGI } from "../yardimci/agentBilgi";
import type { Mod } from "../yardimci/useMod";
import { Avatar } from "./Avatar";

interface Props {
  motto: string;
  aktifAgent: AgentAdi;
  agentSec: (a: AgentAdi) => void;
  kisiler: AgacKisi[];
  aktifKullanici: string;
  kullaniciDegistir: (id: string) => void;
  yeniOturum: () => void;
  calisiyor: boolean;
  baglanti: Baglanti;
  mock: boolean;
  tema: "light" | "dark";
  temaDegistir: () => void;
  mod: Mod;
  modDegistir: () => void;
}

const BAGLANTI: Record<Baglanti, { renk: string; etiket: string; kisa: string }> = {
  kontrol: { renk: "bg-uyari", etiket: "Backend kontrol ediliyor…", kisa: "Bağlanıyor" },
  bagli: { renk: "bg-basari", etiket: "ADK sunucusuna bağlı", kisa: "Bağlı" },
  mock: { renk: "bg-uyari", etiket: "Mock mod: olaylar tarayıcıda senaryodan üretiliyor", kisa: "Mock" },
};

function KullaniciSecici({ kisiler, aktif, degistir, kapali }: { kisiler: AgacKisi[]; aktif: string; degistir: (id: string) => void; kapali: boolean }) {
  const ben = kisiler.find((k) => k.id === aktif);
  return (
    <label
      className={`relative flex h-9 min-w-0 items-center gap-2 rounded-[10px] border border-cizgi bg-panel pr-2 pl-1 shadow-yumusak transition-colors focus-within:ring-2 focus-within:ring-vurgu ${kapali ? "opacity-60" : "hover:border-cizgi-guclu hover:bg-hover"}`}
      title="Giriş yapan kişi (kapsam ve yetki buna göre)"
    >
      {ben && <Avatar kisi={ben} boyut={28} />}
      <span className="hidden min-w-0 leading-tight md:block">
        <span className="block max-w-[150px] truncate text-[13px] font-semibold">{ben?.ad ?? aktif}</span>
        <span className="block max-w-[150px] truncate text-[11px] text-soluk">{ben?.unvan}</span>
      </span>
      <ChevronsUpDown size={14} className="hidden shrink-0 text-soluk sm:block" aria-hidden />
      <select
        value={aktif}
        onChange={(e) => degistir(e.target.value)}
        disabled={kapali}
        aria-label="Giriş yapan kullanıcı"
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      >
        {kisiler.map((k) => (
          <option key={k.id} value={k.id}>
            {k.ad} · {k.unvan}
          </option>
        ))}
      </select>
    </label>
  );
}

function TasmaMenusu({ p }: { p: Props }) {
  const [acik, setAcik] = useState(false);
  const kutu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const dis = (e: PointerEvent) => kutu.current && !kutu.current.contains(e.target as Node) && setAcik(false);
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const ogeler = [...(kutu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
        const i = ogeler.indexOf(document.activeElement as HTMLButtonElement);
        ogeler[(i + (e.key === "ArrowDown" ? 1 : -1) + ogeler.length) % ogeler.length]?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("pointerdown", dis);
    window.addEventListener("keydown", tus);
    requestAnimationFrame(() => kutu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus());
    return () => {
      window.removeEventListener("pointerdown", dis);
      window.removeEventListener("keydown", tus);
    };
  }, [acik]);

  const oge = (onClick: () => void) => () => {
    onClick();
    setAcik(false);
  };
  const sinif = "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] hover:bg-hover focus-visible:bg-hover disabled:opacity-50";
  return (
    <div className="relative shrink-0" ref={kutu}>
      <button type="button" aria-haspopup="menu" aria-expanded={acik} aria-label="Diğer seçenekler" onClick={() => setAcik((a) => !a)} className="btn btn-hayalet btn-ikon">
        <MoreHorizontal size={18} />
      </button>
      {acik && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12 }}
          className="absolute top-full right-0 z-50 mt-2 w-60 origin-top-right rounded-xl border border-cizgi bg-panel p-1.5 shadow-buyuk"
        >
          <button role="menuitem" type="button" className={sinif} disabled={p.calisiyor} onClick={oge(p.yeniOturum)}>
            <RotateCcw size={15} className="text-soluk" /> Yeni oturum ({AGENT_BILGI[p.aktifAgent].kisa})
          </button>
          <button role="menuitem" type="button" className={`${sinif} lg:hidden`} disabled={p.calisiyor} onClick={oge(p.modDegistir)}>
            {p.mod === "ogrenme" ? <Briefcase size={15} className="text-soluk" /> : <GraduationCap size={15} className="text-soluk" />}
            {p.mod === "ogrenme" ? "Uygulama moduna geç" : "Öğrenme moduna geç"}
          </button>
          <button role="menuitem" type="button" className={sinif} onClick={oge(p.temaDegistir)}>
            {p.tema === "dark" ? <Sun size={15} className="text-soluk" /> : <Moon size={15} className="text-soluk" />}
            {p.tema === "dark" ? "Açık tema" : "Koyu tema"}
          </button>
          <div className="my-1 h-px bg-cizgi" />
          <p className="px-2.5 py-1.5 text-[11.5px] leading-snug text-soluk">{BAGLANTI[p.baglanti].etiket}</p>
        </motion.div>
      )}
    </div>
  );
}

export function UstBar(p: Props) {
  const b = BAGLANTI[p.baglanti];
  const ogrenme = p.mod === "ogrenme";
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-cizgi bg-panel/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-vurgu text-vurgu-metin shadow-yumusak max-[359px]:hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="5" rx="1.5" />
            <rect x="3" y="16" width="6" height="5" rx="1.5" />
            <rect x="15" y="16" width="6" height="5" rx="1.5" />
            <path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
          </svg>
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <h1 className="truncate text-[14.5px] font-semibold tracking-tight">{ogrenme ? "Org Ajan Akademisi" : "Org Asistanı"}</h1>
          <p className="hidden max-w-[260px] truncate text-[11.5px] text-soluk 2xl:block" title={ogrenme ? p.motto : undefined}>
            {ogrenme ? p.motto : "Organizasyon ağacınızla doğal dilde konuşun"}
          </p>
        </div>
      </div>

      <span className="mx-1 hidden h-6 w-px bg-cizgi lg:block" aria-hidden />

      <div role="radiogroup" aria-label="Agent seçimi" className="segment shrink-0">
        {(Object.keys(AGENT_BILGI) as AgentAdi[]).map((a) => {
          const secili = a === p.aktifAgent;
          return (
            <button key={a} type="button" role="radio" aria-checked={secili} onClick={() => p.agentSec(a)} disabled={p.calisiyor} title={`${AGENT_BILGI[a].ad} (${a})`} className="max-sm:gap-1.5 max-sm:px-2">
              {secili && <motion.span layoutId="agent-secici" className="segment-zemin" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span aria-hidden className="relative">
                {AGENT_BILGI[a].ikon}
              </span>
              <span className="relative 2xl:hidden">{AGENT_BILGI[a].kisa}</span>
              <span className="relative hidden 2xl:inline">{AGENT_BILGI[a].ad}</span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <KullaniciSecici kisiler={p.kisiler} aktif={p.aktifKullanici} degistir={p.kullaniciDegistir} kapali={p.calisiyor} />

        <div role="radiogroup" aria-label="Görünüm modu" className="segment hidden lg:inline-flex">
          {(
            [
              ["ogrenme", "Öğrenme", GraduationCap, "Dersler, ajan izleri ve State görünür"],
              ["uygulama", "Uygulama", Briefcase, "Gerçek kullanım: sadece sohbet, ağaç ve talepler"],
            ] as const
          ).map(([m, etiket, Ikon, ipucu]) => (
            <button key={m} type="button" role="radio" aria-checked={p.mod === m} disabled={p.calisiyor} title={ipucu} onClick={() => p.mod !== m && p.modDegistir()}>
              {p.mod === m && <motion.span layoutId="mod-secici" className="segment-zemin" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Ikon size={14} className="relative" aria-hidden />
              <span className="relative hidden xl:inline">{etiket}</span>
            </button>
          ))}
        </div>

        <span
          className={`hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium md:inline-flex ${p.mock ? "bg-uyari-acik text-uyari" : "bg-notr-acik text-soluk"}`}
          title={b.etiket}
          role="status"
        >
          <span className={`h-2 w-2 rounded-full ${b.renk} ${p.baglanti === "kontrol" ? "animate-pulse" : ""}`} aria-hidden />
          {b.kisa}
        </span>

        <button
          type="button"
          onClick={p.temaDegistir}
          aria-label={p.tema === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
          title={p.tema === "dark" ? "Açık tema" : "Koyu tema"}
          className="btn btn-hayalet btn-ikon hidden sm:inline-flex"
        >
          {p.tema === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <TasmaMenusu p={p} />
      </div>
    </header>
  );
}
