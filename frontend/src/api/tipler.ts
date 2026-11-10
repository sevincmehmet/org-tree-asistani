// ADK api_server'ın döndürdüğü şekiller (CONTRACT.md → "ADK HTTP protokolü").
import type { AgentAdi } from "../icerik/tipler";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type JsonNesne = { [k: string]: Json };

export interface FunctionCall {
  id: string;
  name: string;
  args: JsonNesne;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response: JsonNesne;
}

export interface Part {
  text?: string;
  thought?: boolean;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface AdkEvent {
  id?: string;
  invocationId?: string;
  author?: string;
  partial?: boolean;
  turnComplete?: boolean;
  timestamp?: number;
  content?: { role?: string; parts?: Part[] };
  actions?: {
    stateDelta?: JsonNesne;
    requestedToolConfirmations?: JsonNesne;
  };
  longRunningToolIds?: string[];
  errorMessage?: string;
}

/** state.agac içindeki bir satır */
export interface AgacKisi {
  id: string;
  ad: string;
  unvan: string;
  departman_id: string;
  departman: string;
  yonetici: string | null;
}

export interface Oturum {
  id: string;
  appName: string;
  userId: string;
  state: JsonNesne;
  events?: AdkEvent[];
  lastUpdateTime?: number;
}

export interface RunGovdesi {
  appName: AgentAdi;
  userId: string;
  sessionId: string;
  newMessage: { role: "user"; parts: Part[] };
  streaming: boolean;
}

/** Gerçek ADK istemcisi ve mock istemci aynı arayüzü uygular. */
export interface AjanIstemcisi {
  readonly mock: boolean;
  createSession(app: AgentAdi, userId: string, state: JsonNesne): Promise<Oturum>;
  getSession(app: AgentAdi, userId: string, sid: string): Promise<Oturum>;
  patchState(app: AgentAdi, userId: string, sid: string, stateDelta: JsonNesne): Promise<void>;
  runSSE(govde: RunGovdesi, onEvent: (e: AdkEvent) => void, signal?: AbortSignal): Promise<void>;
}

// ---- v3: onay akışı (CONTRACT.md → "v3: Onay akışı + yeni arayüz") ----

/** Tool cevaplarındaki kısa kişi şekli. */
export interface KisiOzet {
  id: string;
  ad: string;
  unvan: string;
  departman: string;
}

export type TalepDurumu = "onay_bekliyor" | "onaylandi" | "reddedildi";
export type GecmisOlayi = "gonderildi" | "triyaj" | "onaylandi" | "reddedildi" | "ik_bilgilendirildi" | "yonlendirildi";

export interface Talep {
  no: number;
  zaman: string;
  sahip: KisiOzet;
  tur: string;
  aciklama: string;
  durum: TalepDurumu;
  onaylayan: KisiOzet;
  karar: { karar: "onay" | "red"; not: string; zaman: string; veren: KisiOzet } | null;
  yonlendirme: { hedef: KisiOzet; gerekce: string } | null;
  bilgilendirilenler: KisiOzet[];
  gecmis: { zaman: string; olay: GecmisOlayi | string; kisi_id: string }[];
}

export type BildirimTuru = "onay_istegi" | "onaylandi" | "reddedildi" | "bilgi";

export interface Bildirim {
  no: number;
  zaman: string;
  alici: KisiOzet;
  talep_no: number;
  tur: BildirimTuru | string;
  mesaj: string;
  okundu: boolean;
}

/** state.talep_ozeti: her turda before_agent_callback yazar (aktif kullanıcıya göre). */
export interface TalepOzeti {
  gonderdiklerim: Talep[];
  onayimi_bekleyenler: Talep[];
  bildirimler: Bildirim[];
  guncellendi: string | null;
}

// ---- v4: işlem geçmişi (CONTRACT.md → "v4: İşlem geçmişi + deterministik geri alma") ----

export type IslemTuru = "tasima" | "geri_alma";

/** state.islem_gecmisi içindeki bir kayıt (en yenisi SONDA). */
export interface Islem {
  no: number;
  zaman: string;
  tur: IslemTuru;
  kisi: KisiOzet;
  eski_yonetici: KisiOzet;
  yeni_yonetici: KisiOzet;
  yapan: KisiOzet;
  geri_alindi: boolean;
  geri_alan_no: number | null;
  hedef_no: number | null;
}
