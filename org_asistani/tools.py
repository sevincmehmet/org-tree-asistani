"""Yönetici Asistanı'nın tool'ları.

ADK, fonksiyon adını, docstring'i ve parametre tiplerini okuyup modele bir şema olarak gönderir.
Model hangi tool'u ne zaman çağıracağına bu açıklamalara bakarak karar verir.
Her tool `status` alanı olan bir dict döner: "ok" | "error" | "reddedildi" | "bulunamadi".

Ağaç her zaman OTURUMUN etkin ağacıdır (oturum.kisiler): global veri asla değişmez.
Yetki kuralları guards.py'deki before_tool_callback'te; burada sadece işin kendisi var.
"""

import json

from google.adk.tools import ToolContext

from . import kuyruk, org, oturum
from .debug import dur
from .data import DEPARTMANLAR


def _bulunamadi(neyi: str) -> dict:
    return {"status": "bulunamadi", "mesaj": f"{neyi} bulunamadı."}


def _eslesir(sorgu: str, c: dict) -> bool:
    s = org.normalize(sorgu)
    return (
        s in org.normalize(c["ad"])
        or s in org.normalize(c["unvan"])
        or s in org.normalize(DEPARTMANLAR[c["departman"]]["ad"])
    )


def ben_kimim(tool_context: ToolContext) -> dict:
    """Şu an konuşan (giriş yapmış) kullanıcının bilgilerini döner.

    Kullanıcı "ben", "benim ekibim", "yöneticim" gibi kendinden bahsettiğinde önce bunu çağır.
    """
    kisiler = oturum.kisiler(tool_context.state)
    aktif = oturum.aktif_kullanici(tool_context.state)
    if aktif not in kisiler:
        return _bulunamadi("Aktif kullanıcı")
    return {"status": "ok", "kullanici": org.ozet(aktif, kisiler)}


def calisan_ara(sorgu: str, tool_context: ToolContext) -> dict:
    """İsim, unvan ya da departman adına göre çalışan arar ve id'lerini verir.

    Diğer tool'lar çalışan id'si ister; id'yi bilmiyorsan önce bunu çağır.
    Sadece kullanıcının görebildiği kişiler döner. Göremediği kişiler hakkında hiçbir şey dönmez
    (sayısı bile); hiç görünür eşleşme yoksa sonuç "bulunamadi" olur.

    Args:
        sorgu: Aranacak metin. Örn. "Selin", "backend", "satış temsilcisi".
    """
    kisiler = oturum.kisiler(tool_context.state)
    gorunur = org.gorunur(oturum.aktif_kullanici(tool_context.state), kisiler)
    # Görünmeyenler hiç sayılmaz: "bulunamadı" ile "var ama gizli" aynı cevabı alır, yoksa varlık sızar.
    eslesenler = [cid for cid, c in kisiler.items() if _eslesir(sorgu, c) and cid in gorunur]
    if not eslesenler:
        return _bulunamadi(f"Görebildiğiniz alanda '{sorgu}' ile eşleşen çalışan")
    return {"status": "ok", "sonuclar": [org.ozet(cid, kisiler) for cid in eslesenler]}


def altimda_bul(sorgu: str, tool_context: ToolContext) -> dict:
    """Kullanıcının altındaki bir kişiyi bulur ve kullanıcıdan o kişiye inen yolu döner.

    "X'i bul", "X nerede?", "X'e nasıl ulaşırım?" gibi isteklerde bunu çağır.
    Yol kullanıcının kendisiyle başlar, hedefle biter. Hedef kullanıcının alt ağacında değilse reddedilir.

    Args:
        sorgu: Kişinin adı (ya da id'si). Örn. "İrem", "e11".
    """
    kisiler = oturum.kisiler(tool_context.state)
    aktif = oturum.aktif_kullanici(tool_context.state)
    kapsam = org.kapsam(aktif, kisiler)

    if sorgu.strip() in kisiler:
        adaylar = [sorgu.strip()]
    else:
        s = org.normalize(sorgu)
        adaylar = [cid for cid, c in kisiler.items() if s in org.normalize(c["ad"])]
        if not adaylar:  # isimde yoksa unvan/departmanda dene
            adaylar = [cid for cid, c in kisiler.items() if _eslesir(sorgu, c)]
    if not adaylar:
        return _bulunamadi(f"'{sorgu}' ile eşleşen çalışan")

    altimdakiler = [cid for cid in adaylar if cid in kapsam]
    if not altimdakiler:
        return {
            "status": "reddedildi",
            "mesaj": "Bu kişi sizin alt ekibinizde değil. Sadece kendi altınızdaki kişilere yol çizebilirsiniz.",
            "hedef_id": adaylar[0],
        }
    if len(altimdakiler) > 1:
        return {
            "status": "error",
            "mesaj": "Birden fazla kişi eşleşti. Hangisini kastettiğini kullanıcıya sor.",
            "adaylar": [org.ozet(cid, kisiler) for cid in altimdakiler],
        }

    hedef = altimdakiler[0]
    if dur(4): breakpoint()  # 🔴 4: adaylar → kapsam süzgeci → tek hedef; yolu MODEL değil org.asagi_yol hesaplayacak
    return {
        "status": "ok",
        "hedef": org.ozet(hedef, kisiler),
        "yol_yukaridan_asagi": [org.ozet(cid, kisiler) for cid in org.asagi_yol(aktif, hedef, kisiler)],
    }


