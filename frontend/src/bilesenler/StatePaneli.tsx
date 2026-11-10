import type { JsonNesne } from "../api/tipler";
import { JsonGorunum } from "./JsonGorunum";

const ACIKLAMA: Record<string, string> = {
  aktif_kullanici_id: "Giriş yapan kişi (arayüz yazar)",
  agac: "Oturumun güncel ağacı (ağaç bundan çizilir)",
  tasimalar: "Bu oturumdaki taşımalar",
  taslak_talep: "Gönderilmemiş talep taslağı",
  gonderilen_talepler: "Bu oturumda gönderilen talep no'ları",
  talep_ozeti: "Talepler sekmesi bunu okur (her turun başında yazılır)",
};

export function StatePaneli({ state, sonDelta, sid }: { state: JsonNesne; sonDelta: string[]; sid: string | null }) {
  const anahtarlar = Object.keys(state).sort();
  return (
    <div className="h-full overflow-auto bg-panel p-4 font-mono text-xs">
      <p className="mb-2 font-sans text-[11px] text-soluk">
        Oturum: <span className="font-mono">{sid ?? "henüz yok"}</span>
        {sonDelta.length > 0 && (
          <>
            {" · "}
            <span className="rounded bg-uyari-acik px-1 text-uyari">son stateDelta: {sonDelta.join(", ")}</span>
          </>
        )}
      </p>
      {anahtarlar.length === 0 && <p className="text-soluk">State boş.</p>}
      <div className="space-y-1.5">
        {anahtarlar.map((k) => (
          <div key={k}>
            <JsonGorunum ad={k} deger={state[k]} vurgulu={sonDelta.includes(k)} acikBasla={k !== "agac"} derinlik={1} />
            {ACIKLAMA[k] && <p className="ml-4 font-sans text-[10px] text-soluk">{ACIKLAMA[k]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
