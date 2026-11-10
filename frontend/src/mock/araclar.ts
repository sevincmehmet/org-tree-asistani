// Mock tool'lar: backend'deki tool'ların dönüş şekillerini (CONTRACT.md) taklit eder.
// Yetki kontrolü de burada, gerçekteki before_tool_callback gibi tool'dan ÖNCE yapılır.
import type { AgacKisi, Json, JsonNesne } from "../api/tipler";
import { DEPARTMANLAR, VARSAYILAN_AGAC } from "../veri/org";
import { agacOku, altAgac, asagiYol, haritala, zincir } from "../yardimci/org";

export interface AracSonucu {
  cevap: JsonNesne;
  delta?: JsonNesne;
}

type Arac = (state: JsonNesne, args: JsonNesne) => AracSonucu;

const agacAl = (state: JsonNesne): AgacKisi[] => agacOku(state) ?? VARSAYILAN_AGAC;
const aktifAl = (state: JsonNesne) => String(state.aktif_kullanici_id ?? "e02");

export function kisi(agac: AgacKisi[], id: string): JsonNesne {
  const k = haritala(agac).get(id);
  return k ? { id: k.id, ad: k.ad, unvan: k.unvan, departman: k.departman } : { id, ad: id, unvan: "", departman: "" };
}

const red = (mesaj: string, hedef_id: string | null): AracSonucu => ({
  cevap: { status: "reddedildi", mesaj, hedef_id },
});

const kapsamda = (state: JsonNesne, id: string) => altAgac(agacAl(state), aktifAl(state)).has(id);
const gorunur = (state: JsonNesne, id: string) =>
  kapsamda(state, id) || zincir(haritala(agacAl(state)), aktifAl(state)).includes(id);

// ---- v4: oturuma özel taşıma + işlem geçmişi (gerçekte oturum.py) ----
interface MockIslem {
  no: number;
  zaman: string;
  tur: "tasima" | "geri_alma";
  kisi: JsonNesne;
  eski_yonetici: JsonNesne | null;
  yeni_yonetici: JsonNesne;
  yapan: JsonNesne | null;
  geri_alindi: boolean;
  geri_alan_no: number | null;
  hedef_no: number | null;
}

const islemlerAl = (state: JsonNesne): MockIslem[] => (Array.isArray(state.islem_gecmisi) ? (state.islem_gecmisi as unknown as MockIslem[]) : []);

/** Taşımayı uygular. Kişi temel verideki asıl yöneticisine dönüyorsa `tasimalar`'dan anahtar silinir. */
function tasimaUygula(state: JsonNesne, c: string, y: string) {
  const agac = agacAl(state).map((k) => (k.id === c ? { ...k, yonetici: y } : k));
  const tasimalar: JsonNesne = { ...((state.tasimalar as JsonNesne | undefined) ?? {}) };
  if (VARSAYILAN_AGAC.find((k) => k.id === c)?.yonetici === y) delete tasimalar[c];
  else tasimalar[c] = y;
  return { agac, tasimalar };
}

/** Geçmişe kayıt ekler (yeni liste döner, state'i değiştirmez). hedefNo verilirse o kayıt geri alındı işaretlenir. */
function islemEkle(state: JsonNesne, tur: MockIslem["tur"], k: JsonNesne, eski: JsonNesne | null, yeni: JsonNesne, yapan: JsonNesne, hedefNo: number | null = null) {
  const onceki = islemlerAl(state);
  const kayit: MockIslem = {
    no: Math.max(0, ...onceki.map((i) => i.no)) + 1,
    zaman: simdi().replace("T", " ").slice(0, 16),
    tur,
    kisi: k,
    eski_yonetici: eski,
    yeni_yonetici: yeni,
    yapan,
    geri_alindi: false,
    geri_alan_no: null,
    hedef_no: hedefNo,
  };
  const liste = [...onceki.map((i) => (i.no === hedefNo ? { ...i, geri_alindi: true, geri_alan_no: kayit.no } : i)), kayit];
  return { liste, yeni: kayit };
}

