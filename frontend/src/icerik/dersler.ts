// Ders kartları ve kavram sözlüğü.
// Uygulama gerçek bir org tree aracıdır; restoran benzetmesi yalnızca bu yazılarda,
// kavramları basitçe anlatmak için kullanılır. Bütün kişiler uydurmadır.

export type AgentAdi = "org_asistani" | "calisan_asistani";

export interface Ders {
  no: number;
  baslik: string;
  kavram: string;
  benzetme: string;
  teknik: string;
  agent: AgentAdi | null;
  kullanici: string | null;
  ornekMesajlar: string[];
  nedeBak: string;
  kodYeri?: string;
}

export interface Kavram {
  terim: string;
  benzetme: string;
  aciklama: string;
}

export const MOTTO: string =
  "Bir şeyi öğrendiğini anlamanın en iyi yolu, onu basitçe anlatabilmektir.";

export const DERSLER: Ders[] = [
  {
    no: 1,
    baslik: "Persona",
    kavram: "Instruction (sistem talimatı)",
    benzetme:
      "🍽️ Yeni işe giren bilgili bir çalışana önce üniforma ve görev tanımı verilir: \"Sen mutfak şefisin\" ya da \"Sen garsonsun\". Aynı kişi, giydiği üniformaya göre farklı davranır.",
    teknik:
      "ADK'da her ajanın bir `instruction` metni vardır; model her konuşmada önce bunu okur. Yönetici Asistanı ile Çalışan Asistanı aynı dil modelini kullanır, onları farklı yapan sadece bu talimat ve verilen araçlardır. Persona da kod gibi denenir, beğenilmezse yeniden yazılır.",
    agent: "org_asistani",
    kullanici: "e02",
    ornekMesajlar: ["Kendini tanıt", "Bugün hava nasıl?"],
    nedeBak:
      "Cevabın tonu ve konusu: Yönetici Asistanı kendini org tree yardımcısı olarak tanıtıyor mu, konu dışı soruda kibarca kendi işine dönüyor mu? Sonra üstten Çalışan Asistanı'na geçip aynı soruyu sor, farkı gör.",
    kodYeri: "org_asistani/agent.py → instruction",
  },
  {
    no: 2,
    baslik: "Tool (araç)",
    kavram: "FunctionTool + docstring şeması",
    benzetme:
      "🍽️ Garson hesabı ezberden uydurmaz, POS cihazına bakar. Model de sayıyı tahmin etmez, kendisine verilen aracı çağırır ve gelen sonucu söyler.",
    teknik:
      "Sıradan bir Python fonksiyonu ajana verildiğinde ADK onu `FunctionTool` yapar; fonksiyonun adı, parametre tipleri ve docstring'i modele bir \"kullanım kılavuzu\" (şema) olarak gider. Burada model `departman_agaci(\"d-tek\")` çağırır, sayıyı kod hesaplar.",
    agent: "org_asistani",
    kullanici: "e02",
    ornekMesajlar: [
      "Teknoloji departmanında kaç kişi var?",
      "Frontend ekibinde kimler var?",
    ],
    nedeBak:
      "\"Ajan nasıl düşündü\" zaman çizelgesinde `departman_agaci` çağrısını ve dönen sonucu gör; ağaçta Teknoloji altındaki 10 kişi birlikte vurgulanıyor mu?",
    kodYeri: "org_asistani/tools.py → departman_agaci",
  },
  {
    no: 3,
    baslik: "Tool zinciri ve üstten alta arama",
    kavram: "Çok adımlı function calling, hiyerarşik kapsam",
    benzetme:
      "🍽️ Şef, \"İrem nerede?\" sorusuna mutfağın kapısından başlayıp istasyon istasyon yürüyerek cevap verir. Ama sadece kendi mutfağında yürüyebilir, komşu restoranın mutfağına giremez.",
    teknik:
      "Model bir soruyu cevaplamak için arka arkaya birkaç araç çağırabilir: önce kişiyi bulur, sonra yolunu ya da zincirini ister. `altimda_bul` yolu giriş yapan kişiden başlayıp hedefe kadar yukarıdan aşağı döndürür; `raporlama_zinciri` ise çalışandan en üste doğru çıkar.",
    agent: "org_asistani",
    kullanici: "e02",
    ornekMesajlar: ["İrem'i bul", "Emre'nin zincirini göster"],
    nedeBak:
      "Ağaçta yol yukarıdan aşağı sırayla yanıyor mu? (Burak Demir → Elif Koç → İrem Doğan). İkinci mesajda zincir bu kez aşağıdan yukarı yanmalı: Emre Şahin → Selin Kaya → Burak Demir → Ayşe Yılmaz.",
    kodYeri: "org_asistani/tools.py → altimda_bul, raporlama_zinciri",
  },
  {
    no: 4,
    baslik: "State (oturum hafızası)",
    kavram: "Session state",
    benzetme:
      "🍽️ Masanın adisyonu: garson her gelişinde siparişi baştan sormaz, adisyona yazar ve oradan okur. Masa kalkana kadar adisyon durur.",
    teknik:
      "ADK her konuşma için bir session tutar; araçlar `tool_context.state` üzerinden bu oturuma bilgi yazıp okuyabilir. `talep_taslagi_olustur` taslağı `taslak_talep` anahtarına yazar, `taslagi_goster` aynı yerden okur. Model hatırlamak zorunda kalmaz, bilgi kodun tuttuğu yerde durur.",
    agent: "calisan_asistani",
    kullanici: "e04",
    ornekMesajlar: ["Cuma izin almak istiyorum", "Taslağımı göster"],
    nedeBak:
      "State sekmesinde `taslak_talep` anahtarı belirdi mi? İkinci mesajda ajan taslağı oradan okuyup aynısını gösteriyor mu?",
    kodYeri: "calisan_asistani/tools.py → talep_taslagi_olustur, taslagi_goster",
  },
  {
    no: 5,
    baslik: "Callback ile yetki",
    kavram: "before_tool_callback",
    benzetme:
      "🍽️ Kasayı açmak için müdürün anahtar kartı gerekir. Garson ne kadar ikna edici konuşursa konuşsun, kart yoksa kasa açılmaz; kararı konuşma değil kilit verir.",
    teknik:
      "`before_tool_callback` her araç çalışmadan hemen önce devreye giren bir Python fonksiyonudur. Burada giriş yapan kişinin kapsamını (kendisi + alt ağacı) kontrol eder; hedef kapsam dışındaysa aracı hiç çalıştırmadan `reddedildi` döner. Kritik kural modele bırakılmaz: arayüz gizler, kod engeller.",
    agent: "org_asistani",
    kullanici: "e03",
    ornekMesajlar: ["Kerem'i bul", "Emre'yi bul", "Satış'ta kaç kişi var?"],
    nedeBak:
      "Selin Kaya (Frontend Takım Lideri) olarak önce Satış'tan Kerem Yıldız'ı ara: kişi bulunur ama Selin'in alt ağacında olmadığı için ağaçta Kerem'in kutusu kırmızı titrer ve araç reddeder. Sonra kendi ekibinden Emre'yi ara: yol Selin → Emre yukarıdan aşağı yanar.",
    kodYeri: "org_asistani/guards.py → yetki_kontrolu",
  },
  {
    no: 6,
    baslik: "İnsan onayı",
    kavram: "Human-in-the-loop (require_confirmation)",
    benzetme:
      "🍽️ Hesap kapatılmadan önce müşterinin imzası alınır. Garson hazırlar, ama son sözü müşteri söyler.",
    teknik:
      "Geri alınması zor araçlar `require_confirmation=True` ile işaretlenir. Model `calisani_tasi` çağırmak istediğinde ADK durur ve arayüze bir onay isteği (`adk_request_confirmation`) gönderir; araç ancak sen \"Onayla\" dersen çalışır. Taşıma yalnızca bu oturumun ağacını değiştirir, gerçek veri değişmez.",
    agent: "org_asistani",
    kullanici: "e02",
    ornekMesajlar: [
      "Emre'yi yapay zeka ekibine taşı",
      "Emre'nin zincirini tekrar göster",
    ],
    nedeBak:
      "Onay kartı çıktı mı (kim, kimin altına)? Onayladıktan sonra Emre Şahin ağaçta Elif Koç'un altına kayıyor mu? Reddedersen hiçbir şey değişmemeli.",
    kodYeri: "org_asistani/tools.py → calisani_tasi",
  },
  {
    no: 7,
    baslik: "Agent → agent + onay akışı",
    kavram: "Araç içinde çalışan ajan, ağaçtan hesaplanan onaylayan",
    benzetme:
      "🍽️ Garson siparişi alır, şef onaylar, kasaya bilgi düşer. Garson şefi kendisi seçmez: o masanın şefi zaten bellidir. Müşteriye de mutfağın içini anlatmaz, sadece \"siparişiniz şefin onayında\" der.",
    teknik:
      "`talebi_gonder` çalışınca onaylayanı model seçmez; kod org tree'den hesaplar: çalışanın **doğrudan yöneticisi**. İzin dışı taleplerde aracın içinde ayrı bir triyaj ajanı (agent → agent) işi kimin üstleneceğini önerir; bu öneri çalışana dönmez (en az yetki). Yönetici `onayimi_bekleyenler` ile listeyi görür, `talebi_karara_bagla` ile (yine insan onayıyla) karar verir; onayda İK Müdürü'ne bilgi bildirimi düşer. Kararı sadece asıl onaylayan verebilir, başkası denerse `before_tool_callback` reddeder.",
    agent: "calisan_asistani",
    kullanici: "e07",
    ornekMesajlar: ["Gelecek cuma izin almak istiyorum", "Gönder"],
    nedeBak:
      "Gönderirken onay kartı çıkıyor mu? Gönderince ağaçta talep Deniz Çelik'ten Can Öztürk'e (e06) yukarı akmalı: onaylayanı ağaç belirledi. Sonra Yönetici Asistanı'na geç, giriş yapanı Can Öztürk (e06) yap ve \"Onayımı bekleyen talepler\" yaz (ya da 📥 Talepler sekmesinde Onayla'ya bas); kartı onaylayınca Can'da yeşil ✓ ve İK'ya kesikli \"bilgi\" çizgisi çıkmalı. Son olarak Hakan Kurt (e12, İK Müdürü) olarak \"Bildirimlerim\" yaz: kasaya bilgi düştü mü?",
    kodYeri: "calisan_asistani/tools.py → talebi_gonder · org_asistani/tools.py → talebi_karara_bagla",
  },
  {
    no: 8,
    baslik: "Fine-tuning (kodsuz ders)",
    kavram: "Fine-tuning ve ne zaman gerekmediği",
    benzetme:
      "🍽️ Fine-tuning, garsonu üç aylık bir kursa göndermektir. Pahalıdır ve yavaştır; menü cebindeyse ve kasada POS varsa çoğu zaman gerek kalmaz.",
    teknik:
      "Fine-tuning, modelin ağırlıklarını kendi örneklerinle yeniden eğitmektir; bilgi öğretmekten çok davranış (üslup, format, tutarlılık) kazandırmaya yarar. Sıra genelde şöyledir: önce prompt (persona), sonra tool/RAG ile doğru bilgiye erişim, sonra eval ile ölçmek, gerekirse birkaç örnek (few-shot), en son fine-tuning. Bu demoda gerekmedi: sorunlar bilgi sorunuydu ve org verisi sık değişiyor; ağaç değiştiğinde modeli yeniden eğitmek yerine araç güncel veriyi zaten okuyor. Dürüst not: eval henüz yazılmadı, yani \"gerekmedi\" kararı ölçüme değil gözleme dayanıyor.",
    agent: null,
    kullanici: null,
    ornekMesajlar: [],
    nedeBak:
      "Ekranda bir şey çalışmıyor; bunun yerine önceki derslere dön ve her sorunun hangi basamakta çözüldüğünü düşün: persona mı, araç mı, callback mi?",
  },
];

