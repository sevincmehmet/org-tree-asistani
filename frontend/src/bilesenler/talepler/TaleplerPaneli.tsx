// 📥 Talepler: Gönderdiklerim / Onayımı bekleyenler / Bildirimler (state.talep_ozeti + sohbetteki taze sonuçlar).
import { motion } from "framer-motion";
import { Bell, Check, Inbox, Info, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Bildirim } from "../../api/tipler";
import { zamanGoster, type BirlesikOzet } from "../../yardimci/talep";
import { TalepKarti } from "./TalepKarti";

export type TalepBolumu = "gonderdiklerim" | "bekleyenler" | "bildirimler";

interface Props {
  ozet: BirlesikOzet;
  ozetVar: boolean;
  kullaniciAdi: string;
  calisiyor: boolean;
  hazir: boolean;
  bolum: TalepBolumu;
  setBolum: (b: TalepBolumu) => void;
  vurguluTalep: number | null;
  okunmamis: number;
  karar: (no: number, k: "onay" | "red") => void;
  sor: (mesaj: string) => void;
  talepAc: (no: number) => void;
}

const BILDIRIM_IKON: Record<string, { Ikon: typeof Bell; sinif: string }> = {
  onay_istegi: { Ikon: Inbox, sinif: "bg-uyari-acik text-uyari" },
  onaylandi: { Ikon: Check, sinif: "bg-basari-acik text-basari" },
  reddedildi: { Ikon: X, sinif: "bg-tehlike-acik text-tehlike" },
  bilgi: { Ikon: Info, sinif: "bg-bilgi-acik text-bilgi" },
};

