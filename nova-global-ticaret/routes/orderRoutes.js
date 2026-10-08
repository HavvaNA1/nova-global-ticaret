const express = require("express");
const router = express.Router();
const db = require("../db");

function getIndirimOrani(paketSeviyesi) {
  if (paketSeviyesi === "sapphire") return 20;
  if (paketSeviyesi === "emerald") return 35;
  if (paketSeviyesi === "diamond") return 50;
  return 0;
}

router.get("/user/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    SELECT
      s.siparis_id,
      s.siparis_no,
      s.uye_id,
      s.adres_id,
      s.durum_id,
      sd.durum_adi,
      s.toplam_tutar,
      s.indirim_orani,
      s.indirim_tutari,
      s.odenecek_tutar,
      s.odeme_durumu,
      s.siparis_tarihi,
      o.odeme_tipi
    FROM siparisler s
    LEFT JOIN siparis_durumlari sd ON s.durum_id = sd.durum_id
    LEFT JOIN (
      SELECT odeme_id, siparis_id, odeme_tipi
      FROM odemeler
      WHERE odeme_id IN (SELECT MAX(odeme_id) FROM odemeler GROUP BY siparis_id)
    ) o ON s.siparis_id = o.siparis_id
    WHERE s.uye_id = ?
    ORDER BY s.siparis_id DESC
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Siparişler getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/detail/:siparisId", (req, res) => {
  const siparisId = req.params.siparisId;

  const siparisSql = `
    SELECT
      s.siparis_id,
      s.siparis_no,
      s.uye_id,
      s.adres_id,
      s.durum_id,
      sd.durum_adi,
      s.toplam_tutar,
      s.indirim_orani,
      s.indirim_tutari,
      s.odenecek_tutar,
      s.odeme_durumu,
      s.siparis_tarihi,
      o.odeme_tipi,
      o.odeme_tutari,
      a.teslim_alacak_ad,
      a.teslim_alacak_soyad,
      a.teslim_alacak_telefon,
      a.il,
      a.ilce,
      a.posta_kodu,
      a.acik_adres,
      a.adres_basligi
    FROM siparisler s
    LEFT JOIN siparis_durumlari sd ON s.durum_id = sd.durum_id
    LEFT JOIN adresler a ON s.adres_id = a.adres_id
    LEFT JOIN (
      SELECT odeme_id, siparis_id, odeme_tipi, odeme_tutari
      FROM odemeler
      WHERE odeme_id IN (SELECT MAX(odeme_id) FROM odemeler GROUP BY siparis_id)
    ) o ON s.siparis_id = o.siparis_id
    WHERE s.siparis_id = ?
    LIMIT 1
  `;

  db.query(siparisSql, [siparisId], (siparisErr, siparisResults) => {
    if (siparisErr) {
      console.log(siparisErr);
      return res.status(500).json({ hata: "Sipariş bilgisi getirilemedi." });
    }

    if (siparisResults.length === 0) {
      return res.status(404).json({ hata: "Sipariş bulunamadı." });
    }

    const detaySql = `
      SELECT
        sd.siparis_detay_id,
        sd.siparis_id,
        sd.urun_id,
        u.urun_adi,
        u.aciklama,
        sd.adet,
        sd.birim_fiyat,
        sd.ara_toplam
      FROM siparis_detaylari sd
      JOIN urunler u ON sd.urun_id = u.urun_id
      WHERE sd.siparis_id = ?
      ORDER BY sd.siparis_detay_id ASC
    `;

    db.query(detaySql, [siparisId], (detayErr, detayResults) => {
      if (detayErr) {
        console.log(detayErr);
        return res.status(500).json({ hata: "Sipariş detayları getirilemedi." });
      }

      const kargoSql = `
        SELECT
          kb.kargo_id,
          kb.siparis_id,
          kb.kargo_firma_id,
          kf.firma_adi,
          kb.takip_numarasi,
          kb.kargoya_verilis_tarihi,
          kb.teslim_tarihi,
          kb.aciklama
        FROM kargo_bilgileri kb
        LEFT JOIN kargo_firmalari kf ON kb.kargo_firma_id = kf.kargo_firma_id
        WHERE kb.siparis_id = ?
        ORDER BY kb.kargo_id DESC
        LIMIT 1
      `;

      db.query(kargoSql, [siparisId], (kargoErr, kargoResults) => {
        if (kargoErr) {
          console.log(kargoErr);
          return res.status(500).json({ hata: "Kargo bilgisi getirilemedi." });
        }

        const gecmisSql = `
          SELECT
            sdg.gecmis_id,
            sdg.siparis_id,
            sdg.eski_durum_id,
            eski.durum_adi AS eski_durum_adi,
            sdg.yeni_durum_id,
            yeni.durum_adi AS yeni_durum_adi,
            sdg.aciklama,
            sdg.degisim_tarihi
          FROM siparis_durum_gecmisi sdg
          LEFT JOIN siparis_durumlari eski ON sdg.eski_durum_id = eski.durum_id
          LEFT JOIN siparis_durumlari yeni ON sdg.yeni_durum_id = yeni.durum_id
          WHERE sdg.siparis_id = ?
          ORDER BY sdg.gecmis_id ASC
        `;

        db.query(gecmisSql, [siparisId], (gecmisErr, gecmisResults) => {
          if (gecmisErr) {
            console.log(gecmisErr);
            return res.status(500).json({ hata: "Sipariş durum geçmişi getirilemedi." });
          }

          const siparis = siparisResults[0];
          const adres = {
            adres_id: siparis.adres_id,
            adres_basligi: siparis.adres_basligi,
            teslim_alacak_ad: siparis.teslim_alacak_ad,
            teslim_alacak_soyad: siparis.teslim_alacak_soyad,
            teslim_alacak_telefon: siparis.teslim_alacak_telefon,
            il: siparis.il,
            ilce: siparis.ilce,
            posta_kodu: siparis.posta_kodu,
            acik_adres: siparis.acik_adres
          };

          delete siparis.adres_basligi;
          delete siparis.teslim_alacak_ad;
          delete siparis.teslim_alacak_soyad;
          delete siparis.teslim_alacak_telefon;
          delete siparis.il;
          delete siparis.ilce;
          delete siparis.posta_kodu;
          delete siparis.acik_adres;

          res.json({
            siparis,
            urunler: detayResults,
            kargo: kargoResults[0] || null,
            adres,
            durum_gecmisi: gecmisResults
          });
        });
      });
    });
  });
});
router.put("/status/:siparisId", (req, res) => {
  const siparisId = req.params.siparisId;
  const { yeni_durum_id, aciklama } = req.body;

  if (!yeni_durum_id) {
    return res.status(400).json({ hata: "Yeni durum bilgisi zorunludur." });
  }

  const durumKontrolSql = `
    SELECT durum_id, durum_adi
    FROM siparis_durumlari
    WHERE durum_id = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(durumKontrolSql, [yeni_durum_id], (durumKontrolErr, durumKontrolResults) => {
    if (durumKontrolErr) {
      console.log(durumKontrolErr);
      return res.status(500).json({ hata: "Sipariş durumu kontrol edilemedi." });
    }

    if (durumKontrolResults.length === 0) {
      return res.status(404).json({ hata: "Geçerli sipariş durumu bulunamadı." });
    }

    const eskiDurumSql = "SELECT durum_id FROM siparisler WHERE siparis_id = ? LIMIT 1";

    db.query(eskiDurumSql, [siparisId], (eskiDurumErr, eskiDurumResults) => {
      if (eskiDurumErr) {
        console.log(eskiDurumErr);
        return res.status(500).json({ hata: "Sipariş bilgisi okunamadı." });
      }

      if (eskiDurumResults.length === 0) {
        return res.status(404).json({ hata: "Sipariş bulunamadı." });
      }

      const eskiDurumId = eskiDurumResults[0].durum_id;
      const siparisGuncelleSql = "UPDATE siparisler SET durum_id = ? WHERE siparis_id = ?";

      db.query(siparisGuncelleSql, [yeni_durum_id, siparisId], (guncelleErr) => {
        if (guncelleErr) {
          console.log(guncelleErr);
          return res.status(500).json({ hata: "Sipariş durumu güncellenemedi." });
        }

        const durumGecmisiSql = `
          INSERT INTO siparis_durum_gecmisi
          (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
          VALUES (?, ?, ?, ?)
        `;

        const durumAciklama = aciklama || `Sipariş durumu ${durumKontrolResults[0].durum_adi} olarak güncellendi.`;

        db.query(durumGecmisiSql, [siparisId, eskiDurumId, yeni_durum_id, durumAciklama], (gecmisErr) => {
          if (gecmisErr) {
            console.log(gecmisErr);
            return res.status(500).json({ hata: "Sipariş durum geçmişi oluşturulamadı." });
          }

          res.json({
            mesaj: "Sipariş durumu güncellendi.",
            siparis_id: Number(siparisId),
            eski_durum_id: eskiDurumId,
            yeni_durum_id,
            yeni_durum_adi: durumKontrolResults[0].durum_adi
          });
        });
      });
    });
  });
});

router.post("/create", (req, res) => {
  const { uye_id, adres_id } = req.body;

  if (!uye_id || !adres_id) {
    return res.status(400).json({ hata: "Üye ve adres bilgisi zorunludur." });
  }

  const uyeSql = `
    SELECT uye_id, paket_seviyesi
    FROM uyeler
    WHERE uye_id = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(uyeSql, [uye_id], (uyeErr, uyeResults) => {
    if (uyeErr) {
      console.log(uyeErr);
      return res.status(500).json({ hata: "Üye bilgisi alınamadı." });
    }

    if (uyeResults.length === 0) {
      return res.status(404).json({ hata: "Üye bulunamadı." });
    }

    const paketSeviyesi = uyeResults[0].paket_seviyesi;
    const indirimOrani = getIndirimOrani(paketSeviyesi);

    const sepetSql = `
      SELECT
        MIN(s.sepet_id) AS sepet_id,
        s.urun_id,
        SUM(s.adet) AS adet,
        u.fiyat,
        u.stok_adedi
      FROM sepet s
      JOIN urunler u ON s.urun_id = u.urun_id
      WHERE s.uye_id = ? AND u.aktif_mi = 1
      GROUP BY s.urun_id, u.fiyat, u.stok_adedi
      ORDER BY MIN(s.sepet_id) ASC
    `;

    db.query(sepetSql, [uye_id], (sepetErr, sepetUrunleri) => {
      if (sepetErr) {
        console.log(sepetErr);
        return res.status(500).json({ hata: "Sepet bilgisi alınamadı." });
      }

      if (sepetUrunleri.length === 0) {
        return res.status(400).json({ hata: "Sepet boş. Sipariş oluşturulamaz." });
      }

      for (const urun of sepetUrunleri) {
        if (urun.adet > urun.stok_adedi) {
          return res.status(400).json({ hata: `Ürün stok yetersiz. Ürün ID: ${urun.urun_id}` });
        }
      }

      const toplamTutar = sepetUrunleri.reduce((toplam, urun) => {
        return toplam + Number(urun.fiyat) * Number(urun.adet);
      }, 0);

      const indirimTutari = toplamTutar * (indirimOrani / 100);
      const odenecekTutar = toplamTutar - indirimTutari;
      const siparisNo = `SP-${Date.now()}`;
      const paraBirimiId = 1;

      const siparisSql = `
        INSERT INTO siparisler
        (siparis_no, uye_id, adres_id, para_birimi_id, durum_id, toplam_tutar, indirim_orani, indirim_tutari, odenecek_tutar)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      `;

      db.query(
        siparisSql,
        [siparisNo, uye_id, adres_id, paraBirimiId, toplamTutar, indirimOrani, indirimTutari, odenecekTutar],
        (siparisErr, siparisResult) => {
          if (siparisErr) {
            console.log(siparisErr);
            return res.status(500).json({ hata: "Sipariş oluşturulamadı." });
          }

          const siparisId = siparisResult.insertId;
          let tamamlananIslem = 0;
          const toplamIslem = sepetUrunleri.length;

          sepetUrunleri.forEach((urun) => {
            const araToplam = Number(urun.fiyat) * Number(urun.adet);
            const sonrakiStok = Number(urun.stok_adedi) - Number(urun.adet);

            const detaySql = `
              INSERT INTO siparis_detaylari
              (siparis_id, urun_id, adet, birim_fiyat, ara_toplam)
              VALUES (?, ?, ?, ?, ?)
            `;

            db.query(detaySql, [siparisId, urun.urun_id, urun.adet, urun.fiyat, araToplam], (detayErr) => {
              if (detayErr) {
                console.log(detayErr);
                return res.status(500).json({ hata: "Sipariş detayı oluşturulamadı." });
              }

              const stokSql = "UPDATE urunler SET stok_adedi = stok_adedi - ? WHERE urun_id = ?";

              db.query(stokSql, [urun.adet, urun.urun_id], (stokErr) => {
                if (stokErr) {
                  console.log(stokErr);
                  return res.status(500).json({ hata: "Stok güncellenemedi." });
                }

                const stokHareketSql = `
                  INSERT INTO stok_hareketleri
                  (urun_id, siparis_id, hareket_tipi, adet, onceki_stok, sonraki_stok, aciklama)
                  VALUES (?, ?, 'cikis', ?, ?, ?, ?)
                `;

                db.query(
                  stokHareketSql,
                  [
                    urun.urun_id,
                    siparisId,
                    urun.adet,
                    urun.stok_adedi,
                    sonrakiStok,
                    "Sipariş oluşturulduğu için stok düşüldü."
                  ],
                  (stokHareketErr) => {
                    if (stokHareketErr) {
                      console.log(stokHareketErr);
                      return res.status(500).json({ hata: "Stok hareketi oluşturulamadı." });
                    }

                    tamamlananIslem++;

                    if (tamamlananIslem === toplamIslem) {
                      const temizleSql = "DELETE FROM sepet WHERE uye_id = ?";

                      db.query(temizleSql, [uye_id], (temizleErr) => {
                        if (temizleErr) {
                          console.log(temizleErr);
                          return res.status(500).json({ hata: "Sepet temizlenemedi." });
                        }

                        const durumGecmisiSql = `
                          INSERT INTO siparis_durum_gecmisi
                          (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
                          VALUES (?, NULL, 1, 'Sipariş oluşturuldu, ödeme bekleniyor.')
                        `;

                        db.query(durumGecmisiSql, [siparisId], (durumErr) => {
                          if (durumErr) {
                            console.log(durumErr);
                            return res.status(500).json({ hata: "Sipariş durum geçmişi oluşturulamadı." });
                          }

                          res.status(201).json({
                            mesaj: "Sipariş oluşturuldu.",
                            siparis_id: siparisId,
                            siparis_no: siparisNo,
                            durum_id: 1,
                            toplam_tutar: toplamTutar,
                            indirim_orani: indirimOrani,
                            indirim_tutari: indirimTutari,
                            odenecek_tutar: odenecekTutar
                          });
                        });
                      });
                    }
                  }
                );
              });
            });
          });
        }
      );
    });
  });
});

module.exports = router;



