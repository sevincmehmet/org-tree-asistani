// Sağ panel: 🌳 Ağaç (Liste / Şema + Profil paneli) · 📥 Talepler · 🧾 State (öğrenme modu).
import { AnimatePresence, motion } from "framer-motion";
import { Braces, Focus, History, Inbox, ListTree, Network, PanelRightClose, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgacKisi } from "../api/tipler";
import type { AgacGorunumuApi } from "../durum/useAgacGorunumu";
import type { AjanApi } from "../durum/useAjan";
import { geriAlinabilir, islemGecmisiOku } from "../yardimci/islem";
import { asagiYol, kapsamHesapla, zincir, type KisiHaritasi } from "../yardimci/org";
import type { BirlesikOzet } from "../yardimci/talep";
import { AgacListesi } from "./agac/AgacListesi";
import { GecmisListesi } from "./agac/GecmisListesi";
import { OrgSema } from "./agac/OrgSema";
import { ProfilPaneli } from "./agac/ProfilPaneli";
import { StatePaneli } from "./StatePaneli";
import { TaleplerPaneli, type TalepBolumu } from "./talepler/TaleplerPaneli";

type Sekme = "agac" | "talepler" | "state";

interface Props {
  api: AjanApi;
  ogrenme: boolean;
  agac: AgacKisi[];
  yedekVeri: boolean;
  aktif: string;
  harita: KisiHaritasi;
  g: AgacGorunumuApi;
  ozet: BirlesikOzet;
  ozetVar: boolean;
  /** Verilirse başlıkta "paneli kapat" düğmesi çıkar (sadece lg+). */
  daralt?: () => void;
}

const PROFIL_G = 356;

