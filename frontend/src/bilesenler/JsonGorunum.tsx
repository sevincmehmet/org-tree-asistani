import { useState } from "react";
import type { Json } from "../api/tipler";

const ozet = (v: Json): string => (Array.isArray(v) ? `[${v.length}]` : v && typeof v === "object" ? `{${Object.keys(v).length}}` : "");

function Ilkel({ v }: { v: Json }) {
  if (v === null) return <span className="text-soluk">null</span>;
  if (typeof v === "string") return <span className="break-all text-basari">"{v}"</span>;
  if (typeof v === "number") return <span className="text-lca">{v}</span>;
  return <span className="text-uyari">{String(v)}</span>;
}

interface Props {
  ad?: string;
  deger: Json;
  derinlik?: number;
  vurgulu?: boolean;
  acikBasla?: boolean;
}

/** Katlanabilir JSON ağacı. */
export function JsonGorunum({ ad, deger, derinlik = 0, vurgulu, acikBasla }: Props) {
  const kap = deger !== null && typeof deger === "object";
  const [acik, setAcik] = useState(acikBasla ?? derinlik < 1);
  const etiket = ad !== undefined && <span className="text-soluk">{ad}: </span>;
  const satirSinif = `rounded px-1 ${vurgulu ? "bg-uyari-acik ring-1 ring-uyari/40" : ""}`;

  if (!kap) {
    return (
      <div className={satirSinif}>
        {etiket}
        <Ilkel v={deger} />
      </div>
    );
  }
  const girdiler: [string, Json][] = Array.isArray(deger) ? deger.map((v, i) => [String(i), v]) : Object.entries(deger);
  return (
    <div>
      <button type="button" aria-expanded={acik} onClick={() => setAcik((a) => !a)} className={`${satirSinif} text-left hover:bg-notr-acik`}>
        <span className="inline-block w-3 text-soluk" aria-hidden>
          {acik ? "▾" : "▸"}
        </span>
        {etiket}
        <span className="text-soluk">{ozet(deger)}</span>
      </button>
      {acik && (
        <div className="ml-3 border-l border-cizgi pl-2">
          {girdiler.map(([k, v]) => (
            <JsonGorunum key={k} ad={k} deger={v} derinlik={derinlik + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
