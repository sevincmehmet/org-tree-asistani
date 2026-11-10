// Mock "model": mesajdaki anahtar kelimelere bakıp hangi tool'u çağıracağına karar verir.
// Gerçekte bu kararı LLM verir; burada ders mesajlarının hepsini kapsayan basit kurallar var.
import type { AgentAdi } from "../icerik/tipler";
import type { AgacKisi, Json, JsonNesne } from "../api/tipler";
import { VARSAYILAN_AGAC } from "../veri/org";
import { agacOku } from "../yardimci/org";
import { departmanBul, departmanLideri } from "./araclar";

export interface Baglam {
  state: JsonNesne;
  /** Tool çağırır (functionCall + functionResponse olayları), cevabı döner. */
  cagir(ad: string, args: JsonNesne): Promise<JsonNesne>;
  /** Onaylı tool: onay isteği gönderir ve turu bitirir; karar gelince `devam` YENİ turun bağlamıyla çalışır (reddedilirse null). */
  onayli(ad: string, args: JsonNesne, devam: (cevap: JsonNesne | null, b: Baglam) => Promise<void>): Promise<void>;
  /** Metni parça parça (partial) akıtır. */
  yaz(metin: string): Promise<void>;
}

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
const agacAl = (b: Baglam): AgacKisi[] => agacOku(b.state) ?? VARSAYILAN_AGAC;

/** Mesajda geçen kişileri (ad ya da soyadla) geçiş sırasına göre bulur. */
export function kisileriBul(metin: string, agac: AgacKisi[]): string[] {
  const m = kucuk(metin);
  const bulunan: { id: string; konum: number }[] = [];
  for (const k of agac) {
    const parcalar = kucuk(k.ad).split(" ");
    const konumlar = parcalar
      .map((p) => m.search(new RegExp(`(^|[^\\p{L}])${p}($|[^\\p{L}])`, "u")))
      .filter((i) => i >= 0);
    if (konumlar.length) bulunan.push({ id: k.id, konum: Math.min(...konumlar) });
  }
  return bulunan.sort((a, b) => a.konum - b.konum).map((x) => x.id);
}

const ad = (j: Json | undefined) => String((j as JsonNesne | null)?.ad ?? "?");
const liste = (j: Json | undefined) => (Array.isArray(j) ? j : []);
const kisiSatiri = (j: Json) => `- **${ad(j)}** — ${String((j as JsonNesne).unvan ?? "")}`;

async function redCevabi(b: Baglam, r: JsonNesne) {
  if (r.status === "reddedildi") {
    await b.yaz(`🔒 Bunu yapamam: ${String(r.mesaj)}\n\nBu kural modelde değil, kodda (\`before_tool_callback\`). Arayüz gizler, kod engeller.`);
    return true;
  }
  if (r.status !== "ok") {
    await b.yaz(`Üzgünüm, olmadı: ${String(r.mesaj ?? r.status)}`);
    return true;
  }
  return false;
}

const KONU_DISI = (rol: string) =>
  `Ben bir ${rol}; hava durumu gibi konularda bilgim yok, uydurmak da istemem. 🙂\n\nBana organizasyonla ilgili sorular sorabilirsin.`;

const TUR_ADI: Record<string, string> = { izin: "İzin", ik: "İK", teknik_destek: "Teknik destek", ekip_destegi: "Ekip desteği" };
const DURUM_ADI: Record<string, string> = { onay_bekliyor: "⏳ onay bekliyor", onaylandi: "✅ onaylandı", reddedildi: "✕ reddedildi" };
const talepSatiri = (t: JsonNesne) =>
  `- **#${String(t.no)}** ${ad(t.sahip)} · *${TUR_ADI[String(t.tur)] ?? String(t.tur)}* — "${String(t.aciklama)}" · ${DURUM_ADI[String(t.durum)] ?? String(t.durum)}`;

