"""Ağaç üzerinde çalışan saf yardımcı fonksiyonlar (LLM'den ve ADK'dan bağımsız, test edilebilir).

Önemli: Fonksiyonlar global veriye değil, parametre olarak gelen `kisiler` sözlüğüne bakar.
`kisiler` = oturumun "etkin ağacı": temel veri + o oturumdaki taşımalar (bkz. etkin_kisiler).
Böylece bir oturumda yapılan taşıma başka oturumları ve global veriyi asla etkilemez.
"""

from .data import CALISANLAR, DEPARTMANLAR


def normalize(metin: str) -> str:
    """Türkçe karakter duyarlı küçük harfe çevirme (İ -> i, I -> ı)."""
    return metin.replace("İ", "i").replace("I", "ı").lower().strip()


# ---------- Oturuma özel ağaç ----------

def etkin_kisiler(tasimalar: dict | None = None) -> dict:
    """Temel verinin KOPYASINA oturumdaki taşımaları uygular ve yeni sözlüğü döner.

    tasimalar: {calisan_id: yeni_yonetici_id}. Taşınan kişi yeni yöneticisinin departmanına geçer.
    Global CALISANLAR hiç değişmez.
    """
    kisiler = {cid: dict(c) for cid, c in CALISANLAR.items()}
    for cid, yeni in (tasimalar or {}).items():
        if cid in kisiler and yeni in kisiler:
            kisiler[cid]["yonetici"] = yeni
            kisiler[cid]["departman"] = kisiler[yeni]["departman"]
    return kisiler


def agac_listesi(kisiler: dict) -> list[dict]:
    """Arayüzün ağacı çizdiği düz liste (state["agac"])."""
    return [
        {
            "id": cid,
            "ad": c["ad"],
            "unvan": c["unvan"],
            "departman_id": c["departman"],
            "departman": DEPARTMANLAR[c["departman"]]["ad"],
            "yonetici": c["yonetici"],
        }
        for cid, c in kisiler.items()
    ]


def ozet(calisan_id: str, kisiler: dict) -> dict:
    """Ortak `kisi` tipi: {id, ad, unvan, departman}."""
    c = kisiler[calisan_id]
    return {
        "id": calisan_id,
        "ad": c["ad"],
        "unvan": c["unvan"],
        "departman": DEPARTMANLAR[c["departman"]]["ad"],
    }


# ---------- Ağaç algoritmaları ----------

def dogrudan_ekip(yonetici_id: str, kisiler: dict) -> list[str]:
    return [cid for cid, c in kisiler.items() if c["yonetici"] == yonetici_id]


def tum_alt_ekip(yonetici_id: str, kisiler: dict) -> list[str]:
    """Doğrudan ve dolaylı bağlı herkes (DFS, yığın ile)."""
    sonuc, yigin = [], dogrudan_ekip(yonetici_id, kisiler)
    while yigin:
        cid = yigin.pop()
        sonuc.append(cid)
        yigin.extend(dogrudan_ekip(cid, kisiler))
    return sonuc


def yukari_zincir(calisan_id: str, kisiler: dict) -> list[str]:
    """Çalışandan en tepeye kadar yöneticiler (çalışanın kendisi hariç)."""
    zincir, simdiki = [], kisiler[calisan_id]["yonetici"]
    while simdiki is not None:
        zincir.append(simdiki)
        simdiki = kisiler[simdiki]["yonetici"]
    return zincir


def altinda_mi(calisan_id: str, yonetici_id: str, kisiler: dict) -> bool:
    """calisan_id, yonetici_id'nin kendisi ya da alt ağacında mı?"""
    return calisan_id == yonetici_id or yonetici_id in yukari_zincir(calisan_id, kisiler)


def ortak_yonetici(id_1: str, id_2: str, kisiler: dict) -> str:
    """En yakın ortak ata (LCA): 1. kişinin üstlerinden, 2. kişinin üstlerinde de olan ilk kişi."""
    ustler_1 = [id_1, *yukari_zincir(id_1, kisiler)]
    ustler_2 = {id_2, *yukari_zincir(id_2, kisiler)}
    return next(u for u in ustler_1 if u in ustler_2)


def asagi_yol(ust_id: str, alt_id: str, kisiler: dict) -> list[str]:
    """Üstten alta yol: [ust_id, ..., alt_id]. alt_id, ust_id'nin altında değilse boş liste."""
    if not altinda_mi(alt_id, ust_id, kisiler):
        return []
    yol = [alt_id]
    while yol[-1] != ust_id:
        yol.append(kisiler[yol[-1]]["yonetici"])
    return list(reversed(yol))


# ---------- Kapsam (yetki) ----------

def kapsam(aktif_id: str, kisiler: dict) -> set[str]:
    """Aktif kullanıcı + bütün alt ağacı. Bu kişiler üzerinde işlem yapabilir."""
    if aktif_id not in kisiler:
        return set()
    return {aktif_id, *tum_alt_ekip(aktif_id, kisiler)}


def gorunur(aktif_id: str, kisiler: dict) -> set[str]:
    """Kapsam + kendi yukarı zinciri (herkes kendi yöneticilerini bilir)."""
    if aktif_id not in kisiler:
        return set()
    return kapsam(aktif_id, kisiler) | set(yukari_zincir(aktif_id, kisiler))


# ---------- Onay akışı ----------

IK_MUDURU = "e12"  # onaylanan her talep İK Müdürü'ne bilgi olarak gider


def onaylayan_bul(kisi_id: str, kisiler: dict) -> str | None:
    """Talebi onaylayacak kişi: talep sahibinin DOĞRUDAN yöneticisi (oturumun etkin ağacından).

    Onaylayan elle seçilmez, ağaçtan hesaplanır (line manager onayı). Yöneticisi olmayan kök
    (e01 Genel Müdür) kendi talebini kendisi onaylar: talep gönderildiği anda otomatik onaylı sayılır.
    Kişi ağaçta yoksa None.
    """
    if kisi_id not in kisiler:
        return None
    return kisiler[kisi_id]["yonetici"] or kisi_id


# ---------- Departmanlar ----------

def alt_departmanlar(departman_id: str) -> list[str]:
    return [did for did, d in DEPARTMANLAR.items() if d["ust"] == departman_id]


def departman_kisileri(departman_id: str, kisiler: dict) -> list[str]:
    """Departmandaki ve alt departmanlarındaki herkesin id'si."""
    ids = [cid for cid, c in kisiler.items() if c["departman"] == departman_id]
    for alt in alt_departmanlar(departman_id):
        ids.extend(departman_kisileri(alt, kisiler))
    return ids


def departman_dugumu(departman_id: str, kisiler: dict, gorunur: set[str] | None = None) -> dict:
    """Departmanı alt departmanlarıyla iç içe bir sözlük olarak döner (özyinelemeli).

    gorunur verilirse, içinde göremediği biri olan departmanın kişi sayısı ve id'leri
    hiç dönmez (kisiler_gizli=True). Sayı da bilgi sızdırır; yapı (departman adları) açık kalır.
    """
    ids = departman_kisileri(departman_id, kisiler)
    altlar = [departman_dugumu(a, kisiler, gorunur) for a in alt_departmanlar(departman_id)]
    dugum = {"id": departman_id, "ad": DEPARTMANLAR[departman_id]["ad"]}
    if gorunur is not None and not set(ids) <= gorunur:
        return {**dugum, "kisiler_gizli": True, "alt_departmanlar": altlar}
    return {**dugum, "toplam_calisan": len(ids), "kisi_idleri": ids, "alt_departmanlar": altlar}
