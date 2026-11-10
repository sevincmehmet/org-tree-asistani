"""Algoritmaları, tool'ları, yetki kurallarını ve onay kapısını LLM'SİZ test eder.

Çalıştır (proje kökünden):  ../jollin-asistani/.venv/bin/python test_tools.py
Hiçbir test modele istek göndermez: triyaj agent'ı bile sahte (stub) bir fonksiyonla değiştirilir.
"""

import asyncio
import copy
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace

from google.adk.tools.tool_confirmation import ToolConfirmation

from org_asistani import kuyruk, org, oturum, triyaj
from org_asistani import tools as y  # yönetici tool'ları
from org_asistani.agent import root_agent as yonetici_agent
from org_asistani.data import CALISANLAR
from org_asistani.guards import oturumu_hazirla, yetki_kontrolu
from calisan_asistani import tools as c  # çalışan tool'ları
from calisan_asistani.agent import root_agent as calisan_agent

ILK_VERI = copy.deepcopy(CALISANLAR)
K = CALISANLAR  # temel ağaç (algoritma testleri için)

# Testler gerçek talepler.json'a dokunmasın: geçici dosya
kuyruk.DOSYA = Path(tempfile.mkdtemp()) / "talepler.json"


def ctx(kullanici: str, **state):
    """ToolContext/CallbackContext yerine geçen sahte nesne: sadece `state` sözlüğü var."""
    return SimpleNamespace(state={"aktif_kullanici_id": kullanici, **state})


def tool(ad: str):
    return SimpleNamespace(name=ad)


def ids(kisi_listesi):
    return [k["id"] for k in kisi_listesi]


def reddedildi(sonuc, hedef_id="__herhangi"):
    assert sonuc is not None and sonuc["status"] == "reddedildi", sonuc
    assert hedef_id == "__herhangi" or sonuc["hedef_id"] == hedef_id, sonuc
    return True


# ---------------- 1) Saf algoritmalar ----------------
assert org.yukari_zincir("e04", K) == ["e03", "e02", "e01"]
assert len(org.tum_alt_ekip("e02", K)) == 9  # DFS
assert org.ortak_yonetici("e04", "e10", K) == "e02"  # LCA
assert org.ortak_yonetici("e04", "e18", K) == "e01"
assert org.ortak_yonetici("e03", "e04", K) == "e03"
assert org.asagi_yol("e02", "e11", K) == ["e02", "e09", "e11"]
assert org.asagi_yol("e03", "e11", K) == []
assert org.asagi_yol("e04", "e04", K) == ["e04"]
assert org.kapsam("e03", K) == {"e03", "e04", "e05"}
assert org.gorunur("e03", K) == {"e03", "e04", "e05", "e02", "e01"}
agac = org.departman_dugumu("d-genel", K)
assert agac["toplam_calisan"] == 18 and len(agac["kisi_idleri"]) == 18
assert {d["ad"]: d["toplam_calisan"] for d in agac["alt_departmanlar"]}["Teknoloji"] == 10

# ---------------- 2) Yönetici tool'ları ----------------
s = y.calisan_ara("İREM", ctx("e02"))
assert ids(s["sonuclar"]) == ["e11"]
# Selin (e03) Backend'cileri göremez: sayıları bile dönmez, cevap "bulunamadı" ile aynı
s = y.calisan_ara("backend", ctx("e03"))
assert s["status"] == "bulunamadi" and "gizlenen_sayisi" not in s, s
assert y.calisan_ara("yokböylebiri", ctx("e02"))["status"] == "bulunamadi"

s = y.altimda_bul("İrem", ctx("e02"))
assert s["status"] == "ok" and ids(s["yol_yukaridan_asagi"]) == ["e02", "e09", "e11"]
reddedildi(y.altimda_bul("İrem", ctx("e03")), "e11")  # Selin'in altında değil

