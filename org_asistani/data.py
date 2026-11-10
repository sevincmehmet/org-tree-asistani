"""Demo organizasyon verisi (tamamen uydurma kişiler).

Gerçek sistemde bu veri bir veritabanından / API'den gelir.
"""

# departman_id -> {ad, ust (üst departman id'si, kök için None)}
DEPARTMANLAR = {
    "d-genel": {"ad": "Genel Müdürlük", "ust": None},
    "d-tek": {"ad": "Teknoloji", "ust": "d-genel"},
    "d-fe": {"ad": "Frontend", "ust": "d-tek"},
    "d-be": {"ad": "Backend", "ust": "d-tek"},
    "d-ai": {"ad": "Veri ve Yapay Zeka", "ust": "d-tek"},
    "d-ik": {"ad": "İnsan Kaynakları", "ust": "d-genel"},
    "d-satis": {"ad": "Satış", "ust": "d-genel"},
    "d-kurumsal": {"ad": "Kurumsal Satış", "ust": "d-satis"},
    "d-bireysel": {"ad": "Bireysel Satış", "ust": "d-satis"},
}

# calisan_id -> {ad, unvan, departman, yonetici (yöneticinin calisan_id'si, CEO için None)}
CALISANLAR = {
    "e01": {"ad": "Ayşe Yılmaz", "unvan": "Genel Müdür", "departman": "d-genel", "yonetici": None},
    "e02": {"ad": "Burak Demir", "unvan": "Teknoloji Direktörü", "departman": "d-tek", "yonetici": "e01"},
    "e03": {"ad": "Selin Kaya", "unvan": "Frontend Takım Lideri", "departman": "d-fe", "yonetici": "e02"},
    "e04": {"ad": "Emre Şahin", "unvan": "Frontend Geliştirici", "departman": "d-fe", "yonetici": "e03"},
    "e05": {"ad": "Zeynep Arslan", "unvan": "Frontend Geliştirici", "departman": "d-fe", "yonetici": "e03"},
    "e06": {"ad": "Can Öztürk", "unvan": "Backend Takım Lideri", "departman": "d-be", "yonetici": "e02"},
    "e07": {"ad": "Deniz Çelik", "unvan": "Backend Geliştirici", "departman": "d-be", "yonetici": "e06"},
    "e08": {"ad": "Mert Aydın", "unvan": "Backend Geliştirici", "departman": "d-be", "yonetici": "e06"},
    "e09": {"ad": "Elif Koç", "unvan": "Yapay Zeka Takım Lideri", "departman": "d-ai", "yonetici": "e02"},
    "e10": {"ad": "Ozan Polat", "unvan": "Veri Bilimci", "departman": "d-ai", "yonetici": "e09"},
    "e11": {"ad": "İrem Doğan", "unvan": "Junior AI Geliştirici", "departman": "d-ai", "yonetici": "e09"},
    "e12": {"ad": "Hakan Kurt", "unvan": "İK Müdürü", "departman": "d-ik", "yonetici": "e01"},
    "e13": {"ad": "Gizem Aksoy", "unvan": "İK Uzmanı", "departman": "d-ik", "yonetici": "e12"},
    "e14": {"ad": "Tolga Er", "unvan": "Satış Direktörü", "departman": "d-satis", "yonetici": "e01"},
    "e15": {"ad": "Pınar Güneş", "unvan": "Kurumsal Satış Müdürü", "departman": "d-kurumsal", "yonetici": "e14"},
    "e16": {"ad": "Kerem Yıldız", "unvan": "Satış Temsilcisi", "departman": "d-kurumsal", "yonetici": "e15"},
    "e17": {"ad": "Ece Tan", "unvan": "Bireysel Satış Müdürü", "departman": "d-bireysel", "yonetici": "e14"},
    "e18": {"ad": "Umut Bal", "unvan": "Satış Temsilcisi", "departman": "d-bireysel", "yonetici": "e17"},
}
