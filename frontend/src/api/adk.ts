// Gerçek ADK api_server istemcisi (fetch + ReadableStream ile SSE).
import type { AgentAdi } from "../icerik/tipler";
import type { AdkEvent, AjanIstemcisi, JsonNesne, Oturum, Part, RunGovdesi } from "./tipler";

// 127.0.0.1 (localhost değil): adk api_server sadece IPv4'ü dinler; tarayıcı "localhost"u
// IPv6'ya (::1) çözerse bağlantı kurulamaz ve arayüz yanlışlıkla mock moda düşer.
export const ADK_URL: string = import.meta.env?.VITE_ADK_URL ?? "http://127.0.0.1:8000";
export const KULLANICI_ID = "demo";
export const ONAY_ARACI = "adk_request_confirmation";

async function istek<T>(yol: string, init?: RequestInit): Promise<T> {
  const cevap = await fetch(`${ADK_URL}${yol}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!cevap.ok) {
    const metin = await cevap.text().catch(() => "");
    throw new Error(`${cevap.status} ${cevap.statusText}${metin ? `: ${metin}` : ""}`);
  }
  const govde = await cevap.text();
  return (govde ? JSON.parse(govde) : null) as T;
}

const oturumYolu = (app: AgentAdi, userId: string, sid?: string) =>
  `/apps/${app}/users/${encodeURIComponent(userId)}/sessions${sid ? `/${sid}` : ""}`;

export function createSession(app: AgentAdi, userId: string, state: JsonNesne): Promise<Oturum> {
  return istek<Oturum>(oturumYolu(app, userId), { method: "POST", body: JSON.stringify({ state }) });
}

export function getSession(app: AgentAdi, userId: string, sid: string): Promise<Oturum> {
  return istek<Oturum>(oturumYolu(app, userId, sid));
}

export async function patchState(app: AgentAdi, userId: string, sid: string, stateDelta: JsonNesne): Promise<void> {
  await istek(oturumYolu(app, userId, sid), { method: "PATCH", body: JSON.stringify({ stateDelta }) });
}

export async function listApps(signal?: AbortSignal): Promise<string[]> {
  return istek<string[]>("/list-apps", { signal });
}

/** `data: ...\n\n` bloklarını ayrıştırır; tamamlanmamış son parça geri döner. */
export function sseBloklariniAyir(tampon: string): { veriler: string[]; kalan: string } {
  const bloklar = tampon.replace(/\r\n/g, "\n").split("\n\n");
  const kalan = bloklar.pop() ?? "";
  const veriler = bloklar
    .map((blok) =>
      blok
        .split("\n")
        .filter((s) => s.startsWith("data:"))
        .map((s) => s.slice(5).replace(/^ /, ""))
        .join("\n"),
    )
    .filter((v) => v.length > 0);
  return { veriler, kalan };
}

export async function runSSE(govde: RunGovdesi, onEvent: (e: AdkEvent) => void, signal?: AbortSignal): Promise<void> {
  const cevap = await fetch(`${ADK_URL}/run_sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(govde),
    signal,
  });
  if (!cevap.ok || !cevap.body) {
    throw new Error(`run_sse ${cevap.status}: ${await cevap.text().catch(() => "")}`);
  }
  const okuyucu = cevap.body.getReader();
  const cozucu = new TextDecoder();
  let tampon = "";
  const isle = (veri: string) => {
    const olay = JSON.parse(veri) as AdkEvent & { error?: string };
    if (typeof olay.error === "string") throw new Error(olay.error);
    onEvent(olay);
  };
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) break;
    tampon += cozucu.decode(value, { stream: true });
    const { veriler, kalan } = sseBloklariniAyir(tampon);
    tampon = kalan;
    veriler.forEach(isle);
  }
  const { veriler } = sseBloklariniAyir(tampon + "\n\n");
  veriler.forEach(isle);
}

/** Onay (HITL) cevabı: id = adk_request_confirmation çağrısının id'si. */
export function onayParcasi(onayId: string, onaylandi: boolean): Part {
  return { functionResponse: { id: onayId, name: ONAY_ARACI, response: { confirmed: onaylandi } } };
}

export function sendConfirmation(
  istemci: AjanIstemcisi,
  app: AgentAdi,
  sessionId: string,
  onayId: string,
  onaylandi: boolean,
  onEvent: (e: AdkEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return istemci.runSSE(
    { appName: app, userId: KULLANICI_ID, sessionId, newMessage: { role: "user", parts: [onayParcasi(onayId, onaylandi)] }, streaming: true },
    onEvent,
    signal,
  );
}

export const gercekIstemci: AjanIstemcisi = {
  mock: false,
  createSession,
  getSession,
  patchState,
  runSSE,
};
