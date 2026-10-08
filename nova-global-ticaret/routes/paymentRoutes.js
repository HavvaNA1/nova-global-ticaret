const express = require("express");
const router = express.Router();
const db = require("../db");

function getDurumIdByOdemeTipi(odemeTipi) {
  if (odemeTipi === "kart") return 3;
  if (odemeTipi === "havale") return 2;
  if (odemeTipi === "sponsor_cuzdani") return 2;
  if (odemeTipi === "kendi_cuzdani") return 3;
  return 1;
}

function getOdemeDurumuByOdemeTipi(odemeTipi) {
  if (odemeTipi === "havale" || odemeTipi === "sponsor_cuzdani") return "bekliyor";
  return "odendi";
}

function cuzdanOdemesiMi(odemeTipi) {
  return odemeTipi === "kendi_cuzdani";
}

function paketSeviyesiBul(toplamAlisveris) {
  if (toplamAlisveris >= 25000) return "diamond";
  if (toplamAlisveris >= 15000) return "emerald";
  if (toplamAlisveris >= 3500) return "sapphire";
  return "standart";
}

router.get("/bank-accounts", (req, res) => {
  const sql = `
    SELECT
      bh.banka_hesap_id,
      bh.banka_adi,
      bh.hesap_sahibi,
      bh.iban,
      bh.para_birimi_id,
      pb.para_birimi_adi,
      pb.para_birimi_kodu,
      pb.sembol
    FROM banka_hesaplari bh
    LEFT JOIN para_birimleri pb ON bh.para_birimi_id = pb.para_birimi_id
    WHERE bh.aktif_mi = 1
    ORDER BY bh.banka_hesap_id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Banka hesapları getirilemedi." });
    }

    res.json(results);
  });
});

router.get("/sponsor-pending/:uyeId", (req, res) => {
  const uyeId = req.params.uyeId;

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
      u.uye_no AS siparis_veren_uye_no,
      u.ad AS siparis_veren_ad,
      u.soyad AS siparis_veren_soyad
    FROM odemeler o
    JOIN siparisler s ON o.siparis_id = s.siparis_id
    LEFT JOIN siparis_durumlari sd ON s.durum_id = sd.durum_id
    JOIN uyeler u ON o.siparis_veren_uye_id = u.uye_id
    WHERE o.odeme_durumu = 'bekliyor'
      AND o.odeme_tipi = 'sponsor_cuzdani'
      AND o.odeme_yapan_uye_id = ?
    ORDER BY o.odeme_id DESC
  `;

  db.query(sql, [uyeId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ hata: "Sponsor cüzdan onayları getirilemedi." });
    }

    res.json(results);
  });
});
router.put("/approve-transfer/:siparisId", (req, res) => {
  const siparisId = req.params.siparisId;

  const siparisSql = `
    SELECT durum_id, odeme_durumu
    FROM siparisler
    WHERE siparis_id = ?
    LIMIT 1
  `;

  db.query(siparisSql, [siparisId], (siparisErr, siparisResults) => {
    if (siparisErr) {
      console.log(siparisErr);
      return res.status(500).json({ hata: "Sipariş bilgisi okunamadı." });
    }

    if (siparisResults.length === 0) {
      return res.status(404).json({ hata: "Sipariş bulunamadı." });
    }

    const siparis = siparisResults[0];

    if (Number(siparis.durum_id) !== 2) {
      return res.status(400).json({ hata: "Bu sipariş ödeme kontrol bekliyor durumunda değil." });
    }

    const odemeSql = `
      SELECT odeme_id, siparis_veren_uye_id, odeme_yapan_uye_id, odeme_tipi, odeme_tutari
      FROM odemeler
      WHERE siparis_id = ?
      ORDER BY odeme_id DESC
      LIMIT 1
    `;

    db.query(odemeSql, [siparisId], (odemeOkuErr, odemeResults) => {
      if (odemeOkuErr) {
        console.log(odemeOkuErr);
        return res.status(500).json({ hata: "Ödeme kaydı okunamadı." });
      }

      if (odemeResults.length === 0) {
        return res.status(404).json({ hata: "Bu siparişe ait ödeme kaydı bulunamadı." });
      }

      const odeme = odemeResults[0];

      const onayaDevamEt = () => {
        const eskiDurumId = siparis.durum_id;
        const yeniDurumId = 3;
        const yeniOdemeDurumu = "odendi";
        const guncelleSql = "UPDATE siparisler SET durum_id = ?, odeme_durumu = ? WHERE siparis_id = ?";

        db.query(guncelleSql, [yeniDurumId, yeniOdemeDurumu, siparisId], (guncelleErr) => {
          if (guncelleErr) {
            console.log(guncelleErr);
            return res.status(500).json({ hata: "Ödeme onaylanamadı." });
          }

          db.query("UPDATE odemeler SET odeme_durumu = 'odendi' WHERE odeme_id = ?", [odeme.odeme_id], (odemeErr) => {
            if (odemeErr) {
              console.log(odemeErr);
              return res.status(500).json({ hata: "Ödeme kaydı güncellenemedi." });
            }

            const gecmisSql = `
              INSERT INTO siparis_durum_gecmisi
              (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
              VALUES (?, ?, ?, ?)
            `;
            const aciklama = odeme.odeme_tipi === "sponsor_cuzdani"
              ? "Sponsor cüzdan ödemesi onaylandı."
              : "Havale/EFT ödemesi onaylandı.";

            db.query(gecmisSql, [siparisId, eskiDurumId, yeniDurumId, aciklama], (gecmisErr) => {
              if (gecmisErr) {
                console.log(gecmisErr);
                return res.status(500).json({ hata: "Ödeme onay geçmişi oluşturulamadı." });
              }

              res.json({ mesaj: "Ödeme onaylandı.", siparis_id: Number(siparisId), eski_durum_id: eskiDurumId, yeni_durum_id: yeniDurumId, odeme_durumu: yeniOdemeDurumu });
            });
          });
        });
      };

      if (odeme.odeme_tipi !== "sponsor_cuzdani") return onayaDevamEt();

      const sponsorBulSql = "SELECT sponsor_uye_id FROM uyeler WHERE uye_id = ? AND aktif_mi = 1 LIMIT 1";

      db.query(sponsorBulSql, [odeme.siparis_veren_uye_id], (sponsorErr, sponsorResults) => {
        if (sponsorErr) {
          console.log(sponsorErr);
          return res.status(500).json({ hata: "Sponsor bilgisi okunamadı." });
        }

        const sponsorId = sponsorResults[0] && sponsorResults[0].sponsor_uye_id
          ? sponsorResults[0].sponsor_uye_id
          : odeme.odeme_yapan_uye_id;

        if (!sponsorId) {
          return res.status(400).json({ hata: "Bu sipariş için kayıtlı sponsor bulunamadı." });
        }

        odeme.odeme_yapan_uye_id = sponsorId;

        const cuzdanSql = "SELECT cuzdan_id, bakiye FROM cuzdanlar WHERE uye_id = ? AND aktif_mi = 1 LIMIT 1";
        db.query(cuzdanSql, [sponsorId], (cuzdanErr, cuzdanResults) => {
          if (cuzdanErr) {
            console.log(cuzdanErr);
            return res.status(500).json({ hata: "Sponsor cüzdan bilgisi okunamadı." });
          }
          if (cuzdanResults.length === 0) return res.status(404).json({ hata: "Sponsorun aktif cüzdanı bulunamadı." });

          const cuzdan = cuzdanResults[0];
          const tutar = Number(odeme.odeme_tutari);
          const oncekiBakiye = Number(cuzdan.bakiye);
          if (oncekiBakiye < tutar) return res.status(400).json({ hata: "Sponsor cüzdan bakiyesi yetersiz." });

          const sonrakiBakiye = oncekiBakiye - tutar;
          db.query("UPDATE cuzdanlar SET bakiye = ? WHERE cuzdan_id = ?", [sonrakiBakiye, cuzdan.cuzdan_id], (cuzdanGuncelleErr) => {
            if (cuzdanGuncelleErr) {
              console.log(cuzdanGuncelleErr);
              return res.status(500).json({ hata: "Sponsor cüzdan bakiyesi güncellenemedi." });
            }

            const hareketSql = `
              INSERT INTO cuzdan_hareketleri
              (uye_id, odeme_yapan_uye_id, ilgili_uye_id, siparis_id, islem_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama)
              VALUES (?, ?, ?, ?, 'sponsor_odeme', ?, ?, ?, ?)
            `;
            db.query(hareketSql, [sponsorId, sponsorId, odeme.siparis_veren_uye_id, siparisId, tutar, oncekiBakiye, sonrakiBakiye, "Sponsor cüzdan ödemesi onaylandı."], (hareketErr) => {
              if (hareketErr) {
                console.log(hareketErr);
                return res.status(500).json({ hata: "Sponsor cüzdan hareketi oluşturulamadı." });
              }

              db.query("UPDATE odemeler SET odeme_yapan_uye_id = ? WHERE odeme_id = ?", [sponsorId, odeme.odeme_id], (odemeYapanErr) => {
                if (odemeYapanErr) {
                  console.log(odemeYapanErr);
                  return res.status(500).json({ hata: "Sponsor ödeme bilgisi güncellenemedi." });
                }

                onayaDevamEt();
              });
            });
          });
        });
      });
    });
  });
});

