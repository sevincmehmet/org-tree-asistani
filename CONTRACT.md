# Sözleşme: org-tree-asistani (backend ↔ frontend ↔ içerik)

> **v3 güncellemesi en altta ("v3: Onay akışı + yeni arayüz").** v3, v2'deki talep/triyaj kısmının yerine geçer; çeliştiği yerde v3 geçerlidir.

Bu dosya üç paralel çalışmanın ortak referansıdır. Değiştirmek gerekirse önce burada değiştirilir.

## Amaç
Mevcut `org_asistani` (ADK, Python) geliştirilir ve bir React arayüzüne bağlanır. Öğretici, LinkedIn'de paylaşılabilir bir demo.
Motto: *"Bir şeyi öğrendiğini anlamanın en iyi yolu, onu basitçe anlatabilmektir."*
Uygulama gerçek bir org tree aracıdır; **restoran benzetmesi sadece yazılarda** (ders kartları, README, LinkedIn) kullanılır.
Bütün kişiler uydurmadır (`org_asistani/data.py`, 18 kişi). Arayüz dili: Türkçe.

## Dosya sahipliği (paralel çalışmada kimse başkasının alanına yazmaz)
| Alan | Sahibi |
|---|---|
| `org_asistani/**`, `calisan_asistani/**`, `test_tools.py`, `requirements.txt`, `calistir.sh` | Backend |
| `frontend/**` (HARİÇ `frontend/src/icerik/dersler.ts`) | Frontend |
| `frontend/src/icerik/dersler.ts`, `README.md`, `LINKEDIN.md` | İçerik |
| `CONTRACT.md`, `.vscode/**` | Koordinatör |

## İki agent (ADK app adları)
| App | Rol | 🍽️ Benzetme (yazılar için) |
|---|---|---|
| `org_asistani` | **Yönetici Asistanı**: org tree, kişi bulma, zincir, ekip, taşıma, gelen talepleri atama. Hiyerarşik yetki. | Mutfak şefi: kimin nerede çalıştığını bilir, işi dağıtır |
| `calisan_asistani` | **Çalışan Asistanı**: çalışan talep/sorun bildirir, taslak hazırlanır, onayla gönderilir; triyaj agent'ı doğru yöneticiye yönlendirir. İç bilgi vermez. | Garson: müşteriyi dinler, siparişi mutfağa iletir, mutfağın içini anlatmaz |

## Ortak tipler
`kisi` = `{ "id": "e04", "ad": "Emre Şahin", "unvan": "Frontend Geliştirici", "departman": "Frontend" }`
Her tool cevabı `status` alanı taşır: `"ok"` | `"error"` | `"reddedildi"` | `"bulunamadi"`.
Red cevabı: `{ "status": "reddedildi", "mesaj": "...", "hedef_id": "e14" }` (`hedef_id`: arayüzde kırmızı yanacak kişi; yoksa null).

## Session state anahtarları
| Anahtar | Tip | Yazan | Açıklama |
|---|---|---|---|
| `aktif_kullanici_id` | str | arayüz (session oluştururken / PATCH) + `before_agent_callback` varsayılanı `"e02"` | Giriş yapan kişi |
| `agac` | `[{id, ad, unvan, departman_id, departman, yonetici}]` | her iki agent `before_agent_callback`'te (yoksa) + taşımada | Oturumun güncel ağacı. Arayüz ağacı BUNDAN çizer. `yonetici` = üst kişinin id'si, kök için null |
| `tasimalar` | `{calisan_id: yeni_yonetici_id}` | yönetici agent | Oturuma özel değişiklikler (global veri asla değişmez) |
| `taslak_talep` | `{tur, aciklama}` \| null | çalışan agent | Gönderilmemiş talep |
| `gonderilen_talepler` | `[int]` | çalışan agent | Bu oturumda gönderilen talep numaraları |

## Kapsam (yetki) kuralı
`kapsam(aktif)` = aktif kullanıcı + bütün alt ağacı. **Görünür** = kapsam ∪ aktif kullanıcının yukarı zinciri (kendi yöneticilerini bilir).
"Üstteki alttakini bulur": aşağı yol sadece kapsam içindeki hedefe çizilir. Asıl kural `before_tool_callback`'te; arayüz sadece görsel olarak kilitler. *Arayüz gizler, kod engeller.*

