// Uygulama durumu: her agent için bir oturum, sohbet, tur olayları, ağaç efektleri.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { gercekIstemci, KULLANICI_ID, listApps, onayParcasi } from "../api/adk";
import type { AdkEvent, AjanIstemcisi, JsonNesne, Part } from "../api/tipler";
import type { AgentAdi } from "../icerik/tipler";
import { mockIstemci } from "../mock/mockIstemci";
import { olayEslestir, type Efekt } from "../viz/olayEslestir";
import { akislariKapat, anahtarUret, sohbeteIsle, type SohbetOgesi } from "./sohbet";

export interface AjanOturumu {
  sid: string | null;
  state: JsonNesne;
  sohbet: SohbetOgesi[];
  turOlaylari: AdkEvent[];
  sonDelta: string[];
}

export type Baglanti = "kontrol" | "bagli" | "mock";

type Depo = Record<AgentAdi, AjanOturumu>;

const bosOturum = (kullanici: string): AjanOturumu => ({
  sid: null,
  state: { aktif_kullanici_id: kullanici },
  sohbet: [],
  turOlaylari: [],
  sonDelta: [],
});

const ILK: Depo = { org_asistani: bosOturum("e02"), calisan_asistani: bosOturum("e04") };

type Eylem =
  | { t: "oturum"; app: AgentAdi; sid: string; state: JsonNesne }
  | { t: "sifirla"; app: AgentAdi; kullanici: string }
  | { t: "yama"; app: AgentAdi; delta: JsonNesne }
  | { t: "state"; app: AgentAdi; state: JsonNesne }
  | { t: "kullaniciMesaji"; app: AgentAdi; metin: string; olay: AdkEvent }
  | { t: "onayKarari"; app: AgentAdi; onayId: string; karar: boolean; olay: AdkEvent }
  | { t: "olay"; app: AgentAdi; olay: AdkEvent }
  | { t: "bitti"; app: AgentAdi }
  | { t: "hata"; app: AgentAdi; metin: string };

function indirge(depo: Depo, e: Eylem): Depo {
  const o = depo[e.app];
  const guncelle = (yeni: Partial<AjanOturumu>): Depo => ({ ...depo, [e.app]: { ...o, ...yeni } });
  switch (e.t) {
    case "oturum":
      return guncelle({ sid: e.sid, state: e.state, sonDelta: [] });
    case "sifirla":
      return { ...depo, [e.app]: bosOturum(e.kullanici) };
    case "yama":
      return guncelle({ state: { ...o.state, ...e.delta }, sonDelta: Object.keys(e.delta) });
    case "state":
      return guncelle({ state: e.state });
    case "kullaniciMesaji":
      return guncelle({
        sohbet: [...o.sohbet, { tur: "kullanici", anahtar: anahtarUret("k"), metin: e.metin }],
        turOlaylari: [e.olay],
      });
    case "onayKarari":
      return guncelle({
        sohbet: o.sohbet.map((x) => (x.tur === "onay" && x.anahtar === e.onayId ? { ...x, karar: e.karar } : x)),
        turOlaylari: [...o.turOlaylari, e.olay],
      });
    case "olay": {
      const delta = e.olay.actions?.stateDelta;
      const deltaVar = !!delta && Object.keys(delta).length > 0;
      return guncelle({
        sohbet: sohbeteIsle(o.sohbet, e.olay),
        turOlaylari: [...o.turOlaylari, e.olay],
        ...(deltaVar ? { state: { ...o.state, ...delta }, sonDelta: Object.keys(delta) } : {}),
      });
    }
    case "bitti":
      return guncelle({ sohbet: akislariKapat(o.sohbet) });
    case "hata":
      return guncelle({
        sohbet: [...akislariKapat(o.sohbet), { tur: "hata", anahtar: anahtarUret("h"), metin: e.metin }],
      });
  }
}

const mockIstendi = () => new URLSearchParams(window.location.search).get("mock") === "1";

export interface EfektPaketi {
  nonce: number;
  app: AgentAdi;
  liste: Efekt[];
}

