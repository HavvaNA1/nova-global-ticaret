const express = require("express");
const router = express.Router();
const db = require("../db");

function normalizeSupportedCountry(ulke) {
  const value = String(ulke || "").trim().toLocaleLowerCase("tr-TR");

  if (value === "türkiye" || value === "turkiye" || value === "tr") return "Türkiye";
  if (value === "azerbaycan" || value === "azərbaycan" || value === "az") return "Azerbaycan";
  if (
    value === "amerika birleşik devletleri" ||
    value === "amerika birlesik devletleri" ||
    value === "abd" ||
    value === "usa" ||
    value === "united states"
  ) {
    return "Amerika Birleşik Devletleri";
  }

  return null;
}
function uyeSelectSql() {
  return `
    SELECT 
      uye_id,
      uye_no,
      ad,
      soyad,
      email,
      telefon,
      paket_seviyesi,
      sponsor_uye_id,
      toplam_alisveris,
      cuzdan_bakiyesi,
      ulke,
      il,
      ilce,
      adres,
      aktif_mi,
      kayit_tarihi
    FROM uyeler
  `;
}

router.post("/login", (req, res) => {
  const { email, sifre } = req.body;

  if (!email || !sifre) {
    return res.status(400).json({ hata: "Email ve ÅŸifre zorunludur." });
  }

  const sql = `
    ${uyeSelectSql()}
    WHERE email = ? AND sifre = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(sql, [email, sifre], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "GiriÅŸ yapÄ±lÄ±rken hata oluÅŸtu." });
    }

    if (results.length === 0) {
      return res.status(401).json({ hata: "Email veya ÅŸifre hatalÄ±." });
    }

    res.json({
      mesaj: "GiriÅŸ baÅŸarÄ±lÄ±.",
      uye: results[0]
    });
  });
});

router.post("/register", (req, res) => {
  const {
    ad,
    soyad,
    email,
    telefon,
    sifre,
    ulke,
    il,
    ilce,
    adres,
    sponsor_uye_no
  } = req.body;

  if (!ad || !soyad || !email || !telefon || !sifre || !ulke) {
    return res.status(400).json({ hata: "Ad, soyad, email, telefon, ülke ve şifre zorunludur." });
  }

  const desteklenenUlke = normalizeSupportedCountry(ulke);

  if (!desteklenenUlke) {
    return res.status(400).json({ hata: "Şu an sadece Türkiye, Azerbaycan ve Amerika Birleşik Devletleri destekleniyor." });
  }

  const emailKontrolSql = "SELECT uye_id FROM uyeler WHERE email = ? LIMIT 1";

  db.query(emailKontrolSql, [email], (emailErr, emailResults) => {
    if (emailErr) {
      console.log(emailErr);
      return res.status(500).json({ hata: "Email kontrolÃ¼ yapÄ±lÄ±rken hata oluÅŸtu." });
    }

    if (emailResults.length > 0) {
      return res.status(409).json({ hata: "Bu email adresi zaten kayÄ±tlÄ±." });
    }

    const sponsorBulVeKaydet = (sponsorUyeId) => {
      const insertSql = `
        INSERT INTO uyeler
        (ad, soyad, email, telefon, sifre, paket_seviyesi, sponsor_uye_id, toplam_alisveris, cuzdan_bakiyesi, ulke, il, ilce, adres)
        VALUES (?, ?, ?, ?, ?, 'standart', ?, 0, 0, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [ad, soyad, email, telefon, sifre, sponsorUyeId, desteklenenUlke, il || null, ilce || null, adres || null],
        (insertErr, insertResult) => {
          if (insertErr) {
            console.log(insertErr);
            return res.status(500).json({ hata: "Ãœye kaydÄ± oluÅŸturulamadÄ±." });
          }

          const yeniUyeId = insertResult.insertId;
          const uyeNo = `9000${yeniUyeId + 4}`;
          const updateSql = "UPDATE uyeler SET uye_no = ? WHERE uye_id = ?";

          db.query(updateSql, [uyeNo, yeniUyeId], (updateErr) => {
            if (updateErr) {
              console.log(updateErr);
              return res.status(500).json({ hata: "Ãœye numarasÄ± oluÅŸturulamadÄ±." });
            }

            res.status(201).json({
              mesaj: "KayÄ±t baÅŸarÄ±lÄ±.",
              uye: {
                uye_id: yeniUyeId,
                uye_no: uyeNo,
                ad,
                soyad,
                email,
                telefon,
                paket_seviyesi: "standart",
                sponsor_uye_id: sponsorUyeId,
                ulke: desteklenenUlke,
                il: il || null,
                ilce: ilce || null,
                adres: adres || null
              }
            });
          });
        }
      );
    };

    if (sponsor_uye_no) {
      const sponsorSql = "SELECT uye_id FROM uyeler WHERE uye_no = ? AND aktif_mi = 1 LIMIT 1";

      db.query(sponsorSql, [sponsor_uye_no], (sponsorErr, sponsorResults) => {
        if (sponsorErr) {
          console.log(sponsorErr);
          return res.status(500).json({ hata: "Sponsor kontrolÃ¼ yapÄ±lÄ±rken hata oluÅŸtu." });
        }

        if (sponsorResults.length === 0) {
          return res.status(404).json({ hata: "Sponsor Ã¼ye numarasÄ± bulunamadÄ±." });
        }

        sponsorBulVeKaydet(sponsorResults[0].uye_id);
      });
    } else {
      sponsorBulVeKaydet(null);
    }
  });
});

