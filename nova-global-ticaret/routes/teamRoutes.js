const express = require("express");
const router = express.Router();
const db = require("../db");

function getLegName(index) {
  if (Number(index) === 0) return "Sol Kol";
  if (Number(index) === 1) return "Sağ Kol";
  return "Yerleşim Bekliyor";
}

function memberSelectSql(whereSql) {
  return "SELECT " +
    "u.uye_id, u.uye_no, u.ad, u.soyad, u.email, u.telefon, u.paket_seviyesi, " +
    "u.sponsor_uye_id, u.toplam_alisveris, u.aktif_mi, u.ulke, u.il, " +
    "COUNT(DISTINCT s.siparis_id) AS siparis_sayisi, " +
    "COALESCE(SUM(CASE WHEN s.odeme_durumu = 'odendi' THEN s.odenecek_tutar ELSE 0 END), 0) AS toplam_siparis_tutari " +
    "FROM uyeler u " +
    "LEFT JOIN siparisler s ON u.uye_id = s.uye_id " +
    whereSql + " GROUP BY u.uye_id";
}

router.get("/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;
  const rootSql = memberSelectSql("WHERE u.uye_id = ? AND u.aktif_mi = 1") + " LIMIT 1";

  db.query(rootSql, [uyeId], (rootErr, rootResults) => {
    if (rootErr) {
      console.log(rootErr);
      return res.status(500).json({ hata: "Takım ana üyesi getirilemedi." });
    }

    if (rootResults.length === 0) {
      return res.status(404).json({ hata: "Üye bulunamadı." });
    }

    const childrenSql = "SELECT " +
      "u.uye_id, u.uye_no, u.ad, u.soyad, u.email, u.telefon, u.paket_seviyesi, " +
      "u.sponsor_uye_id, u.toplam_alisveris, u.aktif_mi, u.ulke, u.il, " +
      "ta.takim_agaci_id, ta.seviye AS takim_sirasi, " +
      "COUNT(DISTINCT s.siparis_id) AS siparis_sayisi, " +
      "COALESCE(SUM(CASE WHEN s.odeme_durumu = 'odendi' THEN s.odenecek_tutar ELSE 0 END), 0) AS toplam_siparis_tutari " +
      "FROM uyeler u " +
      "LEFT JOIN takim_agaci ta ON ta.alt_uye_id = u.uye_id AND ta.sponsor_uye_id = ? AND ta.aktif_mi = 1 " +
      "LEFT JOIN siparisler s ON u.uye_id = s.uye_id " +
      "WHERE u.sponsor_uye_id = ? AND u.aktif_mi = 1 " +
      "GROUP BY u.uye_id, ta.takim_agaci_id, ta.seviye " +
      "ORDER BY COALESCE(ta.seviye, 99) ASC, u.uye_id ASC";

    db.query(childrenSql, [uyeId, uyeId], (childErr, childResults) => {
      if (childErr) {
        console.log(childErr);
        return res.status(500).json({ hata: "Takım bayileri getirilemedi." });
      }

      const placedResults = childResults.filter((item) => item.takim_agaci_id);
      const pendingResults = childResults.filter((item) => !item.takim_agaci_id);
      const childIds = childResults.map((item) => item.uye_id);

      const buildResponse = (grandChildren) => {
        const placedChildren = placedResults.map((child) => ({
          ...child,
          kol: getLegName(child.takim_sirasi),
          yerlesim_durumu: "yerlesti",
          aktiflik: Number(child.toplam_siparis_tutari || 0) >= 3000,
          alt_bayiler: grandChildren.filter((item) => Number(item.sponsor_uye_id) === Number(child.uye_id))
        }));

        const pendingChildren = pendingResults.map((child) => ({
          ...child,
          kol: "Yerleşim Bekliyor",
          yerlesim_durumu: "bekliyor",
          aktiflik: Number(child.toplam_siparis_tutari || 0) >= 3000,
          alt_bayiler: grandChildren.filter((item) => Number(item.sponsor_uye_id) === Number(child.uye_id))
        }));

        const solKol = placedChildren.filter((item) => Number(item.takim_sirasi) === 0);
        const sagKol = placedChildren.filter((item) => Number(item.takim_sirasi) === 1);
        const solAktif = solKol.filter((item) => Number(item.toplam_siparis_tutari || 0) >= 3000).length;
        const sagAktif = sagKol.filter((item) => Number(item.toplam_siparis_tutari || 0) >= 3000).length;

        res.json({
          uye: rootResults[0],
          bayiler: placedChildren,
          bekleyen_bayiler: pendingChildren,
          tum_bayiler: [...placedChildren, ...pendingChildren],
          ozet: {
            toplam_bayi: placedChildren.length + pendingChildren.length,
            yerlesen_bayi: placedChildren.length,
            bekleyen_bayi: pendingChildren.length,
            sol_kol_bayi: solKol.length,
            sag_kol_bayi: sagKol.length,
            sol_kol_alisveris: solKol.reduce((sum, item) => sum + Number(item.toplam_siparis_tutari || 0), 0),
            sag_kol_alisveris: sagKol.reduce((sum, item) => sum + Number(item.toplam_siparis_tutari || 0), 0),
            sol_aktif_bayi: solAktif,
            sag_aktif_bayi: sagAktif,
            bonus_2_2_hazir: solAktif >= 2 && sagAktif >= 2
          }
        });
      };

      if (childIds.length === 0) {
        return buildResponse([]);
      }

      const placeholders = childIds.map(() => "?").join(",");
      const grandSql = memberSelectSql("WHERE u.sponsor_uye_id IN (" + placeholders + ") AND u.aktif_mi = 1");

      db.query(grandSql, childIds, (grandErr, grandResults) => {
        if (grandErr) {
          console.log(grandErr);
          return res.status(500).json({ hata: "Alt bayi bilgileri getirilemedi." });
        }

        buildResponse(grandResults);
      });
    });
  });
});