assert ids(y.raporlama_zinciri("e04", ctx("e02"))["zincir_alttan_uste"]) == ["e03", "e02", "e01"]
assert y.ekibi_listele("e02", ctx("e02"))["kisi_sayisi"] == 3
assert y.ekibi_listele("e02", ctx("e02"), dolayli_dahil=True)["kisi_sayisi"] == 9
o = y.ortak_yonetici("e04", "e10", ctx("e02"))
assert ids(o["kisiler"]) == ["e04", "e10"] and o["ortak_yonetici"]["id"] == "e02"
# Burak (e02) kendi Teknoloji'sini sayıyla görür; Satış'ı ve tüm şirketi sayısız
assert y.departman_agaci(ctx("e02"), "d-tek")["agac"]["toplam_calisan"] == 10
assert y.departman_agaci(ctx("e02"))["agac"]["kisiler_gizli"] is True
# Selin (e03): Satış'ın ne sayısı ne id'leri döner (alt departmanlar dahil)
satis = json.dumps(y.departman_agaci(ctx("e03"), "d-satis")["agac"])
assert "toplam_calisan" not in satis and "kisi_idleri" not in satis and "e14" not in satis, satis

# ---------------- 3) Yetki (before_tool_callback) ----------------
# Selin (e03): Satış ekibini listeleyemez, kendi ekibini listeler
reddedildi(yetki_kontrolu(tool("ekibi_listele"), {"yonetici_id": "e14"}, ctx("e03")), "e14")
assert yetki_kontrolu(tool("ekibi_listele"), {"yonetici_id": "e03"}, ctx("e03")) is None
# Zincir: kendi yöneticilerini görür, başka ekibi göremez
assert yetki_kontrolu(tool("raporlama_zinciri"), {"calisan_id": "e01"}, ctx("e03")) is None
reddedildi(yetki_kontrolu(tool("raporlama_zinciri"), {"calisan_id": "e07"}, ctx("e03")), "e07")
# Ortak yönetici: iki kişi de kapsamda olmalı
reddedildi(yetki_kontrolu(tool("ortak_yonetici"), {"calisan_id_1": "e04", "calisan_id_2": "e10"}, ctx("e03")), "e10")
assert yetki_kontrolu(tool("ortak_yonetici"), {"calisan_id_1": "e04", "calisan_id_2": "e10"}, ctx("e02")) is None
# Taşıma: kapsam dışına / kendini taşıyamaz
tasi = {"calisan_id": "e04", "yeni_yonetici_id": "e09"}
reddedildi(yetki_kontrolu(tool("calisani_tasi"), tasi, ctx("e03")), "e09")
assert yetki_kontrolu(tool("calisani_tasi"), tasi, ctx("e02")) is None
reddedildi(yetki_kontrolu(tool("calisani_tasi"), {"calisan_id": "e02", "yeni_yonetici_id": "e14"}, ctx("e02")), "e02")
# Var olmayan id'yi callback engellemez, tool "bulunamadi" der
assert yetki_kontrolu(tool("ekibi_listele"), {"yonetici_id": "e99"}, ctx("e03")) is None
assert y.ekibi_listele("e99", ctx("e03"))["status"] == "bulunamadi"

# ---------------- 4) before_agent_callback ----------------
bos = SimpleNamespace(state={})
oturumu_hazirla(bos)
assert bos.state["aktif_kullanici_id"] == "e02" and len(bos.state["agac"]) == 18
assert set(bos.state["agac"][0]) == {"id", "ad", "unvan", "departman_id", "departman", "yonetici"}

