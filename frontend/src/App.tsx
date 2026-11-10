import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BookOpen, Network, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DerslerPaneli } from "./bilesenler/DerslerPaneli";
import { DusunceCizelgesi } from "./bilesenler/DusunceCizelgesi";
import { PanelSeridi } from "./bilesenler/PanelSeridi";
import { SagPanel } from "./bilesenler/SagPanel";
import { Sohbet } from "./bilesenler/sohbet/Sohbet";
import { UstBar } from "./bilesenler/UstBar";
import { useAgacGorunumu } from "./durum/useAgacGorunumu";
import { useAjan } from "./durum/useAjan";
import { DERSLER, KAVRAMLAR, MOTTO } from "./icerik/dersler";
import type { Ders } from "./icerik/tipler";
import { VARSAYILAN_AGAC } from "./veri/org";
import { islemGecmisiOku } from "./yardimci/islem";
import { agacOku, haritala } from "./yardimci/org";
import { usePanelDurumu } from "./yardimci/usePanelDurumu";
import { ozetiBirlestir, talepOzetiOku } from "./yardimci/talep";
import { useTema } from "./yardimci/useTema";
import { ORNEK_SORULAR, useMod } from "./yardimci/useMod";

/**
 * Ana grid sütunları (lg+). Kapalı panel 44px'lik bir şeride iner.
 * Tailwind sınıfları derleme anında tarandığı için her kombinasyon düz metin olarak yazıldı.
 */
function gridSiniflari(ogrenme: boolean, sol: boolean, sag: boolean): string {
  if (!ogrenme) return sag ? "lg:grid-cols-[minmax(380px,0.8fr)_minmax(0,1.35fr)]" : "lg:grid-cols-[minmax(0,1fr)_44px]";
  const satir = "lg:grid-rows-[minmax(0,1fr)_auto]";
  if (sol && sag) return `${satir} lg:grid-cols-[240px_minmax(300px,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(264px,288px)_minmax(360px,1fr)_minmax(0,1.3fr)] 2xl:grid-cols-[320px_minmax(400px,1fr)_minmax(0,1.4fr)]`;
  if (!sol && sag) return `${satir} lg:grid-cols-[44px_minmax(320px,0.9fr)_minmax(0,1.3fr)]`;
  if (sol && !sag) return `${satir} lg:grid-cols-[240px_minmax(0,1fr)_44px] xl:grid-cols-[minmax(264px,288px)_minmax(0,1fr)_44px] 2xl:grid-cols-[320px_minmax(0,1fr)_44px]`;
  return `${satir} lg:grid-cols-[44px_minmax(0,1fr)_44px]`;
}

