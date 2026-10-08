const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/companies", (req, res) => {
  const sql = `
    SELECT
      kargo_firma_id,
      firma_adi,
      aktif_mi
    FROM kargo_firmalari
    WHERE aktif_mi = 1
    ORDER BY firma_adi ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Kargo firmaları getirilemedi." });
    }

    res.json(results);
  });
});

router.post("/add", (req, res) => {
  const { siparis_id, kargo_firma_id, takip_numarasi, aciklama } = req.body;

  if (!siparis_id || !kargo_firma_id || !takip_numarasi) {
    return res.status(400).json({ hata: "Sipariş, kargo firması ve takip numarası zorunludur." });
  }

  const siparisSql = "SELECT durum_id FROM siparisler WHERE siparis_id = ? LIMIT 1";

  db.query(siparisSql, [siparis_id], (siparisErr, siparisResults) => {
    if (siparisErr) {
      console.log(siparisErr);
      return res.status(500).json({ hata: "Sipariş bilgisi okunamadı." });
    }

    if (siparisResults.length === 0) {
      return res.status(404).json({ hata: "Sipariş bulunamadı." });
    }

    const eskiDurumId = siparisResults[0].durum_id;

    const kargoSql = `
      INSERT INTO kargo_bilgileri
      (siparis_id, kargo_firma_id, takip_numarasi, kargoya_verilis_tarihi, aciklama)
      VALUES (?, ?, ?, NOW(), ?)
    `;

    db.query(kargoSql, [siparis_id, kargo_firma_id, takip_numarasi, aciklama || null], (kargoErr, kargoResult) => {
      if (kargoErr) {
        console.log(kargoErr);
        return res.status(500).json({ hata: "Kargo bilgisi oluşturulamadı." });
      }

      const yeniDurumId = 5;
      const siparisGuncelleSql = "UPDATE siparisler SET durum_id = ? WHERE siparis_id = ?";

      db.query(siparisGuncelleSql, [yeniDurumId, siparis_id], (guncelleErr) => {
        if (guncelleErr) {
          console.log(guncelleErr);
          return res.status(500).json({ hata: "Sipariş kargoda durumuna güncellenemedi." });
        }

        const durumGecmisiSql = `
          INSERT INTO siparis_durum_gecmisi
          (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
          VALUES (?, ?, ?, ?)
        `;

        const durumAciklama = aciklama || "Sipariş kargoya verildi.";

        db.query(durumGecmisiSql, [siparis_id, eskiDurumId, yeniDurumId, durumAciklama], (gecmisErr) => {
          if (gecmisErr) {
            console.log(gecmisErr);
            return res.status(500).json({ hata: "Kargo durum geçmişi oluşturulamadı." });
          }

          res.status(201).json({
            mesaj: "Kargo bilgisi oluşturuldu.",
            kargo_id: kargoResult.insertId,
            siparis_id,
            eski_durum_id: eskiDurumId,
            yeni_durum_id: yeniDurumId
          });
        });
      });
    });
  });
});

router.put("/delivered/:siparisId", (req, res) => {
  const siparisId = req.params.siparisId;
  const { aciklama } = req.body;

  const siparisSql = "SELECT durum_id FROM siparisler WHERE siparis_id = ? LIMIT 1";

  db.query(siparisSql, [siparisId], (siparisErr, siparisResults) => {
    if (siparisErr) {
      console.log(siparisErr);
      return res.status(500).json({ hata: "Sipariş bilgisi okunamadı." });
    }

    if (siparisResults.length === 0) {
      return res.status(404).json({ hata: "Sipariş bulunamadı." });
    }

    const eskiDurumId = siparisResults[0].durum_id;
    const yeniDurumId = 6;
    const siparisGuncelleSql = "UPDATE siparisler SET durum_id = ? WHERE siparis_id = ?";

    db.query(siparisGuncelleSql, [yeniDurumId, siparisId], (guncelleErr) => {
      if (guncelleErr) {
        console.log(guncelleErr);
        return res.status(500).json({ hata: "Sipariş teslim edildi olarak güncellenemedi." });
      }

      const kargoGuncelleSql = `
        UPDATE kargo_bilgileri
        SET teslim_tarihi = NOW()
        WHERE siparis_id = ?
      `;

      db.query(kargoGuncelleSql, [siparisId], (kargoErr) => {
        if (kargoErr) {
          console.log(kargoErr);
          return res.status(500).json({ hata: "Kargo teslim tarihi güncellenemedi." });
        }

        const durumGecmisiSql = `
          INSERT INTO siparis_durum_gecmisi
          (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
          VALUES (?, ?, ?, ?)
        `;

        const durumAciklama = aciklama || "Sipariş teslim edildi.";

        db.query(durumGecmisiSql, [siparisId, eskiDurumId, yeniDurumId, durumAciklama], (gecmisErr) => {
          if (gecmisErr) {
            console.log(gecmisErr);
            return res.status(500).json({ hata: "Teslim durum geçmişi oluşturulamadı." });
          }

          res.json({
            mesaj: "Sipariş teslim edildi olarak güncellendi.",
            siparis_id: Number(siparisId),
            eski_durum_id: eskiDurumId,
            yeni_durum_id: yeniDurumId
          });
        });
      });
    });
  });
});

module.exports = router;
