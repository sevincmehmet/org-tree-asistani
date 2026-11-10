import { motion } from "framer-motion";
import { memo, type KeyboardEvent } from "react";
import { departmanRengi } from "../../veri/org";
import { basHarfler } from "../../yardimci/agacGorunum";
import { KART_G, KART_Y, type Konum } from "../../viz/agacDuzeni";
import { ADIM_SURESI } from "../../viz/efektDurumu";

export type Gorunurluk = "kapsam" | "zincir" | "kilitli";

export interface DugumEfekti {
  yolSira: number | null;
  vurgu: boolean;
  nabiz: boolean;
  red: boolean;
  ortak: boolean;
  lca: boolean;
  onay: boolean;
  ret: boolean;
  geri: boolean;
}

interface Props {
  konum: Konum;
  gorunurluk: Gorunurluk;
  aktif: boolean;
  secili: boolean;
  efekt: DugumEfekti;
  nonce: number;
  ekipSayisi: number;
  acik: boolean;
  bekleyen: number;
  tikla: (id: string) => void;
  acKapa: (id: string, acik: boolean) => void;
  tus: (e: KeyboardEvent, id: string) => void;
}

const kisalt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const R = 12;

function SemaDugumuHam({ konum, gorunurluk, aktif, secili, efekt, nonce, ekipSayisi, acik, bekleyen, tikla, acKapa, tus }: Props) {
  const { kisi } = konum;
  const renk = departmanRengi(kisi.departman_id);
  const kilitli = gorunurluk === "kilitli";

  let cerceve = "var(--cizgi)";
  let dolgu = "var(--panel)";
  let kalinlik = 1;
  if (efekt.vurgu || efekt.nabiz) {
    cerceve = "var(--vurgu)";
    dolgu = "var(--vurgu-acik)";
    kalinlik = 1.75;
  }
  if (efekt.ortak) {
    cerceve = "var(--lca)";
    kalinlik = 2;
  }
  if (efekt.lca) {
    cerceve = "var(--lca)";
    dolgu = "color-mix(in srgb, var(--lca) 14%, var(--panel))";
    kalinlik = 2.5;
  }
  if (efekt.onay) {
    cerceve = "var(--basari)";
    dolgu = "var(--basari-acik)";
    kalinlik = 2;
  }
  if (efekt.red || efekt.ret) {
    cerceve = "var(--tehlike)";
    dolgu = "var(--tehlike-acik)";
    kalinlik = 2;
  }
  if (secili && !efekt.red) {
    cerceve = "var(--metin)";
    kalinlik = Math.max(kalinlik, 1.75);
  }

  const gecikme = efekt.yolSira !== null ? efekt.yolSira * ADIM_SURESI : 0;
  const opaklik = kilitli && !efekt.red && !efekt.vurgu ? 0.62 : 1;

  return (
    <motion.g
      initial={{ opacity: 0, x: konum.x - KART_G / 2, y: konum.y }}
      animate={{ x: konum.x - KART_G / 2, y: konum.y, opacity: opaklik }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 170, damping: 24 }}
    >
      <motion.g
        key={efekt.red ? `red-${nonce}` : "sabit"}
        initial={false}
        animate={efekt.red ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <g
          role="treeitem"
          tabIndex={0}
          data-dugum={kisi.id}
          aria-selected={secili}
          aria-expanded={ekipSayisi ? acik : undefined}
          aria-label={`${kisi.ad}, ${kisi.unvan}${aktif ? ", sen" : ""}${kilitli ? ", kapsam dışı" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            tikla(kisi.id);
          }}
          onKeyDown={(e) => tus(e, kisi.id)}
          className="agac-dugum cursor-pointer"
        >
          {/* Klavye odak halkası */}
          <rect className="odak-halka" x={-4} y={-4} width={KART_G + 8} height={KART_Y + 8} rx={R + 4} fill="none" stroke="var(--vurgu)" strokeWidth={2} opacity={0} />
          {aktif && <rect x={-3} y={-3} width={KART_G + 6} height={KART_Y + 6} rx={R + 3} fill="none" stroke="var(--vurgu)" strokeWidth={1.5} strokeOpacity={0.55} />}
          <rect
            width={KART_G}
            height={KART_Y}
            rx={R}
            style={{ fill: dolgu, stroke: cerceve, strokeWidth: kalinlik, filter: "drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.07))", transition: "fill .25s, stroke .25s" }}
          />
          {efekt.yolSira !== null && (
            <motion.rect
              key={`yol-${nonce}`}
              width={KART_G}
              height={KART_Y}
              rx={R}
              fill="var(--vurgu-acik)"
              stroke="var(--vurgu)"
              strokeWidth={2}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: [0.94, 1.04, 1] }}
              transition={{ delay: gecikme, duration: 0.45 }}
              style={{ transformOrigin: `${KART_G / 2}px ${KART_Y / 2}px` }}
            />
          )}
          {efekt.nabiz && (
            <motion.rect
              key={`nabiz-${nonce}`}
              width={KART_G}
              height={KART_Y}
              rx={R}
              fill="none"
              stroke="var(--vurgu)"
              strokeWidth={2}
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.12 }}
              transition={{ duration: 1.2, repeat: 3, ease: "easeOut" }}
              style={{ transformOrigin: `${KART_G / 2}px ${KART_Y / 2}px` }}
            />
          )}

          {/* Avatar */}
          <circle cx={34} cy={KART_Y / 2} r={19} fill={renk} fillOpacity={0.16} />
          <text x={34} y={KART_Y / 2 + 4.5} textAnchor="middle" style={{ fill: renk, fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
            {basHarfler(kisi.ad)}
          </text>

          <text x={62} y={29} style={{ fill: "var(--metin)", fontSize: 14, fontWeight: 620 }}>
            {kisalt(kisi.ad, aktif ? 14 : 18)}
          </text>
          <text x={62} y={46} style={{ fill: "var(--soluk)", fontSize: 12 }}>
            {kisalt(kisi.unvan, 23)}
          </text>
          <circle cx={65} cy={58.5} r={3} fill={renk} />
          <text x={73} y={62} style={{ fill: "var(--soluk)", fontSize: 11, fontWeight: 500 }}>
            {kisalt(kisi.departman, ekipSayisi ? 16 : 22)}
          </text>

          {kilitli && (
            <g transform={`translate(${KART_G - 26} 10)`} aria-hidden>
              <rect width={16} height={16} rx={5} fill="var(--notr-acik)" />
              <path d="M5 7.5V6a3 3 0 0 1 6 0v1.5M4.5 7.5h7v5h-7z" fill="none" stroke="var(--soluk)" strokeWidth={1.2} strokeLinejoin="round" />
            </g>
          )}
          {aktif && (
            <g transform={`translate(${KART_G - 42} 10)`}>
              <rect width={32} height={18} rx={9} fill="var(--vurgu)" />
              <text x={16} y={12.5} textAnchor="middle" style={{ fill: "var(--vurgu-metin)", fontSize: 10.5, fontWeight: 700 }}>
                Sen
              </text>
            </g>
          )}
          {bekleyen > 0 && (
            <g transform={`translate(${KART_G - 6} -6)`}>
              <title>{`${bekleyen} talep onay bekliyor`}</title>
              <circle r={10} fill="var(--uyari)" stroke="var(--panel)" strokeWidth={2} />
              <text y={3.8} textAnchor="middle" style={{ fill: "var(--panel)", fontSize: 11, fontWeight: 700 }}>
                {bekleyen}
              </text>
            </g>
          )}
          {(efekt.onay || efekt.ret) && (
            <motion.g
              key={`rozet-${nonce}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.25 }}
              style={{ x: 4, y: 4 }}
            >
              <circle r={11} fill={efekt.onay ? "var(--basari)" : "var(--tehlike)"} stroke="var(--panel)" strokeWidth={2} />
              <path
                d={efekt.onay ? "M-4.5 0.5 L-1.2 3.6 L4.6 -3" : "M-3.6 -3.6 L3.6 3.6 M3.6 -3.6 L-3.6 3.6"}
                fill="none"
                stroke="var(--panel)"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.g>
          )}
          {efekt.geri && (
            <motion.g
              key={`geri-${nonce}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.5 }}
            >
              <g transform={`translate(${KART_G / 2 - 48} ${KART_Y - 8})`}>
                <title>Bu taşıma geri alındı</title>
                <rect width={96} height={18} rx={9} fill="var(--bilgi)" stroke="var(--panel)" strokeWidth={1.5} />
                <text x={48} y={12.5} textAnchor="middle" style={{ fill: "var(--panel)", fontSize: 10.5, fontWeight: 700 }}>
                  ↶ geri alındı
                </text>
              </g>
            </motion.g>
          )}
          {efekt.lca && (
            <g transform={`translate(${KART_G / 2 - 46} ${KART_Y - 8})`}>
              <rect width={92} height={18} rx={9} fill="var(--lca)" />
              <text x={46} y={12.5} textAnchor="middle" style={{ fill: "var(--panel)", fontSize: 10.5, fontWeight: 700 }}>
                ortak yönetici
              </text>
            </g>
          )}
        </g>

        {/* Aç/kapa: ayrı bir düğme (kartın sağ alt köşesi) */}
        {ekipSayisi > 0 && (
          <g
            role="button"
            tabIndex={0}
            aria-label={`${kisi.ad} ekibini ${acik ? "kapat" : "aç"} (${ekipSayisi} kişi)`}
            aria-expanded={acik}
            transform={`translate(${KART_G - 46} ${KART_Y - 25})`}
            onClick={(e) => {
              e.stopPropagation();
              acKapa(kisi.id, !acik);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                acKapa(kisi.id, !acik);
              }
            }}
            className="agac-dugum cursor-pointer"
          >
            <rect className="odak-halka" x={-3} y={-3} width={42} height={24} rx={9} fill="none" stroke="var(--vurgu)" strokeWidth={2} opacity={0} />
            <rect width={36} height={18} rx={6} fill={acik ? "var(--notr-acik)" : "var(--panel)"} stroke="var(--cizgi-guclu)" strokeWidth={1} />
            <text x={11} y={12.8} textAnchor="middle" style={{ fill: "var(--metin-2)", fontSize: 10.5, fontWeight: 650 }}>
              {ekipSayisi}
            </text>
            <path d={acik ? "M20.5 10.5 L24.5 6.5 L28.5 10.5" : "M20.5 7 L24.5 11 L28.5 7"} fill="none" stroke="var(--metin-2)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </motion.g>
    </motion.g>
  );
}

export const SemaDugumu = memo(SemaDugumuHam);