# ---------------- 5) Taşıma: oturuma özel, döngü yok ----------------
a, b = ctx("e02"), ctx("e02")
oturumu_hazirla(a), oturumu_hazirla(b)
assert y.calisani_tasi("e02", "e03", ctx("e01"))["status"] == "error"  # döngü: Burak, Selin'in altına
assert y.calisani_tasi("e03", "e04", ctx("e02"))["status"] == "error"  # döngü: Selin, Emre'nin altına
t = y.calisani_tasi("e04", "e09", a)
assert t["status"] == "ok" and t["calisan"]["departman"] == "Veri ve Yapay Zeka"
assert t["eski_yonetici"]["id"] == "e03" and t["yeni_yonetici"]["id"] == "e09"
assert a.state["tasimalar"] == {"e04": "e09"}
assert next(k for k in a.state["agac"] if k["id"] == "e04")["yonetici"] == "e09"
assert y.raporlama_zinciri("e04", a)["zincir_alttan_uste"][0]["id"] == "e09"
# Diğer oturum ve global veri değişmedi
assert y.raporlama_zinciri("e04", b)["zincir_alttan_uste"][0]["id"] == "e03"
assert "tasimalar" not in b.state
assert next(k for k in b.state["agac"] if k["id"] == "e04")["yonetici"] == "e03"
assert CALISANLAR == ILK_VERI
# Taşımadan sonra kapsam da değişir: Selin artık Emre'yi bulamaz (a oturumunda)
a.state["aktif_kullanici_id"] = "e03"
reddedildi(y.altimda_bul("Emre", a), "e04")


# ---------------- 6) Onay kapısı (require_confirmation) ----------------
def onayli_tool(agent, ad):
    return next(t for t in agent.tools if getattr(t, "name", None) == ad)


class SahteToolContext(SimpleNamespace):
    """FunctionTool.run_async'in ihtiyaç duyduğu kadarını taklit eder."""

    def __init__(self, state, tool_confirmation=None):
        super().__init__(
            state=state, tool_confirmation=tool_confirmation, function_call_id="test",
            actions=SimpleNamespace(skip_summarization=False), istenen_onay=None,
        )

    def request_confirmation(self, hint=None, payload=None):
        self.istenen_onay = hint


async def onay_testleri():
    tasi_tool = onayli_tool(yonetici_agent, "calisani_tasi")
    # Onay yok -> tool çalışmaz, onay istenir
    sahte = SahteToolContext(ctx("e02").state)
    sonuc = await tasi_tool.run_async(args=tasi, tool_context=sahte)
    assert "requires confirmation" in sonuc["error"] and sahte.istenen_onay, sonuc
    assert "tasimalar" not in sahte.state
    # Reddedildi -> çalışmaz
    sahte = SahteToolContext(ctx("e02").state, ToolConfirmation(confirmed=False))
    sonuc = await tasi_tool.run_async(args=tasi, tool_context=sahte)
    assert "rejected" in sonuc["error"] and "tasimalar" not in sahte.state
    # Onaylandı -> çalışır
    sahte = SahteToolContext(ctx("e02").state, ToolConfirmation(confirmed=True))
    sonuc = await tasi_tool.run_async(args=tasi, tool_context=sahte)
    assert sonuc["status"] == "ok" and sahte.state["tasimalar"] == {"e04": "e09"}

    # Talep tool'ları da onay kapısından geçer (karara_bagla'nın çalışan hâli bölüm 10'da)
    for agent, ad, args in (
        (yonetici_agent, "talebi_karara_bagla", {"talep_no": 1, "karar": "onay"}),
        (calisan_agent, "talebi_gonder", {}),
    ):
        sahte = SahteToolContext(ctx("e02").state)
        sonuc = await onayli_tool(agent, ad).run_async(args=args, tool_context=sahte)
        assert "requires confirmation" in sonuc["error"], (ad, sonuc)


asyncio.run(onay_testleri())

# ---------------- 6b) İşlem geçmişi + deterministik geri alma (v4) ----------------
g = ctx("e02")
oturumu_hazirla(g)
assert y.islem_gecmisi(g) == {"status": "ok", "islemler": []}
assert y.islemi_geri_al(g)["status"] == "error"  # geri alınacak taşıma yok
assert y.islemi_geri_al(g, islem_no=7)["status"] == "bulunamadi"
# Taşı -> geri al: asıl yöneticiye dönüş, tasimalar anahtarı SİLİNİR
assert y.calisani_tasi("e04", "e09", g)["status"] == "ok"
i1 = g.state["islem_gecmisi"][0]
assert (i1["no"], i1["tur"], i1["kisi"]["id"], i1["eski_yonetici"]["id"], i1["yeni_yonetici"]["id"]) == (
    1, "tasima", "e04", "e03", "e09")