def raporlama_zinciri(calisan_id: str, tool_context: ToolContext) -> dict:
    """Bir çalışanın yöneticisinden en tepeye (Genel Müdür) kadar raporlama zincirini döner.

    "X kime bağlı?", "X'in zincirini göster" gibi isteklerde kullan.

    Args:
        calisan_id: Çalışan id'si, örn. "e04".
    """
    kisiler = oturum.kisiler(tool_context.state)
    if calisan_id not in kisiler:
        return _bulunamadi("Çalışan")
    return {
        "status": "ok",
        "calisan": org.ozet(calisan_id, kisiler),
        "zincir_alttan_uste": [org.ozet(y, kisiler) for y in org.yukari_zincir(calisan_id, kisiler)],
    }


def ekibi_listele(yonetici_id: str, tool_context: ToolContext, dolayli_dahil: bool = False) -> dict:
    """Bir yöneticiye bağlı çalışanları listeler. "X'in ekibi", "ekibimde kimler var?" için kullan.

    Args:
        yonetici_id: Yöneticinin çalışan id'si.
        dolayli_dahil: False ise sadece doğrudan bağlı olanlar, True ise alt ekiplerdeki herkes.
    """
    kisiler = oturum.kisiler(tool_context.state)
    if yonetici_id not in kisiler:
        return _bulunamadi("Yönetici")
    ids = org.tum_alt_ekip(yonetici_id, kisiler) if dolayli_dahil else org.dogrudan_ekip(yonetici_id, kisiler)
    return {
        "status": "ok",
        "yonetici": org.ozet(yonetici_id, kisiler),
        "kisi_sayisi": len(ids),
        "ekip": [org.ozet(i, kisiler) for i in ids],
    }


def departman_agaci(tool_context: ToolContext, departman_id: str = "d-genel") -> dict:
    """Departman hiyerarşisini alt departmanları ve çalışan sayılarıyla iç içe döner.

    "X departmanında kaç kişi var?", "şirketin yapısı nasıl?" gibi sorular için kullan.
    Kullanıcının göremediği biri olan departmanlarda sayı ve id yerine kisiler_gizli=True döner.

    Args:
        departman_id: Başlangıç departmanı. Tüm şirket için "d-genel".
            Geçerli id'ler: d-genel, d-tek (Teknoloji), d-fe (Frontend), d-be (Backend),
            d-ai (Veri ve Yapay Zeka), d-ik (İnsan Kaynakları), d-satis (Satış),
            d-kurumsal (Kurumsal Satış), d-bireysel (Bireysel Satış).
    """
    if departman_id not in DEPARTMANLAR:
        return _bulunamadi("Departman")
    kisiler = oturum.kisiler(tool_context.state)
    gorunur = org.gorunur(oturum.aktif_kullanici(tool_context.state), kisiler)
    agac = org.departman_dugumu(departman_id, kisiler, gorunur)
    if "kisiler_gizli" not in json.dumps(agac):
        return {"status": "ok", "agac": agac}
    # Sadece sayıyı saklamak yetmedi: eval'de model gizli toplamı tahmin edip uydurdu ("18", "16").
    return {
        "status": "ok",
        "agac": agac,
        "uyari": "kisiler_gizli olan departmanların kişi sayısını BİLMİYORSUN. Toplam ya da tahmini sayı "
        "söyleme, alt departmanları toplayarak da hesaplama. Sadece toplam_calisan yazan sayıları söyleyebilirsin.",
    }


def ortak_yonetici(calisan_id_1: str, calisan_id_2: str, tool_context: ToolContext) -> dict:
    """İki çalışanın en yakın ortak yöneticisini bulur (ağaçtaki en yakın ortak ata).

    "X ile Y arasında sorun olursa kime gider?" gibi sorular için kullan.
    """
    kisiler = oturum.kisiler(tool_context.state)
    for cid in (calisan_id_1, calisan_id_2):
        if cid not in kisiler:
            return _bulunamadi(f"Çalışan {cid}")
    ortak = org.ortak_yonetici(calisan_id_1, calisan_id_2, kisiler)
    return {
        "status": "ok",
        "kisiler": [org.ozet(calisan_id_1, kisiler), org.ozet(calisan_id_2, kisiler)],
        "ortak_yonetici": org.ozet(ortak, kisiler),
    }


