const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    SELECT
      MIN(s.sepet_id) AS sepet_id,
      s.uye_id,
      s.urun_id,
      SUM(s.adet) AS adet,
      u.urun_adi,
      u.aciklama,
      u.fiyat,
      u.stok_adedi,
      m.marka_adi,
      k.kategori_adi,
      (SUM(s.adet) * u.fiyat) AS ara_toplam
    FROM sepet s
    JOIN urunler u ON s.urun_id = u.urun_id
    LEFT JOIN markalar m ON u.marka_id = m.marka_id
    LEFT JOIN kategoriler k ON u.kategori_id = k.kategori_id
    WHERE s.uye_id = ?
    GROUP BY s.uye_id, s.urun_id, u.urun_adi, u.aciklama, u.fiyat, u.stok_adedi, m.marka_adi, k.kategori_adi
    ORDER BY MIN(s.sepet_id) ASC
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Sepet getirilemedi." });
    }

    res.json(results);
  });
});

router.post("/add", (req, res) => {
  const { uye_id, urun_id, adet } = req.body;

  if (!uye_id || !urun_id) {
    return res.status(400).json({ hata: "Üye ve ürün bilgisi zorunludur." });
  }

  const miktar = Number(adet || 1);

  if (miktar < 1) {
    return res.status(400).json({ hata: "Adet 1 veya daha büyük olmalıdır." });
  }

  const mevcutSql = `
    SELECT sepet_id, adet
    FROM sepet
    WHERE uye_id = ? AND urun_id = ?
    ORDER BY sepet_id ASC
  `;

  db.query(mevcutSql, [uye_id, urun_id], (mevcutErr, mevcutResults) => {
    if (mevcutErr) {
      console.log(mevcutErr);
      return res.status(500).json({ hata: "Sepet kontrol edilemedi." });
    }

    if (mevcutResults.length === 0) {
      const insertSql = "INSERT INTO sepet (uye_id, urun_id, adet) VALUES (?, ?, ?)";

      return db.query(insertSql, [uye_id, urun_id, miktar], (insertErr) => {
        if (insertErr) {
          console.log(insertErr);
          return res.status(500).json({ hata: "Ürün sepete eklenemedi." });
        }

        res.status(201).json({ mesaj: "Ürün sepete eklendi." });
      });
    }

    const anaSepetId = mevcutResults[0].sepet_id;
    const yeniAdet = mevcutResults.reduce((toplam, item) => toplam + Number(item.adet), 0) + miktar;
    const updateSql = "UPDATE sepet SET adet = ? WHERE sepet_id = ?";

    db.query(updateSql, [yeniAdet, anaSepetId], (updateErr) => {
      if (updateErr) {
        console.log(updateErr);
        return res.status(500).json({ hata: "Sepet güncellenemedi." });
      }

      const silinecekler = mevcutResults.slice(1).map((item) => item.sepet_id);

      if (silinecekler.length === 0) {
        return res.status(201).json({ mesaj: "Ürün adedi güncellendi.", adet: yeniAdet });
      }

      const temizleSql = "DELETE FROM sepet WHERE sepet_id IN (?)";

      db.query(temizleSql, [silinecekler], (temizleErr) => {
        if (temizleErr) {
          console.log(temizleErr);
          return res.status(500).json({ hata: "Tekrarlı sepet kayıtları temizlenemedi." });
        }

        res.status(201).json({ mesaj: "Ürün adedi güncellendi.", adet: yeniAdet });
      });
    });
  });
});

router.put("/update/:sepetId", (req, res) => {
  const sepetId = req.params.sepetId;
  const { adet } = req.body;

  if (!adet || adet < 1) {
    return res.status(400).json({ hata: "Adet 1 veya daha büyük olmalıdır." });
  }

  const sepetSql = "SELECT uye_id, urun_id FROM sepet WHERE sepet_id = ? LIMIT 1";

  db.query(sepetSql, [sepetId], (sepetErr, sepetResults) => {
    if (sepetErr) {
      console.log(sepetErr);
      return res.status(500).json({ hata: "Sepet bilgisi okunamadı." });
    }

    if (sepetResults.length === 0) {
      return res.status(404).json({ hata: "Sepet kaydı bulunamadı." });
    }

    const updateSql = "UPDATE sepet SET adet = ? WHERE sepet_id = ?";

    db.query(updateSql, [adet, sepetId], (updateErr) => {
      if (updateErr) {
        console.log(updateErr);
        return res.status(500).json({ hata: "Sepet güncellenemedi." });
      }

      const temizleSql = "DELETE FROM sepet WHERE uye_id = ? AND urun_id = ? AND sepet_id <> ?";

      db.query(temizleSql, [sepetResults[0].uye_id, sepetResults[0].urun_id, sepetId], (temizleErr) => {
        if (temizleErr) {
          console.log(temizleErr);
          return res.status(500).json({ hata: "Tekrarlı sepet kayıtları temizlenemedi." });
        }

        res.json({ mesaj: "Sepet güncellendi." });
      });
    });
  });
});

router.delete("/remove/:sepetId", (req, res) => {
  const sepetId = req.params.sepetId;

  const sepetSql = "SELECT uye_id, urun_id FROM sepet WHERE sepet_id = ? LIMIT 1";

  db.query(sepetSql, [sepetId], (sepetErr, sepetResults) => {
    if (sepetErr) {
      console.log(sepetErr);
      return res.status(500).json({ hata: "Sepet bilgisi okunamadı." });
    }

    if (sepetResults.length === 0) {
      return res.status(404).json({ hata: "Sepet kaydı bulunamadı." });
    }

    const sql = "DELETE FROM sepet WHERE uye_id = ? AND urun_id = ?";

    db.query(sql, [sepetResults[0].uye_id, sepetResults[0].urun_id], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Ürün sepetten silinemedi." });
      }

      res.json({ mesaj: "Ürün sepetten silindi." });
    });
  });
});

module.exports = router;