assert i1["yapan"]["id"] == "e02" and i1["geri_alindi"] is False and i1["geri_alan_no"] is None
assert i1["hedef_no"] is None and i1["zaman"]
assert set(i1) == {"no", "zaman", "tur", "kisi", "eski_yonetici", "yeni_yonetici", "yapan",
                   "geri_alindi", "geri_alan_no", "hedef_no"}
assert yetki_kontrolu(tool("islemi_geri_al"), {}, g) is None
ga = y.islemi_geri_al(g)
assert ga["status"] == "ok", ga
assert g.state["tasimalar"] == {}  # gereksiz override kalmadı
assert next(k for k in g.state["agac"] if k["id"] == "e04")["yonetici"] == "e03"
assert g.state["agac"] == org.agac_listesi(K)
assert ga["islem"]["no"] == 2 and ga["islem"]["tur"] == "geri_alma" and ga["islem"]["hedef_no"] == 1
assert ga["islem"]["eski_yonetici"]["id"] == "e09" and ga["islem"]["yeni_yonetici"]["id"] == "e03"
assert ga["geri_alinan"]["no"] == 1 and ga["geri_alinan"]["geri_alindi"] is True
assert ga["geri_alinan"]["geri_alan_no"] == 2
assert [i["no"] for i in y.islem_gecmisi(g)["islemler"]] == [2, 1]  # en yenisi önce
assert [i["no"] for i in g.state["islem_gecmisi"]] == [1, 2]  # state'te en yenisi sonda
# İki kez geri alma -> hata (numarayla), 0 ile de geri alınacak taşıma kalmadı
assert y.islemi_geri_al(g, islem_no=1)["status"] == "error"
assert y.islemi_geri_al(g)["status"] == "error"
assert y.islemi_geri_al(g, islem_no=2)["status"] == "error"  # geri_alma kaydı geri alınmaz
# Elle asıl yöneticiye geri taşıma da tasimalar'ı temizler
y.calisani_tasi("e05", "e06", g)
assert g.state["tasimalar"] == {"e05": "e06"}
y.calisani_tasi("e05", "e03", g)
assert g.state["tasimalar"] == {} and [i["no"] for i in g.state["islem_gecmisi"]] == [1, 2, 3, 4]
# Sonradan tekrar taşınan kişinin eski işlemi geri alınamaz
y.calisani_tasi("e11", "e06", g)  # #5
y.calisani_tasi("e11", "e03", g)  # #6
s5 = y.islemi_geri_al(g, islem_no=5)
assert s5["status"] == "error" and "sonradan değişmiş" in s5["mesaj"], s5
assert not g.state["islem_gecmisi"][4]["geri_alindi"]
# Numarayla geri alma: #6 -> e11 tekrar e06'ya, sonra 0 -> son geri alınmamış taşıma #5
s6 = y.islemi_geri_al(g, islem_no=6)
assert s6["status"] == "ok" and s6["islem"]["hedef_no"] == 6 and g.state["tasimalar"] == {"e11": "e06"}
s7 = y.islemi_geri_al(g)
assert s7["status"] == "ok" and s7["geri_alinan"]["no"] == 5 and g.state["tasimalar"] == {}
assert CALISANLAR == ILK_VERI
# Döngü: geri dönülecek eski yönetici artık kişinin alt ekibindeyse
d = ctx("e02")
y.calisani_tasi("e05", "e06", d)  # #1: Zeynep e03 -> e06
y.calisani_tasi("e03", "e05", d)  # #2: Selin, Zeynep'in altına
assert "Döngü" in y.islemi_geri_al(d, islem_no=1)["mesaj"]