async function bildirimleriYaz(b: Baglam) {
  const r = await b.cagir("bildirimlerim", {});
  const bildirimler = liste(r.bildirimler) as JsonNesne[];
  if (!bildirimler.length) return b.yaz("Hiç bildirimin yok.");
  const yeni = bildirimler.filter((x) => !x.okundu).length;
  await b.yaz(
    `${yeni ? `**${yeni}** yeni bildirimin var` : "Yeni bildirimin yok"} (toplam ${bildirimler.length}):\n${bildirimler
      .map((x) => `- ${x.okundu ? "" : "🔵 "}${String(x.mesaj)} *(#${String(x.talep_no)})*`)
      .join("\n")}`,
  );
}

async function yoneticiBeyni(metin: string, b: Baglam) {
  const m = kucuk(metin);
  const agac = agacAl(b);
  const kisiler = kisileriBul(metin, agac);
  const dep = departmanBul(metin);

  if (/tanıt|kimsin|nesin|merhaba|selam/.test(m)) {
    const r = await b.cagir("ben_kimim", {});
    await b.yaz(
      `Merhaba **${ad(r.kullanici)}**! Ben **Yönetici Asistanı**'yım. 👔\n\nŞunları yapabilirim:\n- Kapsamındaki kişileri bulup yolu göstermek\n- Raporlama zinciri ve ekip listesi\n- Departman sayıları\n- Onayını bekleyen talepleri listelemek ve onayınla karara bağlamak\n- Onayınla çalışan taşımak\n\nSadece **senin alt ağacını** görebilirim.`,
    );
    return;
  }

  // v4: geri alma "taşı" kuralından ÖNCE bakılır ("son taşımayı geri al" bir taşıma isteği değildir).
  if (/geri al|vazgeç|iptal et/.test(m)) {
    const no = Number(m.match(/#?\s*(\d+)/)?.[1]) || 0;
    await b.onayli("islemi_geri_al", { islem_no: no }, async (r, b) => {
      if (!r) return b.yaz("Tamam, geri almadım. Ağaç olduğu gibi duruyor.");
      if (await redCevabi(b, r)) return;
      const i = r.islem as JsonNesne;
      await b.yaz(
        `↶ **#${String((r.geri_alinan as JsonNesne).no)}** geri alındı: **${ad(i.kisi)}** yeniden **${ad(i.yeni_yonetici)}**'un ekibinde.\n\nTersine çevrilecek taşımayı model değil kod buldu (işlem kaydı #${String(i.no)}).`,
      );
    });
    return;
  }

  if (/geçmiş|ne değişti|hangi işlem/.test(m)) {
    const r = await b.cagir("islem_gecmisi", {});
    const islemler = liste(r.islemler) as JsonNesne[];
    if (!islemler.length) return b.yaz("Bu oturumda henüz bir değişiklik yapılmadı.");
    await b.yaz(
      `Bu oturumdaki işlemler (en yenisi önce):\n${islemler
        .map((i) => `- **#${String(i.no)}** ${i.tur === "geri_alma" ? "↶ " : ""}${ad(i.kisi)}: ${ad(i.eski_yonetici)} → ${ad(i.yeni_yonetici)}${i.geri_alindi ? " *(geri alındı)*" : ""}`)
        .join("\n")}`,
    );
    return;
  }

  if (/taşı/.test(m)) {
    const calisan = kisiler[0];
    const yeni = kisiler[1] ?? (dep ? departmanLideri(agac, dep) : undefined);
    if (!calisan || !yeni) {
      await b.yaz("Kimi kimin altına taşıyayım? Örneğin: *Emre'yi yapay zeka ekibine taşı*.");
      return;
    }
    await b.onayli("calisani_tasi", { calisan_id: calisan, yeni_yonetici_id: yeni }, async (r, b) => {
      if (!r) return b.yaz("Tamam, taşımayı **iptal ettim**. Ağaç olduğu gibi kaldı.");
      if (await redCevabi(b, r)) return;
      await b.yaz(
        `✅ **${ad(r.calisan)}** artık **${ad(r.yeni_yonetici)}**'un ekibinde (önceki yönetici: ${ad(r.eski_yonetici)}).\n\nBu değişiklik sadece bu oturumun ağacında; gerçek veri değişmedi.`,
      );
    });
    return;
  }

  if (/bildirim/.test(m)) {
    await bildirimleriYaz(b);
    return;
  }

  const kararNo = Number(m.match(/#?\s*(\d+)/)?.[1]);
  if (kararNo && /onayla|onay ver|reddet|red\b/.test(m)) {
    const karar = /reddet|red\b/.test(m) ? "red" : "onay";
    const gerekce = karar === "red" ? (metin.split(/gerekçe:|çünkü/i)[1]?.trim() ?? "") : "";
    await b.onayli("talebi_karara_bagla", { talep_no: kararNo, karar, not_: gerekce }, async (r, b) => {
      if (!r) return b.yaz("Peki, karar vermedim. Talep onay bekliyor olarak duruyor.");
      if (r.status === "reddedildi") {
        await b.yaz(`🔒 Bunu yapamam: ${String(r.mesaj)}\n\nOnaylayan kişi ağaçtan hesaplanır; kural kodda (\`before_tool_callback\`). Ağaçta asıl onaylayan vurgulandı.`);
        return;
      }
      if (await redCevabi(b, r)) return;
      const t = r.talep as JsonNesne;
      if (t.durum === "onaylandi") {
        const bilgi = liste(t.bilgilendirilenler).map(ad).join(", ");
        await b.yaz(`✅ **#${String(t.no)}** onaylandı. Bilgilendirilenler: ${bilgi}.\n\nİK Müdürü bunu *"Bildirimlerim"* diye sorunca görecek.`);
      } else {
        await b.yaz(`✕ **#${String(t.no)}** reddedildi. ${ad(t.sahip)} bilgilendirildi.`);
      }
    });
    return;
  }

  if (/ekibimin talep|ekibin talep/.test(m)) {
    const r = await b.cagir("ekibimin_talepleri", {});
    const talepler = liste(r.talepler) as JsonNesne[];
    if (!talepler.length) return b.yaz("Ekibinde kayıtlı talep yok.");
    await b.yaz(`Ekibindeki talepler:\n${talepler.map(talepSatiri).join("\n")}`);
    return;
  }

  if (/onayımı bekleyen|bekleyen|onay bekleyen|talepler/.test(m)) {
    const r = await b.cagir("onayimi_bekleyenler", {});
    const talepler = liste(r.talepler) as JsonNesne[];
    if (!talepler.length) return b.yaz("Onayını bekleyen talep yok. 🎉");
    await b.yaz(
      `Onayını bekleyen **${talepler.length}** talep var:\n${talepler.map(talepSatiri).join("\n")}\n\nKarar için örn. *"#${String(talepler[0].no)} numaralı talebi onayla"* yazabilirsin.`,
    );
    return;
  }

  if (/ortak/.test(m) && kisiler.length >= 2) {
    const r = await b.cagir("ortak_yonetici", { calisan_id_1: kisiler[0], calisan_id_2: kisiler[1] });
    if (await redCevabi(b, r)) return;
    await b.yaz(`İkisinin en yakın ortak yöneticisi **${ad(r.ortak_yonetici)}**.`);
    return;
  }

  if (/zincir|kime bağlı|raporla|yöneticisi kim/.test(m) && kisiler[0]) {
    const r = await b.cagir("raporlama_zinciri", { calisan_id: kisiler[0] });
    if (await redCevabi(b, r)) return;
    const z = [r.calisan, ...liste(r.zincir_alttan_uste)].map(ad);
    await b.yaz(`**${ad(r.calisan)}** için raporlama zinciri (alttan üste):\n\n${z.join(" → ")}`);
    return;
  }

  if (/kaç kişi|kaç çalışan|departman/.test(m)) {
    const r = await b.cagir("departman_agaci", { departman_id: dep ?? "d-genel" });
    const d = r.agac as JsonNesne;
    const sayi = (n: JsonNesne) => (n.kisiler_gizli ? "görme yetkiniz yok" : `**${String(n.toplam_calisan)}** kişi`);
    const alt = liste(d.alt_departmanlar).map((a) => `- ${ad(a)}: ${sayi(a as JsonNesne)}`);
    const bas = d.kisiler_gizli
      ? `**${String(d.ad)}** departmanında göremediğiniz kişiler var; kişi sayısını paylaşamıyorum.`
      : `**${String(d.ad)}** departmanında toplam **${String(d.toplam_calisan)}** kişi var.`;
    await b.yaz(`${bas}${alt.length ? `\n\nAlt departmanlar:\n${alt.join("\n")}` : ""}`);
    return;
  }

  if (/ekib|ekip|kimler|listele|altımda/.test(m)) {
    const yonetici = dep ? departmanLideri(agac, dep) : (kisiler[0] ?? String(b.state.aktif_kullanici_id ?? "e02"));
    const r = await b.cagir("ekibi_listele", { yonetici_id: yonetici, dolayli_dahil: /tüm|hepsi|dolaylı|herkes/.test(m) });
    if (await redCevabi(b, r)) return;
    const ekip = liste(r.ekip);
    await b.yaz(`**${ad(r.yonetici)}** ekibinde **${String(r.kisi_sayisi)}** kişi var:\n${ekip.map(kisiSatiri).join("\n")}`);
    return;
  }

  if (kisiler[0]) {
    const hedef = agac.find((k) => k.id === kisiler[0])!;
    const r = await b.cagir("altimda_bul", { sorgu: hedef.ad.split(" ")[0] });
    if (await redCevabi(b, r)) return;
    const yol = liste(r.yol_yukaridan_asagi).map(ad);
    await b.yaz(`Buldum: **${ad(r.hedef)}** — ${String((r.hedef as JsonNesne).unvan)}.\n\nYukarıdan aşağı yol:\n${yol.join(" → ")}`);
    return;
  }

  await b.yaz(KONU_DISI("organizasyon asistanıyım"));
}

function talepTuru(m: string): string {
  if (/izin|tatil/.test(m)) return "izin";
  if (/maaş|bordro|sigorta|\bik\b|özlük/.test(m)) return "ik";
  if (/bilgisayar|arıza|bozuk|vpn|şifre|erişim|teknik|lisans/.test(m)) return "teknik_destek";
  return "ekip_destegi";
}

async function calisanBeyni(metin: string, b: Baglam) {
  const m = kucuk(metin);

  if (/tanıt|kimsin|nesin|merhaba|selam/.test(m)) {
    const r = await b.cagir("ben_kimim", {});
    await b.yaz(
      `Merhaba **${ad(r.kullanici)}**! Ben **Çalışan Asistanı**'yım. 🙋\n\nİzin, teknik destek, ekip desteği ya da İK konularında talebini dinler, bir taslak hazırlar ve **onayınla** gönderirim. Talep, org tree'den hesaplanan **doğrudan yöneticinin** onayına gider.\n\nŞirketin iç yapısı hakkında bilgi veremem; o iş yöneticilerin asistanında.`,
    );
    return;
  }

  if (/bildirim/.test(m)) {
    await bildirimleriYaz(b);
    return;
  }

  if (/taleplerim|talebim|ne durumda|durumu ne/.test(m)) {
    const r = await b.cagir("taleplerim", {});
    const talepler = liste(r.talepler) as JsonNesne[];
    if (!talepler.length) return b.yaz("Henüz gönderdiğin bir talep yok.");
    await b.yaz(`Taleplerin:\n${talepler.map(talepSatiri).join("\n")}`);
    return;
  }

  if (/yöneticim/.test(m)) {
    const r = await b.cagir("ben_kimim", {});
    const y = r.yoneticim as JsonNesne | undefined;
    await b.yaz(y ? `Doğrudan yöneticin **${ad(y)}** (${String(y.unvan ?? "")}). Taleplerin onay için ona gider.` : "Bir üst yöneticin yok; taleplerin otomatik onaylanır.");
    return;
  }

  if (/^\s*(gönder|yolla|ilet)|(talebi|taslağı|taslagi) (gönder|ilet)/.test(m)) {
    if (!b.state.taslak_talep) return b.yaz("Gönderilecek bir taslak yok. Önce ne istediğini anlatır mısın?");
    await b.onayli("talebi_gonder", {}, async (r, b) => {
      if (!r) return b.yaz("Peki, göndermedim. Taslağın duruyor; istersen değiştirebiliriz.");
      if (await redCevabi(b, r)) return;
      const onaylayan = r.onaylayan as JsonNesne;
      if (r.durum === "onaylandi") {
        await b.yaz(`📨 Talebin **#${String(r.talep_no)}** gönderildi. En üst yönetici olduğun için **otomatik onaylandı**; İK bilgilendirildi.`);
        return;
      }
      await b.yaz(
        `📨 Talebin **#${String(r.talep_no)}** gönderildi ve **${ad(onaylayan)}** (${String(onaylayan.unvan ?? "")}) onayını bekliyor.\n\nOnaylayanı ben seçmedim: org tree'de **doğrudan yöneticin** olduğu için kod hesapladı. Onaylanınca İK'ya bilgi düşecek.`,
      );
    });
    return;
  }

  if (/taslağ|taslak|göster/.test(m)) {
    const r = await b.cagir("taslagi_goster", {});
    if (r.status !== "ok") return b.yaz("Henüz bir taslağın yok. Ne istediğini anlatırsan hazırlarım.");
    const t = r.taslak as JsonNesne;
    await b.yaz(`Taslağın şöyle:\n- **Tür:** ${TUR_ADI[String(t.tur)] ?? String(t.tur)}\n- **Açıklama:** ${String(t.aciklama)}\n\nGöndermek için *"Gönder"* yazman yeterli.`);
    return;
  }

  if (/izin|yardım|destek|talep|sorun|arıza|bozuk|maaş|bordro|ihtiyac/.test(m)) {
    const aciklama = metin.replace(/,?\s*talep oluştur\.?$/i, "").trim();
    const r = await b.cagir("talep_taslagi_olustur", { tur: talepTuru(m), aciklama });
    const t = r.taslak as JsonNesne;
    await b.yaz(`Bir taslak hazırladım (henüz gönderilmedi):\n- **Tür:** ${TUR_ADI[String(t.tur)]}\n- **Açıklama:** ${String(t.aciklama)}\n\nUygunsa *"Gönder"* yaz, göndermeden önce senden onay isteyeceğim.`);
    return;
  }

  await b.yaz(KONU_DISI("çalışan asistanıyım"));
}

export function beyin(app: AgentAdi): (metin: string, b: Baglam) => Promise<void> {
  return app === "org_asistani" ? yoneticiBeyni : calisanBeyni;
}
