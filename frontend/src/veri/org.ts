// org_asistani/data.py'nin arayüz kopyası (tamamen uydurma kişiler).
// Mock modda ve gerçek oturumda `agac` henüz state'e yazılmamışken yedek olarak kullanılır.
import type { AgacKisi } from "../api/tipler";

export const DEPARTMANLAR: Record<string, { ad: string; ust: string | null }> = {
  "d-genel": { ad: "Genel Müdürlük", ust: null },
  "d-tek": { ad: "Teknoloji", ust: "d-genel" },
  "d-fe": { ad: "Frontend", ust: "d-tek" },
  "d-be": { ad: "Backend", ust: "d-tek" },
  "d-ai": { ad: "Veri ve Yapay Zeka", ust: "d-tek" },
  "d-ik": { ad: "İnsan Kaynakları", ust: "d-genel" },
  "d-satis": { ad: "Satış", ust: "d-genel" },
  "d-kurumsal": { ad: "Kurumsal Satış", ust: "d-satis" },
  "d-bireysel": { ad: "Bireysel Satış", ust: "d-satis" },
};

const HAM: [string, string, string, string, string | null][] = [
  ["e01", "Ayşe Yılmaz", "Genel Müdür", "d-genel", null],
  ["e02", "Burak Demir", "Teknoloji Direktörü", "d-tek", "e01"],
  ["e03", "Selin Kaya", "Frontend Takım Lideri", "d-fe", "e02"],
  ["e04", "Emre Şahin", "Frontend Geliştirici", "d-fe", "e03"],
  ["e05", "Zeynep Arslan", "Frontend Geliştirici", "d-fe", "e03"],
  ["e06", "Can Öztürk", "Backend Takım Lideri", "d-be", "e02"],
  ["e07", "Deniz Çelik", "Backend Geliştirici", "d-be", "e06"],
  ["e08", "Mert Aydın", "Backend Geliştirici", "d-be", "e06"],
  ["e09", "Elif Koç", "Yapay Zeka Takım Lideri", "d-ai", "e02"],
  ["e10", "Ozan Polat", "Veri Bilimci", "d-ai", "e09"],
  ["e11", "İrem Doğan", "Junior AI Geliştirici", "d-ai", "e09"],
  ["e12", "Hakan Kurt", "İK Müdürü", "d-ik", "e01"],
  ["e13", "Gizem Aksoy", "İK Uzmanı", "d-ik", "e12"],
  ["e14", "Tolga Er", "Satış Direktörü", "d-satis", "e01"],
  ["e15", "Pınar Güneş", "Kurumsal Satış Müdürü", "d-kurumsal", "e14"],
  ["e16", "Kerem Yıldız", "Satış Temsilcisi", "d-kurumsal", "e15"],
  ["e17", "Ece Tan", "Bireysel Satış Müdürü", "d-bireysel", "e14"],
  ["e18", "Umut Bal", "Satış Temsilcisi", "d-bireysel", "e17"],
];

export const VARSAYILAN_AGAC: AgacKisi[] = HAM.map(([id, ad, unvan, departman_id, yonetici]) => ({
  id,
  ad,
  unvan,
  departman_id,
  departman: DEPARTMANLAR[departman_id].ad,
  yonetici,
}));

/** Departman renkleri (ağaç kartları ve çipler). */
export const DEPARTMAN_RENGI: Record<string, string> = {
  "d-genel": "#64748b",
  "d-tek": "#6366f1",
  "d-fe": "#0ea5e9",
  "d-be": "#10b981",
  "d-ai": "#8b5cf6",
  "d-ik": "#ec4899",
  "d-satis": "#f59e0b",
  "d-kurumsal": "#f97316",
  "d-bireysel": "#84cc16",
};

export const departmanRengi = (id: string) => DEPARTMAN_RENGI[id] ?? "#94a3b8";