# Yetki: Burak, Ozan'ı (e10) Emre'nin (e04) altına taşır; Selin (e03) geri alamaz (eski yönetici e09)
r = ctx("e02")
y.calisani_tasi("e10", "e04", r)
r.state["aktif_kullanici_id"] = "e03"
reddedildi(yetki_kontrolu(tool("islemi_geri_al"), {"islem_no": 0}, r), "e09")
reddedildi(yetki_kontrolu(tool("islemi_geri_al"), {"islem_no": 1}, r), "e09")
assert yetki_kontrolu(tool("islemi_geri_al"), {"islem_no": 9}, r) is None  # yok -> tool hatayı döner
r.state["aktif_kullanici_id"] = "e02"
assert yetki_kontrolu(tool("islemi_geri_al"), {}, r) is None


async def geri_al_onay_testi():
    geri_tool = onayli_tool(yonetici_agent, "islemi_geri_al")
    st = ctx("e02").state
    y.calisani_tasi("e04", "e09", SimpleNamespace(state=st))
    sahte = SahteToolContext(st)  # onay yok -> çalışmaz
    sonuc = await geri_tool.run_async(args={"islem_no": 0}, tool_context=sahte)
    assert "requires confirmation" in sonuc["error"] and sahte.istenen_onay, sonuc
    assert st["tasimalar"] == {"e04": "e09"} and len(st["islem_gecmisi"]) == 1
    sahte = SahteToolContext(st, ToolConfirmation(confirmed=True))  # onaylı -> çalışır
    sonuc = await geri_tool.run_async(args={"islem_no": 0}, tool_context=sahte)
    assert sonuc["status"] == "ok" and st["tasimalar"] == {} and len(st["islem_gecmisi"]) == 2


asyncio.run(geri_al_onay_testi())

# ---------------- 7) Çalışan tool'ları (taslak) ----------------
emre = ctx("e04")
bk = c.ben_kimim(emre)
assert bk["kullanici"]["id"] == "e04" and bk["yoneticim"]["id"] == "e03"
assert c.taslagi_goster(emre)["status"] == "bulunamadi"
assert c.talep_taslagi_olustur("tatil", "x", emre)["status"] == "error"  # geçersiz tür
assert c.talep_taslagi_olustur("izin", "Cuma günü izin", emre)["taslak"] == {"tur": "izin", "aciklama": "Cuma günü izin"}
assert c.taslagi_goster(emre)["taslak"]["tur"] == "izin"

# ---------------- 8) Depo + onaylayan (saf) ----------------
assert org.onaylayan_bul("e07", K) == "e06"  # doğrudan yönetici
assert org.onaylayan_bul("e12", K) == "e01"
assert org.onaylayan_bul("e01", K) == "e01"  # kök: kendisi (otomatik onay)
assert org.onaylayan_bul("e99", K) is None
assert org.onaylayan_bul("e04", org.etkin_kisiler({"e04": "e09"})) == "e09"  # oturumun ağacından

# Eski (v2) düz liste biçimindeki dosya boş depo sayılır, ilk yazmada yeni biçime geçer
kuyruk.DOSYA.write_text('[{"no": 1, "durum": "atandi"}]', "utf-8")
assert kuyruk.listele() == [] and kuyruk.bildirimler("e06") == []
eski_test = kuyruk.yeni_talep(org.ozet("e04", K), "izin", "x", org.ozet("e03", K))
assert eski_test["no"] == 1 and set(json.loads(kuyruk.DOSYA.read_text("utf-8"))) == {"talepler", "bildirimler"}
kuyruk.DOSYA.unlink()  # temiz depo ile devam

# yonlendirme_kaydet doğrulamaları (LLM yok)
t0 = kuyruk.yeni_talep(org.ozet("e04", K), "ik", "Bordro sorusu", org.ozet("e03", K))
assert triyaj.yonlendirme_kaydet(999, "e12", "x")["status"] == "error"  # talep yok
assert triyaj.yonlendirme_kaydet(t0["no"], "e99", "x")["status"] == "error"  # kişi yok
assert triyaj.yonlendirme_kaydet(t0["no"], "e03", "x")["status"] == "error"  # ik -> e12 olmalı
assert triyaj.yonlendirme_kaydet(t0["no"], "e12", "İK konusu")["status"] == "ok"
t0 = kuyruk.getir(t0["no"])
assert t0["yonlendirme"]["hedef"]["id"] == "e12" and [g["olay"] for g in t0["gecmis"]] == ["gonderildi", "triyaj"]
kuyruk.DOSYA.unlink()


