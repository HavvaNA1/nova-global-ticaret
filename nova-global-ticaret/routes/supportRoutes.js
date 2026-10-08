const express = require("express");
const router = express.Router();
const db = require("../db");

const createTableSql = `
  CREATE TABLE IF NOT EXISTS destek_talepleri (
    talep_id INT AUTO_INCREMENT PRIMARY KEY,
    uye_id INT NOT NULL,
    konu VARCHAR(150) NOT NULL,
    mesaj TEXT NOT NULL,
    durum ENUM('acik','yanitlandi','kapandi') DEFAULT 'acik',
    admin_cevap TEXT NULL,
    olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    yanit_tarihi TIMESTAMP NULL DEFAULT NULL,
    INDEX (uye_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

function ensureTable(callback) {
  db.query(createTableSql, callback);
}

router.post("/create", (req, res) => {
  const { uye_id, konu, mesaj } = req.body;

  if (!uye_id || !konu || !mesaj) {
    return res.status(400).json({ hata: "Talep icin uye, konu ve mesaj zorunludur." });
  }

  ensureTable((tableErr) => {
    if (tableErr) {
      console.log(tableErr);
      return res.status(500).json({ hata: "Talep tablosu hazirlanamadi." });
    }

    const sql = `
      INSERT INTO destek_talepleri (uye_id, konu, mesaj)
      VALUES (?, ?, ?)
    `;

    db.query(sql, [uye_id, konu, mesaj], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Talep olusturulamadi." });
      }

      res.status(201).json({
        mesaj: "Talebiniz admin paneline iletildi.",
        talep_id: result.insertId
      });
    });
  });
});

router.get("/user/:uyeId", (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) {
      console.log(tableErr);
      return res.status(500).json({ hata: "Talep tablosu okunamadi." });
    }

    const sql = `
      SELECT talep_id, uye_id, konu, mesaj, durum, admin_cevap, olusturma_tarihi, yanit_tarihi
      FROM destek_talepleri
      WHERE uye_id = ?
      ORDER BY talep_id DESC
    `;

    db.query(sql, [req.params.uyeId], (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Talepler getirilemedi." });
      }

      res.json(results);
    });
  });
});

router.get("/admin/all", (req, res) => {
  ensureTable((tableErr) => {
    if (tableErr) {
      console.log(tableErr);
      return res.status(500).json({ hata: "Talep tablosu okunamadi." });
    }

    const sql = `
      SELECT
        dt.talep_id,
        dt.uye_id,
        u.uye_no,
        u.ad,
        u.soyad,
        u.email,
        dt.konu,
        dt.mesaj,
        dt.durum,
        dt.admin_cevap,
        dt.olusturma_tarihi,
        dt.yanit_tarihi
      FROM destek_talepleri dt
      JOIN uyeler u ON dt.uye_id = u.uye_id
      ORDER BY dt.talep_id DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Admin talepleri getirilemedi." });
      }

      res.json(results);
    });
  });
});

router.put("/admin/reply/:talepId", (req, res) => {
  const { admin_cevap, durum } = req.body;

  if (!admin_cevap) {
    return res.status(400).json({ hata: "Admin cevabi zorunludur." });
  }

  ensureTable((tableErr) => {
    if (tableErr) {
      console.log(tableErr);
      return res.status(500).json({ hata: "Talep tablosu okunamadi." });
    }

    const sql = `
      UPDATE destek_talepleri
      SET admin_cevap = ?, durum = ?, yanit_tarihi = NOW()
      WHERE talep_id = ?
    `;

    db.query(sql, [admin_cevap, durum || "yanitlandi", req.params.talepId], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ hata: "Talep yanitlanamadi." });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ hata: "Talep bulunamadi." });
      }

      res.json({ mesaj: "Talep yanitlandi.", talep_id: Number(req.params.talepId) });
    });
  });
});

module.exports = router;
