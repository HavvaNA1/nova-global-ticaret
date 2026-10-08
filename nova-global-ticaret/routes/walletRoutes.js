const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const cuzdanSql = `
    SELECT
      c.cuzdan_id,
      c.uye_id,
      c.para_birimi_id,
      pb.para_birimi_adi,
      pb.para_birimi_kodu,
      pb.sembol,
      c.bakiye,
      c.blokeli_bakiye,
      c.aktif_mi,
      c.olusturma_tarihi,
      c.guncelleme_tarihi
    FROM cuzdanlar c
    LEFT JOIN para_birimleri pb ON c.para_birimi_id = pb.para_birimi_id
    WHERE c.uye_id = ? AND c.aktif_mi = 1
    LIMIT 1
  `;

  db.query(cuzdanSql, [uyeId], (cuzdanErr, cuzdanResults) => {
    if (cuzdanErr) {
      console.log(cuzdanErr);
      return res.status(500).json({ hata: "Cüzdan bilgisi getirilemedi." });
    }

    if (cuzdanResults.length === 0) {
      return res.status(404).json({ hata: "Aktif cüzdan bulunamadı." });
    }

    const hareketSql = `
      SELECT
        hareket_id,
        uye_id,
        odeme_yapan_uye_id,
        ilgili_uye_id,
        siparis_id,
        islem_tipi,
        tutar,
        onceki_bakiye,
        sonraki_bakiye,
        aciklama,
        hareket_tarihi
      FROM cuzdan_hareketleri
      WHERE uye_id = ?
      ORDER BY hareket_id DESC
    `;

    db.query(hareketSql, [uyeId], (hareketErr, hareketResults) => {
      if (hareketErr) {
        console.log(hareketErr);
        return res.status(500).json({ hata: "Cüzdan hareketleri getirilemedi." });
      }

      res.json({
        cuzdan: cuzdanResults[0],
        hareketler: hareketResults
      });
    });
  });
});

module.exports = router;