def calisani_tasi(calisan_id: str, yeni_yonetici_id: str, tool_context: ToolContext) -> dict:
    """Bir çalışanı yeni bir yöneticinin altına taşır (yazma işlemi, sadece bu oturumda geçerli).

    Kullanıcı taşıma isteyince doğrudan çağır. Sistem kullanıcıya onay kartı gösterir;
    kullanıcı onaylamadan taşıma yapılmaz.

    Args:
        calisan_id: Taşınacak çalışanın id'si.
        yeni_yonetici_id: Yeni yöneticinin id'si.
    """
    state = tool_context.state
    kisiler = oturum.kisiler(state)
    for cid in (calisan_id, yeni_yonetici_id):
        if cid not in kisiler:
            return _bulunamadi(f"Çalışan {cid}")
    if org.altinda_mi(yeni_yonetici_id, calisan_id, kisiler):
        return {
            "status": "error",
            "mesaj": "Döngü oluşur: bir kişi kendisinin ya da kendi alt ekibindeki birinin altına taşınamaz.",
        }
    eski = kisiler[calisan_id]["yonetici"]
    if dur(5): breakpoint()  # 🔴 5: buraya geldiysen kullanıcı onay kartında "Onayla" dedi (yetki 2. durakta geçti)
    if eski == yeni_yonetici_id:
        return {"status": "error", "mesaj": "Bu kişi zaten bu yöneticiye bağlı."}

    kisiler = oturum.tasima_uygula(state, calisan_id, yeni_yonetici_id)
    sonuc = {
        "status": "ok",
        "calisan": org.ozet(calisan_id, kisiler),
        "eski_yonetici": org.ozet(eski, kisiler) if eski else None,
        "yeni_yonetici": org.ozet(yeni_yonetici_id, kisiler),
    }
    aktif = oturum.aktif_kullanici(state)
    oturum.islem_ekle(
        state, "tasima", sonuc["calisan"], sonuc["eski_yonetici"], sonuc["yeni_yonetici"],
        org.ozet(aktif, kisiler) if aktif in kisiler else None,
    )
    return sonuc


def islem_gecmisi(tool_context: ToolContext) -> dict:
    """Bu oturumda yapılan değişikliklerin (taşımalar ve geri almalar) kaydını en yenisi önce döner.

    "Ne değişti?", "geçmiş", "bugün kimi taşıdık?", "hangi işlemler yapıldı?" gibi sorularda çağır.
    Her kaydın numarası (no) vardır; belirli bir işlemi geri almak için islemi_geri_al'a bu numara verilir.
    """
    return {"status": "ok", "islemler": list(reversed(oturum.islemleri(tool_context.state)))}


def islemi_geri_al(tool_context: ToolContext, islem_no: int = 0) -> dict:
    """Daha önce yapılmış bir taşımayı geri alır: kişiyi o işlemdeki eski yöneticisine döndürür (yazma işlemi).

    Kullanıcı "geri al", "vazgeçtim", "son işlemi iptal et" deyince doğrudan çağır; ters taşımayı
    calisani_tasi ile elle kurma. Sistem kullanıcıya onay kartı gösterir.
    Kişi o işlemden sonra tekrar taşındıysa geri alma yapılmaz (hata döner).

    Args:
        islem_no: Geri alınacak işlemin numarası (islem_gecmisi'ndeki no). Verilmezse 0:
            geri alınmamış en son taşıma.
    """
    state = tool_context.state
    hedef = oturum.geri_alinacak_islem(state, islem_no)
    if dur(7): breakpoint()  # 🔴 7: hedef = state["islem_gecmisi"]'nden KODLA bulunan kayıt (modelin hafızası değil)
    if hedef is None:
        if islem_no:
            return _bulunamadi(f"#{islem_no} numaralı işlem")
        return {"status": "error", "mesaj": "Geri alınacak bir taşıma yok."}
    if hedef["tur"] != "tasima":
        return {"status": "error", "mesaj": f"#{hedef['no']} bir taşıma değil; sadece taşımalar geri alınabilir."}
    if hedef["geri_alindi"]:
        return {
            "status": "error",
            "mesaj": f"#{hedef['no']} numaralı işlem zaten geri alınmış (#{hedef['geri_alan_no']} ile).",
        }
    if not hedef["eski_yonetici"]:
        return {"status": "error", "mesaj": "Bu işlemde eski yönetici yok; geri alınamaz."}

    kisiler = oturum.kisiler(state)
    calisan_id, eski_id = hedef["kisi"]["id"], hedef["eski_yonetici"]["id"]
    simdiki = kisiler[calisan_id]["yonetici"]
    if simdiki != hedef["yeni_yonetici"]["id"]:
        return {
            "status": "error",
            "mesaj": f"#{hedef['no']} geri alınamaz: kişinin yöneticisi o işlemden sonra sonradan değişmiş.",
        }
    if org.altinda_mi(eski_id, calisan_id, kisiler):
        return {
            "status": "error",
            "mesaj": "Döngü oluşur: eski yönetici artık bu kişinin alt ekibinde; geri alma yapılamaz.",
        }

    kisiler = oturum.tasima_uygula(state, calisan_id, eski_id)
    aktif = oturum.aktif_kullanici(state)
    islem = oturum.islem_ekle(
        state, "geri_alma", org.ozet(calisan_id, kisiler), org.ozet(simdiki, kisiler), org.ozet(eski_id, kisiler),
        org.ozet(aktif, kisiler) if aktif in kisiler else None, hedef_no=hedef["no"],
    )
    geri_alinan = next(i for i in oturum.islemleri(state) if i["no"] == hedef["no"])
    return {"status": "ok", "islem": islem, "geri_alinan": geri_alinan}


