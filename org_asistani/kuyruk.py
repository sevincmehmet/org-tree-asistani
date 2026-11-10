"""İki asistanın ortak deposu: talepler + bildirimler (çalışan -> onaylayan yönetici -> İK).

Demo için basit bir JSON dosyası (proje kökünde talepler.json):
    {"talepler": [...], "bildirimler": [...]}
Gerçek sistemde bir veritabanı tablosu ya da mesaj kuyruğu olur.
Depo oturumlar arası ORTAKTIR: Deniz'in gönderdiği talebi Can kendi oturumunda görür.

Bir talebin yaşam döngüsü (bkz. CONTRACT.md v3):
    onay_bekliyor  -> çalışan gönderdi; onaylayan = ağaçtaki doğrudan yöneticisi
    onaylandi      -> onaylayan onayladı; İK (e12) + varsa yönlendirme hedefi bilgilendirildi
    reddedildi     -> onaylayan reddetti; talep sahibine gerekçeyle bildirildi

ADK'dan ve LLM'den bağımsızdır (saf depo mantığı, test edilebilir).
"""

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .debug import dur

DOSYA = Path(__file__).resolve().parent.parent / "talepler.json"
_kilit = threading.Lock()

TURLER = ("izin", "teknik_destek", "ekip_destegi", "ik")
KARARLAR = ("onay", "red")


def simdi() -> str:
    return datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%Y-%m-%d %H:%M")


def _oku() -> dict:
    """Depoyu okur. Eski (v2) düz liste biçimi uyumsuz olduğu için boş depo sayılır (ilk yazmada üzerine yazılır)."""
    if not DOSYA.exists():
        return {"talepler": [], "bildirimler": []}
    try:
        veri = json.loads(DOSYA.read_text("utf-8") or "{}")
    except json.JSONDecodeError:
        veri = {}
    if not isinstance(veri, dict):  # v2: düz talep listesi (onaylayan/geçmiş alanları yok)
        veri = {}
    return {"talepler": list(veri.get("talepler") or []), "bildirimler": list(veri.get("bildirimler") or [])}


def _yaz(veri: dict) -> None:
    """Önce geçici dosyaya yaz, sonra yer değiştir: yarım yazılmış dosya okunmaz."""
    gecici = DOSYA.with_name(DOSYA.name + ".tmp")
    gecici.write_text(json.dumps(veri, ensure_ascii=False, indent=2), "utf-8")
    os.replace(gecici, DOSYA)


def _bul(veri: dict, no) -> dict | None:
    try:
        no = int(no)
    except (TypeError, ValueError):
        return None
    return next((t for t in veri["talepler"] if t["no"] == no), None)


def _gecmis(talep: dict, olay: str, kisi_id: str | None) -> None:
    talep["gecmis"].append({"zaman": simdi(), "olay": olay, "kisi_id": kisi_id})


def _bildirim(veri: dict, alici: dict, talep_no: int, tur: str, mesaj: str) -> dict:
    kayit = {
        "no": max((b["no"] for b in veri["bildirimler"]), default=0) + 1,
        "zaman": simdi(),
        "alici": alici,
        "talep_no": talep_no,
        "tur": tur,
        "mesaj": mesaj[:500],
        "okundu": False,
    }
    veri["bildirimler"].append(kayit)
    return kayit


# ---------- Talepler ----------

def yeni_talep(sahip: dict, tur: str, aciklama: str, onaylayan: dict) -> dict:
    """Yeni talep ekler (durum onay_bekliyor, geçmiş: gonderildi). sahip/onaylayan: ortak `kisi` tipi."""
    with _kilit:
        veri = _oku()
        talep = {
            "no": max((t["no"] for t in veri["talepler"]), default=0) + 1,
            "zaman": simdi(),
            "sahip": sahip,
            "tur": tur,
            "aciklama": aciklama[:1000],
            "durum": "onay_bekliyor",
            "onaylayan": onaylayan,
            "karar": None,
            "yonlendirme": None,
            "bilgilendirilenler": [],
            "gecmis": [],
        }
        _gecmis(talep, "gonderildi", sahip["id"])
        veri["talepler"].append(talep)
        _yaz(veri)
        return talep


def getir(no) -> dict | None:
    return _bul(_oku(), no)


def listele(kosul=None) -> list[dict]:
    """Talepler, en yenisi önce. kosul(talep) -> bool verilirse süzer."""
    return [t for t in reversed(_oku()["talepler"]) if kosul is None or kosul(t)]