# talebi_gonder: triyaj agent'ı yerine sahte fonksiyon (model çağrısı yok)
triyaj_cagrilari = []


async def sahte_triyaj(talep_no):
    triyaj_cagrilari.append(talep_no)
    triyaj.yonlendirme_kaydet(talep_no, "e06", "Backend ekibinin işi")
    return kuyruk.getir(talep_no)


async def bozuk_triyaj(talep_no):
    raise RuntimeError("kota doldu")


def olaylar(talep):
    return [g["olay"] for g in talep["gecmis"]]


def bildirim_turleri(kisi_id):
    return [(b["talep_no"], b["tur"]) for b in kuyruk.bildirimler(kisi_id)]


def gonder(kullanici_ctx, tur, aciklama):
    c.talep_taslagi_olustur(tur, aciklama, kullanici_ctx)
    return asyncio.run(c.talebi_gonder(kullanici_ctx))


gercek_triyaj = triyaj.triyaja_gonder
triyaj.triyaja_gonder = sahte_triyaj
try:
    # ---------------- 9) Mutlu yol: Deniz (e07) izin -> Can (e06) onaylar -> İK (e12) bilgi ----------------
    deniz, can, burak, selin, hakan = ctx("e07"), ctx("e06"), ctx("e02"), ctx("e03"), ctx("e12")
    sonuc = gonder(deniz, "izin", "15 Aralık Cuma 1 gün izin")
    assert set(sonuc) == {"status", "talep_no", "onaylayan", "durum"}, sonuc  # dar kapı
    assert sonuc["status"] == "ok" and sonuc["durum"] == "onay_bekliyor" and sonuc["onaylayan"]["id"] == "e06"
    no = sonuc["talep_no"]
    assert triyaj_cagrilari == []  # izin triyaja gitmez
    assert deniz.state["taslak_talep"] is None and deniz.state["gonderilen_talepler"] == [no]
    assert [t["no"] for t in deniz.state["talep_ozeti"]["gonderdiklerim"]] == [no]  # tool özeti tazeledi
    talep = kuyruk.getir(no)
    assert talep["yonlendirme"] is None and talep["karar"] is None and olaylar(talep) == ["gonderildi"]
    assert bildirim_turleri("e06") == [(no, "onay_istegi")]

    assert [t["no"] for t in y.onayimi_bekleyenler(can)["talepler"]] == [no]
    assert y.onayimi_bekleyenler(burak)["talepler"] == []  # Burak'ın doğrudan ekibinden değil
    assert no in [t["no"] for t in y.ekibimin_talepleri(burak)["talepler"]]  # ama ekibinin talebi
    assert y.ekibimin_talepleri(selin)["talepler"] == []
    assert [t["no"] for t in c.taleplerim(deniz)["talepler"]] == [no]

    # Yetki: yanlış onaylayan -> reddedildi, hedef_id gerçek onaylayan
    for yanlis in (burak, selin, deniz):
        reddedildi(yetki_kontrolu(tool("talebi_karara_bagla"), {"talep_no": no, "karar": "onay"}, yanlis), "e06")
    assert yetki_kontrolu(tool("talebi_karara_bagla"), {"talep_no": 999, "karar": "onay"}, can)["status"] == "bulunamadi"
    assert yetki_kontrolu(tool("talebi_karara_bagla"), {"talep_no": no, "karar": "onay"}, can) is None
    assert y.talebi_karara_bagla(no, "belki", can)["status"] == "error"

    karar = y.talebi_karara_bagla(no, "onay", can, not_="İyi tatiller")
    assert karar["status"] == "ok"
    talep = karar["talep"]
    assert talep["durum"] == "onaylandi" and talep["karar"]["karar"] == "onay"
    assert talep["karar"]["veren"]["id"] == "e06" and talep["karar"]["not"] == "İyi tatiller"
    assert olaylar(talep) == ["gonderildi", "onaylandi", "ik_bilgilendirildi"]
    assert [g["kisi_id"] for g in talep["gecmis"]] == ["e07", "e06", "e12"]
    assert ids(talep["bilgilendirilenler"]) == ["e12"]
    assert bildirim_turleri("e12") == [(no, "bilgi")]
    assert bildirim_turleri("e07") == [(no, "onaylandi")]
    # Artık onay beklemiyor
    reddedildi(yetki_kontrolu(tool("talebi_karara_bagla"), {"talep_no": no, "karar": "red"}, can), "e06")
    assert y.talebi_karara_bagla(no, "red", can)["status"] == "error"

    # Bildirimlerim: okunmamış hâliyle döner, sonra okundu olur
    b = y.bildirimlerim(hakan)["bildirimler"]
    assert [(x["tur"], x["okundu"]) for x in b] == [("bilgi", False)]
    assert all(x["okundu"] for x in kuyruk.bildirimler("e12"))
    assert c.bildirimlerim(deniz)["bildirimler"][0]["tur"] == "onaylandi"

    # ---------------- 10) Red yolu (notla) + onay kapısı çalışır hâli ----------------
    no2 = gonder(deniz, "izin", "Pazartesi izin")["talep_no"]

    async def onayli_karar():
        karar_tool = onayli_tool(yonetici_agent, "talebi_karara_bagla")
        args = {"talep_no": no2, "karar": "red", "not_": "Sprint teslimi var"}
        sahte = SahteToolContext(ctx("e06").state)  # onay yok -> çalışmaz
        sonuc = await karar_tool.run_async(args=args, tool_context=sahte)
        assert "requires confirmation" in sonuc["error"] and kuyruk.getir(no2)["durum"] == "onay_bekliyor"
        sahte = SahteToolContext(ctx("e06").state, ToolConfirmation(confirmed=True))  # onaylı -> çalışır
        return await karar_tool.run_async(args=args, tool_context=sahte)

    red = asyncio.run(onayli_karar())
    assert red["status"] == "ok" and red["talep"]["durum"] == "reddedildi"
    assert olaylar(red["talep"]) == ["gonderildi", "reddedildi"] and red["talep"]["bilgilendirilenler"] == []
    son = kuyruk.bildirimler("e07")[0]
    assert (son["talep_no"], son["tur"]) == (no2, "reddedildi") and "Sprint teslimi var" in son["mesaj"]
    assert (no2, "bilgi") not in bildirim_turleri("e12")  # redde İK'ya bilgi gitmez

    # ---------------- 11) İzin dışı tür: triyaj yönlendirmesi + onayda hedefe bilgi ----------------
    zeynep = ctx("e05")
    s3 = gonder(zeynep, "ekip_destegi", "Ödeme API'sinde backend desteği lazım")
    no3 = s3["talep_no"]
    assert set(s3) == {"status", "talep_no", "onaylayan", "durum"} and "Backend ekibinin" not in str(s3)
    assert s3["onaylayan"]["id"] == "e03" and triyaj_cagrilari == [no3]
    t3 = kuyruk.getir(no3)
    assert t3["yonlendirme"] == {"hedef": org.ozet("e06", K), "gerekce": "Backend ekibinin işi"}
    assert olaylar(t3) == ["gonderildi", "triyaj"]
    t3 = y.talebi_karara_bagla(no3, "onay", selin)["talep"]
    assert olaylar(t3) == ["gonderildi", "triyaj", "onaylandi", "ik_bilgilendirildi", "yonlendirildi"]
    assert ids(t3["bilgilendirilenler"]) == ["e12", "e06"]
    assert (no3, "bilgi") in bildirim_turleri("e06") and (no3, "bilgi") in bildirim_turleri("e12")

    # Triyaj çökse bile yönlendirme eksik kalmaz: kural tabanlı yedek
    triyaj.triyaja_gonder = bozuk_triyaj
    s4 = gonder(ctx("e04"), "teknik_destek", "VPN erişimim yok")
    assert s4["status"] == "ok" and s4["onaylayan"]["id"] == "e03"
    t4 = kuyruk.getir(s4["talep_no"])
    assert t4["yonlendirme"]["hedef"]["id"] == "e03" and olaylar(t4) == ["gonderildi", "triyaj"]
    assert asyncio.run(c.talebi_gonder(ctx("e04")))["status"] == "error"  # taslak yok

    # ---------------- 12) e01 (kök): kendi talebi otomatik onaylı ----------------
    ayse = ctx("e01")
    s5 = gonder(ayse, "izin", "Yıllık izin")
    assert s5["durum"] == "onaylandi" and s5["onaylayan"]["id"] == "e01"
    t5 = kuyruk.getir(s5["talep_no"])
    assert t5["durum"] == "onaylandi" and t5["karar"]["veren"]["id"] == "e01"
    assert olaylar(t5) == ["gonderildi", "onaylandi", "ik_bilgilendirildi"]
    assert (s5["talep_no"], "onay_istegi") not in bildirim_turleri("e01")
    assert (s5["talep_no"], "bilgi") in bildirim_turleri("e12")