router.post("/create", (req, res) => {
  const {
    siparis_id,
    siparis_veren_uye_id,
    odeme_yapan_uye_id,
    odeme_tipi,
    odeme_tutari,
    aciklama
  } = req.body;

  if (!siparis_id || !siparis_veren_uye_id || !odeme_yapan_uye_id || !odeme_tipi || !odeme_tutari) {
    return res.status(400).json({ hata: "Ödeme için gerekli bilgiler eksik." });
  }

  const yeniDurumId = getDurumIdByOdemeTipi(odeme_tipi);
  const odemeDurumu = getOdemeDurumuByOdemeTipi(odeme_tipi);
  let finalOdemeYapanUyeId = odeme_yapan_uye_id;

  const paketGuncelle = (callback) => {
    if (odemeDurumu !== "odendi") {
      return callback();
    }

    const uyeSql = `
      SELECT uye_id, paket_seviyesi, toplam_alisveris
      FROM uyeler
      WHERE uye_id = ?
      LIMIT 1
    `;

    db.query(uyeSql, [siparis_veren_uye_id], (uyeErr, uyeResults) => {
      if (uyeErr) {
        console.log(uyeErr);
        return callback(uyeErr);
      }

      if (uyeResults.length === 0) {
        return callback();
      }

      const uye = uyeResults[0];
      const eskiPaket = uye.paket_seviyesi;
      const yeniToplamAlisveris = Number(uye.toplam_alisveris) + Number(odeme_tutari);
      const yeniPaket = paketSeviyesiBul(yeniToplamAlisveris);

      const toplamGuncelleSql = `
        UPDATE uyeler
        SET toplam_alisveris = ?, paket_seviyesi = ?
        WHERE uye_id = ?
      `;

      db.query(toplamGuncelleSql, [yeniToplamAlisveris, yeniPaket, siparis_veren_uye_id], (guncelleErr) => {
        if (guncelleErr) {
          console.log(guncelleErr);
          return callback(guncelleErr);
        }

        if (eskiPaket === yeniPaket) {
          return callback();
        }

        const paketGecmisiSql = `
          INSERT INTO paket_gecmisi
          (uye_id, eski_paket, yeni_paket, degisim_nedeni)
          VALUES (?, ?, ?, ?)
        `;

        const degisimNedeni = `Toplam alışveriş ${yeniToplamAlisveris} TL olduğu için paket güncellendi.`;

        db.query(
          paketGecmisiSql,
          [siparis_veren_uye_id, eskiPaket, yeniPaket, degisimNedeni],
          (paketErr) => {
            if (paketErr) {
              console.log(paketErr);
              return callback(paketErr);
            }

            callback();
          }
        );
      });
    });
  };

  const komisyonlariOlustur = (callback) => {
    if (odemeDurumu !== "odendi") {
      return callback();
    }

    const sponsorSql = `
      SELECT sponsor_uye_id
      FROM uyeler
      WHERE uye_id = ?
      LIMIT 1
    `;

    db.query(sponsorSql, [siparis_veren_uye_id], (sponsorErr, sponsorResults) => {
      if (sponsorErr) {
        console.log(sponsorErr);
        return callback(sponsorErr);
      }

      const birinciSponsorId = sponsorResults[0] ? sponsorResults[0].sponsor_uye_id : null;

      if (!birinciSponsorId) {
        return callback();
      }

      const zincir = [];
      let mevcutSponsorId = birinciSponsorId;

      const sponsorZinciriBul = (seviye) => {
        if (!mevcutSponsorId || seviye > 3) {
          return komisyonKayitlariniEkle();
        }

        const ustSponsorSql = `
          SELECT uye_id, sponsor_uye_id
          FROM uyeler
          WHERE uye_id = ? AND aktif_mi = 1
          LIMIT 1
        `;

        db.query(ustSponsorSql, [mevcutSponsorId], (ustErr, ustResults) => {
          if (ustErr) {
            console.log(ustErr);
            return callback(ustErr);
          }

          if (ustResults.length === 0) {
            return komisyonKayitlariniEkle();
          }

          zincir.push({
            seviye,
            kazanan_uye_id: ustResults[0].uye_id
          });

          mevcutSponsorId = ustResults[0].sponsor_uye_id;
          sponsorZinciriBul(seviye + 1);
        });
      };

      const komisyonKayitlariniEkle = () => {
        if (zincir.length === 0) {
          return callback();
        }

        const kuralSql = `
          SELECT seviye, komisyon_orani
          FROM komisyon_kurallari
          WHERE aktif_mi = 1 AND seviye IN (1, 2, 3)
        `;

        db.query(kuralSql, (kuralErr, kuralResults) => {
          if (kuralErr) {
            console.log(kuralErr);
            return callback(kuralErr);
          }

          let tamamlanan = 0;

          zincir.forEach((sponsor) => {
            const kural = kuralResults.find((item) => Number(item.seviye) === Number(sponsor.seviye));

            if (!kural) {
              tamamlanan++;

              if (tamamlanan === zincir.length) {
                return callback();
              }

              return;
            }

            const komisyonOrani = Number(kural.komisyon_orani);
            const kazancTutari = Number(odeme_tutari) * (komisyonOrani / 100);

            const kazancSql = `
              INSERT INTO uye_kazanclari
              (kazanan_uye_id, siparis_id, kazanc_kaynagi_uye_id, kazanc_orani, kazanc_tutari, kazanc_durumu, aciklama)
              VALUES (?, ?, ?, ?, ?, 'bekliyor', ?)
            `;

            const kazancAciklama = `${sponsor.seviye}. seviye sponsor komisyonu oluşturuldu.`;

            db.query(
              kazancSql,
              [
                sponsor.kazanan_uye_id,
                siparis_id,
                siparis_veren_uye_id,
                komisyonOrani,
                kazancTutari,
                kazancAciklama
              ],
              (kazancErr) => {
                if (kazancErr) {
                  console.log(kazancErr);
                  return callback(kazancErr);
                }

                tamamlanan++;

                if (tamamlanan === zincir.length) {
                  callback();
                }
              }
            );
          });
        });
      };

      sponsorZinciriBul(1);
    });
  };

  const odemeKaydiniDevamEttir = () => {
    const odemeSql = `
      INSERT INTO odemeler
      (siparis_id, siparis_veren_uye_id, odeme_yapan_uye_id, odeme_tipi, odeme_tutari, odeme_durumu, aciklama)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      odemeSql,
      [siparis_id, siparis_veren_uye_id, finalOdemeYapanUyeId, odeme_tipi, odeme_tutari, odemeDurumu, aciklama || null],
      (odemeErr, odemeResult) => {
        if (odemeErr) {
          console.log(odemeErr);
          return res.status(500).json({ hata: "Ödeme kaydı oluşturulamadı." });
        }

        const eskiDurumSql = "SELECT durum_id FROM siparisler WHERE siparis_id = ? LIMIT 1";

        db.query(eskiDurumSql, [siparis_id], (durumErr, durumResults) => {
          if (durumErr) {
            console.log(durumErr);
            return res.status(500).json({ hata: "Sipariş durumu okunamadı." });
          }

          if (durumResults.length === 0) {
            return res.status(404).json({ hata: "Sipariş bulunamadı." });
          }

          const eskiDurumId = durumResults[0].durum_id;

          const siparisGuncelleSql = "UPDATE siparisler SET durum_id = ?, odeme_durumu = ? WHERE siparis_id = ?";

          db.query(siparisGuncelleSql, [yeniDurumId, odemeDurumu, siparis_id], (guncelleErr) => {
            if (guncelleErr) {
              console.log(guncelleErr);
              return res.status(500).json({ hata: "Sipariş durumu güncellenemedi." });
            }

            const durumAciklama =
              odeme_tipi === "havale"
                ? "Havale/EFT odeme bildirimi alindi, kontrol bekliyor."
                : odeme_tipi === "sponsor_cuzdani"
                  ? "Sponsor cuzdan odeme talebi olusturuldu, onay bekliyor."
                  : "Odeme onaylandi.";

            const durumGecmisiSql = `
              INSERT INTO siparis_durum_gecmisi
              (siparis_id, eski_durum_id, yeni_durum_id, aciklama)
              VALUES (?, ?, ?, ?)
            `;

            db.query(durumGecmisiSql, [siparis_id, eskiDurumId, yeniDurumId, durumAciklama], (gecmisErr) => {
              if (gecmisErr) {
                console.log(gecmisErr);
                return res.status(500).json({ hata: "Ödeme durum geçmişi oluşturulamadı." });
              }

              komisyonlariOlustur((komisyonErr) => {
                if (komisyonErr) {
                  return res.status(500).json({ hata: "Komisyon kayıtları oluşturulamadı." });
                }

                paketGuncelle((paketErr) => {
                  if (paketErr) {
                    return res.status(500).json({ hata: "Paket bilgisi güncellenemedi." });
                  }

                  res.status(201).json({
                    mesaj: "Ödeme kaydı oluşturuldu.",
                    odeme_id: odemeResult.insertId,
                    siparis_id,
                    eski_durum_id: eskiDurumId,
                    yeni_durum_id: yeniDurumId,
                    odeme_durumu: odemeDurumu
                  });
                });
              });
            });
          });
        });
      }
    );
  };

  if (odeme_tipi === "sponsor_cuzdani") {
    const sponsorBulSql = "SELECT sponsor_uye_id FROM uyeler WHERE uye_id = ? AND aktif_mi = 1 LIMIT 1";

    return db.query(sponsorBulSql, [siparis_veren_uye_id], (sponsorErr, sponsorResults) => {
      if (sponsorErr) {
        console.log(sponsorErr);
        return res.status(500).json({ hata: "Sponsor bilgisi okunamadı." });
      }

      const sponsorId = sponsorResults[0] ? sponsorResults[0].sponsor_uye_id : null;

      if (!sponsorId) {
        return res.status(400).json({ hata: "Bu üyenin sponsor cüzdanı ile ödeme yapabileceği kayıtlı sponsoru yok." });
      }

      finalOdemeYapanUyeId = sponsorId;
      odemeKaydiniDevamEttir();
    });
  }

  if (!cuzdanOdemesiMi(odeme_tipi)) {
    return odemeKaydiniDevamEttir();
  }

  const cuzdanSql = `
    SELECT cuzdan_id, bakiye
    FROM cuzdanlar
    WHERE uye_id = ? AND aktif_mi = 1
    LIMIT 1
  `;

  db.query(cuzdanSql, [finalOdemeYapanUyeId], (cuzdanErr, cuzdanResults) => {
    if (cuzdanErr) {
      console.log(cuzdanErr);
      return res.status(500).json({ hata: "Cüzdan bilgisi okunamadı." });
    }

    if (cuzdanResults.length === 0) {
      return res.status(404).json({ hata: "Ödeme yapan üyeye ait aktif cüzdan bulunamadı." });
    }

    const cuzdan = cuzdanResults[0];
    const oncekiBakiye = Number(cuzdan.bakiye);
    const tutar = Number(odeme_tutari);
    const sonrakiBakiye = oncekiBakiye - tutar;

    if (oncekiBakiye < tutar) {
      return res.status(400).json({ hata: "Cüzdan bakiyesi yetersiz." });
    }

    const cuzdanGuncelleSql = "UPDATE cuzdanlar SET bakiye = ? WHERE cuzdan_id = ?";

    db.query(cuzdanGuncelleSql, [sonrakiBakiye, cuzdan.cuzdan_id], (cuzdanGuncelleErr) => {
      if (cuzdanGuncelleErr) {
        console.log(cuzdanGuncelleErr);
        return res.status(500).json({ hata: "Cüzdan bakiyesi güncellenemedi." });
      }

      const hareketTipi = odeme_tipi === "sponsor_cuzdani" ? "sponsor_odeme" : "cikis";
      const hareketAciklama =
        odeme_tipi === "sponsor_cuzdani"
          ? "Sponsor cüzdanı ile sipariş ödemesi yapıldı."
          : "Üye kendi cüzdanı ile sipariş ödemesi yaptı.";

      const hareketSql = `
        INSERT INTO cuzdan_hareketleri
        (uye_id, odeme_yapan_uye_id, ilgili_uye_id, siparis_id, islem_tipi, tutar, onceki_bakiye, sonraki_bakiye, aciklama)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        hareketSql,
        [
          odeme_yapan_uye_id,
          odeme_yapan_uye_id,
          siparis_veren_uye_id,
          siparis_id,
          hareketTipi,
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

          odemeKaydiniDevamEttir();
        }
      );
    });
  });
});

module.exports = router;