## Yönetici tool'ları (`org_asistani`) — isimler ve dönüşler AYNEN böyle
| Tool | Argümanlar | Dönüş (`status:"ok"` iken) | Not |
|---|---|---|---|
| `ben_kimim` | – | `{kullanici: kisi}` | |
| `calisan_ara` | `sorgu: str` | `{sonuclar: [kisi], gizlenen_sayisi: int}` | Sadece görünür kişiler; diğerlerinin sadece sayısı |
| `altimda_bul` | `sorgu: str` | `{hedef: kisi, yol_yukaridan_asagi: [kisi]}` | Yol aktif kullanıcıyla başlar, hedefle biter. Kapsam dışı → `reddedildi` + `hedef_id` |
| `raporlama_zinciri` | `calisan_id: str` | `{calisan: kisi, zincir_alttan_uste: [kisi]}` | |
| `ekibi_listele` | `yonetici_id: str, dolayli_dahil: bool=false` | `{yonetici: kisi, kisi_sayisi: int, ekip: [kisi]}` | Kapsam dışı → reddedildi |
| `departman_agaci` | `departman_id: str="d-genel"` | `{agac: {id, ad, toplam_calisan, kisi_idleri: [id], alt_departmanlar: [...]}}` | |
| `ortak_yonetici` | `calisan_id_1, calisan_id_2` | `{kisiler: [kisi, kisi], ortak_yonetici: kisi}` | |
| `calisani_tasi` ⚠️onaylı | `calisan_id, yeni_yonetici_id` | `{calisan: kisi, eski_yonetici: kisi, yeni_yonetici: kisi}` | `require_confirmation=True`; döngü → `error`; state `agac` + `tasimalar` güncellenir |
| `bekleyen_talepler` | – | `{talepler: [talep]}` | Sadece önerilen hedefi aktif kullanıcının kapsamında olanlar |
| `talebi_ata` ⚠️onaylı | `talep_no: int, atanan: str` | `{talep: talep}` | `require_confirmation=True`; atanan kapsamda olmalı |

`talep` = `{no, zaman, sahip: kisi, tur, aciklama, durum: "triyaj"|"onay_bekliyor"|"atandi", oneri: {hedef: kisi, oncelik: "dusuk"|"normal"|"yuksek", gerekce} | null, atanan: kisi | null}`

## Çalışan tool'ları (`calisan_asistani`)
| Tool | Argümanlar | Dönüş | Not |
|---|---|---|---|
| `ben_kimim` | – | `{kullanici: kisi, yoneticim: kisi}` | |
| `talep_taslagi_olustur` | `tur: "izin"|"teknik_destek"|"ekip_destegi"|"ik", aciklama: str` | `{taslak: {tur, aciklama}}` | state `taslak_talep` |
| `taslagi_goster` | – | `{taslak}` | |
| `talebi_gonder` ⚠️onaylı | – | `{talep_no: int, iletilen_birim: str}` | `require_confirmation=True`. İçeride triyaj agent'ı çalışır (agent→agent). Dönüşü KOD seçer: kişi adı yok, sadece birim adı (ör. "Teknoloji", "İnsan Kaynakları") |

Triyaj (içeride, arayüze görünmez): talep sahibine ve türe bakarak hedef yöneticiyi önerir. Kurallar: `izin` → doğrudan yönetici; `ik` → İK Müdürü (e12); `teknik_destek`/`ekip_destegi` → ilgili ekibin lideri (açıklamadan çıkarır). Kayıt: ortak kuyruk dosyası `talepler.json`.

