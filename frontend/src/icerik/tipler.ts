// CONTRACT.md → "Ders içeriği tipi". İçerik dosyası (dersler.ts) aynı şekli kendi içinde de
// tanımlar; uygulama kodu tipleri buradan alır, değerleri (DERSLER, KAVRAMLAR, MOTTO)
// ./dersler'den. İkisi yapısal olarak birebir aynıdır.

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