export default function App() {
  const api = useAjan();
  const { tema, degistir } = useTema();
  const { mod, degistir: modDegistir } = useMod();
  const ogrenme = mod === "ogrenme";
  const [ilerleme, setIlerleme] = useState<Record<number, number>>({});
  const [bannerKapali, setBannerKapali] = useState(false);
  const panel = usePanelDurumu();

  const oturumAgaci = useMemo(() => agacOku(api.aktif.state), [api.aktif.state]);
  const agac = oturumAgaci ?? VARSAYILAN_AGAC;
  const harita = useMemo(() => haritala(agac), [agac]);
  const aktifKullanici = String(api.aktif.state.aktif_kullanici_id ?? "e02");
  const kisiAdi = useCallback((id: string) => harita.get(id)?.ad ?? id, [harita]);
  const g = useAgacGorunumu(agac, aktifKullanici, api.efekt);

  const ozetHam = useMemo(() => talepOzetiOku(api.aktif.state), [api.aktif.state]);
  const ozet = useMemo(() => ozetiBirlestir(ozetHam, api.aktif.sohbet), [ozetHam, api.aktif.sohbet]);
  const islemler = useMemo(() => islemGecmisiOku(api.aktif.state), [api.aktif.state]);
  const bekleyenSayi = ozet.onayimi_bekleyenler.filter((t) => t.durum === "onay_bekliyor").length;

  const dene = (d: Ders) => {
    if (!d.agent || !d.ornekMesajlar.length) return;
    setIlerleme((p) => ({ ...p, [d.no]: 1 }));
    void api.dersMesajiGonder(d.agent, d.kullanici, d.ornekMesajlar[0], true);
  };
  const sonraki = (d: Ders) => {
    const i = ilerleme[d.no] ?? 0;
    if (!d.agent || i >= d.ornekMesajlar.length) return;
    setIlerleme((p) => ({ ...p, [d.no]: i + 1 }));
    void api.dersMesajiGonder(d.agent, d.kullanici, d.ornekMesajlar[i], false);
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <UstBar
        motto={MOTTO}
        aktifAgent={api.aktifAgent}
        agentSec={api.agentSec}
        kisiler={agac}
        aktifKullanici={aktifKullanici}
        kullaniciDegistir={(id) => void api.kullaniciDegistir(id)}
        yeniOturum={() => void api.yeniOturum()}
        calisiyor={api.calisiyor}
        baglanti={api.baglanti}
        mock={api.mock}
        tema={tema}
        temaDegistir={degistir}
        mod={mod}
        modDegistir={modDegistir}
      />

      <AnimatePresence>
        {api.otomatikMock && !bannerKapali && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="shrink-0 overflow-hidden border-b border-uyari/20 bg-uyari-acik text-[13px] text-uyari" role="status">
            <div className="flex items-center gap-2.5 px-4 py-2">
              <AlertTriangle size={15} className="shrink-0" aria-hidden />
              <span className="min-w-0">
                ADK sunucusuna ulaşılamadı, <strong>mock moda</strong> geçildi: olaylar tarayıcıda senaryodan üretiliyor. Gerçek ajan için backend'i başlatıp sayfayı yenile.
              </span>
              <button type="button" onClick={() => setBannerKapali(true)} className="btn btn-hayalet btn-ikon ml-auto h-7 w-7 shrink-0 text-uyari" aria-label="Uyarıyı kapat">
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 ${gridSiniflari(ogrenme, panel.acik.sol, panel.acik.sag)}`}>
        {ogrenme && !panel.acik.sol && (
          <div className="hidden min-h-0 lg:row-span-2 lg:flex">
            <PanelSeridi taraf="sol" etiket="Dersler" Ikon={BookOpen} ac={() => panel.degistir("sol", true)} />
          </div>
        )}
        {ogrenme && (
          // Kapalıyken sadece lg+'da gizlenir; mobilde paneller alt alta ve hep açık.
          <div className={`flex max-h-[70vh] min-h-0 flex-col lg:row-span-2 lg:max-h-none ${panel.acik.sol ? "" : "lg:hidden"}`}>
            <DerslerPaneli
              daralt={() => panel.degistir("sol", false)}
              dersler={DERSLER}
              kavramlar={KAVRAMLAR}
              ilerleme={ilerleme}
              kisiAdi={kisiAdi}
              calisiyor={api.calisiyor || api.baglanti === "kontrol"}
              dene={dene}
              sonraki={sonraki}
            />
          </div>
        )}

        <div className="flex h-[72vh] min-h-0 flex-col lg:h-auto">
          <Sohbet
            agent={api.aktifAgent}
            sohbet={api.aktif.sohbet}
            calisiyor={api.calisiyor}
            hazir={api.baglanti !== "kontrol"}
            harita={harita}
            aktif={aktifKullanici}
            talepler={ozet.hepsi}
            islemler={islemler}
            gonder={(m) => void api.gonder(m)}
            onayla={(id, k) => void api.onayla(id, k)}
            yeniOturum={() => void api.yeniOturum()}
            oneriler={ogrenme ? undefined : ORNEK_SORULAR[api.aktifAgent]}
          />
        </div>

        <div className={`flex h-[80vh] min-h-0 flex-col lg:h-auto ${panel.acik.sag ? "" : "lg:hidden"}`}>
          <SagPanel
            api={api}
            ogrenme={ogrenme}
            agac={agac}
            yedekVeri={!oturumAgaci}
            aktif={aktifKullanici}
            harita={harita}
            g={g}
            ozet={ozet}
            ozetVar={!!ozetHam}
            daralt={() => panel.degistir("sag", false)}
          />
        </div>
        {!panel.acik.sag && (
          <div className={`hidden min-h-0 lg:flex ${ogrenme ? "lg:row-span-2" : ""}`}>
            <PanelSeridi taraf="sag" etiket="Ağaç ve talepler" Ikon={Network} rozet={bekleyenSayi} ac={() => panel.degistir("sag", true)} />
          </div>
        )}

        {ogrenme && (
          <div className={panel.acik.sag ? "lg:col-span-2" : "lg:col-start-2 lg:row-start-2"}>
            <DusunceCizelgesi olaylar={api.aktif.turOlaylari} calisiyor={api.calisiyor} />
          </div>
        )}
      </main>
    </div>
  );
}