finally:
    triyaj.triyaja_gonder = gercek_triyaj

# ---------------- 13) talep_ozeti (before_agent_callback) ----------------
no6 = kuyruk.yeni_talep(org.ozet("e08", K), "izin", "Cuma", org.ozet("e06", K))["no"]
for kullanici in ("e06", "e12"):
    st = SimpleNamespace(state={"aktif_kullanici_id": kullanici})
    oturumu_hazirla(st)
    oz = st.state["talep_ozeti"]
    assert set(oz) == {"gonderdiklerim", "onayimi_bekleyenler", "bildirimler", "guncellendi"}, oz
    assert oz["gonderdiklerim"] == []
    if kullanici == "e06":
        assert [t["no"] for t in oz["onayimi_bekleyenler"]] == [no6]
        assert {b["tur"] for b in oz["bildirimler"]} == {"onay_istegi", "bilgi"}
    else:
        assert oz["onayimi_bekleyenler"] == []
        assert {b["tur"] for b in oz["bildirimler"]} == {"bilgi"} and len(oz["bildirimler"]) == 3
    # Değişmediyse aynı nesne kalır (gereksiz stateDelta yok)
    onceki = st.state["talep_ozeti"]
    oturum.talep_ozetini_yaz(st.state)
    assert st.state["talep_ozeti"] is onceki
# Çalışan agent'ının callback'i de özeti yazar
from calisan_asistani.agent import oturumu_hazirla as calisan_hazirla  # noqa: E402

st = SimpleNamespace(state={"aktif_kullanici_id": "e07"})
calisan_hazirla(st)
assert len(st.state["talep_ozeti"]["gonderdiklerim"]) == 2 and len(st.state["agac"]) == 18

# Tool listeleri sözleşmeyle aynı
assert [getattr(t, "name", getattr(t, "__name__", None)) for t in yonetici_agent.tools] == [
    "ben_kimim", "calisan_ara", "altimda_bul", "raporlama_zinciri", "ekibi_listele", "departman_agaci",
    "ortak_yonetici", "onayimi_bekleyenler", "ekibimin_talepleri", "bildirimlerim", "islem_gecmisi",
    "calisani_tasi", "talebi_karara_bagla", "islemi_geri_al",
]
assert [getattr(t, "name", getattr(t, "__name__", None)) for t in calisan_agent.tools] == [
    "ben_kimim", "talep_taslagi_olustur", "taslagi_goster", "talebi_gonder", "taleplerim", "bildirimlerim",
]
assert CALISANLAR == ILK_VERI  # global veri hiç değişmedi

print("Tüm testler geçti ✓")