router.get("/profile/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

  const sql = `
    ${uyeSelectSql()}
    WHERE uye_id = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Profil bilgisi getirilemedi." });
    }

    if (results.length === 0) {
      return res.status(404).json({ hata: "Ãœye bulunamadÄ±." });
    }

    res.json(results[0]);
  });
});

router.put("/profile/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;
  const { ad, soyad, email, telefon, ulke, il, ilce, adres } = req.body;

  if (!ad || !soyad || !email || !telefon) {
    return res.status(400).json({ hata: "Ad, soyad, email ve telefon zorunludur." });
  }

  const emailKontrolSql = `
    SELECT uye_id
    FROM uyeler
    WHERE email = ? AND uye_id != ?
    LIMIT 1
  `;

  db.query(emailKontrolSql, [email, uyeId], (emailErr, emailResults) => {
    if (emailErr) {
      console.log(emailErr);
      return res.status(500).json({ hata: "Email kontrolÃ¼ yapÄ±lamadÄ±." });
    }

    if (emailResults.length > 0) {
      return res.status(409).json({ hata: "Bu email baÅŸka bir Ã¼ye tarafÄ±ndan kullanÄ±lÄ±yor." });
    }

    const updateSql = `
      UPDATE uyeler
      SET ad = ?, soyad = ?, email = ?, telefon = ?, ulke = ?, il = ?, ilce = ?, adres = ?
      WHERE uye_id = ? AND aktif_mi = 1
    `;

    db.query(
      updateSql,
      [ad, soyad, email, telefon, ulke || null, il || null, ilce || null, adres || null, uyeId],
      (updateErr, updateResult) => {
        if (updateErr) {
          console.log(updateErr);
          return res.status(500).json({ hata: "Profil gÃ¼ncellenemedi." });
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ hata: "Ãœye bulunamadÄ±." });
        }

        res.json({ mesaj: "Profil gÃ¼ncellendi." });
      }
    );
  });
});

router.put("/password/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;
  const { eski_sifre, yeni_sifre } = req.body;

  if (!eski_sifre || !yeni_sifre) {
    return res.status(400).json({ hata: "Eski ÅŸifre ve yeni ÅŸifre zorunludur." });
  }

  const kontrolSql = `
    SELECT uye_id
    FROM uyeler
    WHERE uye_id = ? AND sifre = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(kontrolSql, [uyeId, eski_sifre], (kontrolErr, kontrolResults) => {
    if (kontrolErr) {
      console.log(kontrolErr);
      return res.status(500).json({ hata: "Åifre kontrolÃ¼ yapÄ±lamadÄ±." });
    }

    if (kontrolResults.length === 0) {
      return res.status(401).json({ hata: "Eski ÅŸifre hatalÄ±." });
    }

    const updateSql = "UPDATE uyeler SET sifre = ? WHERE uye_id = ?";

    db.query(updateSql, [yeni_sifre, uyeId], (updateErr) => {
      if (updateErr) {
        console.log(updateErr);
        return res.status(500).json({ hata: "Åifre gÃ¼ncellenemedi." });
      }

      res.json({ mesaj: "Åifre gÃ¼ncellendi." });
    });
  });
});

module.exports = router;


