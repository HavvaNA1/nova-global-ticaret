const express = require("express");
const cors = require("cors");
const path = require("path");

const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const walletRoutes = require("./routes/walletRoutes");
const earningRoutes = require("./routes/earningRoutes");
const cargoRoutes = require("./routes/cargoRoutes");
const adminRoutes = require("./routes/adminRoutes");
const supportRoutes = require("./routes/supportRoutes");
const teamRoutes = require("./routes/teamRoutes");



const app = express();

app.use(cors());
app.use(express.json());
app.use("/app", express.static(path.join(__dirname, "public")));
app.use("/admin-assets", express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
  res.send("Nova Global Ticaret API Ã§alÄ±ÅŸÄ±yor.");
});

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/earnings", earningRoutes);
app.use("/api/cargo", cargoRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/team", teamRoutes);



app.listen(5000, () => {
  console.log("Server 5000 portunda Ã§alÄ±ÅŸÄ±yor.");
});

