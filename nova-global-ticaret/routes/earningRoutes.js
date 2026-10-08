const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    SELECT
      uk.kazanc_id,
      uk.kazanan_uye_id,
      uk.siparis_id,
      uk.kazanc_kaynagi_uye_id,
      kaynak.uye_no AS kaynak_uye_no,
      kaynak.ad AS kaynak_ad,
      kaynak.soyad AS kaynak_soyad,
      uk.kazanc_orani,
      uk.kazanc_tutari,
      uk.kazanc_durumu,
      uk.aciklama,
      uk.kazanc_tarihi
    FROM uye_kazanclari uk
    LEFT JOIN uyeler kaynak ON uk.kazanc_kaynagi_uye_id = kaynak.uye_id
    WHERE uk.kazanan_uye_id = ?
    ORDER BY uk.kazanc_id DESC
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Kazançlar getirilemedi." });
    }

    const toplamBekleyen = results
      .filter((item) => item.kazanc_durumu === "bekliyor")
      .reduce((toplam, item) => toplam + Number(item.kazanc_tutari), 0);

    const toplamOnaylanan = results
      .filter((item) => item.kazanc_durumu === "onaylandi")
      .reduce((toplam, item) => toplam + Number(item.kazanc_tutari), 0);

    const toplamOdenen = results
      .filter((item) => item.kazanc_durumu === "odendi")
      .reduce((toplam, item) => toplam + Number(item.kazanc_tutari), 0);

    res.json({
      ozet: {
        toplam_bekleyen: toplamBekleyen,
        toplam_onaylanan: toplamOnaylanan,
        toplam_odenen: toplamOdenen
      },
      kazanclar: results
    });
  });
});

module.exports = router;
