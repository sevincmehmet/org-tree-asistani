# Org Tree Asistanı

> *"Bir şeyi öğrendiğini anlamanın en iyi yolu, onu basitçe anlatabilmektir."*

Google ADK ile yapılmış, iki yapay zeka ajanlı küçük bir organizasyon ağacı (org tree) uygulaması. Bir **Yönetici Asistanı** kimin nerede çalıştığını bulur, raporlama zincirini gösterir, ekip taşır ve gelen talepleri atar; bir **Çalışan Asistanı** ise çalışanın talebini dinler, taslak hazırlar ve onayla doğru yöneticiye iletir. Ajan her araç çağırdığında ağaç canlı olarak tepki verir: yol yanar, yetkisiz istek kırmızı titrer, önemli işlemler onay kartı bekler. Uygulamanın yanında 8 kısa ders var; her ders bir ADK kavramını bir restoran benzetmesiyle anlatıp "▶ Dene" ile ekranda gösterir.

![Ekran görüntüsü](docs/ekran.png)

---

## Restoranla 60 saniyede AI ajanı

Uygulama gerçek bir org tree aracı; restoran sadece kavramları basitçe anlatmak için kullandığım benzetme.

| Kavram | 🍽️ Restoranda | Bu projede |
|---|---|---|
| LLM | Çok şey bilen ama restoranı ilk gün gören yeni çalışan | Gemini modeli |
| Persona | Üniforma ve görev tanımı | Her ajanın `instruction` metni |
| Tool | Kasadaki POS cihazı | `altimda_bul`, `ekibi_listele`, `talebi_gonder`... |
| Callback | Kasayı açan müdür kartı | `before_tool_callback` ile yetki kontrolü |
| State | Masanın adisyonu | Session state: `agac`, `taslak_talep`... |
| İnsan onayı | Hesap kapanmadan önce müşterinin imzası | `require_confirmation=True` + onay kartı |
| Agent → agent | Garson siparişi mutfağa iletir, mutfağın içini anlatmaz | Triyaj ajanı `talebi_gonder` aracının içinde çalışır |
| MCP | Tedarikçi anlaşması | (Bu demoda yok) |
| RAG | Garsonun cebindeki menü kartı | (Bu demoda yok; araçlar güncel veriyi okuyor) |
| Eval | Gizli müşteri | (Henüz yok) |
| Fine-tuning | Çalışanı 3 aylık kursa göndermek | Bilerek yapılmadı (bkz. Ders 8) |

İki ajan da bu tabloya oturuyor:
- **Yönetici Asistanı = mutfak şefi.** Kimin nerede çalıştığını bilir, işi dağıtır.
- **Çalışan Asistanı = garson.** Müşteriyi dinler, siparişi mutfağa iletir, mutfağın içini anlatmaz.

---

## Özellikler

- **İki ajan, tek ağaç:** `org_asistani` (Yönetici Asistanı) ve `calisan_asistani` (Çalışan Asistanı) aynı organizasyon üzerinde farklı rollerle çalışır.
- **Hiyerarşik kapsam, "üstteki alttakini bulur":** Herkes kendini ve bütün alt ağacını görür, ayrıca kendi yönetici zincirini bilir. Kapsam dışındaki bir kişiye yapılan istek `before_tool_callback` tarafından reddedilir. *Arayüz gizler, kod engeller.*
- **Canlı ağaç:** Araç sonuçları ağaca yansır. Arama yolu yukarıdan aşağı, raporlama zinciri aşağıdan yukarı yanar; reddedilen hedef kırmızı titrer; taşıma animasyonla yer değiştirir.
- **Onay kartı:** Ekip taşıma, talep atama ve talep gönderme gibi işlemler sen onaylamadan çalışmaz.
- **"Ajan nasıl düşündü" zaman çizelgesi:** Modelin hangi aracı hangi argümanla çağırdığı ve ne cevap aldığı adım adım görünür. Ayrıca State sekmesinde oturum hafızası izlenebilir.
- **Mock modu:** `?mock=1` ile backend ve API anahtarı olmadan, hazır cevaplarla arayüz denenebilir.

---

## Mimari

```
┌──────────────────────────────┐
│  React arayüzü (Vite :5173)  │  ağaç · sohbet · onay kartı · zaman çizelgesi · dersler
└──────────────┬───────────────┘
               │  HTTP + SSE (/run_sse, /apps/.../sessions)
┌──────────────▼───────────────┐
│  adk api_server (:8000)      │
└───────┬──────────────┬───────┘
        │              │
┌───────▼───────┐ ┌────▼──────────────┐
│ org_asistani  │ │ calisan_asistani  │
│ (Yönetici)    │ │ (Çalışan)         │
└───────┬───────┘ └────┬──────────────┘
        │              │
┌───────▼──────────────▼───────────────────────────┐
│ Callback'ler: before_agent_callback (oturumu     │
│ hazırla) · before_tool_callback (yetki kontrolü) │
├──────────────────────────────────────────────────┤
│ Tool'lar (FunctionTool)                          │
│   talebi_gonder ──► [ triyaj ajanı ] (içeride,   │
│                      arayüze görünmez)           │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│ Org çekirdeği: data.py (18 uydurma kişi),        │
│ org.py (zincir, alt ağaç, ortak yönetici)        │
│ + session state (agac, tasimalar, taslak_talep)  │
│ + talepler.json (ortak talep kuyruğu)            │
└──────────────────────────────────────────────────┘
```

