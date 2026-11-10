// Küçük, güvenli markdown: **kalın**, *italik*, `kod`, listeler, satır sonları. innerHTML yok.
import { Fragment, type ReactNode } from "react";

function satirIci(metin: string, anahtar: string): ReactNode[] {
  const parcalar = metin.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parcalar.map((p, i) => {
    const k = `${anahtar}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return (
        <code key={k} className="rounded bg-notr-acik px-1 py-0.5 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={k}>{p.slice(1, -1)}</em>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

type Blok = { tur: "p"; satirlar: string[] } | { tur: "ul" | "ol"; ogeler: string[] };

function bloklara(metin: string): Blok[] {
  const bloklar: Blok[] = [];
  for (const ham of metin.replace(/\r/g, "").split("\n")) {
    const satir = ham.trimEnd();
    const ul = satir.match(/^\s*[-*•]\s+(.*)$/);
    const ol = satir.match(/^\s*\d+[.)]\s+(.*)$/);
    const son = bloklar[bloklar.length - 1];
    if (ul || ol) {
      const tur = ul ? "ul" : "ol";
      const icerik = (ul ?? ol)![1];
      if (son && son.tur === tur) son.ogeler.push(icerik);
      else bloklar.push({ tur, ogeler: [icerik] });
    } else if (!satir.trim()) {
      bloklar.push({ tur: "p", satirlar: [] });
    } else if (/^\s{2,}\S/.test(ham) && son && son.tur !== "p") {
      son.ogeler[son.ogeler.length - 1] += `\n${satir.trim()}`;
    } else if (son && son.tur === "p" && son.satirlar.length) {
      son.satirlar.push(satir);
    } else {
      bloklar.push({ tur: "p", satirlar: [satir] });
    }
  }
  return bloklar.filter((b) => (b.tur === "p" ? b.satirlar.length > 0 : true));
}

const cokSatir = (s: string, k: string) =>
  s.split("\n").map((satir, i) => (
    <Fragment key={`${k}-${i}`}>
      {i > 0 && <br />}
      {satirIci(satir, `${k}-${i}`)}
    </Fragment>
  ));

export function MarkdownLite({ metin }: { metin: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {bloklara(metin).map((b, i) => {
        if (b.tur === "p") return <p key={i}>{cokSatir(b.satirlar.join("\n"), `p${i}`)}</p>;
        const Liste = b.tur;
        return (
          <Liste key={i} className={`space-y-1 pl-5 ${b.tur === "ul" ? "list-disc" : "list-decimal"} marker:text-soluk`}>
            {b.ogeler.map((o, j) => (
              <li key={j}>{cokSatir(o, `l${i}-${j}`)}</li>
            ))}
          </Liste>
        );
      })}
    </div>
  );
}
