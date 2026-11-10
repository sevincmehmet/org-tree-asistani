"""Öğrenme amaçlı durak noktaları (breakpoint). Kapalıyken hiçbir etkisi yoktur.

Açmak için ORG_DEBUG ortam değişkeni:
    ORG_DEBUG=hepsi        bütün duraklar
    ORG_DEBUG=2,3,6        sadece bu numaralar
    (boş / tanımsız)       kapalı: normal çalıştırma, testler ve calistir.sh etkilenmez

VS Code'da: Çalıştır ve Hata Ayıkla (⇧⌘D) → "Org: 🔴 Duraklarla ..." → hangi durakları istediğini sorar.
Debugger dışında açarsan (terminalde ORG_DEBUG=hepsi) Python'un pdb'si açılır: c = devam, n = sonraki satır, p x = değişkeni yazdır.

Kullanım (her durakta):
    if dur(3): breakpoint()   # 🔴 3: ...
`breakpoint()` satırı durağın kendi fonksiyonunda olduğu için debugger tam o satırda durur;
Değişkenler (VARIABLES) panelinde args, state, kisiler vb. o anki halleriyle görünür.

Bir isteğin akış sırasına göre duraklar:
  ── Her tur ───────────────────────────────────────────────────────────────
   1  guards.oturumu_hazirla         before_agent_callback: model çalışmadan önce state
  ── Her tool çağrısı (model "şunu çağır" dedikten SONRA, tool'dan ÖNCE) ────
   2  guards.yetki_kontrolu          before_tool_callback: tool.name, args, kapsam, gorunur
   3  guards._reddet                 yetki REDDEDİLDİ: Call Stack'te hangi kuraldan geldiğine bak
  ── Okuma tool'u ──────────────────────────────────────────────────────────
   4  tools.altimda_bul              hedef bulundu, yol hesaplanmak üzere
  ── Yazma tool'ları (sadece onay kartında "Onayla" dedikten SONRA çalışır) ─
   5  tools.calisani_tasi            onay verildi, taşıma başlıyor
   6  oturum.tasima_uygula           state'e yeni sözlük yazılıyor (stateDelta buradan doğar)
   7  tools.islemi_geri_al           geri alınacak kayıt KODLA bulundu (model değil)
   8  tools.talebi_karara_bagla      yönetici onay/red veriyor
   9  kuyruk.karara_bagla            kilit içinde: durum değişti, bildirimler üretilecek
  ── Çalışan Asistanı + agent → agent ──────────────────────────────────────
  10  calisan.talebi_gonder          onaylayan ağaçtan hesaplandı, talep kaydedilecek
  11  triyaj.yonlendirme_kaydet      İÇERİDEKİ triyaj ajanı kendi tool'unu çağırdı
  12  calisan.talebi_gonder (dönüş)  çalışana dönecek alanları KOD seçti (dar kapı)

Önerilen başlangıç setleri:
  2,3        → yetki (Ders 5: Selin "Satış ekibini listele")
  5,6        → insan onayı + state (Ders 6: "Emre'yi yapay zeka ekibine taşı")
  10,11,12   → agent → agent (Ders 7: Deniz "...talep oluştur", "Gönder")
"""

import os

_SECIM = os.getenv("ORG_DEBUG", "").strip().lower()
_HEPSI = _SECIM in ("hepsi", "all", "*")
_NUMARALAR = {int(p) for p in _SECIM.replace(" ", "").split(",") if p.isdigit()}


def dur(no: int) -> bool:
    """Bu numaralı durak açık mı? Kapalıyken her zaman False (sıfır maliyet)."""
    return _HEPSI or no in _NUMARALAR