// ---- Paylaşılan talep / bildirim deposu (gerçekte talepler.json; iki agent'ın oturumları ortak kullanır) ----
type Kisi = JsonNesne;
export interface MockTalep {
  no: number;
  zaman: string;
  sahip: Kisi;
  tur: string;
  aciklama: string;
  durum: "onay_bekliyor" | "onaylandi" | "reddedildi";
  onaylayan: Kisi;
  karar: { karar: "onay" | "red"; not: string; zaman: string; veren: Kisi } | null;
  yonlendirme: { hedef: Kisi; gerekce: string } | null;
  bilgilendirilenler: Kisi[];
  gecmis: { zaman: string; olay: string; kisi_id: string }[];
}
export interface MockBildirim {
  no: number;
  zaman: string;
  alici: Kisi;
  talep_no: number;
  tur: "onay_istegi" | "onaylandi" | "reddedildi" | "bilgi";
  mesaj: string;
  okundu: boolean;
}

const IK_MUDURU = "e12";
const simdi = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 19);
};
const V = VARSAYILAN_AGAC;

const depo: { talepler: MockTalep[]; bildirimler: MockBildirim[] } = {
  talepler: [
    {
      no: 100,
      zaman: "2026-11-05T10:05:00",
      sahip: kisi(V, "e04"),
      tur: "teknik_destek",
      aciklama: "Test cihazı için ek monitör",
      durum: "onaylandi",
      onaylayan: kisi(V, "e03"),
      karar: { karar: "onay", not: "Uygun.", zaman: "2026-11-05T14:20:00", veren: kisi(V, "e03") },
      yonlendirme: { hedef: kisi(V, "e03"), gerekce: "Frontend ekibinin donanım talebi." },
      bilgilendirilenler: [kisi(V, "e12"), kisi(V, "e04")],
      gecmis: [
        { zaman: "2026-11-05T10:05:00", olay: "gonderildi", kisi_id: "e04" },
        { zaman: "2026-11-05T10:05:02", olay: "triyaj", kisi_id: "e03" },
        { zaman: "2026-11-05T14:20:00", olay: "onaylandi", kisi_id: "e03" },
        { zaman: "2026-11-05T14:20:01", olay: "ik_bilgilendirildi", kisi_id: "e12" },
      ],
    },
    {
      no: 101,
      zaman: "2026-11-07T09:12:00",
      sahip: kisi(V, "e05"),
      tur: "izin",
      aciklama: "Gelecek hafta pazartesi yıllık izin",
      durum: "onay_bekliyor",
      onaylayan: kisi(V, "e03"),
      karar: null,
      yonlendirme: null,
      bilgilendirilenler: [],
      gecmis: [{ zaman: "2026-11-07T09:12:00", olay: "gonderildi", kisi_id: "e05" }],
    },
  ],
  bildirimler: [
    { no: 1, zaman: "2026-11-05T14:20:01", alici: kisi(V, "e12"), talep_no: 100, tur: "bilgi", mesaj: "Selin Kaya, Emre Şahin'in #100 talebini onayladı.", okundu: false },
    { no: 2, zaman: "2026-11-05T14:20:01", alici: kisi(V, "e04"), talep_no: 100, tur: "onaylandi", mesaj: "#100 talebin Selin Kaya tarafından onaylandı.", okundu: true },
    { no: 3, zaman: "2026-11-07T09:12:00", alici: kisi(V, "e03"), talep_no: 101, tur: "onay_istegi", mesaj: "Zeynep Arslan izin talebi gönderdi (#101).", okundu: false },
  ],
};

const talepJson = (t: MockTalep): JsonNesne => structuredClone(t) as unknown as JsonNesne;
const bildirimJson = (b: MockBildirim): JsonNesne => ({ ...b }) as unknown as JsonNesne;

