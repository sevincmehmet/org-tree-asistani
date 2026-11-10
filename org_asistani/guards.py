"""Callback'ler: agent ve tool'lar çalışmadan önce devreye giren kontrol noktaları.

Yetki kontrolü modele bırakılmıyor. Model kuralı unutsa bile callback tool'u
çalıştırmadan engelliyor. "Arayüz gizler, kod engeller."

Kapsam kuralı (bkz. CONTRACT.md):
    kapsam  = aktif kullanıcı + bütün alt ağacı       (üzerinde işlem yapabilir)
    görünür = kapsam + kendi yukarı zinciri            (kendi yöneticilerini bilir)

Sıra: önce before_tool_callback çalışır; geçerse onaylı tool'larda ADK kullanıcıya
onay kartı gösterir (require_confirmation); kullanıcı onaylarsa tool çalışır.
"""

import os
from typing import Any, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext

from . import kuyruk, org, oturum
from .debug import dur

VARSAYILAN_KULLANICI = os.getenv("DEMO_KULLANICI", "e02")  # Teknoloji Direktörü


def oturumu_hazirla(callback_context: CallbackContext) -> None:
    """before_agent_callback: her turda varsayılan kullanıcıyı, güncel ağacı ve talep özetini state'e yazar."""
    if dur(1): breakpoint()  # 🔴 1: state = callback_context.state (model henüz hiçbir şey görmedi)
    oturum.hazirla(callback_context.state, VARSAYILAN_KULLANICI)
    return None


def _reddet(mesaj: str, hedef_id: str | None = None) -> dict:
    if dur(3): breakpoint()  # 🔴 3: REDDEDİLDİ. Call Stack'te bir üst satır = hangi kural; tool hiç çalışmayacak
    return {"status": "reddedildi", "mesaj": mesaj, "hedef_id": hedef_id}


def yetki_kontrolu(tool: BaseTool, args: dict[str, Any], tool_context: ToolContext) -> Optional[dict]:
    """before_tool_callback. dict dönerse tool hiç çalışmaz, model bu dict'i sonuç olarak görür.

    Var olmayan id'ler burada engellenmez; tool kendisi "bulunamadi" döner.
    """
    kisiler = oturum.kisiler(tool_context.state)
    aktif = oturum.aktif_kullanici(tool_context.state)
    kapsam = org.kapsam(aktif, kisiler)
    gorunur = org.gorunur(aktif, kisiler)
    if dur(2): breakpoint()  # 🔴 2: tool.name + args = modelin kararı; aktif, kapsam, gorunur = kodun kuralı

    def disarida(cid: str, kume: set[str]) -> bool:
        return cid in kisiler and cid not in kume

    if tool.name == "ekibi_listele":
        hedef = args.get("yonetici_id", "")
        if disarida(hedef, kapsam):
            return _reddet("Sadece kendi ekibinizin ve alt ekiplerinizin listesini görebilirsiniz.", hedef)

    elif tool.name == "raporlama_zinciri":
        hedef = args.get("calisan_id", "")
        if disarida(hedef, gorunur):
            return _reddet("Bu kişi sizin görebildiğiniz alanda değil (alt ekibiniz ya da kendi yöneticileriniz).", hedef)

    elif tool.name == "ortak_yonetici":
        for hedef in (args.get("calisan_id_1", ""), args.get("calisan_id_2", "")):
            if disarida(hedef, kapsam):
                return _reddet("Ortak yönetici sadece kendi alt ekibinizdeki kişiler için sorulabilir.", hedef)

    elif tool.name == "calisani_tasi":
        calisan, yeni = args.get("calisan_id", ""), args.get("yeni_yonetici_id", "")
        if calisan == aktif:
            return _reddet("Kendinizi taşıyamazsınız; bunu sizin yöneticiniz yapabilir.", calisan)
        for hedef in (calisan, yeni):
            if disarida(hedef, kapsam):
                return _reddet(
                    "Sadece kendi alt ekibinizdeki kişileri, yine kendi alt ekibinizdeki birinin altına taşıyabilirsiniz.",
                    hedef,
                )

    elif tool.name == "islemi_geri_al":
        # Hedef kayıt state'ten çözülür (0 = geri alınmamış en son taşıma). Yoksa tool hatayı kendisi döner.
        try:
            islem_no = int(args.get("islem_no") or 0)
        except (TypeError, ValueError):
            islem_no = 0
        islem = oturum.geri_alinacak_islem(tool_context.state, islem_no)
        if islem is not None:
            for kisi in (islem.get("kisi"), islem.get("eski_yonetici")):
                if kisi and disarida(kisi["id"], kapsam):
                    return _reddet(
                        "Sadece kendi alt ekibinizdeki kişilerle ilgili taşımaları geri alabilirsiniz.", kisi["id"]
                    )

    elif tool.name == "talebi_karara_bagla":
        # Kararı sadece talebin onaylayanı verebilir (onaylayan, gönderilirken ağaçtan hesaplandı).
        talep = kuyruk.getir(args.get("talep_no", -1))
        if talep is None:
            return {"status": "bulunamadi", "mesaj": "Böyle bir talep yok."}
        onaylayan = talep["onaylayan"]
        if aktif != onaylayan["id"]:
            return _reddet(f"Bu talebi sadece onaylayanı ({onaylayan['ad']}) karara bağlayabilir.", onaylayan["id"])
        if talep["durum"] != "onay_bekliyor":
            return _reddet(f"Bu talep onay beklemiyor (durum: {talep['durum']}).", onaylayan["id"])

    return None  # None = engel yok, tool normal çalışsın
