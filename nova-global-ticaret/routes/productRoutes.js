const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {
  const sql = `
    SELECT 
      u.urun_id,
      u.urun_adi,
      u.aciklama,
      u.stok_adedi,
      u.fiyat,
      m.marka_adi,
      k.kategori_adi
    FROM urunler u
    LEFT JOIN markalar m ON u.marka_id = m.marka_id
    LEFT JOIN kategoriler k ON u.kategori_id = k.kategori_id
    WHERE u.aktif_mi = 1
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Ürünler getirilemedi." });
    }

    res.json(results);
  });
});

module.exports = router;