---

## 8 ders

Uygulamadaki ders panelinden her birini "▶ Dene" ile çalıştırabilirsin.

| # | Ders | 🍽️ Benzetme | Ajan / Giriş | Örnek mesaj | Ekranda ne izlenir |
|---|---|---|---|---|---|
| 1 | Persona | Üniforma ve görev tanımı | İkisi de / Burak Demir (e02) | "Kendini tanıt" | Aynı model, iki farklı karakter |
| 2 | Tool | POS cihazı | Yönetici / e02 | "Teknoloji departmanında kaç kişi var?" | `departman_agaci` çağrısı, 10 kişi vurgulanır |
| 3 | Tool zinciri + üstten alta | Şefin mutfağı istasyon istasyon dolaşması | Yönetici / e02 | "İrem'i bul", "Emre'nin zincirini göster" | Yol yukarıdan aşağı, zincir aşağıdan yukarı yanar |
| 4 | State | Masanın adisyonu | Çalışan / Emre Şahin (e04) | "Cuma izin almak istiyorum", "Taslağımı göster" | State sekmesinde `taslak_talep` |
| 5 | Callback / yetki | Müdürün kasa kartı | Yönetici / Selin Kaya (e03) | "Kerem'i bul", "Satış'ta kaç kişi var?" | Kapsam dışı: red, Kerem Yıldız kırmızı titrer; Satış'ın kişi sayısı bile dönmez |
| 6 | İnsan onayı | Müşterinin imzası | Yönetici / e02 | "Emre'yi yapay zeka ekibine taşı" | Onay kartı, sonra Emre'nin yer değiştirmesi |
| 7 | Agent → agent | Garson siparişi mutfağa iletir | Çalışan / Deniz Çelik (e07) → Yönetici / e02 | "Backend projesinde yardıma ihtiyacım var, talep oluştur", "Gönder", "Bekleyen talepleri göster" | Çalışana sadece birim adı döner; yönetici talebi kuyrukta görür |
| 8 | Fine-tuning (kodsuz) | Çalışanı kursa göndermek | – | – | Merdiven: prompt → tool/RAG → eval → few-shot → fine-tuning |

---

## Çalıştırma

Gereksinimler: Python 3.10+, Node.js 18+, bir Gemini API anahtarı.

