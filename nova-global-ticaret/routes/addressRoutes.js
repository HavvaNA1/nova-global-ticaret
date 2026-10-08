const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    SELECT 
      adres_id,
      uye_id,
      ulke_id,
      teslim_alacak_ad,
      teslim_alacak_soyad,
      teslim_alacak_telefon,
      il,
      ilce,
      posta_kodu,
      acik_adres,
      adres_basligi,
      varsayilan_mi,
      aktif_mi
    FROM adresler
    WHERE uye_id = ? AND aktif_mi = 1
    ORDER BY varsayilan_mi DESC, adres_id DESC
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Adresler getirilemedi." });
    }

    res.json(results);
  });
});

router.post("/add", (req, res) => {
  const {
    uye_id,
    ulke_id,
    teslim_alacak_ad,
    teslim_alacak_soyad,
    teslim_alacak_telefon,
    il,
    ilce,
    posta_kodu,
    acik_adres,
    adres_basligi
  } = req.body;

  if (!uye_id || !ulke_id || !teslim_alacak_ad || !teslim_alacak_soyad || !teslim_alacak_telefon || !il || !ilce || !acik_adres) {
    return res.status(400).json({ hata: "Zorunlu adres bilgileri eksik." });
  }

  const insertSql = `
    INSERT INTO adresler
    (uye_id, ulke_id, teslim_alacak_ad, teslim_alacak_soyad, teslim_alacak_telefon, il, ilce, posta_kodu, acik_adres, adres_basligi, varsayilan_mi, aktif_mi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
  `;

  db.query(
    insertSql,
    [uye_id, ulke_id, teslim_alacak_ad, teslim_alacak_soyad, teslim_alacak_telefon, il, ilce, posta_kodu || null, acik_adres, adres_basligi || "Adres"],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Adres eklenemedi." });
      }

      res.status(201).json({
        mesaj: "Adres eklendi.",
        adres_id: result.insertId
      });
    }
  );
});

router.put("/update/:adresId", (req, res) => {
  const adresId = req.params.adresId;
  const {
    uye_id,
    ulke_id,
    teslim_alacak_ad,
    teslim_alacak_soyad,
    teslim_alacak_telefon,
    il,
    ilce,
    posta_kodu,
    acik_adres,
    adres_basligi
  } = req.body;

  if (!uye_id || !ulke_id || !teslim_alacak_ad || !teslim_alacak_soyad || !teslim_alacak_telefon || !il || !ilce || !acik_adres) {
    return res.status(400).json({ hata: "Zorunlu adres bilgileri eksik." });
  }

  const sql = `
    UPDATE adresler
    SET ulke_id = ?, teslim_alacak_ad = ?, teslim_alacak_soyad = ?, teslim_alacak_telefon = ?, il = ?, ilce = ?, posta_kodu = ?, acik_adres = ?, adres_basligi = ?
    WHERE adres_id = ? AND uye_id = ? AND aktif_mi = 1
  `;

  db.query(
    sql,
    [ulke_id, teslim_alacak_ad, teslim_alacak_soyad, teslim_alacak_telefon, il, ilce, posta_kodu || null, acik_adres, adres_basligi || "Adres", adresId, uye_id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Adres güncellenemedi." });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ hata: "Güncellenecek adres bulunamadı." });
      }

      res.json({
        mesaj: "Adres güncellendi.",
        adres_id: Number(adresId)
      });
    }
  );
});
router.put("/default/:adresId", (req, res) => {
  const adresId = req.params.adresId;
  const { uye_id } = req.body;

  if (!uye_id) {
    return res.status(400).json({ hata: "Üye bilgisi zorunludur." });
  }

  const sifirlaSql = "UPDATE adresler SET varsayilan_mi = 0 WHERE uye_id = ?";
  const varsayilanSql = "UPDATE adresler SET varsayilan_mi = 1 WHERE adres_id = ? AND uye_id = ?";
  const uyeGuncelleSql = "UPDATE uyeler SET adres_id = ? WHERE uye_id = ?";

  db.query(sifirlaSql, [uye_id], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Adresler güncellenemedi." });
    }

    db.query(varsayilanSql, [adresId, uye_id], (err2) => {
      if (err2) {
        console.log(err2);
        return res.status(500).json({ hata: "Varsayılan adres seçilemedi." });
      }

      db.query(uyeGuncelleSql, [adresId, uye_id], (err3) => {
        if (err3) {
          console.log(err3);
          return res.status(500).json({ hata: "Üye varsayılan adresi güncellenemedi." });
        }

        res.json({ mesaj: "Varsayılan adres güncellendi." });
      });
    });
  });
});

router.delete("/remove/:adresId", (req, res) => {
  const adresId = req.params.adresId;

  const sql = "UPDATE adresler SET aktif_mi = 0 WHERE adres_id = ?";

  db.query(sql, [adresId], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Adres silinemedi." });
    }

    res.json({ mesaj: "Adres pasif hale getirildi." });
  });
});

module.exports = router;