export function SagPanel({ api, ogrenme, agac, yedekVeri, aktif, harita, g, ozet, ozetVar, daralt }: Props) {
  const [sekmeSecimi, setSekme] = useState<Sekme>("agac");
  const sekme: Sekme = !ogrenme && sekmeSecimi === "state" ? "agac" : sekmeSecimi;
  const [bolumSecimi, setBolumSecimi] = useState<TalepBolumu | null>(null);
  const [vurguluTalep, setVurguluTalep] = useState<number | null>(null);
  const [gorulen, setGorulen] = useState<Set<number>>(() => new Set());

  const kapsam = useMemo(() => kapsamHesapla(agac, aktif), [agac, aktif]);

  // 🕘 İşlem geçmişi (v4): sadece Yönetici Asistanı'nın oturumunda tutulur.
  const yoneticiMi = api.aktifAgent === "org_asistani";
  const islemler = useMemo(() => (yoneticiMi ? islemGecmisiOku(api.aktif.state) : []), [yoneticiMi, api.aktif.state]);
  const geriAlinabilirSayi = islemler.filter(geriAlinabilir).length;
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const gecmisRef = useRef<HTMLDivElement>(null);
  const gecmisDugmeRef = useRef<HTMLButtonElement>(null);
  const { gonder } = api;
  // Geri alma kararını kod verir: düğme sadece sohbete istek yollar, ajan islemi_geri_al'ı çağırır, onay kartı sohbette çıkar.
  const geriAl = useCallback(
    (no: number) => {
      setGecmisAcik(false);
      void gonder(`#${no} numaralı işlemi geri al`);
    },
    [gonder],
  );

  useEffect(() => {
    if (!gecmisAcik) return;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setGecmisAcik(false);
    const tikla = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!gecmisRef.current?.contains(t) && !gecmisDugmeRef.current?.contains(t)) setGecmisAcik(false);
    };
    window.addEventListener("keydown", tus);
    window.addEventListener("mousedown", tikla);
    return () => {
      window.removeEventListener("keydown", tus);
      window.removeEventListener("mousedown", tikla);
    };
  }, [gecmisAcik]);

  // Kişi başına onay bekleyen talep sayısı (bilinen talepler üzerinden).
  const bekleyenler = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of ozet.hepsi.values()) if (t.durum === "onay_bekliyor") m.set(t.onaylayan.id, (m.get(t.onaylayan.id) ?? 0) + 1);
    return m;
  }, [ozet]);

  const okunmamis = ozet.bildirimler.filter((b) => !b.okundu && !gorulen.has(b.no)).length;
  const bekleyenSayi = ozet.onayimi_bekleyenler.filter((t) => t.durum === "onay_bekliyor").length;
  const bolum: TalepBolumu = bolumSecimi ?? (bekleyenSayi ? "bekleyenler" : ozet.gonderdiklerim.length ? "gonderdiklerim" : "bildirimler");
  const setBolum = (b: TalepBolumu) => {
    setBolumSecimi(b);
    setVurguluTalep(null);
    if (b === "bildirimler") setGorulen((s) => new Set([...s, ...ozet.bildirimler.map((x) => x.no)]));
  };

  // Yerel etkileşimler (LLM çağrılmaz): seçim + yol önizleme.
  const { yerelEfekt } = api;
  const yolOnizle = useCallback(
    (id: string) => {
      if (id === aktif) return;
      if (kapsam.kapsam.has(id)) {
        const yol = asagiYol(harita, aktif, id);
        if (yol && yol.length > 1) yerelEfekt([{ tur: "yol", idler: yol, yon: "asagi" }]);
      } else if (kapsam.ustZincir.has(id)) {
        const z = zincir(harita, aktif);
        yerelEfekt([{ tur: "yol", idler: z.slice(0, z.indexOf(id) + 1), yon: "yukari" }]);
      } else {
        yerelEfekt([{ tur: "red", id }]);
      }
    },
    [aktif, harita, kapsam, yerelEfekt],
  );
  const tikla = useCallback(
    (id: string) => {
      g.sec(id);
      yolOnizle(id);
    },
    [g, yolOnizle],
  );

  const talepAc = (no: number) => {
    setSekme("talepler");
    setBolumSecimi(ozet.onayimi_bekleyenler.some((t) => t.no === no) ? "bekleyenler" : "gonderdiklerim");
    setVurguluTalep(no);
  };

  // Ajan bir işlemi kodda engellediyse kısa bir uyarı göster (yerel tıklamalarda değil).
  const [uyari, setUyari] = useState<{ n: number; metin: string } | null>(null);
  const [sonNonce, setSonNonce] = useState(0);
  if (api.efekt && api.efekt.nonce !== sonNonce) {
    setSonNonce(api.efekt.nonce);
    const red = api.efekt.liste.find((e) => e.tur === "red");
    const yerel = api.efekt.liste.length === 1 && red && g.secili === red.id;
    if (red && red.tur === "red" && !yerel) {
      const vurgu = api.efekt.liste.find((e) => e.tur === "vurgu");
      const ad = harita.get(red.id)?.ad ?? red.id;
      setUyari({
        n: api.efekt.nonce,
        metin:
          vurgu && vurgu.tur === "vurgu"
            ? `Kod engelledi: bu kararı sadece ${harita.get(vurgu.idler[0])?.ad ?? "asıl onaylayan"} verebilir`
            : `Kod engelledi: ${ad} kapsam dışında`,
      });
    }
  }

  useEffect(() => {
    if (!uyari) return;
    const t = setTimeout(() => setUyari(null), 3600);
    return () => clearTimeout(t);
  }, [uyari]);

  const seciliKisi = g.secili ? harita.get(g.secili) : undefined;
  const profilAcik = sekme === "agac" && !!seciliKisi && g.profil;

  const sekmeler: { id: Sekme; etiket: string; Ikon: typeof Inbox }[] = [
    { id: "agac", etiket: "Ağaç", Ikon: Network },
    { id: "talepler", etiket: "Talepler", Ikon: Inbox },
    ...(ogrenme ? [{ id: "state" as const, etiket: "State", Ikon: Braces }] : []),
  ];

  return (
    <section aria-label="Org tree ve talepler" className="kart @container flex h-full min-h-0 flex-col overflow-hidden">
      {/* Etiketler ekran değil PANEL genişliğine göre gizlenir (container query); son çare yatay kaydırma. */}
      <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-cizgi px-1.5 [scrollbar-width:none] @sm:gap-1.5 @sm:px-2 @md:gap-2">
        <div role="tablist" aria-label="Sağ panel" className="segment shrink-0">
          {sekmeler.map(({ id, etiket, Ikon }) => (
            <button key={id} type="button" role="tab" aria-selected={sekme === id} onClick={() => setSekme(id)} aria-label={etiket} title={etiket} className="max-sm:px-2">
              {sekme === id && <motion.span layoutId="sag-sekme" className="segment-zemin" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Ikon size={14} className="relative" aria-hidden />
              {/* Dar panelde sadece seçili sekmenin adı yazılır */}
              <span className={`relative ${sekme === id ? "" : "hidden @[480px]:inline"}`}>{etiket}</span>
              {id === "talepler" && okunmamis + bekleyenSayi > 0 && (
                <span className="relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-vurgu px-1 text-[11px] font-semibold text-vurgu-metin tabular-nums" aria-label={`${okunmamis} okunmamış bildirim, ${bekleyenSayi} onay bekleyen`}>
                  {okunmamis + bekleyenSayi}
                </span>
              )}
              {id === "state" && api.aktif.sonDelta.length > 0 && sekme !== "state" && <span className="relative h-1.5 w-1.5 rounded-full bg-uyari" aria-label="state değişti" />}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 @sm:gap-1.5">
        {sekme === "agac" && (
          <>
            {yoneticiMi && (
              <button
                ref={gecmisDugmeRef}
                type="button"
                aria-expanded={gecmisAcik}
                aria-haspopup="dialog"
                aria-label={`İşlem geçmişi${geriAlinabilirSayi ? ` (${geriAlinabilirSayi} geri alınabilir)` : ""}`}
                onClick={() => setGecmisAcik((a) => !a)}
                title="İşlem geçmişi: bu oturumdaki taşımalar ve geri almalar"
                className={`btn btn-sm shrink-0 max-sm:px-2 ${gecmisAcik ? "bg-vurgu-acik text-vurgu" : "btn-hayalet"}`}
              >
                <History size={14} aria-hidden /> <span className="hidden @[600px]:inline">Geçmiş</span>
                {geriAlinabilirSayi > 0 && (
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-notr-acik px-1 text-[11px] font-semibold tabular-nums" aria-hidden>
                    {geriAlinabilirSayi}
                  </span>
                )}
              </button>
            )}
            {g.gorunum === "sema" && (
              <button
                type="button"
                aria-pressed={g.odak}
                aria-label="Odak modu"
                onClick={() => {
                  if (!g.odak) g.profilKapat();
                  g.setOdak(!g.odak);
                }}
                title="Odak modu: seçili kişi + yöneticisi + doğrudan ekibi"
                className={`btn btn-sm shrink-0 max-sm:px-2 ${g.odak ? "bg-vurgu-acik text-vurgu" : "btn-hayalet"}`}
              >
                <Focus size={14} /> <span className="hidden @[600px]:inline">Odak</span>
              </button>
            )}
            <div role="radiogroup" aria-label="Ağaç görünümü" className="segment shrink-0">
              {(
                [
                  ["liste", "Liste", ListTree],
                  ["sema", "Şema", Network],
                ] as const
              ).map(([id, etiket, Ikon]) => (
                <button key={id} type="button" role="radio" aria-checked={g.gorunum === id} onClick={() => g.setGorunum(id)} title={`${etiket} görünümü`} aria-label={`${etiket} görünümü`} className="max-sm:px-2">
                  {g.gorunum === id && <motion.span layoutId="agac-gorunum" className="segment-zemin" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <Ikon size={14} className="relative" aria-hidden />
                  <span className="relative hidden @[680px]:inline">{etiket}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {daralt && (
          <button type="button" onClick={daralt} className="btn btn-hayalet btn-ikon btn-sm hidden shrink-0 lg:inline-flex" aria-label="Sağ paneli kapat" title="Paneli kapat">
            <PanelRightClose size={15} aria-hidden />
          </button>
        )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-panel-2">
        {sekme === "agac" && (
          <>
            {g.gorunum === "sema" ? (
              <OrgSema agac={agac} aktif={aktif} kapsam={kapsam} efekt={api.efekt} g={g} bekleyenler={bekleyenler} tikla={tikla} sagBosluk={profilAcik ? PROFIL_G : 0} />
            ) : (
              <div className={`h-full bg-panel ${profilAcik ? "sm:pr-[356px]" : ""}`}>
                <AgacListesi dar={profilAcik} agac={agac} aktif={aktif} kapsam={kapsam} efekt={api.efekt} g={g} bekleyenler={bekleyenler} tikla={tikla} />
              </div>
            )}
            {yedekVeri && ogrenme && g.gorunum === "sema" && (
              <p
                className="pointer-events-none absolute top-3 left-3 max-w-[55%] rounded-lg border border-cizgi bg-panel/90 px-2.5 py-1 text-[11px] text-soluk backdrop-blur"
                title="ADK, agac anahtarını ilk turda before_agent_callback ile yazar."
              >
                Varsayılan ağaç · oturumun <code className="font-mono">agac</code>'ı ilk mesajla gelir
              </p>
            )}
            <AnimatePresence>
              {profilAcik && seciliKisi && (
                <ProfilPaneli
                  key="profil"
                  kisi={seciliKisi}
                  agac={agac}
                  harita={harita}
                  aktif={aktif}
                  kapsam={kapsam}
                  talepler={[...ozet.hepsi.values()]}
                  kapat={g.profilKapat}
                  sec={tikla}
                  odakla={(id) => {
                    g.sec(id, false);
                    g.setGorunum("sema");
                    g.setOdak(true);
                  }}
                  yolGoster={yolOnizle}
                  talepAc={talepAc}
                  islemler={islemler}
                  geriAl={yoneticiMi ? geriAl : undefined}
                  calisiyor={api.calisiyor}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {gecmisAcik && yoneticiMi && (
                <motion.div
                  ref={gecmisRef}
                  key="gecmis"
                  role="dialog"
                  aria-label="İşlem geçmişi"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-2 right-2 z-40 flex max-h-[min(420px,calc(100%-16px))] w-[360px] max-w-[calc(100%-16px)] flex-col overflow-hidden rounded-xl border border-cizgi bg-panel shadow-buyuk"
                >
                  <div className="flex items-center gap-2 border-b border-cizgi px-3 py-2">
                    <History size={14} className="text-vurgu" aria-hidden />
                    <span className="text-[13px] font-semibold">İşlem geçmişi</span>
                    <span className="text-xs text-soluk">· {islemler.length}</span>
                    <button type="button" onClick={() => setGecmisAcik(false)} className="btn btn-hayalet btn-ikon btn-sm ml-auto h-7 w-7" aria-label="Geçmişi kapat">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <GecmisListesi islemler={islemler} geriAl={geriAl} pasif={api.calisiyor} />
                  </div>
                  <p className="border-t border-cizgi px-3 py-2 text-[11px] leading-relaxed text-soluk">
                    "Geri al" sohbete istek gönderir; işlemi kod, işlem kaydından bulup tersine çevirir. Onay kartı sohbette çıkar.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {sekme === "talepler" && (
          <div className="h-full bg-panel-2">
            <TaleplerPaneli
              ozet={ozet}
              ozetVar={ozetVar}
              kullaniciAdi={harita.get(aktif)?.ad ?? aktif}
              calisiyor={api.calisiyor}
              hazir={api.baglanti !== "kontrol"}
              bolum={bolum}
              setBolum={setBolum}
              vurguluTalep={vurguluTalep}
              okunmamis={okunmamis}
              karar={(no, k) => void api.talepKarari(no, k)}
              sor={(m) => void api.gonder(m)}
              talepAc={talepAc}
            />
          </div>
        )}
        {sekme === "state" && <StatePaneli state={api.aktif.state} sonDelta={api.aktif.sonDelta} sid={api.aktif.sid} />}

        <AnimatePresence>
          {uyari && (
            <motion.div
              key={uyari.n}
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-16 left-1/2 z-30 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-xl border border-tehlike/30 bg-panel px-3 py-2 text-[13px] font-medium text-tehlike shadow-buyuk"
            >
              <ShieldAlert size={15} aria-hidden />
              {uyari.metin}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
