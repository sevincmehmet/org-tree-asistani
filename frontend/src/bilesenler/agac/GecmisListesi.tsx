// 🕘 İşlem geçmişi (CONTRACT v4): bu oturumdaki taşımalar ve geri almalar, en yenisi önce.
// "↶ Geri al" doğrudan bir şey değiştirmez: sohbete "#N numaralı işlemi geri al" gönderir,
// ajan islemi_geri_al'ı çağırır ve onay kartı yine sohbette çıkar. Asıl kural backend'de.
import { Undo2 } from "lucide-react";
import type { Islem } from "../../api/tipler";
import { geriAlinabilir, islemDurumu } from "../../yardimci/islem";

const ilkAd = (ad: string) => ad.split(" ")[0];
const saat = (zaman: string) => zaman.slice(11, 16) || zaman;

function islemCumlesi(i: Islem): string {
  // Türkçe ekler isme göre değiştiği için ("Burak'tan", "Selin'e") eksiz biçim: "Emre: Selin → Elif"
  return `${ilkAd(i.kisi.ad)}: ${ilkAd(i.eski_yonetici.ad)} → ${ilkAd(i.yeni_yonetici.ad)}`;
}

interface SatirProps {
  islem: Islem;
  /** Verilmezse buton gösterilmez. */
  geriAl?: (no: number) => void;
  pasif?: boolean;
}

export function IslemSatiri({ islem: i, geriAl, pasif }: SatirProps) {
  const durum = islemDurumu(i);
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover">
      <span className="w-7 shrink-0 font-mono text-xs text-soluk">#{i.no}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] ${durum === "geri_alindi" ? "text-soluk line-through" : ""}`}>
          {durum === "geri_alma" && <span className="text-bilgi">↶ </span>}
          {islemCumlesi(i)}
        </span>
        <span className="block truncate text-[11.5px] text-soluk">
          {saat(i.zaman)}
          {durum === "geri_alma" && i.hedef_no != null && ` · #${i.hedef_no} geri alındı`}
          {durum === "geri_alindi" && i.geri_alan_no != null && ` · #${i.geri_alan_no} ile geri alındı`}
        </span>
      </span>
      {geriAl && geriAlinabilir(i) && (
        <button
          type="button"
          disabled={pasif}
          onClick={() => geriAl(i.no)}
          className="btn btn-sm btn-ikincil shrink-0"
          title={`#${i.no} numaralı taşımayı geri al (onay kartı sohbette çıkar)`}
        >
          <Undo2 size={13} aria-hidden /> Geri al
        </button>
      )}
    </li>
  );
}

interface Props {
  islemler: Islem[];
  geriAl: (no: number) => void;
  pasif: boolean;
}

export function GecmisListesi({ islemler, geriAl, pasif }: Props) {
  if (!islemler.length) {
    return (
      <p className="px-3 py-4 text-[13px] leading-relaxed text-soluk">
        Bu oturumda henüz taşıma yok. Örneğin <em>"Emre'yi yapay zeka ekibine taşı"</em> yazınca kayıt buraya düşer.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 p-1.5" aria-label="İşlem geçmişi">
      {islemler.map((i) => (
        <IslemSatiri key={i.no} islem={i} geriAl={geriAl} pasif={pasif} />
      ))}
    </ul>
  );
}
