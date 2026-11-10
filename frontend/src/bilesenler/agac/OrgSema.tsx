// 🌳 Şema: org chart. Derin seviyeler kapalı başlar, düğümde aç/kapa, Odak modu, pan/zoom,
// seçilene/efekte otomatik ortalama ve CONTRACT'taki bütün v2 + v3 efektleri.
import { AnimatePresence, motion } from "framer-motion";
import { FoldVertical, Focus, Maximize, Minus, Plus, ScanSearch, UnfoldVertical } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import type { AgacKisi } from "../../api/tipler";
import type { AgacGorunumuApi } from "../../durum/useAgacGorunumu";
import type { EfektPaketi } from "../../durum/useAjan";
import { gorunurAgac, odakAgaci } from "../../yardimci/agacGorunum";
import { haritala, type Kapsam } from "../../yardimci/org";
import { dirsek, duzenHesapla, KART_G, KART_Y, yonluDirsek, type Duzen } from "../../viz/agacDuzeni";
import { ADIM_SURESI, efektDurumu } from "../../viz/efektDurumu";
import { efektKisileri } from "../../viz/olayEslestir";
import { SemaDugumu, type Gorunurluk } from "./SemaDugumu";

interface Props {
  agac: AgacKisi[];
  aktif: string;
  kapsam: Kapsam;
  efekt: EfektPaketi | null;
  g: AgacGorunumuApi;
  bekleyenler: Map<string, number>;
  tikla: (id: string) => void;
  /** Sağdaki profil paneli açıkken kapladığı genişlik (ortalamada hesaba katılır). */
  sagBosluk: number;
}

interface Donusum {
  x: number;
  y: number;
  k: number;
}

const sinirla = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const PAY = 40;
const K_MIN = 0.3;
const K_MAX = 1.6;