router.post("/place", (req, res) => {
  const { sponsor_uye_id, alt_uye_id, seviye } = req.body;
  const leg = Number(seviye);

  if (!sponsor_uye_id || !alt_uye_id || ![0, 1].includes(leg)) {
    return res.status(400).json({ hata: "Sponsor, bayi ve kol bilgisi zorunludur." });
  }

  const kontrolSql = `
    SELECT uye_id, sponsor_uye_id
    FROM uyeler
    WHERE uye_id = ? AND sponsor_uye_id = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(kontrolSql, [alt_uye_id, sponsor_uye_id], (kontrolErr, kontrolResults) => {
    if (kontrolErr) {
      console.log(kontrolErr);
      return res.status(500).json({ hata: "Bayi kontrolü yapılamadı." });
    }

    if (kontrolResults.length === 0) {
      return res.status(404).json({ hata: "Bu bayi seçilen sponsorun altında bulunamadı." });
    }

    const eskiKayitSql = `
      SELECT takim_agaci_id
      FROM takim_agaci
      WHERE sponsor_uye_id = ? AND alt_uye_id = ? AND aktif_mi = 1
      LIMIT 1
    `;

    db.query(eskiKayitSql, [sponsor_uye_id, alt_uye_id], (eskiErr, eskiResults) => {
      if (eskiErr) {
        console.log(eskiErr);
        return res.status(500).json({ hata: "Yerleşim kaydı okunamadı." });
      }

      if (eskiResults.length > 0) {
        const updateSql = "UPDATE takim_agaci SET seviye = ? WHERE takim_agaci_id = ?";
        return db.query(updateSql, [leg, eskiResults[0].takim_agaci_id], (updateErr) => {
          if (updateErr) {
            console.log(updateErr);
            return res.status(500).json({ hata: "Bayi yerleşimi güncellenemedi." });
          }

          res.json({ mesaj: "Bayi yerleşimi güncellendi.", alt_uye_id: Number(alt_uye_id), kol: getLegName(leg) });
        });
      }

      const insertSql = `
        INSERT INTO takim_agaci
        (sponsor_uye_id, alt_uye_id, seviye, aktif_mi)
        VALUES (?, ?, ?, 1)
      `;

      db.query(insertSql, [sponsor_uye_id, alt_uye_id, leg], (insertErr) => {
        if (insertErr) {
          console.log(insertErr);
          return res.status(500).json({ hata: "Bayi yerleşimi oluşturulamadı." });
        }

        res.status(201).json({ mesaj: "Bayi kola yerleştirildi.", alt_uye_id: Number(alt_uye_id), kol: getLegName(leg) });
      });
    });
  });
});

module.exports = router;
