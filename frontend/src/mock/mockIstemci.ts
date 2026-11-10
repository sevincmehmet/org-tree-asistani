// Mock ADK istemcisi: backend olmadan arayüzü göstermek için CONTRACT.md'deki olay şekillerini
// zamanlamasıyla birlikte üretir (functionCall → functionResponse → partial metin → son metin,
// onaylı tool'larda adk_request_confirmation turu).
import { ONAY_ARACI } from "../api/adk";
import type { AdkEvent, AjanIstemcisi, FunctionCall, Json, JsonNesne, Oturum, RunGovdesi } from "../api/tipler";
import type { AgentAdi } from "../icerik/tipler";
import { VARSAYILAN_AGAC } from "../veri/org";
import { ARACLAR, talepOzeti } from "./araclar";
import { beyin, type Baglam } from "./beyin";

interface MockOturum {
  id: string;
  app: AgentAdi;
  userId: string;
  state: JsonNesne;
  bekleyen?: { onayId: string; cagri: FunctionCall; devam: (r: JsonNesne | null, b: Baglam) => Promise<void> };
}

const oturumlar = new Map<string, MockOturum>();
let sayac = 0;
const yeniId = (on: string) => `${on}-${Date.now().toString(36)}-${(++sayac).toString(36)}`;

class Durdu extends Error {}

function bekle(ms: number, signal?: AbortSignal) {
  return new Promise<void>((coz, reddet) => {
    if (signal?.aborted) return reddet(new DOMException("İptal", "AbortError"));
    const t = setTimeout(coz, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reddet(new DOMException("İptal", "AbortError"));
    });
  });
}

const kopya = <T,>(x: T): T => structuredClone(x);
const oturumJson = (o: MockOturum): Oturum => ({ id: o.id, appName: o.app, userId: o.userId, state: kopya(o.state), events: [], lastUpdateTime: Date.now() / 1000 });

function oturumAl(sid: string): MockOturum {
  const o = oturumlar.get(sid);
  if (!o) throw new Error(`404 Session not found: ${sid}`);
  return o;
}