## ADK HTTP protokolü (ADK 2.14, `adk api_server`) — camelCase
- Sunucu: `adk api_server --allow_origins=http://localhost:5173 --port 8000 .` (proje kökünden; `--allow_origins` yoksa tarayıcı 403 alır)
- Uygulamalar: `GET /list-apps` → `["calisan_asistani","org_asistani"]`
- Session: `POST /apps/{app}/users/{userId}/sessions` body `{"state": {"aktif_kullanici_id": "e02"}}` → `{id, appName, userId, state, events, lastUpdateTime}`
- Session oku: `GET /apps/{app}/users/{userId}/sessions/{sid}` → `state` içinde `agac` vb.
- Giriş değiştir: `PATCH /apps/{app}/users/{userId}/sessions/{sid}` body `{"stateDelta": {"aktif_kullanici_id": "e03"}}`
- Mesaj (SSE): `POST /run_sse` body `{"appName","userId","sessionId","newMessage":{"role":"user","parts":[{"text":"..."}]},"streaming":true}` → `data: <Event JSON>\n\n` satırları. Hata: `data: {"error": "..."}`.
- Event: `{id, invocationId, author, partial?, content:{role, parts:[{text}|{functionCall:{id,name,args}}|{functionResponse:{id,name,response}}]}, actions:{stateDelta, requestedToolConfirmations?}, longRunningToolIds?, turnComplete?}`. `partial:true` metin parçalarını biriktir, `partial` olmayan son metinle değiştir.
- **Onay (HITL):** Sunucu `functionCall {id: CONF_ID, name: "adk_request_confirmation", args: {originalFunctionCall: {id, name, args}, toolConfirmation: {hint, confirmed:false}}}` gönderir. Arayüz kart gösterir; cevap yeni bir `/run_sse` ile:
  `newMessage: {"role":"user","parts":[{"functionResponse":{"id": CONF_ID, "name":"adk_request_confirmation","response":{"confirmed": true|false}}}]}`
  (id = onay çağrısının id'si, orijinal çağrınınki değil.) Ayrıca orijinal tool için `{"error":"This tool call requires confirmation..."}` içeren bir functionResponse gelir; arayüz bunu "onay bekliyor" diye gösterir, hata diye değil.

## Olay → ağaç efekti (frontend `src/viz/olayEslestir.ts`)
| Kaynak | Efekt |
|---|---|
| `altimda_bul` ok | `yol_yukaridan_asagi` id'leri sırayla yukarıdan aşağı yanar (yol animasyonu) |
| `raporlama_zinciri` ok | `calisan` + `zincir_alttan_uste` aşağıdan yukarı yanar |
| `ekibi_listele` ok | `yonetici` + `ekip` id'leri vurgulanır |
| `departman_agaci` ok | `agac.kisi_idleri` (alt departmanlar dahil) vurgulanır |
| `ortak_yonetici` ok | iki kişi + ortak yönetici özel renk |
| `calisan_ara` ok | `sonuclar` nabız |
| herhangi `status:"reddedildi"` | `hedef_id` kırmızı titreşim |
| `calisani_tasi` ok | yeni `agac` state'inden animasyonlu yer değiştirme |
| `talebi_ata` ok / `talebi_gonder` ok | (yönetici görünümünde) `talep.atanan` nabız |
| `adk_request_confirmation` | onay kartı (orijinal tool adı + argümanlar, kişi id'leri adla gösterilir) |

## Ders içeriği tipi (`frontend/src/icerik/dersler.ts`)
```ts
export type AgentAdi = "org_asistani" | "calisan_asistani";
export interface Ders {
  no: number;
  baslik: string;            // "Persona"
  kavram: string;            // teknik kavram adı
  benzetme: string;          // 🍽️ restoran benzetmesi, 1-2 cümle
  teknik: string;            // teknik açıklama, 2-3 cümle, sade
  agent: AgentAdi | null;    // null = kodsuz ders (fine-tuning)
  kullanici: string | null;  // giriş yapılacak kişi id'si, ör. "e02"
  ornekMesajlar: string[];   // "▶ Dene" sırayla gönderir
  nedeBak: string;           // "Ağaçta yol yukarıdan aşağı yanıyor mu?"
  kodYeri?: string;          // ör. "org_asistani/guards.py → yetki_kontrolu"
}
export interface Kavram { terim: string; benzetme: string; aciklama: string; }
export const DERSLER: Ders[];
export const KAVRAMLAR: Kavram[];
export const MOTTO: string;
```

## 8 ders (içerik bunları yazar)
1 Persona (iki agent'ta "Kendini tanıt") · 2 Tool (yönetici/e02: "Teknoloji departmanında kaç kişi var?") · 3 Tool zinciri + üstten alta (yönetici/e02: "İrem'i bul", "Emre'nin zincirini göster") · 4 State (çalışan/e04: "Cuma izin almak istiyorum", "Taslağımı göster") · 5 Callback/yetki (yönetici/e03 Selin: "Satış ekibini listele") · 6 İnsan onayı (yönetici/e02: "Emre'yi yapay zeka ekibine taşı") · 7 Agent→agent (çalışan/e07: "Backend projesinde yardıma ihtiyacım var, talep oluştur", "Gönder" → yönetici/e02: "Bekleyen talepleri göster") · 8 Fine-tuning (kodsuz: "garsonu kursa göndermek"; merdiven prompt → tool → eval → few-shot → fine-tuning)

---

# v3: Onay akışı + yeni arayüz

## Neden
Gerçek İK sistemlerinde onaylayan kişi elle seçilmez, **org tree'den hesaplanır** (line manager onayı, sonra İK'ya bilgi). Bu, org tree'nin en somut kullanım örneği ve hiyerarşik yetkinin canlı gösterimi.

## Akış
```
🙋 Çalışan: talep taslağı → talebi_gonder 🔘
     → onaylayan = çalışanın DOĞRUDAN yöneticisi (ağaçtan; yoksa bir üst; CEO ise e01 kendisi otomatik onaylı sayılır)
     → (izin dışı türlerde) triyaj agent'ı "yonlendirme" önerir: işi kim üstlenmeli (agent→agent korunur)
     → durum: "onay_bekliyor"
👔 Onaylayan yönetici: onayimi_bekleyenler → talebi_karara_bagla(no, "onay"|"red", not) 🔘
     → onay: durum "onaylandi"; bildirim: İK Müdürü (e12) + (varsa) yonlendirme hedefi + talep sahibi
     → red:  durum "reddedildi"; bildirim: talep sahibi (gerekçeyle)
👀 İK (e12) / ilgili kişi: bildirimlerim
🙋 Çalışan: taleplerim (durum + geçmiş)
```
Yetki (before_tool_callback): `talebi_karara_bagla` sadece talebin `onaylayan`ı tarafından yapılabilir; başkası → `reddedildi`, `hedef_id` = gerçek onaylayan. Durum `onay_bekliyor` değilse → `reddedildi`.

## Kaldırılan / değişen tool'lar
- KALDIRILDI: `bekleyen_talepler`, `talebi_ata` (yerine aşağıdakiler).
- `talebi_gonder` dönüşü: `{talep_no, onaylayan: kisi, durum: "onay_bekliyor"}` (kendi yöneticisinin adını görmek gizlilik ihlali değil). Triyajın önerdiği kişi DÖNMEZ (dar kapı korunur).

## Yeni tipler
`talep` = `{no, zaman, sahip: kisi, tur, aciklama, durum: "onay_bekliyor"|"onaylandi"|"reddedildi", onaylayan: kisi, karar: {karar:"onay"|"red", not, zaman, veren: kisi} | null, yonlendirme: {hedef: kisi, gerekce} | null, bilgilendirilenler: [kisi], gecmis: [{zaman, olay, kisi_id}]}`
`gecmis.olay` değerleri: `"gonderildi"`, `"triyaj"`, `"onaylandi"`, `"reddedildi"`, `"ik_bilgilendirildi"`, `"yonlendirildi"`.
`bildirim` = `{no, zaman, alici: kisi, talep_no, tur: "onay_istegi"|"onaylandi"|"reddedildi"|"bilgi", mesaj, okundu: bool}`
Depo: proje kökünde `talepler.json` → `{ "talepler": [...], "bildirimler": [...] }` (kilitli okuma/yazma).

## Yeni tool'lar
Yönetici (`org_asistani`):
| Tool | Argümanlar | Dönüş |
|---|---|---|
| `onayimi_bekleyenler` | – | `{talepler: [talep]}` (onaylayan == aktif ve onay_bekliyor) |
| `talebi_karara_bagla` ⚠️onaylı | `talep_no: int, karar: "onay"|"red", not_: str=""` | `{talep: talep}` |
| `bildirimlerim` | – | `{bildirimler: [bildirim]}` (alici == aktif; okundu yapar) |
| `ekibimin_talepleri` | – | `{talepler: [talep]}` (sahibi aktifin kapsamında olanlar, tüm durumlar) |
Çalışan (`calisan_asistani`): mevcutlar + `taleplerim` → `{talepler: [talep]}`, `bildirimlerim` (aynı şekil).

## Arayüz için state özeti
Her iki agent `before_agent_callback`'te (her tur) yazar: `state["talep_ozeti"]` =
`{ "gonderdiklerim": [talep], "onayimi_bekleyenler": [talep], "bildirimler": [bildirim], "guncellendi": "<zaman>" }` (aktif kullanıcıya göre).
Not: depo oturumlar arası ortaktır; özet sadece bir tur çalışınca tazelenir. Arayüz "son güncelleme" gösterir.

## Olay → ağaç efekti (v3 ekleri)
| Kaynak | Efekt |
|---|---|
| `talebi_gonder` ok | sahip → onaylayan yolu **yukarı akan** animasyon |
| `onayimi_bekleyenler` ok | her talebin sahibi nabız |
| `talebi_karara_bagla` ok, onay | onaylayan yeşil ✓; onaylayan → İK (e12) **kesikli "bilgi" çizgisi**; bilgilendirilenler nabız |
| `talebi_karara_bagla` ok, red | sahip kırmızı ✕ rozeti |
| `talebi_karara_bagla` reddedildi (yetki) | `hedef_id` (gerçek onaylayan) vurgulanır + aktif kişi kırmızı titrer |

## Arayüz v3 (yeniden tasarım)
- İki ağaç görünümü, aynı seçimi paylaşır: **🗂️ Liste** (girintili, aç/kapa, arama → otomatik açılır, klavye ↑↓←→ Enter) ve **🌳 Şema** (kartlar daha büyük ve okunur; derin seviyeler varsayılan kapalı + düğümde aç/kapa; **Odak modu**: kişi + yöneticisi + doğrudan ekibi; seçilene otomatik ortalama).
- **Profil paneli** (sağdan kayan): ad, unvan, departman, yöneticisi, doğrudan ekip, kapsam durumu (🔒/✓), bu kişinin talepleri.
- **📥 Talepler** sekmesi: Gönderdiklerim / Onayımı bekleyenler / Bildirimler; her talep için durum zaman çizelgesi (gönderildi → onay bekliyor → onaylandı → İK bilgilendirildi).
- Modlar korunur: 🎓 Öğrenme (dersler + düşünce şeridi + State) / 💼 Uygulama.

---

# v4: İşlem geçmişi (audit log) + deterministik geri alma

## Neden
Kullanıcı "geri al" dediğinde ajan şu an önceki tool sonucunu HAFIZASINDAN okuyup ters taşıma yapıyor (çalışıyor ama modele güveniyor; uzun/karışık konuşmada yanlış işlemi çevirebilir). Kural: kritik işi modele bırakma → her yazma işlemi koda kaydedilir, geri alma kod tarafından yapılır.

## State
`state["islem_gecmisi"]` = `[islem]` (oturuma özel, çünkü taşımalar oturuma özel), en yenisi SONDA.
`islem` = `{no: int, zaman, tur: "tasima"|"geri_alma", kisi: kisi, eski_yonetici: kisi, yeni_yonetici: kisi, yapan: kisi, geri_alindi: bool, geri_alan_no: int|null, hedef_no: int|null}`
- `tasima`: calisani_tasi her başarılı çalıştığında eklenir.
- `geri_alma`: islemi_geri_al eklenir; `hedef_no` = geri alınan işlemin no'su; geri alınan işlem `geri_alindi:true`, `geri_alan_no` doldurulur.

## Düzeltme
Kişi temel verideki asıl yöneticisine geri taşınırsa `tasimalar`'dan anahtarı SİL (gereksiz kayıt kalmasın).

## Yeni tool'lar (yönetici)
| Tool | Argümanlar | Dönüş |
|---|---|---|
| `islem_gecmisi` | – | `{islemler: [islem]}` (en yenisi önce) |
| `islemi_geri_al` ⚠️onaylı | `islem_no: int = 0` (0 = geri alınmamış en son taşıma) | `{islem: <yeni geri_alma kaydı>, geri_alinan: <eski kayıt>}` |
Kurallar (tool içinde + callback): işlem var olmalı, tur "tasima" olmalı, geri alınmamış olmalı; kişinin ŞU ANKİ yöneticisi o işlemin `yeni_yonetici`'si olmalı (sonradan tekrar taşındıysa → `{status:"error", mesaj:"...sonradan değişmiş..."}`); döngü olmamalı; before_tool_callback: kişi ve eski yönetici aktif kullanıcının kapsamında olmalı (değilse reddedildi + hedef_id). Persona: "geri al / vazgeçtim" → islemi_geri_al çağır, ters taşımayı elle kurma.

## Arayüz
- Olay → efekt: `islemi_geri_al` ok → `agac`'tan animasyonlu taşıma + kişi üzerinde "↶ geri alındı" rozeti.
- Profil panelinde "🕘 Son değişiklikler" (o kişiyle ilgili islem_gecmisi kayıtları).
- Ağaç panelinde 🕘 Geçmiş listesi (state.islem_gecmisi): her taşıma satırı "Ayşe → Burak'tan Selin'e · 14:02", geri alınmamışlar için "↶ Geri al" düğmesi → sohbete "#N numaralı işlemi geri al" gönderir (onay kartı yine sohbette çıkar).
- Mock bunu da taklit eder.