function bildir(alici: Kisi, talep_no: number, tur: MockBildirim["tur"], mesaj: string) {
  const no = Math.max(0, ...depo.bildirimler.map((b) => b.no)) + 1;
  depo.bildirimler.push({ no, zaman: simdi(), alici, talep_no, tur, mesaj, okundu: false });
}

/** Onaylayan = doğrudan yönetici (ağaçtan). Yöneticisi yoksa (CEO) kendisi. */
function onaylayanBul(agac: AgacKisi[], sahipId: string): string {
  return haritala(agac).get(sahipId)?.yonetici ?? sahipId;
}

/** Arayüz için state özeti (gerçekte before_agent_callback her turda yazar). */
export function talepOzeti(state: JsonNesne): JsonNesne {
  const aktif = aktifAl(state);
  return {
    gonderdiklerim: depo.talepler.filter((t) => t.sahip.id === aktif).map(talepJson),
    onayimi_bekleyenler: depo.talepler.filter((t) => t.onaylayan.id === aktif && t.durum === "onay_bekliyor").map(talepJson),
    bildirimler: depo.bildirimler.filter((b) => b.alici.id === aktif).map(bildirimJson),
    guncellendi: simdi(),
  } as JsonNesne;
}

/** Triyaj (agent→agent): gerçekte ayrı bir LLM ajanı; burada kurallarla taklit ediliyor. */
function triyaj(agac: AgacKisi[], sahipId: string, tur: string, aciklama: string): { hedef: string; gerekce: string } {
  const sahip = haritala(agac).get(sahipId);
  if (tur === "ik") return { hedef: "e12", gerekce: "İK konuları İK Müdürü'ne gider." };
  if (tur === "izin") return { hedef: sahip?.yonetici ?? "e01", gerekce: "İzin talepleri doğrudan yöneticiye gider." };
  const dep = departmanBul(aciklama) ?? sahip?.departman_id ?? "d-genel";
  return { hedef: departmanLideri(agac, dep), gerekce: `Açıklama ${DEPARTMANLAR[dep]?.ad ?? dep} ekibini işaret ediyor.` };
}

// ---- Metinden departman bulma (mock "dil anlama") ----
const DEP_ANAHTAR: [RegExp, string][] = [
  [/yapay zeka|veri|\bai\b/, "d-ai"],
  [/frontend|ön yüz/, "d-fe"],
  [/backend|arka uç/, "d-be"],
  [/teknoloji/, "d-tek"],
  [/insan kaynak|\bik\b|\bİk\b/, "d-ik"],
  [/kurumsal/, "d-kurumsal"],
  [/bireysel/, "d-bireysel"],
  [/satış/, "d-satis"],
  [/genel müdürlük|şirket/, "d-genel"],
];

export function departmanBul(metin: string): string | null {
  const m = metin.toLocaleLowerCase("tr");
  return DEP_ANAHTAR.find(([r]) => r.test(m))?.[1] ?? null;
}

export function departmanLideri(agac: AgacKisi[], dep: string): string {
  const harita = haritala(agac);
  const uyeler = agac.filter((k) => k.departman_id === dep);
  uyeler.sort((a, b) => zincir(harita, a.id).length - zincir(harita, b.id).length);
  return uyeler[0]?.id ?? "e01";
}

const altDepartmanlar = (dep: string) => Object.entries(DEPARTMANLAR).filter(([, d]) => d.ust === dep).map(([id]) => id);

function departmanKisileri(agac: AgacKisi[], dep: string): string[] {
  return [...agac.filter((k) => k.departman_id === dep).map((k) => k.id), ...altDepartmanlar(dep).flatMap((a) => departmanKisileri(agac, a))];
}