**1. Backend**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Her iki ajan klasöründe örnek dosyayı `.env` olarak kopyala ve anahtarını yaz (anahtarı https://aistudio.google.com/apikey adresinden alabilirsin):

```bash
cp org_asistani/.env.example org_asistani/.env
cp calisan_asistani/.env.example calisan_asistani/.env
# iki dosyada da: GOOGLE_API_KEY=buraya_anahtarin
```

Sunucuyu başlat:

```bash
./calistir.sh
```

**2. Frontend** (ayrı bir terminalde)

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda http://localhost:5173 adresini aç.

**Backend olmadan denemek için:** http://localhost:5173/?mock=1 (API anahtarı gerekmez, cevaplar hazır).

**3. Testler**

```bash
python test_tools.py        # araçlar, yetki ve onay kapısı; modele istek atmaz
python eval_guvenlik.py     # gerçek modelle saldırı vakaları; API anahtarı ve kota ister
```

---

## Proje yapısı

```
org-tree-asistani/
├── org_asistani/          # Yönetici Asistanı (ADK app)
│   ├── agent.py           # persona (instruction), tool ve callback bağlantıları
│   ├── tools.py           # altimda_bul, ekibi_listele, calisani_tasi, talebi_karara_bagla...
│   ├── guards.py          # before_agent_callback, before_tool_callback (yetki)
│   ├── org.py             # ağaç hesapları: zincir, alt ağaç, ortak yönetici
│   └── data.py            # 18 uydurma kişi, departmanlar
├── calisan_asistani/      # Çalışan Asistanı (ADK app) + triyaj ajanı
├── frontend/              # React + Vite arayüzü
│   └── src/icerik/dersler.ts   # ders kartları ve kavram sözlüğü
├── test_tools.py          # araçların LLM'siz testleri
├── eval_guvenlik.py       # gerçek modelle saldırı/sızıntı eval'i
├── calistir.sh            # adk api_server başlatıcı
├── requirements.txt
└── CONTRACT.md            # backend ↔ frontend sözleşmesi
```

---

## Neleri öğrendim / bilinen eksikler

**Öğrendiklerim**
- **Kritik kuralları modele bırakmadım.** Yetki kontrolü `before_tool_callback`'te; model ne kadar ikna edilirse edilsin kapsam dışı aracı çalıştıramıyor. Arayüz de kilitliyor ama asıl engel kodda.
- **Sayıyı ve yolu model değil kod hesaplıyor.** Model sadece hangi aracı çağıracağına karar veriyor.
- **Persona da kod gibi.** Talimatı birkaç kez yeniden yazdım; küçük ifade farkları davranışı belirgin şekilde değiştiriyor.
- **Agent → agent'ta dönüşü kod seçmeli.** Triyaj ajanının iç kararı (kişi adı) çalışana sızmıyor, sadece birim adı dönüyor.
- **Gizlemek yetmiyor, sayı da sızdırıyor; model de boşluğu uyduruyor.** İlk sürümde aramalar isimleri gizliyor ama "5 kişi gizlendi" diyordu; sayıyı da kaldırdım. Eval'de model, gizlenen şirket toplamını tahmin edip uydurdu ("18", sonra "16"). Aracın cevabına "bu sayıyı bilmiyorsun" uyarısı ekleyince tekrar testlerinde uydurma kalmadı.

**Bilinen eksikler (dürüstçe)**
- **Ücretsiz katman kotası:** Gemini ücretsiz katmanında dakikalık istek sınırı düşük; hızlı denemelerde 429 hatası görülebilir.
- **Lite model bazen adım atlıyor:** `flash-lite` hızlı ve ucuz, ama bazen ikinci aracı çağırmadan cevap verebiliyor ya da kişiyi önce aramadan id tahmin etmeye çalışabiliyor.
- **Oturumlar tek makinelik:** ADK 2.14 oturumları her agent klasöründe SQLite'a (`.adk/session.db`) yazıyor; sunucu kapanınca kaybolmuyor ama birden fazla sunucuda paylaşılmıyor. Üretimde `--session_service_uri` ile ortak bir veritabanı gerekir. Talepler de tek bir `talepler.json` dosyasında.
- **Eval küçük:** `eval_guvenlik.py` Selin olarak 9 saldırı/kontrol vakası çalıştırıyor (isim sızıntısı, gizli sayı, uydurma sayı). Model rastgele olduğu için az tekrarla ölçülüyor; çok turlu konuşmalar ve yazma araçları henüz kapsam dışı.
- **Fine-tuning bilerek yapılmadı:** Sorunlar bilgi sorunuydu ve org verisi sık değişiyor; araçlar güncel veriyi okuduğu için gerek duymadım (Ders 8).

---

## Teknoloji

- **Backend:** Python, [Google ADK](https://google.github.io/adk-docs/) (`adk api_server`, FunctionTool, callback'ler, session state, tool confirmation), Gemini
- **Frontend:** React, TypeScript, Vite; SSE ile canlı olay akışı
- **Veri:** Tamamen uydurma 18 kişilik örnek organizasyon (`org_asistani/data.py`)

> **Not:** Bu projedeki bütün kişiler, unvanlar ve departmanlar uydurmadır; gerçek bir kurum ya da kişiyle ilgisi yoktur.

**Nasıl geliştirildi:** Claude Code ile geliştirildi; kodu satır satır inceledim ve VS Code debugger'ıyla breakpoint koyarak izledim.

---

## English

> *"The best way to know you've learned something is being able to explain it simply."*

**Org Tree Assistant** is a small org-chart app built with Google ADK and two AI agents. The **Manager Assistant** (`org_asistani`) finds people, shows reporting chains, moves employees between teams and assigns incoming requests. The **Employee Assistant** (`calisan_asistani`) listens to an employee's request, drafts it and, after confirmation, routes it through an internal triage agent to the right manager. The live tree reacts to every tool call: paths light up, unauthorized targets shake red, risky actions wait for a confirmation card. Eight short in-app lessons explain each ADK concept with a restaurant analogy (manager assistant = head chef, employee assistant = waiter who never exposes the kitchen).

Highlights: hierarchical permissions enforced in `before_tool_callback` ("the UI hides, the code blocks"), session state, human-in-the-loop via `require_confirmation`, agent-inside-a-tool with least privilege, a "how the agent thought" timeline, and a no-backend mock mode. The UI and lessons are in Turkish. All people in the data are fictional.

**Run it**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp org_asistani/.env.example org_asistani/.env
cp calisan_asistani/.env.example calisan_asistani/.env
# set GOOGLE_API_KEY in both files (https://aistudio.google.com/apikey)
./calistir.sh

# second terminal
cd frontend && npm install && npm run dev
# open http://localhost:5173   (or http://localhost:5173/?mock=1 without a backend)
```

Known limitations: free-tier rate limits, the lite model occasionally skips steps, sessions are stored per agent in a local SQLite file (.adk/session.db), not shared across servers, a small security eval (`eval_guvenlik.py`: 9 attack/control cases run against the real model; it caught the model inventing a hidden head count, which I fixed), and no fine-tuning (on purpose).

Built with Claude Code; I reviewed the code line by line and stepped through it with breakpoints in the VS Code debugger.
