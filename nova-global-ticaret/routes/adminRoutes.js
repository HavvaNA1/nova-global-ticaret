const express = require("express");
const router = express.Router();
const db = require("../db");
router.post("/login", (req, res) => {
  const { email, sifre } = req.body;

  if (!email || !sifre) {
    return res.status(400).json({ hata: "Email ve şifre zorunludur." });
  }

  const normalizedEmail = String(email).toLowerCase();

  if (normalizedEmail === "admin@nova.com" && sifre === "admin123") {
    return res.json({
      mesaj: "Admin girişi başarılı.",
      admin: {
        uye_id: 0,
        uye_no: "ADMIN",
        ad: "Nova",
        soyad: "Admin",
        email: "admin@nova.com",
        yetki: "super_admin"
      }
    });
  }

  const sql = `
    SELECT uye_id, uye_no, ad, soyad, email, aktif_mi
    FROM uyeler
    WHERE email = ? AND sifre = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(sql, [email, sifre], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Admin girişi yapılırken hata oluştu." });
    }

    if (results.length === 0) {
      return res.status(401).json({ hata: "Email veya şifre hatalı." });
    }

    const user = results[0];
    const adminEmails = ["admin@nova.com", "havva@nova.com", "havva@nova.com.tr"];
    const adminMi = Number(user.uye_id) === 7 || adminEmails.includes(String(user.email || "").toLowerCase());

    if (!adminMi) {
      return res.status(403).json({ hata: "Bu kullanıcı admin paneline yetkili değil." });
    }

    res.json({
      mesaj: "Admin girişi başarılı.",
      admin: {
        ...user,
        yetki: "admin"
      }
    });
  });
});

router.get("/summary", (req, res) => {
  const summary = {};

  db.query("SELECT COUNT(*) AS toplam_uye FROM uyeler", (uyeErr, uyeResults) => {
    if (uyeErr) {
      console.log(uyeErr);
      return res.status(500).json({ hata: "Toplam üye sayısı alınamadı." });
    }

    summary.toplam_uye = uyeResults[0].toplam_uye;

    db.query("SELECT COUNT(*) AS toplam_siparis FROM siparisler", (siparisErr, siparisResults) => {
      if (siparisErr) {
        console.log(siparisErr);
        return res.status(500).json({ hata: "Toplam sipariş sayısı alınamadı." });
      }

      summary.toplam_siparis = siparisResults[0].toplam_siparis;

      db.query("SELECT COUNT(*) AS bekleyen_havale FROM siparisler WHERE durum_id = 2", (havaleErr, havaleResults) => {
        if (havaleErr) {
          console.log(havaleErr);
          return res.status(500).json({ hata: "Bekleyen havale sayısı alınamadı." });
        }

        summary.bekleyen_havale = havaleResults[0].bekleyen_havale;

        db.query("SELECT COUNT(*) AS kargodaki_siparis FROM siparisler WHERE durum_id = 5", (kargoErr, kargoResults) => {
          if (kargoErr) {
            console.log(kargoErr);
            return res.status(500).json({ hata: "Kargodaki sipariş sayısı alınamadı." });
          }

          summary.kargodaki_siparis = kargoResults[0].kargodaki_siparis;

          db.query("SELECT COALESCE(SUM(odenecek_tutar), 0) AS toplam_satis FROM siparisler WHERE odeme_durumu = 'odendi'", (satisErr, satisResults) => {
            if (satisErr) {
              console.log(satisErr);
              return res.status(500).json({ hata: "Toplam satış tutarı alınamadı." });
            }

            summary.toplam_satis = satisResults[0].toplam_satis;

            db.query("SELECT COALESCE(SUM(kazanc_tutari), 0) AS bekleyen_kazanc FROM uye_kazanclari WHERE kazanc_durumu = 'bekliyor'", (kazancErr, kazancResults) => {
              if (kazancErr) {
                console.log(kazancErr);
                return res.status(500).json({ hata: "Bekleyen kazanç tutarı alınamadı." });
              }

              summary.bekleyen_kazanc = kazancResults[0].bekleyen_kazanc;

              res.json(summary);
            });
          });
        });
      });
    });
  });
});

router.get("/orders", (req, res) => {
  const sql = `
    SELECT
      s.siparis_id,
      s.siparis_no,
      s.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
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
      o.odeme_tutari
    FROM siparisler s
    JOIN uyeler u ON s.uye_id = u.uye_id
    LEFT JOIN siparis_durumlari sd ON s.durum_id = sd.durum_id
    LEFT JOIN (
      SELECT odeme_id, siparis_id, odeme_tipi, odeme_tutari
      FROM odemeler
      WHERE odeme_id IN (SELECT MAX(odeme_id) FROM odemeler GROUP BY siparis_id)
    ) o ON s.siparis_id = o.siparis_id
    ORDER BY s.siparis_id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Admin sipari? listesi getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/earnings/pending", (req, res) => {
  const sql = `
    SELECT
      uk.kazanc_id,
      uk.kazanan_uye_id,
      kazanan.uye_no AS kazanan_uye_no,
      kazanan.ad AS kazanan_ad,
      kazanan.soyad AS kazanan_soyad,
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
    JOIN uyeler kazanan ON uk.kazanan_uye_id = kazanan.uye_id
    JOIN uyeler kaynak ON uk.kazanc_kaynagi_uye_id = kaynak.uye_id
    WHERE uk.kazanc_durumu = 'bekliyor'
    ORDER BY uk.kazanc_id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Bekleyen kazançlar getirilemedi." });
    }

    res.json(results);
  });
});

router.put("/earnings/approve/:kazancId", (req, res) => {
  const kazancId = req.params.kazancId;

  const kazancSql = `
    SELECT
      kazanc_id,
      kazanan_uye_id,
      siparis_id,
      kazanc_tutari,
      kazanc_durumu
    FROM uye_kazanclari
    WHERE kazanc_id = ?
    LIMIT 1
  `;

  db.query(kazancSql, [kazancId], (kazancErr, kazancResults) => {
    if (kazancErr) {
      console.log(kazancErr);
      return res.status(500).json({ hata: "Kazanç bilgisi okunamadı." });
    }

    if (kazancResults.length === 0) {
      return res.status(404).json({ hata: "Kazanç kaydı bulunamadı." });
    }

    const kazanc = kazancResults[0];

    if (kazanc.kazanc_durumu !== "bekliyor") {
      return res.status(400).json({ hata: "Bu kazanç zaten işleme alınmış." });
    }

    const cuzdanSql = `
      SELECT cuzdan_id, bakiye
      FROM cuzdanlar
      WHERE uye_id = ? AND aktif_mi = 1
      LIMIT 1
    `;

    db.query(cuzdanSql, [kazanc.kazanan_uye_id], (cuzdanErr, cuzdanResults) => {
      if (cuzdanErr) {
        console.log(cuzdanErr);
        return res.status(500).json({ hata: "Cüzdan bilgisi okunamadı." });
      }

      if (cuzdanResults.length === 0) {
        return res.status(404).json({ hata: "Kazanan üyeye ait aktif cüzdan bulunamadı." });
      }

      const cuzdan = cuzdanResults[0];
      const oncekiBakiye = Number(cuzdan.bakiye);
      const tutar = Number(kazanc.kazanc_tutari);
      const sonrakiBakiye = oncekiBakiye + tutar;

      const cuzdanGuncelleSql = `
        UPDATE cuzdanlar
        SET bakiye = ?
        WHERE cuzdan_id = ?
      `;

      db.query(cuzdanGuncelleSql, [sonrakiBakiye, cuzdan.cuzdan_id], (cuzdanGuncelleErr) => {
        if (cuzdanGuncelleErr) {
          console.log(cuzdanGuncelleErr);
          return res.status(500).json({ hata: "Cüzdan bakiyesi güncellenemedi." });
        }

        const hareketSql = `
          INSERT INTO cuzdan_hareketleri
          (uye_id, odeme_yapan_uye_id, ilgili_uye_id, siparis_id, islem_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama)
          VALUES (?, NULL, NULL, ?, 'komisyon', ?, ?, ?, ?)
        `;

        const hareketAciklama = "Sponsor komisyon kazancı cüzdana aktarıldı.";

        db.query(
          hareketSql,
          [
            kazanc.kazanan_uye_id,
            kazanc.siparis_id,
            tutar,
            oncekiBakiye,
            sonrakiBakiye,
            hareketAciklama
          ],
          (hareketErr) => {
            if (hareketErr) {
              console.log(hareketErr);
              return res.status(500).json({ hata: "Cüzdan hareketi oluşturulamadı." });
            }

            const kazancGuncelleSql = `
              UPDATE uye_kazanclari
              SET kazanc_durumu = 'odendi'
              WHERE kazanc_id = ?
            `;

            db.query(kazancGuncelleSql, [kazancId], (kazancGuncelleErr) => {
              if (kazancGuncelleErr) {
                console.log(kazancGuncelleErr);
                return res.status(500).json({ hata: "Kazanç durumu güncellenemedi." });
              }

              res.json({
                mesaj: "Kazanç onaylandı ve cüzdana aktarıldı.",
                kazanc_id: Number(kazancId),
                kazanan_uye_id: kazanc.kazanan_uye_id,
                tutar,
                onceki_bakiye: oncekiBakiye,
                sonraki_bakiye: sonrakiBakiye
              });
            });
          }
        );
      });
    });
  });
});


router.get("/payments/pending", (req, res) => {
  const sql = `
    SELECT
      o.odeme_id,
      o.siparis_id,
      o.siparis_veren_uye_id,
      o.odeme_yapan_uye_id,
      o.odeme_tipi,
      o.odeme_tutari,
      o.odeme_durumu,
      o.aciklama,
      o.odeme_tarihi,
      s.siparis_no,
      s.durum_id,
      sd.durum_adi,
      siparis_uye.uye_no AS siparis_veren_uye_no,
      siparis_uye.ad AS siparis_veren_ad,
      siparis_uye.soyad AS siparis_veren_soyad,
      odeyen_uye.uye_no AS odeme_yapan_uye_no,
      odeyen_uye.ad AS odeme_yapan_ad,
      odeyen_uye.soyad AS odeme_yapan_soyad
    FROM odemeler o
    JOIN siparisler s ON o.siparis_id = s.siparis_id
    LEFT JOIN siparis_durumlari sd ON s.durum_id = sd.durum_id
    JOIN uyeler siparis_uye ON o.siparis_veren_uye_id = siparis_uye.uye_id
    JOIN uyeler odeyen_uye ON o.odeme_yapan_uye_id = odeyen_uye.uye_id
    WHERE o.odeme_durumu = 'bekliyor'
    ORDER BY o.odeme_id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Bekleyen odemeler getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/wallet-movements", (req, res) => {
  const sql = `
    SELECT
      ch.hareket_id,
      ch.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
      ch.odeme_yapan_uye_id,
      ch.ilgili_uye_id,
      ch.siparis_id,
      ch.islem_tipi,
      ch.tutar,
      ch.onceki_bakiye,
      ch.sonraki_bakiye,
      ch.aciklama,
      ch.hareket_tarihi
    FROM cuzdan_hareketleri ch
    JOIN uyeler u ON ch.uye_id = u.uye_id
    ORDER BY ch.hareket_id DESC
    LIMIT 100
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Hesap hareketleri getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/members", (req, res) => {
  const q = String(req.query.q || "").trim();
  const like = `%${q}%`;
  const params = q ? [Number(q) || -1, like, like, like, like, like, like] : [];
  const whereSql = q
    ? `WHERE u.uye_id = ? OR u.uye_no LIKE ? OR u.ad LIKE ? OR u.soyad LIKE ? OR CONCAT(u.ad, ' ', u.soyad) LIKE ? OR u.telefon LIKE ? OR u.email LIKE ?`
    : "";

  const sql = `
    SELECT
      u.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
      u.email,
      u.telefon,
      u.paket_seviyesi,
      u.sponsor_uye_id,
      sponsor.uye_no AS sponsor_uye_no,
      sponsor.ad AS sponsor_ad,
      sponsor.soyad AS sponsor_soyad,
      u.toplam_alisveris,
      u.cuzdan_bakiyesi,
      u.ulke,
      u.il,
      u.ilce,
      u.adres,
      u.aktif_mi,
      u.kayit_tarihi,
      c.bakiye,
      c.blokeli_bakiye,
      pb.para_birimi_kodu,
      pb.sembol,
      (SELECT COUNT(*) FROM siparisler s WHERE s.uye_id = u.uye_id) AS siparis_sayisi,
      (SELECT COALESCE(SUM(s.odenecek_tutar), 0) FROM siparisler s WHERE s.uye_id = u.uye_id AND s.odeme_durumu = 'odendi') AS toplam_odenen_siparis
    FROM uyeler u
    LEFT JOIN uyeler sponsor ON u.sponsor_uye_id = sponsor.uye_id
    LEFT JOIN cuzdanlar c ON u.uye_id = c.uye_id AND c.aktif_mi = 1
    LEFT JOIN para_birimleri pb ON c.para_birimi_id = pb.para_birimi_id
    ${whereSql}
    ORDER BY u.uye_id DESC
    LIMIT 120
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Üyeler getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/members/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;
  const sql = `
    SELECT
      u.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
      u.email,
      u.telefon,
      u.paket_seviyesi,
      u.sponsor_uye_id,
      sponsor.uye_no AS sponsor_uye_no,
      sponsor.ad AS sponsor_ad,
      sponsor.soyad AS sponsor_soyad,
      u.toplam_alisveris,
      u.cuzdan_bakiyesi,
      u.ulke,
      u.il,
      u.ilce,
      u.adres,
      u.aktif_mi,
      u.kayit_tarihi,
      c.bakiye,
      c.blokeli_bakiye,
      pb.para_birimi_adi,
      pb.para_birimi_kodu,
      pb.sembol
    FROM uyeler u
    LEFT JOIN uyeler sponsor ON u.sponsor_uye_id = sponsor.uye_id
    LEFT JOIN cuzdanlar c ON u.uye_id = c.uye_id AND c.aktif_mi = 1
    LEFT JOIN para_birimleri pb ON c.para_birimi_id = pb.para_birimi_id
    WHERE u.uye_id = ?
    LIMIT 1
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Üye detayı getirilemedi." });
    }

    if (results.length === 0) {
      return res.status(404).json({ hata: "Üye bulunamadı." });
    }

    res.json(results[0]);
  });
});


router.get("/team/pending", (req, res) => {
  const sql = `
    SELECT
      u.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
      u.email,
      u.telefon,
      u.paket_seviyesi,
      u.sponsor_uye_id,
      sponsor.uye_no AS sponsor_uye_no,
      sponsor.ad AS sponsor_ad,
      sponsor.soyad AS sponsor_soyad,
      u.toplam_alisveris,
      COUNT(DISTINCT s.siparis_id) AS siparis_sayisi,
      COALESCE(SUM(CASE WHEN s.odeme_durumu = 'odendi' THEN s.odenecek_tutar ELSE 0 END), 0) AS toplam_siparis_tutari
    FROM uyeler u
    JOIN uyeler sponsor ON u.sponsor_uye_id = sponsor.uye_id
    LEFT JOIN takim_agaci ta
      ON ta.sponsor_uye_id = u.sponsor_uye_id
      AND ta.alt_uye_id = u.uye_id
      AND ta.aktif_mi = 1
    LEFT JOIN siparisler s ON s.uye_id = u.uye_id
    WHERE u.aktif_mi = 1
      AND u.sponsor_uye_id IS NOT NULL
      AND ta.takim_agaci_id IS NULL
    GROUP BY
      u.uye_id,
      u.uye_no,
      u.ad,
      u.soyad,
      u.email,
      u.telefon,
      u.paket_seviyesi,
      u.sponsor_uye_id,
      sponsor.uye_no,
      sponsor.ad,
      sponsor.soyad,
      u.toplam_alisveris
    ORDER BY u.uye_id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Yerle?im bekleyen bayiler getirilemedi." });
    }

    res.json(results);
  });
});

module.exports = router;





