const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    SELECT 
      f.favori_id,
      f.uye_id,
      f.urun_id,
      u.urun_adi,
      u.aciklama,
      u.fiyat,
      u.stok_adedi,
      m.marka_adi,
      k.kategori_adi,
      f.eklenme_tarihi
    FROM favoriler f
    JOIN urunler u ON f.urun_id = u.urun_id
    LEFT JOIN markalar m ON u.marka_id = m.marka_id
    LEFT JOIN kategoriler k ON u.kategori_id = k.kategori_id
    WHERE f.uye_id = ?
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Favoriler getirilemedi." });
    }

    res.json(results);
  });
});

router.post("/add", (req, res) => {
  const { uye_id, urun_id } = req.body;

  if (!uye_id || !urun_id) {
    return res.status(400).json({ hata: "Üye ve ürün bilgisi zorunludur." });
  }

  const sql = `
    INSERT INTO favoriler (uye_id, urun_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE urun_id = VALUES(urun_id)
  `;

  db.query(sql, [uye_id, urun_id], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Ürün favorilere eklenemedi." });
    }

    res.status(201).json({ mesaj: "Ürün favorilere eklendi." });
  });
});

router.delete("/remove/:favoriId", (req, res) => {
  const favoriId = req.params.favoriId;

  const sql = "DELETE FROM favoriler WHERE favori_id = ?";

  db.query(sql, [favoriId], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Favori silinemedi." });
    }

    res.json({ mesaj: "Favori silindi." });
  });
});

module.exports = router;