// Gerçekte org.departman_dugumu: göremediği biri olan departmanda sayı ve id dönmez (sayı da bilgi sızdırır).
function departmanAgaci(state: JsonNesne, agac: AgacKisi[], dep: string): JsonNesne {
  const altlar = altDepartmanlar(dep).map((id) => departmanAgaci(state, agac, id));
  const tum = departmanKisileri(agac, dep);
  const dugum = { id: dep, ad: DEPARTMANLAR[dep]?.ad ?? dep };
  if (tum.some((id) => !gorunur(state, id))) return { ...dugum, kisiler_gizli: true, alt_departmanlar: altlar };
  return { ...dugum, toplam_calisan: tum.length, kisi_idleri: tum, alt_departmanlar: altlar };
}

// ---- Tool'lar ----
export const ARACLAR: Record<string, Arac> = {
  ben_kimim: (state) => {
    const agac = agacAl(state);
    const ben = haritala(agac).get(aktifAl(state));
    return {
      cevap: {
        status: "ok",
        kullanici: kisi(agac, aktifAl(state)),
        ...(ben?.yonetici ? { yoneticim: kisi(agac, ben.yonetici) } : {}),
      },
    };
  },

  calisan_ara: (state, { sorgu }): AracSonucu => {
    const agac = agacAl(state);
    const q = String(sorgu).toLocaleLowerCase("tr");
    const eslesen = agac.filter((k) => `${k.ad} ${k.unvan} ${k.departman}`.toLocaleLowerCase("tr").includes(q));
    // Görünmeyenler hiç sayılmaz: "yok" ile "var ama gizli" aynı cevabı alır.
    const gor = eslesen.filter((k) => gorunur(state, k.id));
    if (!gor.length) return { cevap: { status: "bulunamadi", mesaj: `Görebildiğiniz alanda "${String(sorgu)}" ile eşleşen çalışan bulunamadı.` } };
    return { cevap: { status: "ok", sonuclar: gor.map((k) => kisi(agac, k.id)) } };
  },

  altimda_bul: (state, { sorgu }) => {
    const agac = agacAl(state);
    const q = String(sorgu).toLocaleLowerCase("tr");
    const hedef = agac.find((k) => k.ad.toLocaleLowerCase("tr").includes(q));
    if (!hedef) return { cevap: { status: "bulunamadi", mesaj: `"${sorgu}" bulunamadı.` } };
    const yol = asagiYol(haritala(agac), aktifAl(state), hedef.id);
    if (!yol) return red(`${hedef.ad} senin kapsamında değil.`, hedef.id);
    return { cevap: { status: "ok", hedef: kisi(agac, hedef.id), yol_yukaridan_asagi: yol.map((id) => kisi(agac, id)) } };
  },

  raporlama_zinciri: (state, { calisan_id }) => {
    const agac = agacAl(state);
    const id = String(calisan_id);
    if (!gorunur(state, id)) return red("Bu kişinin zincirini görme yetkin yok.", id);
    return {
      cevap: { status: "ok", calisan: kisi(agac, id), zincir_alttan_uste: zincir(haritala(agac), id).slice(1).map((z) => kisi(agac, z)) },
    };
  },

  ekibi_listele: (state, { yonetici_id, dolayli_dahil }) => {
    const agac = agacAl(state);
    const id = String(yonetici_id);
    if (!kapsamda(state, id)) return red(`${kisi(agac, id).ad} ekibi senin kapsamında değil.`, id);
    const ekip = dolayli_dahil ? [...altAgac(agac, id)].filter((x) => x !== id) : agac.filter((k) => k.yonetici === id).map((k) => k.id);
    return { cevap: { status: "ok", yonetici: kisi(agac, id), kisi_sayisi: ekip.length, ekip: ekip.map((x) => kisi(agac, x)) } };
  },

  departman_agaci: (state, { departman_id }) => ({
    cevap: { status: "ok", agac: departmanAgaci(state, agacAl(state), String(departman_id ?? "d-genel")) },
  }),

  ortak_yonetici: (state, { calisan_id_1, calisan_id_2 }) => {
    const agac = agacAl(state);
    const h = haritala(agac);
    const z1 = zincir(h, String(calisan_id_1));
    const z2 = new Set(zincir(h, String(calisan_id_2)));
    const ortak = z1.find((x) => z2.has(x)) ?? "e01";
    return { cevap: { status: "ok", kisiler: [kisi(agac, String(calisan_id_1)), kisi(agac, String(calisan_id_2))], ortak_yonetici: kisi(agac, ortak) } };
  },

  calisani_tasi: (state, { calisan_id, yeni_yonetici_id }) => {
    const agac = agacAl(state);
    const c = String(calisan_id);
    const y = String(yeni_yonetici_id);
    if (c === aktifAl(state)) return red("Kendinizi taşıyamazsınız; bunu sizin yöneticiniz yapabilir.", c);
    if (!kapsamda(state, c)) return red("Bu çalışanı taşıma yetkin yok.", c);
    if (!kapsamda(state, y)) return red("Yeni yönetici senin kapsamında değil.", y);
    if (altAgac(agac, c).has(y)) return { cevap: { status: "error", mesaj: "Bu taşıma döngü oluşturur." } };
    const eski = haritala(agac).get(c)?.yonetici ?? null;
    if (eski === y) return { cevap: { status: "error", mesaj: "Bu kişi zaten bu yöneticiye bağlı." } };
    const { agac: yeniAgac, tasimalar } = tasimaUygula(state, c, y);
    const cevap = { status: "ok", calisan: kisi(agac, c), eski_yonetici: eski ? kisi(agac, eski) : null, yeni_yonetici: kisi(agac, y) };
    const gecmis = islemEkle(state, "tasima", cevap.calisan, cevap.eski_yonetici, cevap.yeni_yonetici, kisi(agac, aktifAl(state)));
    return { cevap, delta: { agac: yeniAgac as unknown as Json, tasimalar, islem_gecmisi: gecmis.liste as unknown as Json } };
  },

  // v4: işlem geçmişi (en yenisi önce) ve deterministik geri alma. Backend'deki kurallarla aynı.
  islem_gecmisi: (state) => ({ cevap: { status: "ok", islemler: [...islemlerAl(state)].reverse() as unknown as Json } }),

  islemi_geri_al: (state, { islem_no }) => {
    const no = Number(islem_no ?? 0) || 0;
    const liste = islemlerAl(state);
    const hedef = no ? liste.find((i) => i.no === no) : [...liste].reverse().find((i) => i.tur === "tasima" && !i.geri_alindi);
    if (!hedef) return { cevap: no ? { status: "bulunamadi", mesaj: `#${no} numaralı işlem bulunamadı.` } : { status: "error", mesaj: "Geri alınacak bir taşıma yok." } };
    // Yetki (gerçekte before_tool_callback): kişi ve eski yönetici kapsamda olmalı.
    for (const k of [hedef.kisi, hedef.eski_yonetici]) {
      if (k && !kapsamda(state, String(k.id))) return red("Sadece kendi alt ekibinizdeki kişilerle ilgili taşımaları geri alabilirsiniz.", String(k.id));
    }
    if (hedef.tur !== "tasima") return { cevap: { status: "error", mesaj: `#${hedef.no} bir taşıma değil; sadece taşımalar geri alınabilir.` } };
    if (hedef.geri_alindi) return { cevap: { status: "error", mesaj: `#${hedef.no} numaralı işlem zaten geri alınmış (#${String(hedef.geri_alan_no)} ile).` } };
    if (!hedef.eski_yonetici) return { cevap: { status: "error", mesaj: "Bu işlemde eski yönetici yok; geri alınamaz." } };
    const agac = agacAl(state);
    const c = String(hedef.kisi.id);
    const eski = String(hedef.eski_yonetici.id);
    const simdiki = haritala(agac).get(c)?.yonetici ?? null;
    if (simdiki !== String(hedef.yeni_yonetici.id)) return { cevap: { status: "error", mesaj: `#${hedef.no} geri alınamaz: kişinin yöneticisi o işlemden sonra değişmiş.` } };
    if (altAgac(agac, c).has(eski)) return { cevap: { status: "error", mesaj: "Döngü oluşur: eski yönetici artık bu kişinin alt ekibinde; geri alma yapılamaz." } };
    const { agac: yeniAgac, tasimalar } = tasimaUygula(state, c, eski);
    const gecmis = islemEkle(state, "geri_alma", kisi(agac, c), kisi(agac, String(simdiki)), kisi(agac, eski), kisi(agac, aktifAl(state)), hedef.no);
    const geriAlinan = gecmis.liste.find((i) => i.no === hedef.no)!;
    return {
      cevap: { status: "ok", islem: gecmis.yeni as unknown as Json, geri_alinan: geriAlinan as unknown as Json },
      delta: { agac: yeniAgac as unknown as Json, tasimalar, islem_gecmisi: gecmis.liste as unknown as Json },
    };
  },

  onayimi_bekleyenler: (state) => {
    const aktif = aktifAl(state);
    const liste = depo.talepler.filter((t) => t.onaylayan.id === aktif && t.durum === "onay_bekliyor");
    return { cevap: { status: "ok", talepler: liste.map(talepJson) } };
  },

  talebi_karara_bagla: (state, { talep_no, karar, not_ }) => {
    const agac = agacAl(state);
    const aktif = aktifAl(state);
    const t = depo.talepler.find((x) => x.no === Number(talep_no));
    if (!t) return { cevap: { status: "bulunamadi", mesaj: `#${String(talep_no)} numaralı talep bulunamadı.` } };
    // Yetki (gerçekte before_tool_callback): sadece talebin onaylayanı karar verebilir.
    if (t.onaylayan.id !== aktif) return red(`#${t.no} talebini sadece ${String(t.onaylayan.ad)} karara bağlayabilir.`, String(t.onaylayan.id));
    if (t.durum !== "onay_bekliyor") return red(`#${t.no} talebi zaten karara bağlanmış (${t.durum}).`, null);
    const onay = karar !== "red";
    const veren = kisi(agac, aktif);
    const zaman = simdi();
    t.durum = onay ? "onaylandi" : "reddedildi";
    t.karar = { karar: onay ? "onay" : "red", not: String(not_ ?? ""), zaman, veren };
    t.gecmis.push({ zaman, olay: onay ? "onaylandi" : "reddedildi", kisi_id: aktif });
    if (onay) {
      const ik = kisi(agac, IK_MUDURU);
      const alicilar = [ik, ...(t.yonlendirme && t.yonlendirme.hedef.id !== aktif ? [t.yonlendirme.hedef] : []), t.sahip];
      t.bilgilendirilenler = alicilar.filter((k, i) => alicilar.findIndex((x) => x.id === k.id) === i);
      t.gecmis.push({ zaman, olay: "ik_bilgilendirildi", kisi_id: IK_MUDURU });
      bildir(ik, t.no, "bilgi", `${String(veren.ad)}, ${String(t.sahip.ad)} adlı çalışanın #${t.no} ${t.tur} talebini onayladı.`);
      if (t.yonlendirme && t.yonlendirme.hedef.id !== aktif && t.yonlendirme.hedef.id !== IK_MUDURU) {
        bildir(t.yonlendirme.hedef, t.no, "bilgi", `#${t.no} talebi onaylandı; işi sen üstleneceksin.`);
      }
      bildir(t.sahip, t.no, "onaylandi", `#${t.no} talebin ${String(veren.ad)} tarafından onaylandı.`);
    } else {
      t.bilgilendirilenler = [t.sahip];
      bildir(t.sahip, t.no, "reddedildi", `#${t.no} talebin ${String(veren.ad)} tarafından reddedildi.${not_ ? ` Gerekçe: ${String(not_)}` : ""}`);
    }
    return { cevap: { status: "ok", talep: talepJson(t) } };
  },

  bildirimlerim: (state) => {
    const aktif = aktifAl(state);
    const benim = depo.bildirimler.filter((b) => b.alici.id === aktif);
    const cevap = benim.map(bildirimJson);
    benim.forEach((b) => (b.okundu = true));
    return { cevap: { status: "ok", bildirimler: cevap } };
  },

  ekibimin_talepleri: (state) => {
    const kapsam = altAgac(agacAl(state), aktifAl(state));
    return { cevap: { status: "ok", talepler: depo.talepler.filter((t) => kapsam.has(String(t.sahip.id))).map(talepJson) } };
  },

  taleplerim: (state) => {
    const aktif = aktifAl(state);
    return { cevap: { status: "ok", talepler: depo.talepler.filter((t) => t.sahip.id === aktif).map(talepJson) } };
  },

  talep_taslagi_olustur: (_state, { tur, aciklama }) => {
    const taslak = { tur: String(tur), aciklama: String(aciklama) };
    return { cevap: { status: "ok", taslak }, delta: { taslak_talep: taslak } };
  },

  taslagi_goster: (state): AracSonucu => {
    const taslak = state.taslak_talep ?? null;
    return taslak ? { cevap: { status: "ok", taslak } } : { cevap: { status: "bulunamadi", mesaj: "Henüz taslak yok." } };
  },

  talebi_gonder: (state): AracSonucu => {
    const agac = agacAl(state);
    const taslak = state.taslak_talep as { tur: string; aciklama: string } | null | undefined;
    if (!taslak) return { cevap: { status: "error", mesaj: "Gönderilecek taslak yok." } };
    const sahipId = aktifAl(state);
    const onaylayanId = onaylayanBul(agac, sahipId);
    const no = Math.max(0, ...depo.talepler.map((t) => t.no)) + 1;
    const zaman = simdi();
    const sahip = kisi(agac, sahipId);
    const onaylayan = kisi(agac, onaylayanId);
    // Triyaj agent'ı (agent→agent): izin dışı türlerde işi kimin üstleneceğini önerir. Çalışana DÖNMEZ.
    const yon = taslak.tur === "izin" ? null : triyaj(agac, sahipId, taslak.tur, taslak.aciklama);
    const t: MockTalep = {
      no,
      zaman,
      sahip,
      tur: taslak.tur,
      aciklama: taslak.aciklama,
      durum: "onay_bekliyor",
      onaylayan,
      karar: null,
      yonlendirme: yon ? { hedef: kisi(agac, yon.hedef), gerekce: yon.gerekce } : null,
      bilgilendirilenler: [],
      gecmis: [
        { zaman, olay: "gonderildi", kisi_id: sahipId },
        ...(yon ? [{ zaman, olay: "triyaj", kisi_id: yon.hedef }] : []),
      ],
    };
    depo.talepler.push(t);
    if (onaylayanId === sahipId) {
      // CEO: kendisi otomatik onaylı sayılır.
      t.durum = "onaylandi";
      t.karar = { karar: "onay", not: "Otomatik onay (en üst yönetici).", zaman, veren: sahip };
      t.gecmis.push({ zaman, olay: "onaylandi", kisi_id: sahipId }, { zaman, olay: "ik_bilgilendirildi", kisi_id: IK_MUDURU });
      t.bilgilendirilenler = [kisi(agac, IK_MUDURU)];
      bildir(kisi(agac, IK_MUDURU), no, "bilgi", `${String(sahip.ad)} #${no} talebini gönderdi (otomatik onay).`);
    } else {
      bildir(onaylayan, no, "onay_istegi", `${String(sahip.ad)} ${taslak.tur} talebi gönderdi (#${no}).`);
    }
    const gonderilen = [...((state.gonderilen_talepler as number[] | undefined) ?? []), no];
    return {
      cevap: { status: "ok", talep_no: no, onaylayan, durum: t.durum },
      delta: { taslak_talep: null, gonderilen_talepler: gonderilen },
    };
  },
};

export const ONAYLI_ARACLAR = new Set(["calisani_tasi", "talebi_gonder", "talebi_karara_bagla", "islemi_geri_al"]);