export function useAjan() {
  const [depo, dagit] = useReducer(indirge, ILK);
  const [aktifAgent, setAktifAgent] = useState<AgentAdi>("org_asistani");
  const [calisiyor, setCalisiyor] = useState(false);
  const [baglanti, setBaglanti] = useState<Baglanti>(mockIstendi() ? "mock" : "kontrol");
  const [otomatikMock, setOtomatikMock] = useState(false);
  const [efekt, setEfekt] = useState<EfektPaketi | null>(null);

  const istemci: AjanIstemcisi = baglanti === "bagli" ? gercekIstemci : mockIstemci;
  const depoRef = useRef(depo);
  const istemciRef = useRef(istemci);
  const efektSayaci = useRef(0);
  useEffect(() => {
    depoRef.current = depo;
    istemciRef.current = istemci;
  });

  // Açılışta backend'e ulaşılıyor mu? Ulaşılamazsa mock moda geç.
  useEffect(() => {
    if (baglanti !== "kontrol") return;
    const ctrl = new AbortController();
    // Effect temizlendiyse (React StrictMode geliştirmede effect'i iki kez çalıştırır) sonucu yok say.
    // Aksi halde temizlikteki abort() "backend yok" sanılır ve arayüz yanlışlıkla mock moda düşer.
    let temizlendi = false;
    const zaman = setTimeout(() => ctrl.abort(), 2500);
    listApps(ctrl.signal)
      .then(() => {
        if (!temizlendi) setBaglanti("bagli");
      })
      .catch(() => {
        if (temizlendi) return;
        setBaglanti("mock");
        setOtomatikMock(true);
      })
      .finally(() => clearTimeout(zaman));
    return () => {
      temizlendi = true;
      clearTimeout(zaman);
      ctrl.abort();
    };
  }, [baglanti]);

  const efektYay = useCallback((app: AgentAdi, liste: Efekt[]) => {
    if (liste.length) setEfekt({ nonce: ++efektSayaci.current, app, liste });
  }, []);

  /** Agent için oturum yoksa (ya da istenen kullanıcı farklıysa ve `yeni` ise) oluşturur. */
  // Giriş değiştirme PATCH'i bitmeden yeni tur başlarsa sunucu eski kullanıcıyla çalışır; önce onu bekle.
  const bekleyenYama = useRef<Promise<unknown> | null>(null);

  const oturumHazirla = useCallback(async (app: AgentAdi, kullanici?: string, yeni = false): Promise<string> => {
    await bekleyenYama.current?.catch(() => undefined);
    const o = depoRef.current[app];
    const hedefKullanici = kullanici ?? String(o.state.aktif_kullanici_id ?? "e02");
    if (o.sid && !yeni) {
      if (hedefKullanici !== o.state.aktif_kullanici_id) {
        const delta = { aktif_kullanici_id: hedefKullanici };
        dagit({ t: "yama", app, delta });
        await istemciRef.current.patchState(app, KULLANICI_ID, o.sid, delta);
      }
      return o.sid;
    }
    if (yeni) dagit({ t: "sifirla", app, kullanici: hedefKullanici });
    const oturum = await istemciRef.current.createSession(app, KULLANICI_ID, { aktif_kullanici_id: hedefKullanici });
    dagit({ t: "oturum", app, sid: oturum.id, state: oturum.state ?? { aktif_kullanici_id: hedefKullanici } });
    depoRef.current = { ...depoRef.current, [app]: { ...depoRef.current[app], sid: oturum.id } };
    return oturum.id;
  }, []);

  const calistir = useCallback(
    async (app: AgentAdi, sid: string, parcalar: Part[]) => {
      setCalisiyor(true);
      try {
        await istemciRef.current.runSSE(
          { appName: app, userId: KULLANICI_ID, sessionId: sid, newMessage: { role: "user", parts: parcalar }, streaming: true },
          (olay) => {
            dagit({ t: "olay", app, olay });
            const aktif = String(depoRef.current[app].state.aktif_kullanici_id ?? "");
            efektYay(app, olayEslestir(olay, { aktif }));
          },
        );
        const taze = await istemciRef.current.getSession(app, KULLANICI_ID, sid);
        if (taze?.state) dagit({ t: "state", app, state: taze.state });
        dagit({ t: "bitti", app });
      } catch (e) {
        dagit({ t: "hata", app, metin: e instanceof Error ? e.message : String(e) });
      } finally {
        setCalisiyor(false);
      }
    },
    [efektYay],
  );

  const gonder = useCallback(
    async (metin: string, app: AgentAdi = aktifAgent) => {
      const temiz = metin.trim();
      if (!temiz) return;
      try {
        const sid = await oturumHazirla(app);
        dagit({ t: "kullaniciMesaji", app, metin: temiz, olay: { author: "user", content: { role: "user", parts: [{ text: temiz }] } } });
        await calistir(app, sid, [{ text: temiz }]);
      } catch (e) {
        dagit({ t: "hata", app, metin: e instanceof Error ? e.message : String(e) });
      }
    },
    [aktifAgent, oturumHazirla, calistir],
  );

  const onayla = useCallback(
    async (onayId: string, karar: boolean) => {
      const app = aktifAgent;
      const sid = depoRef.current[app].sid;
      if (!sid) return;
      const parca = onayParcasi(onayId, karar);
      dagit({ t: "onayKarari", app, onayId, karar, olay: { author: "user", content: { role: "user", parts: [parca] } } });
      await calistir(app, sid, [parca]);
    },
    [aktifAgent, calistir],
  );

  const kullaniciDegistir = useCallback(
    async (id: string) => {
      const app = aktifAgent;
      const sid = depoRef.current[app].sid;
      const delta = { aktif_kullanici_id: id };
      dagit({ t: "yama", app, delta });
      setEfekt(null);
      if (!sid) return;
      try {
        const yama = istemciRef.current.patchState(app, KULLANICI_ID, sid, delta);
        bekleyenYama.current = yama;
        await yama;
      } catch (e) {
        dagit({ t: "hata", app, metin: `Giriş değiştirilemedi: ${e instanceof Error ? e.message : String(e)}` });
      }
    },
    [aktifAgent],
  );

  const agentSec = useCallback((app: AgentAdi) => {
    setAktifAgent(app);
    setEfekt(null);
  }, []);

  const yeniOturum = useCallback(async () => {
    setEfekt(null);
    try {
      await oturumHazirla(aktifAgent, undefined, true);
    } catch (e) {
      dagit({ t: "hata", app: aktifAgent, metin: e instanceof Error ? e.message : String(e) });
    }
  }, [aktifAgent, oturumHazirla]);

  /** Ders: doğru agent + kullanıcıya geç (gerekirse yeni oturum) ve mesajı gönder. */
  const dersMesajiGonder = useCallback(
    async (app: AgentAdi, kullanici: string | null, metin: string, ilkMesaj: boolean) => {
      setAktifAgent(app);
      setEfekt(null);
      const o = depoRef.current[app];
      const farkliKullanici = kullanici !== null && kullanici !== o.state.aktif_kullanici_id;
      try {
        const sid = await oturumHazirla(app, kullanici ?? undefined, ilkMesaj && (farkliKullanici || !o.sid));
        dagit({ t: "kullaniciMesaji", app, metin, olay: { author: "user", content: { role: "user", parts: [{ text: metin }] } } });
        await calistir(app, sid, [{ text: metin }]);
      } catch (e) {
        dagit({ t: "hata", app, metin: e instanceof Error ? e.message : String(e) });
      }
    },
    [oturumHazirla, calistir],
  );

  /**
   * Talepler sekmesindeki hızlı eylem: karar mesajını Yönetici Asistanı'na gönderir.
   * Gerçek onay kartı yine sohbette çıkar (insan onayı ajan akışında kalır).
   */
  const talepKarari = useCallback(
    async (no: number, karar: "onay" | "red") => {
      const kullanici = String(depoRef.current[aktifAgent].state.aktif_kullanici_id ?? "e02");
      const metin = karar === "onay" ? `#${no} numaralı talebi onayla` : `#${no} numaralı talebi reddet`;
      await dersMesajiGonder("org_asistani", kullanici, metin, false);
    },
    [aktifAgent, dersMesajiGonder],
  );

  const yerelEfekt = useCallback((liste: Efekt[]) => efektYay(aktifAgent, liste), [aktifAgent, efektYay]);

  const aktif = depo[aktifAgent];
  return useMemo(
    () => ({
      depo,
      aktif,
      aktifAgent,
      calisiyor,
      baglanti,
      otomatikMock,
      efekt: efekt && efekt.app === aktifAgent ? efekt : null,
      mock: istemci.mock,
      agentSec,
      gonder,
      onayla,
      kullaniciDegistir,
      yeniOturum,
      dersMesajiGonder,
      talepKarari,
      yerelEfekt,
    }),
    [depo, aktif, aktifAgent, calisiyor, baglanti, otomatikMock, efekt, istemci.mock, agentSec, gonder, onayla, kullaniciDegistir, yeniOturum, dersMesajiGonder, talepKarari, yerelEfekt],
  );
}

export type AjanApi = ReturnType<typeof useAjan>;