def yonlendirme_yaz(no, hedef: dict, gerekce: str) -> dict | None:
    """Triyajın önerisini (işi kim üstlenmeli) yazar ve geçmişe "triyaj" ekler."""
    with _kilit:
        veri = _oku()
        talep = _bul(veri, no)
        if talep is None:
            return None
        talep["yonlendirme"] = {"hedef": hedef, "gerekce": gerekce[:300]}
        _gecmis(talep, "triyaj", hedef["id"])
        _yaz(veri)
        return talep


def karara_bagla(no, karar: str, not_: str, veren: dict, ik: dict) -> dict | None:
    """Onay/red kararını yazar ve bildirimleri üretir. Tek kilit içinde: iki karar çakışamaz.

    onay -> durum onaylandi; bildirim: İK (bilgi) + varsa yönlendirme hedefi (bilgi) + sahip (onaylandi)
    red  -> durum reddedildi; bildirim: sahip (reddedildi, notla)
    Talep yoksa ya da artık onay beklemiyorsa None döner.
    """
    with _kilit:
        veri = _oku()
        talep = _bul(veri, no)
        if talep is None or talep["durum"] != "onay_bekliyor":
            return None
        if dur(9): breakpoint()  # 🔴 9: _kilit tutuluyor: aynı anda ikinci bir karar bu satıra giremez
        no, sahip = talep["no"], talep["sahip"]
        talep["karar"] = {"karar": karar, "not": not_[:500], "zaman": simdi(), "veren": veren}

        if karar == "red":
            talep["durum"] = "reddedildi"
            _gecmis(talep, "reddedildi", veren["id"])
            mesaj = f"#{no} numaralı talebiniz {veren['ad']} tarafından reddedildi."
            _bildirim(veri, sahip, no, "reddedildi", f"{mesaj} Gerekçe: {not_}" if not_ else mesaj)
        else:
            talep["durum"] = "onaylandi"
            _gecmis(talep, "onaylandi", veren["id"])
            ozet = f"#{no} ({talep['tur']}) {sahip['ad']}: {talep['aciklama'][:120]}"
            _bildirim(veri, ik, no, "bilgi", f"Onaylanan talep {ozet} (onaylayan: {veren['ad']})")
            _gecmis(talep, "ik_bilgilendirildi", ik["id"])
            bilgilendirilenler = [ik]
            hedef = (talep.get("yonlendirme") or {}).get("hedef")
            if hedef:
                # Aynı kişiye iki kez, kararı verene ya da talep sahibine "bilgi" gitmez
                if hedef["id"] not in {ik["id"], veren["id"], sahip["id"]}:
                    _bildirim(veri, hedef, no, "bilgi", f"Size yönlendirilen talep onaylandı: {ozet}")
                    bilgilendirilenler.append(hedef)
                _gecmis(talep, "yonlendirildi", hedef["id"])
            talep["bilgilendirilenler"] = bilgilendirilenler
            mesaj = f"#{no} numaralı talebiniz {veren['ad']} tarafından onaylandı."
            _bildirim(veri, sahip, no, "onaylandi", f"{mesaj} Not: {not_}" if not_ else mesaj)
        _yaz(veri)
        return talep


# ---------- Bildirimler ----------

def bildirim_ekle(alici: dict, talep_no: int, tur: str, mesaj: str) -> dict:
    with _kilit:
        veri = _oku()
        kayit = _bildirim(veri, alici, talep_no, tur, mesaj)
        _yaz(veri)
        return kayit


def bildirimler(alici_id: str) -> list[dict]:
    """Bir kişinin bildirimleri, en yenisi önce."""
    return [b for b in reversed(_oku()["bildirimler"]) if b["alici"]["id"] == alici_id]


def okundu_yap(alici_id: str) -> list[dict]:
    """Kişinin bildirimlerini okunmadan ÖNCEKİ hâliyle (en yenisi önce) döner, sonra hepsini okundu yapar."""
    with _kilit:
        veri = _oku()
        liste = [dict(b) for b in reversed(veri["bildirimler"]) if b["alici"]["id"] == alici_id]
        if any(not b["okundu"] for b in liste):
            for b in veri["bildirimler"]:
                if b["alici"]["id"] == alici_id:
                    b["okundu"] = True
            _yaz(veri)
        return liste