def onayimi_bekleyenler(tool_context: ToolContext) -> dict:
    """Kullanıcının onayını bekleyen talepleri (en yenisi önce) listeler.

    "Onayımı bekleyenler", "bekleyen talepler", "onaylamam gereken ne var?" gibi isteklerde çağır.
    Onaylayan ağaçtan hesaplanır: sadece kullanıcının DOĞRUDAN ekibinden gelen talepler düşer.
    """
    aktif = oturum.aktif_kullanici(tool_context.state)
    talepler = kuyruk.listele(lambda t: t["onaylayan"]["id"] == aktif and t["durum"] == "onay_bekliyor")
    return {"status": "ok", "talepler": talepler}


def talebi_karara_bagla(talep_no: int, karar: str, tool_context: ToolContext, not_: str = "") -> dict:
    """Onayını bekleyen bir talebi onaylar ya da reddeder (yazma işlemi).

    Kullanıcı "onayla" / "reddet" deyince doğrudan çağır; sistem onay kartı gösterir.
    Onaylanınca İK Müdürü ve (varsa) işi üstlenecek kişi bilgilendirilir; talep sahibine bildirim gider.

    Args:
        talep_no: Talep numarası.
        karar: "onay" ya da "red".
        not_: Kısa not. Redde gerekçe olarak talep sahibine iletilir.
    """
    if dur(8): breakpoint()  # 🔴 8: talep_no, karar, not_ = modelin argümanları; onaylayan kontrolü 2. durakta yapıldı
    if karar not in kuyruk.KARARLAR:
        return {"status": "error", "mesaj": 'karar "onay" ya da "red" olmalı.'}
    state = tool_context.state
    kisiler = oturum.kisiler(state)
    aktif = oturum.aktif_kullanici(state)
    if aktif not in kisiler:
        return _bulunamadi("Aktif kullanıcı")
    talep = kuyruk.karara_bagla(
        talep_no, karar, (not_ or "").strip(), org.ozet(aktif, kisiler), org.ozet(org.IK_MUDURU, kisiler)
    )
    if talep is None:  # yetki callback'ten geçtikten sonra başka biri karar vermiş olabilir
        return {"status": "error", "mesaj": f"#{talep_no} numaralı talep artık onay beklemiyor."}
    oturum.talep_ozetini_yaz(state)
    return {"status": "ok", "talep": talep}


def bildirimlerim(tool_context: ToolContext) -> dict:
    """Kullanıcıya gelen bildirimleri (onay istekleri, bilgi, sonuçlar) en yenisi önce döner ve okundu yapar.

    "Bildirimlerim", "yeni bir şey var mı?" gibi isteklerde çağır. İK Müdürü onaylanan talepleri buradan görür.
    """
    state = tool_context.state
    liste = kuyruk.okundu_yap(oturum.aktif_kullanici(state))
    oturum.talep_ozetini_yaz(state)
    return {"status": "ok", "bildirimler": liste}


def ekibimin_talepleri(tool_context: ToolContext) -> dict:
    """Kullanıcının kendisi ve bütün alt ekibinin talepleri, tüm durumlarıyla (en yenisi önce).

    "Ekibimin talepleri", "ekibimde kim izin aldı?" gibi isteklerde çağır.
    """
    state = tool_context.state
    kapsam = org.kapsam(oturum.aktif_kullanici(state), oturum.kisiler(state))
    return {"status": "ok", "talepler": kuyruk.listele(lambda t: t["sahip"]["id"] in kapsam)}
