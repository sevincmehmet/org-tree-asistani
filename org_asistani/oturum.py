"""Oturum (session state) yardımcıları. İki agent da kullanır.

State anahtarları (bkz. CONTRACT.md):
    aktif_kullanici_id  giriş yapan kişi
    tasimalar           {calisan_id: yeni_yonetici_id}, oturuma özel değişiklikler
    agac                arayüzün çizdiği ağaç (etkin ağacın düz listesi)
    talep_ozeti         aktif kullanıcının talep/bildirim özeti (arayüzün 📥 Talepler sekmesi)
    islem_gecmisi       bu oturumdaki yazma işlemleri (audit log), en yenisi SONDA (bkz. CONTRACT v4)
"""

from . import kuyruk, org
from .debug import dur
from .data import CALISANLAR


def aktif_kullanici(state) -> str:
    return state.get("aktif_kullanici_id") or ""


def kisiler(state) -> dict:
    """Bu oturumun etkin ağacı: temel veri + bu oturumdaki taşımalar."""
    return org.etkin_kisiler(state.get("tasimalar") or {})


def tasima_uygula(state, calisan_id: str, yeni_yonetici_id: str) -> dict:
    """Taşımayı state'e yazar ve yeni etkin ağacı döner (calisani_tasi ve islemi_geri_al ortak yolu).

    Kişi temel verideki asıl yöneticisine dönüyorsa `tasimalar`'dan anahtar SİLİNİR (gereksiz kayıt kalmaz).
    State'e YENİ bir sözlük yazılır (yerinde değiştirmek ADK'da stateDelta üretmez). `agac` da tazelenir.
    """
    if dur(6): breakpoint()  # 🔴 6: state'i YERİNDE değiştirmiyoruz, yeni dict yazıyoruz → ADK bunu stateDelta olarak arayüze yollar
    tasimalar = dict(state.get("tasimalar") or {})
    if CALISANLAR[calisan_id]["yonetici"] == yeni_yonetici_id:
        tasimalar.pop(calisan_id, None)
    else:
        tasimalar[calisan_id] = yeni_yonetici_id
    state["tasimalar"] = tasimalar
    yeni = kisiler(state)
    state["agac"] = org.agac_listesi(yeni)
    return yeni


# ---------- İşlem geçmişi (audit log) ----------

def islemleri(state) -> list[dict]:
    """Bu oturumun işlem geçmişi, en yenisi SONDA (state'teki sıra)."""
    return list(state.get("islem_gecmisi") or [])


def yeni_islem(gecmis: list[dict], tur: str, kisi: dict, eski_yonetici: dict | None, yeni_yonetici: dict,
               yapan: dict | None, hedef_no: int | None = None) -> dict:
    """Saf: geçmişe eklenecek bir sonraki kaydı üretir (no oturum içinde 1'den başlar)."""
    return {
        "no": max((i["no"] for i in gecmis), default=0) + 1,
        "zaman": kuyruk.simdi(),
        "tur": tur,
        "kisi": kisi,
        "eski_yonetici": eski_yonetici,
        "yeni_yonetici": yeni_yonetici,
        "yapan": yapan,
        "geri_alindi": False,
        "geri_alan_no": None,
        "hedef_no": hedef_no,
    }


def islem_ekle(state, tur: str, kisi: dict, eski_yonetici: dict | None, yeni_yonetici: dict,
               yapan: dict | None, hedef_no: int | None = None) -> dict:
    """Geçmişe yeni bir kayıt ekler (YENİ liste yazar) ve kaydı döner.

    hedef_no verilirse (geri alma), hedef kayıt geri_alindi=True ve geri_alan_no ile işaretlenir.
    """
    gecmis = islemleri(state)
    islem = yeni_islem(gecmis, tur, kisi, eski_yonetici, yeni_yonetici, yapan, hedef_no)
    if hedef_no is not None:
        gecmis = [
            {**i, "geri_alindi": True, "geri_alan_no": islem["no"]} if i["no"] == hedef_no else i for i in gecmis
        ]
    state["islem_gecmisi"] = [*gecmis, islem]
    return islem


def geri_alinacak_islem(state, islem_no: int = 0) -> dict | None:
    """Geri alınmak istenen kaydı bulur. 0 = geri alınmamış en son taşıma. Yoksa None.

    Numara verilirse kaydı olduğu gibi döner (türü/durumu tool kontrol eder).
    """
    gecmis = islemleri(state)
    if not islem_no:
        return next((i for i in reversed(gecmis) if i["tur"] == "tasima" and not i["geri_alindi"]), None)
    return next((i for i in gecmis if i["no"] == islem_no), None)


def sahip_gorunumu(talep: dict) -> dict:
    """Talep sahibine gösterilecek hali: triyajın iç kararı (işi kime yönlendirdiği) çıkarılır.

    Dar kapı ilkesi: garson, siparişi mutfakta hangi aşçının yaptığını müşteriye söylemez.
    Talep sahibi; durumu, onaylayanı, kararı ve İK'ya bilgi gittiğini görür, yönlendirme hedefini görmez.
    """
    t = dict(talep)
    t["yonlendirme"] = None
    t["bilgilendirilenler"] = [k for k in t.get("bilgilendirilenler", []) if k["id"] == org.IK_MUDURU]
    t["gecmis"] = [g for g in t.get("gecmis", []) if g["olay"] not in ("triyaj", "yonlendirildi")]
    return t


def talep_ozeti(aktif: str) -> dict:
    """Aktif kullanıcının gözünden ortak depo: gönderdikleri, onayını bekleyenler, bildirimleri."""
    return {
        "gonderdiklerim": [sahip_gorunumu(t) for t in kuyruk.listele(lambda t: t["sahip"]["id"] == aktif)],
        "onayimi_bekleyenler": kuyruk.listele(
            lambda t: t["onaylayan"]["id"] == aktif and t["durum"] == "onay_bekliyor"
        ),
        "bildirimler": kuyruk.bildirimler(aktif),
        "guncellendi": kuyruk.simdi(),
    }


def talep_ozetini_yaz(state) -> None:
    """state["talep_ozeti"]'ni tazeler; sadece değiştiyse yazar (dakika çözünürlüklü zaman dahil).

    Depo oturumlar arası ortak olduğu için özet ancak bir tur (ya da talep tool'u) çalışınca tazelenir.
    """
    ozet = talep_ozeti(aktif_kullanici(state))
    if state.get("talep_ozeti") != ozet:
        state["talep_ozeti"] = ozet


def hazirla(state, varsayilan_kullanici: str) -> None:
    """before_agent_callback'lerin ortak işi: varsayılan kullanıcı + güncel ağaç + talep özeti.

    Gerçek sistemde aktif kullanıcı login/JWT'den gelir. Burada arayüz session'ı oluştururken yazar.
    """
    if not state.get("aktif_kullanici_id"):
        state["aktif_kullanici_id"] = varsayilan_kullanici
    agac = org.agac_listesi(kisiler(state))
    if state.get("agac") != agac:  # sadece değiştiyse yaz (gereksiz stateDelta olmasın)
        state["agac"] = agac
    talep_ozetini_yaz(state)
