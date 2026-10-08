const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "ticaret_sistemi",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.log("Veritabanı bağlantı hatası:", err);
  } else {
    console.log("Veritabanına bağlandı.");
  }
});

module.exports = db;