function baglamKur(o: MockOturum, emit: (e: AdkEvent) => void, signal?: AbortSignal): { baglam: Baglam; calistir: (ad: string, args: JsonNesne, id: string) => Promise<JsonNesne> } {
  const invocationId = yeniId("inv");
  // Gerçekte `agac` ilk turda before_agent_callback ile yazılır: ilk olayın stateDelta'sında gelir.
  // v3: talep_ozeti de her turun başında (aktif kullanıcıya göre) yazılır.
  let ilkDelta: JsonNesne | null = { talep_ozeti: talepOzeti(o.state) };
  if (!o.state.agac) ilkDelta.agac = kopya(VARSAYILAN_AGAC) as unknown as Json;
  Object.assign(o.state, kopya(ilkDelta));
  const yayinla = (e: AdkEvent) => {
    const olay: AdkEvent = { id: yeniId("evt"), invocationId, author: o.app, timestamp: Date.now() / 1000, ...e };
    if (ilkDelta && !olay.partial) {
      olay.actions = { ...olay.actions, stateDelta: { ...ilkDelta, ...olay.actions?.stateDelta } };
      ilkDelta = null;
    }
    emit(olay);
  };

  const calistir = async (ad: string, args: JsonNesne, id: string) => {
    await bekle(380, signal);
    const { cevap, delta } = ARACLAR[ad](o.state, args);
    if (delta) Object.assign(o.state, delta);
    yayinla({
      content: { role: "user", parts: [{ functionResponse: { id, name: ad, response: cevap } }] },
      actions: { stateDelta: delta ? kopya(delta) : {} },
    });
    return cevap;
  };

  const cagriYayinla = async (ad: string, args: JsonNesne) => {
    await bekle(650, signal);
    const id = yeniId("adk");
    yayinla({ content: { role: "model", parts: [{ functionCall: { id, name: ad, args } }] }, actions: { stateDelta: {} } });
    return id;
  };

  const baglam: Baglam = {
    state: o.state,
    async cagir(ad, args) {
      const id = await cagriYayinla(ad, args);
      return calistir(ad, args, id);
    },
    async onayli(ad, args, devam) {
      const id = await cagriYayinla(ad, args);
      await bekle(250, signal);
      const cagri: FunctionCall = { id, name: ad, args };
      yayinla({
        content: { role: "user", parts: [{ functionResponse: { id, name: ad, response: { error: "This tool call requires confirmation, please approve or reject." } } }] },
        actions: { stateDelta: {} },
      });
      const onayId = yeniId("adk");
      const IPUCU: Record<string, string> = {
        calisani_tasi: "Bu taşıma ağacı değiştirir. Onaylıyor musun?",
        islemi_geri_al: "Taşıma işlem kaydından bulunup tersine çevrilsin mi?",
        talebi_gonder: "Talep, doğrudan yöneticinin onayına gönderilsin mi?",
        talebi_karara_bagla: args.karar === "red" ? "Talep reddedilsin mi? Talep sahibine bildirim gider." : "Talep onaylansın mı? İK'ya ve talep sahibine bildirim gider.",
      };
      const hint = IPUCU[ad] ?? "Bu işlem onay gerektiriyor.";
      yayinla({
        content: { role: "user", parts: [{ functionCall: { id: onayId, name: ONAY_ARACI, args: { originalFunctionCall: cagri as unknown as Json, toolConfirmation: { hint, confirmed: false } } } }] },
        actions: { stateDelta: {}, requestedToolConfirmations: { [id]: { hint, confirmed: false } } },
        longRunningToolIds: [onayId],
      });
      o.bekleyen = { onayId, cagri, devam };
      throw new Durdu();
    },
    async yaz(metin) {
      await bekle(450, signal);
      const parcalar = metin.match(/\S+\s*/g) ?? [metin];
      let biriken = "";
      for (let i = 0; i < parcalar.length; i += 3) {
        const parca = parcalar.slice(i, i + 3).join("");
        biriken += parca;
        yayinla({ partial: true, content: { role: "model", parts: [{ text: parca }] } });
        await bekle(45, signal);
      }
      yayinla({ content: { role: "model", parts: [{ text: biriken }] }, actions: { stateDelta: {} }, turnComplete: true });
    },
  };
  return { baglam, calistir };
}

async function runSSE(govde: RunGovdesi, onEvent: (e: AdkEvent) => void, signal?: AbortSignal): Promise<void> {
  const o = oturumAl(govde.sessionId);
  const { baglam, calistir } = baglamKur(o, onEvent, signal);
  const parca = govde.newMessage.parts[0];
  try {
    const onay = parca?.functionResponse;
    if (onay && onay.name === ONAY_ARACI) {
      const b = o.bekleyen;
      if (!b || b.onayId !== onay.id) throw new Error("Bekleyen bir onay isteği yok.");
      o.bekleyen = undefined;
      if (onay.response.confirmed === true) {
        const r = await calistir(b.cagri.name, b.cagri.args, b.cagri.id);
        await b.devam(r, baglam);
      } else {
        await bekle(300, signal);
        onEvent({
          id: yeniId("evt"),
          author: o.app,
          content: { role: "user", parts: [{ functionResponse: { id: b.cagri.id, name: b.cagri.name, response: { error: "This tool call is rejected." } } }] },
          actions: { stateDelta: {} },
        });
        await b.devam(null, baglam);
      }
      return;
    }
    await beyin(o.app)(parca?.text ?? "", baglam);
  } catch (e) {
    if (e instanceof Durdu) return;
    throw e;
  }
}

export const mockIstemci: AjanIstemcisi = {
  mock: true,
  async createSession(app, userId, state) {
    await bekle(120);
    // Gerçek sunucudaki gibi: oturum açılırken `agac` YOK, ilk turda gelir.
    const o: MockOturum = { id: yeniId("mock"), app, userId, state: { aktif_kullanici_id: "e02", ...kopya(state) } };
    oturumlar.set(o.id, o);
    return oturumJson(o);
  },
  async getSession(_app, _userId, sid) {
    await bekle(60);
    return oturumJson(oturumAl(sid));
  },
  async patchState(_app, _userId, sid, stateDelta) {
    await bekle(60);
    Object.assign(oturumAl(sid).state, kopya(stateDelta));
  },
  runSSE,
};