function BildirimSatiri({ b, ac }: { b: Bildirim; ac: () => void }) {
  const ik = BILDIRIM_IKON[b.tur] ?? BILDIRIM_IKON.bilgi;
  return (
    <li>
      <button type="button" onClick={ac} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-hover">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${ik.sinif}`} aria-hidden>
          <ik.Ikon size={15} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[13px] leading-snug ${b.okundu ? "text-metin-2" : "font-medium text-metin"}`}>{b.mesaj}</span>
          <span className="mt-0.5 block text-xs text-soluk">
            #{b.talep_no} · {zamanGoster(b.zaman)}
          </span>
        </span>
        {!b.okundu && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vurgu" aria-label="okunmadı" />}
      </button>
    </li>
  );
}

function Bos({ ikon, baslik, aciklama, children }: { ikon: ReactNode; baslik: string; aciklama: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center px-4 py-10 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-notr-acik text-soluk">{ikon}</span>
      <p className="text-sm font-semibold">{baslik}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-soluk">{aciklama}</p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function TaleplerPaneli({ ozet, ozetVar, kullaniciAdi, calisiyor, hazir, bolum, setBolum, vurguluTalep, okunmamis, karar, sor, talepAc }: Props) {
  const bekleyenSayi = ozet.onayimi_bekleyenler.filter((t) => t.durum === "onay_bekliyor").length;
  const sekmeler: { id: TalepBolumu; etiket: string; sayi: number; rozet?: boolean }[] = [
    { id: "gonderdiklerim", etiket: "Gönderdiklerim", sayi: ozet.gonderdiklerim.length },
    { id: "bekleyenler", etiket: "Onayımı bekleyenler", sayi: bekleyenSayi, rozet: bekleyenSayi > 0 },
    { id: "bildirimler", etiket: "Bildirimler", sayi: okunmamis, rozet: okunmamis > 0 },
  ];

  // Vurgulanan talebe kaydır.
  const [sonVurgu, setSonVurgu] = useState<number | null>(null);
  useEffect(() => {
    if (vurguluTalep === null || vurguluTalep === sonVurgu) return;
    const t = setTimeout(() => {
      document.getElementById(`talep-${vurguluTalep}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setSonVurgu(vurguluTalep);
    }, 80);
    return () => clearTimeout(t);
  }, [vurguluTalep, sonVurgu, bolum]);

  if (!ozetVar) {
    return (
      <Bos ikon={<Inbox size={20} />} baslik="Talep özeti henüz yok" aciklama={`Ajan, ${kullaniciAdi} için talep özetini her turun başında state'e yazar. Bir mesaj gönderince burası dolar.`}>
        <button type="button" className="btn btn-ikincil btn-sm" disabled={calisiyor || !hazir} onClick={() => sor("Taleplerim ne durumda?")}>
          Taleplerim ne durumda?
        </button>
        <button type="button" className="btn btn-ikincil btn-sm" disabled={calisiyor || !hazir} onClick={() => sor("Onayımı bekleyen talepler")}>
          Onayımı bekleyenler
        </button>
      </Bos>
    );
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 pb-2">
        <div role="tablist" aria-label="Talep bölümleri" className="segment max-w-full overflow-x-auto">
          {sekmeler.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={bolum === s.id} onClick={() => setBolum(s.id)}>
              {bolum === s.id && <motion.span layoutId="talep-bolum" className="segment-zemin" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{s.etiket}</span>
              {s.sayi > 0 && (
                <span className={`relative grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${s.rozet ? "bg-vurgu text-vurgu-metin" : "bg-cizgi text-soluk"}`}>
                  {s.sayi}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1.5 px-4 pb-2 text-[11.5px] text-soluk">
        <RefreshCw size={11} aria-hidden />
        Son güncelleme {zamanGoster(ozet.guncellendi) || "—"} · bir sonraki mesajdan sonra tazelenir
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {bolum === "gonderdiklerim" &&
          (ozet.gonderdiklerim.length ? (
            <div className="space-y-3">
              {[...ozet.gonderdiklerim].reverse().map((t) => (
                <TalepKarti key={t.no} talep={t} vurgulu={vurguluTalep === t.no} sohbettenGuncel={ozet.sohbettenGuncellendi.has(t.no)} />
              ))}
            </div>
          ) : (
            <Bos ikon={<Send size={18} />} baslik="Gönderdiğin talep yok" aciklama="Çalışan Asistanı'na bir talep anlat; onaylayan, org tree'den doğrudan yöneticin olarak hesaplanır.">
              <button type="button" className="btn btn-ikincil btn-sm" disabled={calisiyor || !hazir} onClick={() => sor("Gelecek cuma izin almak istiyorum")}>
                Gelecek cuma izin almak istiyorum
              </button>
            </Bos>
          ))}

        {bolum === "bekleyenler" &&
          (ozet.onayimi_bekleyenler.length ? (
            <div className="space-y-3">
              {ozet.onayimi_bekleyenler.map((t) => (
                <TalepKarti
                  key={t.no}
                  talep={t}
                  vurgulu={vurguluTalep === t.no}
                  sohbettenGuncel={ozet.sohbettenGuncellendi.has(t.no)}
                  eylem={{ onayla: () => karar(t.no, "onay"), reddet: () => karar(t.no, "red"), kapali: calisiyor || !hazir }}
                />
              ))}
            </div>
          ) : (
            <Bos ikon={<Check size={18} />} baslik="Onayını bekleyen talep yok" aciklama="Ekibinden biri talep gönderdiğinde burada görünür. Onaylayan sen olduğunda kod bunu ağaçtan bilir." />
          ))}

        {bolum === "bildirimler" &&
          (ozet.bildirimler.length ? (
            <ul className="kart divide-y divide-cizgi overflow-hidden p-1">
              {[...ozet.bildirimler].reverse().map((b) => (
                <BildirimSatiri key={b.no} b={b} ac={() => talepAc(b.talep_no)} />
              ))}
            </ul>
          ) : (
            <Bos ikon={<Bell size={18} />} baslik="Bildirim yok" aciklama="Bir talep onaylanınca İK'ya ve talep sahibine bildirim düşer." />
          ))}
      </div>
    </div>
  );
}
