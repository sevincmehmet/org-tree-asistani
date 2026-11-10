"""Çalışan Asistanı'nın tool'ları.

Çalışan sadece KENDİ bilgisini ve kendi yöneticisini görür. Başka kimsenin bilgisini veren
bir tool yok: verilmeyen bilgi sızdırılamaz (en az yetki).
Talep önce state'te taslak olarak durur, kullanıcı onaylayınca ortak depoya gönderilir ve
doğrudan yöneticisinin onayına düşer (bkz. CONTRACT.md v3).
"""

from google.adk.tools import ToolContext

from org_asistani import kuyruk, org, oturum
from org_asistani.debug import dur


def ben_kimim(tool_context: ToolContext) -> dict:
    """Şu an konuşan çalışanın bilgisini ve doğrudan yöneticisini döner.

    Kullanıcı kendinden ya da yöneticisinden bahsettiğinde çağır.
    """
    kisiler = oturum.kisiler(tool_context.state)
    aktif = oturum.aktif_kullanici(tool_context.state)
    if aktif not in kisiler:
        return {"status": "bulunamadi", "mesaj": "Aktif kullanıcı bulunamadı."}
    yonetici = kisiler[aktif]["yonetici"]
    return {
        "status": "ok",
        "kullanici": org.ozet(aktif, kisiler),
        "yoneticim": org.ozet(yonetici, kisiler) if yonetici else None,
    }


def talep_taslagi_olustur(tur: str, aciklama: str, tool_context: ToolContext) -> dict:
    """Kullanıcının talebinden bir taslak hazırlar (henüz göndermez).

    Kullanıcı izin, destek ya da İK ile ilgili bir şey istediğinde çağır. Taslak değişirse tekrar çağır.

    Args:
        tur: "izin" (izin/tatil), "teknik_destek" (bilgisayar, erişim, araç, teknik sorun),
            "ekip_destegi" (bir projede başka ekipten yardım), "ik" (bordro, haklar, belge).
        aciklama: Talebin kısa, net özeti (ne, ne zaman, neden). Şifre gibi gizli bilgi yazma.
    """
    if tur not in kuyruk.TURLER:
        return {"status": "error", "mesaj": f"Tür şunlardan biri olmalı: {', '.join(kuyruk.TURLER)}."}
    if not aciklama.strip():
        return {"status": "error", "mesaj": "Açıklama boş olamaz."}
    taslak = {"tur": tur, "aciklama": aciklama.strip()[:1000]}
    tool_context.state["taslak_talep"] = taslak
    return {"status": "ok", "taslak": taslak}


def taslagi_goster(tool_context: ToolContext) -> dict:
    """Henüz gönderilmemiş talep taslağını gösterir. "Taslağımı göster" gibi isteklerde çağır."""
    taslak = tool_context.state.get("taslak_talep")
    if not taslak:
        return {"status": "bulunamadi", "taslak": None, "mesaj": "Henüz bir taslak yok."}
    return {"status": "ok", "taslak": taslak}


async def talebi_gonder(tool_context: ToolContext) -> dict:
    """Hazır taslağı onaya gönderir (yazma işlemi).

    Kullanıcı "gönder" deyince doğrudan çağır; sistem kullanıcıya onay kartı gösterir.
    Önce talep_taslagi_olustur ile bir taslak olmalı. Onaylayan, kullanıcının doğrudan yöneticisidir
    (ağaçtan hesaplanır). Yöneticisi olmayan Genel Müdür'ün talebi otomatik onaylanır.
    """
    # Yönetici tarafı ayrı bir paket; çalışan asistanı ona sadece bu dar kapıdan erişir.
    from org_asistani import triyaj

    state = tool_context.state
    taslak = state.get("taslak_talep")
    if not taslak:
        return {"status": "error", "mesaj": "Gönderilecek taslak yok. Önce talep_taslagi_olustur'u çağır."}
    kisiler = oturum.kisiler(state)
    aktif = oturum.aktif_kullanici(state)
    onaylayan_id = org.onaylayan_bul(aktif, kisiler)
    if onaylayan_id is None:
        return {"status": "error", "mesaj": "Aktif kullanıcı bulunamadı."}

    sahip, onaylayan = org.ozet(aktif, kisiler), org.ozet(onaylayan_id, kisiler)
    tur, aciklama = taslak["tur"], taslak["aciklama"]
    if dur(10): breakpoint()  # 🔴 10: onaylayan = org.onaylayan_bul → ağaçtan hesaplandı (model seçmedi)
    no = kuyruk.yeni_talep(sahip, tur, aciklama, onaylayan)["no"]

    # İzin dışı türlerde triyaj agent'ı işi kimin üstleneceğini önerir (agent'tan agent'a).
    if tur != "izin":
        try:
            guncel = await triyaj.triyaja_gonder(no)
        except Exception:  # noqa: BLE001 - triyaj başarısız olsa da talep kaydedildi
            guncel = None
        if not (guncel or {}).get("yonlendirme"):
            triyaj.kural_tabanli_yonlendirme(no)  # yedek plan: kural tabanlı yönlendirme

    if onaylayan_id == aktif:  # kök (Genel Müdür): üstü yok, kendi talebi otomatik onaylı
        kuyruk.karara_bagla(no, "onay", "Üst yönetici yok: otomatik onay.", onaylayan, org.ozet(org.IK_MUDURU, kisiler))
        durum = "onaylandi"
    else:
        kuyruk.bildirim_ekle(
            onaylayan, no, "onay_istegi",
            f"{sahip['ad']} #{no} numaralı {tur} talebi için onayınızı bekliyor: {aciklama[:120]}",
        )
        durum = "onay_bekliyor"

    state["taslak_talep"] = None
    state["gonderilen_talepler"] = [*(state.get("gonderilen_talepler") or []), no]
    oturum.talep_ozetini_yaz(state)

    # Dönecek alanları KOD seçiyor: triyajın önerdiği kişi ve gerekçesi çalışana dönmez.
    if dur(12): breakpoint()  # 🔴 12: kuyruk.getir(no)["yonlendirme"] dolu ama çalışana DÖNMÜYOR: dönüşü kod seçiyor
    return {"status": "ok", "talep_no": no, "onaylayan": onaylayan, "durum": durum}


def taleplerim(tool_context: ToolContext) -> dict:
    """Kullanıcının gönderdiği talepleri durumları ve geçmişleriyle (en yenisi önce) döner.

    "Taleplerim", "talebim ne oldu?", "onaylandı mı?" gibi isteklerde çağır.
    """
    aktif = oturum.aktif_kullanici(tool_context.state)
    talepler = kuyruk.listele(lambda t: t["sahip"]["id"] == aktif)
    # Dar kapı: triyajın kime yönlendirdiği talep sahibine gösterilmez
    return {"status": "ok", "talepler": [oturum.sahip_gorunumu(t) for t in talepler]}


def bildirimlerim(tool_context: ToolContext) -> dict:
    """Kullanıcıya gelen bildirimleri (onaylandı/reddedildi) en yenisi önce döner ve okundu yapar.

    "Bildirimlerim", "yeni bir şey var mı?" gibi isteklerde çağır.
    """
    state = tool_context.state
    liste = kuyruk.okundu_yap(oturum.aktif_kullanici(state))
    oturum.talep_ozetini_yaz(state)
    return {"status": "ok", "bildirimler": liste}