export const KAVRAMLAR: Kavram[] = [
  {
    terim: "LLM (büyük dil modeli)",
    benzetme:
      "🍽️ Çok şey bilen ama restoranı ilk gün gören yeni bir çalışan.",
    aciklama:
      "Metni okuyup sıradaki kelimeleri tahmin ederek cevap üreten model. Genel bilgisi geniştir ama senin şirketini, ağacını, kurallarını kendiliğinden bilmez.",
  },
  {
    terim: "Persona",
    benzetme: "🍽️ Üniforma ve görev tanımı.",
    aciklama:
      "Ajana kim olduğunu, ne yapıp ne yapmayacağını anlatan talimat metni (ADK'da `instruction`). Aynı model farklı persona ile farklı bir asistana dönüşür.",
  },
  {
    terim: "Tool (araç)",
    benzetme: "🍽️ Kasadaki POS cihazı.",
    aciklama:
      "Modelin çağırabildiği gerçek bir fonksiyon. Hesap, arama, kayıt gibi işleri kod yapar; model sadece hangi aracı hangi argümanla çağıracağına karar verir.",
  },
  {
    terim: "Function calling",
    benzetme:
      "🍽️ Garsonun POS'a doğru tuşlara basması: \"3 numaralı masa, 2 çorba\".",
    aciklama:
      "Modelin serbest metin yerine \"şu aracı şu argümanlarla çalıştır\" diye yapılandırılmış bir istek üretmesi. Araç çalışır, sonucu modele geri döner, model cevabı yazar.",
  },
  {
    terim: "Callback",
    benzetme: "🍽️ Kasayı açmak için gereken müdür kartı.",
    aciklama:
      "Ajanın ya da aracın çalışmasından önce veya sonra devreye giren kod. Yetki kontrolü gibi kritik kurallar burada yazılır, böylece modelin ikna edilmesiyle aşılamaz.",
  },
  {
    terim: "State",
    benzetme: "🍽️ Masanın adisyonu.",
    aciklama:
      "Bir oturum boyunca saklanan anahtar-değer bilgileri: giriş yapan kişi, güncel ağaç, taslak talep gibi. Araçlar okur ve yazar, arayüz de ağacı buradan çizer.",
  },
  {
    terim: "Session (oturum)",
    benzetme: "🍽️ Bir masanın oturduğu andan kalktığı ana kadarki ziyaret.",
    aciklama:
      "Bir kullanıcıyla yapılan konuşmanın tamamı: mesajlar, araç çağrıları ve state. Bu demoda oturumlar bellekte tutulur, sunucu kapanınca silinir.",
  },
  {
    terim: "İnsan onayı (HITL)",
    benzetme: "🍽️ Hesap kapanmadan önce müşterinin imzası.",
    aciklama:
      "Önemli bir işlem yapılmadan önce ajanın durup insandan \"evet\" beklemesi. ADK'da araca `require_confirmation=True` verilir; arayüz bir onay kartı gösterir.",
  },
  {
    terim: "Agent → agent",
    benzetme:
      "🍽️ Garsonun siparişi mutfağa iletmesi; mutfağın içini müşteriye anlatmaması.",
    aciklama:
      "Bir ajanın işin bir parçasını başka bir ajana yaptırması. Burada triyaj ajanı bir aracın içinde çalışır ve işi kimin üstleneceğini önerir; dışarıya sadece kodun seçtiği özet döner (en az yetki).",
  },
  {
    terim: "Onay akışı",
    benzetme: "🍽️ Garson siparişi alır, şef onaylar, kasaya bilgi düşer.",
    aciklama:
      "Talebin kimin onayına gideceği org tree'den hesaplanır (doğrudan yönetici); onaylanınca İK bilgilendirilir. Gerçek İK sistemlerinde de onaylayan elle seçilmez, kararı da sadece o kişi verebilir.",
  },
  {
    terim: "MCP",
    benzetme:
      "🍽️ Tedarikçi anlaşması: her tedarikçiyle ayrı ayrı pazarlık yerine standart bir sözleşme.",
    aciklama:
      "Model Context Protocol; araçları ve veri kaynaklarını ajanlara standart bir yolla bağlamak için açık bir protokol. Bu demoda kullanılmadı, araçlar doğrudan Python fonksiyonu.",
  },
  {
    terim: "RAG",
    benzetme: "🍽️ Garsonun cebindeki menü kartı.",
    aciklama:
      "Retrieval-Augmented Generation: cevap vermeden önce ilgili belgeleri bulup modele vermek. Model bilgiyi ezberlemez, her seferinde güncel kaynaktan okur.",
  },
  {
    terim: "Eval (değerlendirme)",
    benzetme: "🍽️ Gizli müşteri: habersiz gelip servisi puanlar.",
    aciklama:
      "Ajanı önceden hazırlanmış sorularla çalıştırıp doğru aracı çağırdı mı, doğru cevabı verdi mi diye ölçmek. Persona ya da model değişince bir şeyin bozulup bozulmadığını böyle anlarsın.",
  },
  {
    terim: "Fine-tuning",
    benzetme: "🍽️ Çalışanı üç aylık bir kursa göndermek.",
    aciklama:
      "Modeli kendi örneklerinle yeniden eğitmek. Davranış ve üslup için işe yarar; sık değişen bilgi için genelde yanlış araçtır. Prompt, tool ve eval denenmeden başvurulmaz.",
  },
  {
    terim: "Org tree / LCA",
    benzetme:
      "🍽️ Restoranın kadro şeması; iki çalışanın ortak amiri, ikisinin de bağlı olduğu en yakın şeftir.",
    aciklama:
      "Org tree, kimin kime bağlı olduğunu gösteren ağaç. LCA (en yakın ortak ata) iki kişinin ortak yöneticisini bulmanın adı; `ortak_yonetici` aracı bunu hesaplar.",
  },
];