function useBoyut<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [boyut, setBoyut] = useState({ g: 0, y: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([g]) => setBoyut({ g: g.contentRect.width, y: g.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, boyut };
}

function kutuHesapla(duzen: Duzen, idler: string[]) {
  const k = idler.map((id) => duzen.konumlar.get(id)).filter((x) => !!x);
  if (!k.length) return null;
  return {
    x0: Math.min(...k.map((p) => p.x - KART_G / 2)),
    x1: Math.max(...k.map((p) => p.x + KART_G / 2)),
    y0: Math.min(...k.map((p) => p.y)),
    y1: Math.max(...k.map((p) => p.y + KART_Y)),
  };
}

/** İki kart arasında kavisli kesikli "bilgi" çizgisi (hiyerarşi dışı). */
function bilgiYolu(a: { x: number; y: number }, b: { x: number; y: number }) {
  const ax = a.x;
  const ay = a.y + KART_Y / 2;
  const bx = b.x;
  const by = b.y + KART_Y / 2;
  const sol = bx < ax;
  const x1 = ax + (sol ? -KART_G / 2 : KART_G / 2);
  const x2 = bx + (sol ? KART_G / 2 : -KART_G / 2);
  const orta = Math.min(ay, by) - 60;
  return `M ${x1} ${ay} C ${x1 + (sol ? -40 : 40)} ${orta}, ${x2 + (sol ? 40 : -40)} ${orta}, ${x2} ${by}`;
}

export function OrgSema({ agac, aktif, kapsam, efekt, g, bekleyenler, tikla, sagBosluk }: Props) {
  const { ref: kutu, boyut } = useBoyut<HTMLDivElement>();
  const harita = useMemo(() => haritala(agac), [agac]);
  const odakId = g.secili ?? aktif;
  const gorunurListe = useMemo(() => (g.odak ? odakAgaci(agac, odakId) : gorunurAgac(agac, g.semaAcik)), [agac, g.odak, odakId, g.semaAcik]);
  const duzen = useMemo(() => duzenHesapla(gorunurListe), [gorunurListe]);
  const durum = useMemo(() => efektDurumu(efekt?.liste ?? [], harita), [efekt, harita]);
  const nonce = efekt?.nonce ?? 0;

  const [donusum, setDonusum] = useState<Donusum>({ x: 0, y: 0, k: 0.9 });
  const [yumusak, setYumusak] = useState(false);
  const elleOynandi = useRef(false);
  const ilkYerlesim = useRef(true);

  const genislik = Math.max(200, boyut.g - (boyut.g > 640 ? sagBosluk : 0));

  /** Programatik hareket: yumuşak geçişle. */
  const git = useCallback((d: Donusum) => {
    setYumusak(true);
    setDonusum(d);
  }, []);

  const sigdirHesap = useCallback(
    (kutuB: { x0: number; x1: number; y0: number; y1: number }, kMax = 1) => {
      const k = sinirla(Math.min((genislik - PAY * 2) / (kutuB.x1 - kutuB.x0), (boyut.y - PAY * 2) / (kutuB.y1 - kutuB.y0)), K_MIN, kMax);
      return {
        k,
        x: genislik / 2 - ((kutuB.x0 + kutuB.x1) / 2) * k,
        y: Math.max(PAY - kutuB.y0 * k, boyut.y / 2 - ((kutuB.y0 + kutuB.y1) / 2) * k),
      };
    },
    [genislik, boyut.y],
  );

  /** Tümünü sığdır; okunamayacak kadar küçülecekse odak kişisi + yöneticisi + ekibine sığdır. */
  const otomatik = useCallback(() => {
    if (!boyut.g || !boyut.y) return;
    const s = duzen.sinir;
    const tam = sigdirHesap({ x0: s.minX, x1: s.maxX, y0: s.minY, y1: s.maxY });
    if (tam.k >= 0.88) return git(tam);
    const p = duzen.konumlar.get(odakId);
    if (!p) return git(tam);
    const grup = [odakId, ...(p.kisi.yonetici ? [p.kisi.yonetici] : []), ...gorunurListe.filter((k) => k.yonetici === odakId).map((k) => k.id)];
    const b = kutuHesapla(duzen, grup)!;
    const k = sinirla(Math.min((genislik - PAY * 2) / (b.x1 - b.x0), (boyut.y - PAY * 2) / (b.y1 - b.y0)), 0.8, 1);
    git({ k, x: genislik / 2 - ((b.x0 + b.x1) / 2) * k, y: Math.min(PAY - b.y0 * k, boyut.y / 2 - ((b.y0 + b.y1) / 2) * k) });
  }, [boyut, duzen, sigdirHesap, git, odakId, genislik, gorunurListe]);

  /** Kutuyu görünür alana getirir (gerekirse uzaklaşır); zaten görünürse dokunmaz. */
  const donusumRef = useRef(donusum);
  useEffect(() => {
    donusumRef.current = donusum;
  });
  const gorunurYap = useCallback(
    (idler: string[], ortala = false) => {
      const b = kutuHesapla(duzen, idler);
      if (!b || !boyut.g) return;
      if (durum.bilgi.length) b.y0 -= 64; // "bilgi" çizgisi kartların üstünden kavis yapar
      const d = donusumRef.current;
      const kGerek = Math.min((genislik - PAY * 2) / (b.x1 - b.x0), (boyut.y - PAY * 2) / (b.y1 - b.y0));
      if (kGerek < d.k || ortala) {
        const k = sinirla(Math.min(d.k, kGerek), 0.5, K_MAX);
        git({ k, x: genislik / 2 - ((b.x0 + b.x1) / 2) * k, y: boyut.y / 2 - ((b.y0 + b.y1) / 2) * k });
        return;
      }
      const sx0 = d.x + b.x0 * d.k;
      const sx1 = d.x + b.x1 * d.k;
      const sy0 = d.y + b.y0 * d.k;
      const sy1 = d.y + b.y1 * d.k;
      const dx = sx0 < PAY ? PAY - sx0 : sx1 > genislik - PAY ? genislik - PAY - sx1 : 0;
      const dy = sy0 < PAY ? PAY - sy0 : sy1 > boyut.y - PAY ? boyut.y - PAY - sy1 : 0;
      if (dx || dy) git({ ...d, x: d.x + dx, y: d.y + dy });
    },
    [duzen, boyut, genislik, git, durum.bilgi.length],
  );

  // İlk yerleşim + odak modu değişince otomatik yerleştir.
  const odakAnahtari = `${g.odak}-${g.odak ? odakId : ""}`;
  const sonOdak = useRef(odakAnahtari);
  useLayoutEffect(() => {
    if (!boyut.g || !boyut.y) return;
    if (ilkYerlesim.current || sonOdak.current !== odakAnahtari) {
      ilkYerlesim.current = false;
      sonOdak.current = odakAnahtari;
      elleOynandi.current = false;
      otomatik();
      // Panel yeniden açıldığında süren bir efekt varsa onu göster.
      if (efekt) gorunurYap(efektKisileri(efekt.liste), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- efekt sadece ilk yerleşimde okunur
  }, [boyut, odakAnahtari, otomatik]);

  // Seçim değişince seçileni görünür yap.
  useEffect(() => {
    if (g.secili) gorunurYap([g.secili]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece seçim değişince
  }, [g.secili]);

  // Yeni ajan efekti: efektin kişilerini görünür alana getir.
  useEffect(() => {
    if (!efekt) return;
    const t = setTimeout(() => gorunurYap(efektKisileri(efekt.liste)), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece yeni efektte
  }, [efekt?.nonce]);

  // Aç/kapa sonrası açılan ekibi görünür yap.
  const bekleyenGorunur = useRef<string[] | null>(null);
  useEffect(() => {
    if (bekleyenGorunur.current) {
      gorunurYap(bekleyenGorunur.current);
      bekleyenGorunur.current = null;
    }
  }, [duzen, gorunurYap]);

  const acKapa = useCallback(
    (id: string, acik: boolean) => {
      bekleyenGorunur.current = acik ? [id, ...(g.cocuklar.get(id) ?? [])] : [id];
      g.semaDegistir(id, acik);
    },
    [g],
  );

  // Ctrl/⌘ + tekerlek (ya da trackpad kıstırma) yakınlaştırır, tekerlek kaydırır.
  useEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const tekerlek = (e: WheelEvent) => {
      e.preventDefault();
      elleOynandi.current = true;
      setYumusak(false);
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setDonusum((d) => {
        if (e.ctrlKey || e.metaKey) {
          const k = sinirla(d.k * Math.exp(-e.deltaY * 0.01), K_MIN, K_MAX);
          return { k, x: mx - (mx - d.x) * (k / d.k), y: my - (my - d.y) * (k / d.k) };
        }
        return { ...d, x: d.x - e.deltaX, y: d.y - e.deltaY };
      });
    };
    el.addEventListener("wheel", tekerlek, { passive: false });
    return () => el.removeEventListener("wheel", tekerlek);
  }, [kutu]);

  // Sürükleyerek kaydırma
  const surukle = useRef<{ x: number; y: number; dx: number; dy: number; tasindi: boolean } | null>(null);
  const tasindiMi = useRef(false);
  const basla = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    surukle.current = { x: e.clientX, y: e.clientY, dx: donusum.x, dy: donusum.y, tasindi: false };
    tasindiMi.current = false;
  };
  const hareket = (e: RPointerEvent) => {
    const s = surukle.current;
    if (!s) return;
    const fx = e.clientX - s.x;
    const fy = e.clientY - s.y;
    if (!s.tasindi && Math.hypot(fx, fy) < 4) return;
    if (!s.tasindi) (e.currentTarget as Element).setPointerCapture(e.pointerId);
    s.tasindi = true;
    tasindiMi.current = true;
    elleOynandi.current = true;
    setYumusak(false);
    setDonusum((d) => ({ ...d, x: s.dx + fx, y: s.dy + fy }));
  };
  const bitir = () => {
    surukle.current = null;
  };

  const yakinlas = (carpan: number) => {
    elleOynandi.current = true;
    const d = donusumRef.current;
    const k = sinirla(d.k * carpan, K_MIN, K_MAX);
    const mx = genislik / 2;
    const my = boyut.y / 2;
    git({ k, x: mx - (mx - d.x) * (k / d.k), y: my - (my - d.y) * (k / d.k) });
  };

  const sigdir = () => {
    const s = duzen.sinir;
    git(sigdirHesap({ x0: s.minX, x1: s.maxX, y0: s.minY, y1: s.maxY }, 1.1));
  };
  const ortala = () => gorunurYap([odakId], true);

  const gorunurluk = (id: string): Gorunurluk => (kapsam.kapsam.has(id) ? "kapsam" : kapsam.ustZincir.has(id) ? "zincir" : "kilitli");

  const dugumTikla = useCallback(
    (id: string) => {
      if (tasindiMi.current) return;
      tikla(id);
    },
    [tikla],
  );

  // Klavye: ↑ yönetici, ↓ ekibin ilki (gerekirse açar), ←/→ kardeşler, Enter/Space seç.
  const odakla = (id: string) => requestAnimationFrame(() => kutu.current?.querySelector<SVGGElement>(`[data-dugum="${id}"]`)?.focus());
  const tus = (e: KeyboardEvent, id: string) => {
    const k = duzen.konumlar.get(id)?.kisi;
    if (!k) return;
    const kardesler = gorunurListe.filter((x) => x.yonetici === k.yonetici).map((x) => x.id);
    const i = kardesler.indexOf(id);
    const cocuk = gorunurListe.filter((x) => x.yonetici === id).map((x) => x.id);
    let hedef: string | null = null;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      tikla(id);
      return;
    }
    if (e.key === "ArrowUp" && k.yonetici && duzen.konumlar.has(k.yonetici)) hedef = k.yonetici;
    if (e.key === "ArrowDown") {
      if (cocuk.length) hedef = cocuk[0];
      else if ((g.cocuklar.get(id) ?? []).length && !g.odak) {
        acKapa(id, true);
        hedef = g.cocuklar.get(id)![0];
      }
    }
    if (e.key === "ArrowLeft" && i > 0) hedef = kardesler[i - 1];
    if (e.key === "ArrowRight" && i >= 0 && i < kardesler.length - 1) hedef = kardesler[i + 1];
    if (hedef) {
      e.preventDefault();
      gorunurYap([hedef]);
      odakla(hedef);
    }
  };

  const konumlar = [...duzen.konumlar.values()];

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden" ref={kutu}>
      <svg
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={basla}
        onPointerMove={hareket}
        onPointerUp={bitir}
        onPointerCancel={bitir}
        onClick={(e) => e.target === e.currentTarget && !tasindiMi.current && g.sec(null)}
        role="tree"
        aria-label="Organizasyon şeması"
      >
        <defs>
          <pattern id="sema-nokta" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--nokta)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sema-nokta)" pointerEvents="none" />
        <g
          style={{
            transform: `translate(${donusum.x}px, ${donusum.y}px) scale(${donusum.k})`,
            transformOrigin: "0 0",
            transition: yumusak ? "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
          onTransitionEnd={(e) => e.target === e.currentTarget && setYumusak(false)}
        >
          {/* Hiyerarşi çizgileri */}
          {duzen.kenarlar.map(({ ust, alt }) => {
            const a = duzen.konumlar.get(ust)!;
            const b = duzen.konumlar.get(alt)!;
            const soluk = gorunurluk(alt) === "kilitli";
            return (
              <motion.path
                key={alt}
                initial={{ d: dirsek(a, b), opacity: 0 }}
                animate={{ d: dirsek(a, b), opacity: soluk ? 0.6 : 1 }}
                transition={{ type: "spring", stiffness: 170, damping: 24 }}
                fill="none"
                stroke="var(--cizgi-guclu)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeDasharray={soluk ? "3 4" : undefined}
              />
            );
          })}

          {/* Yol animasyonu (aşağı ya da yukarı) */}
          {durum.yolKenarlari.map(({ a, b, sira }) => {
            const ka = duzen.konumlar.get(a);
            const kb = duzen.konumlar.get(b);
            if (!ka || !kb) return null;
            return (
              <motion.path
                key={`yol-${nonce}-${a}-${b}`}
                d={yonluDirsek(ka, kb, harita.get(b)?.yonetici === a)}
                fill="none"
                stroke="var(--vurgu)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: (sira - 1) * ADIM_SURESI + ADIM_SURESI * 0.4, duration: ADIM_SURESI, ease: "easeInOut" }}
              />
            );
          })}

          {/* v3: talep yukarı akar (sahip → onaylayan) */}
          {durum.akis.map((yol, j) =>
            yol.slice(1).map((ust, i) => {
              const alt = yol[i];
              const ka = duzen.konumlar.get(alt);
              const kb = duzen.konumlar.get(ust);
              if (!ka || !kb) return null;
              const d = yonluDirsek(ka, kb, false);
              return (
                <g key={`akis-${nonce}-${j}-${alt}`}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="var(--vurgu)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: i * 0.5, duration: 0.5, ease: "easeInOut" }}
                  />
                  <circle r={6} fill="var(--vurgu)" stroke="var(--panel)" strokeWidth={2}>
                    <animateMotion dur="1.4s" repeatCount="3" path={d} begin={`${i * 0.5}s`} fill="freeze" />
                  </circle>
                </g>
              );
            }),
          )}

          {/* v3: onaylayan → İK kesikli "bilgi" çizgisi */}
          {durum.bilgi.map(({ a, b }) => {
            const ka = duzen.konumlar.get(a);
            const kb = duzen.konumlar.get(b);
            if (!ka || !kb) return null;
            const d = bilgiYolu(ka, kb);
            const mx = (ka.x + kb.x) / 2;
            const my = Math.min(ka.y, kb.y) + KART_Y / 2 - 52;
            return (
              <g key={`bilgi-${nonce}-${a}-${b}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke="var(--bilgi)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  initial={{ opacity: 0, strokeDashoffset: 0 }}
                  animate={{ opacity: 1, strokeDashoffset: -48 }}
                  transition={{ opacity: { delay: 0.4, duration: 0.3 }, strokeDashoffset: { duration: 1.2, repeat: Infinity, ease: "linear" } }}
                />
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} transform={`translate(${mx} ${my})`}>
                  <rect x={-22} y={-11} width={44} height={20} rx={10} fill="var(--bilgi-acik)" stroke="var(--bilgi)" strokeWidth={1} />
                  <text y={3.5} textAnchor="middle" style={{ fill: "var(--bilgi)", fontSize: 11, fontWeight: 650 }}>
                    bilgi
                  </text>
                </motion.g>
              </g>
            );
          })}

          <AnimatePresence initial={false}>
            {konumlar.map((k) => {
              const id = k.kisi.id;
              const ekip = g.cocuklar.get(id) ?? [];
              return (
                <SemaDugumu
                  key={id}
                  konum={k}
                  gorunurluk={gorunurluk(id)}
                  aktif={id === aktif}
                  secili={g.secili === id}
                  nonce={nonce}
                  ekipSayisi={g.odak ? 0 : ekip.length}
                  acik={g.semaAcik.has(id)}
                  bekleyen={bekleyenler.get(id) ?? 0}
                  tikla={dugumTikla}
                  acKapa={acKapa}
                  tus={tus}
                  efekt={{
                    yolSira: durum.yol.get(id) ?? null,
                    vurgu: durum.vurgu.has(id),
                    nabiz: durum.nabiz.has(id),
                    red: durum.red.has(id),
                    ortak: durum.ortak.has(id),
                    lca: durum.lca.has(id),
                    onay: durum.onay.has(id),
                    ret: durum.ret.has(id),
                    geri: durum.geri.has(id),
                  }}
                />
              );
            })}
          </AnimatePresence>
        </g>
      </svg>

      {/* Kontroller */}
      <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl border border-cizgi bg-panel/95 p-1 shadow-yumusak backdrop-blur">
        <button type="button" aria-label="Uzaklaştır" title="Uzaklaştır" onClick={() => yakinlas(1 / 1.2)} className="btn btn-hayalet btn-ikon h-7 w-7">
          <Minus size={15} />
        </button>
        <span className="w-10 text-center text-xs tabular-nums text-soluk" aria-live="polite">
          {Math.round(donusum.k * 100)}%
        </span>
        <button type="button" aria-label="Yakınlaştır" title="Yakınlaştır" onClick={() => yakinlas(1.2)} className="btn btn-hayalet btn-ikon h-7 w-7">
          <Plus size={15} />
        </button>
        <span className="mx-0.5 h-4 w-px bg-cizgi" aria-hidden />
        <button type="button" aria-label="Tümünü sığdır" title="Tümünü sığdır" onClick={sigdir} className="btn btn-hayalet btn-ikon h-7 w-7">
          <Maximize size={14} />
        </button>
        <button type="button" aria-label="Seçili kişiye ortala" title="Seçili kişiye ortala" onClick={ortala} className="btn btn-hayalet btn-ikon h-7 w-7">
          <ScanSearch size={15} />
        </button>
        {!g.odak && (
          <>
            <span className="mx-0.5 h-4 w-px bg-cizgi" aria-hidden />
            <button
              type="button"
              aria-label="Tüm ekipleri aç"
              title="Tüm ekipleri aç"
              onClick={() => {
                bekleyenGorunur.current = agac.map((k) => k.id);
                g.hepsiniAc();
              }}
              className="btn btn-hayalet btn-ikon h-7 w-7"
            >
              <UnfoldVertical size={15} />
            </button>
            <button
              type="button"
              aria-label="Varsayılana daralt"
              title="Varsayılana daralt (sadece senin zincirin açık)"
              onClick={() => {
                bekleyenGorunur.current = [aktif];
                g.varsayilanaDon();
              }}
              className="btn btn-hayalet btn-ikon h-7 w-7"
            >
              <FoldVertical size={15} />
            </button>
          </>
        )}
      </div>

      {g.odak && (
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cizgi bg-panel/95 py-1 pr-1 pl-3 text-xs shadow-yumusak backdrop-blur">
          <Focus size={13} className="text-vurgu" aria-hidden />
          <span className="whitespace-nowrap">
            Odak: <strong>{harita.get(odakId)?.ad}</strong>
          </span>
          <button type="button" onClick={() => g.setOdak(false)} className="btn btn-hayalet btn-sm h-6 rounded-full px-2">
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}
