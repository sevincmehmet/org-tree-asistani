import type { AgentAdi } from "../icerik/tipler";

export const AGENT_BILGI: Record<AgentAdi, { ikon: string; ad: string; kisa: string }> = {
  org_asistani: { ikon: "👔", ad: "Yönetici Asistanı", kisa: "Yönetici" },
  calisan_asistani: { ikon: "🙋", ad: "Çalışan Asistanı", kisa: "Çalışan" },
};
