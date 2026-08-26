// server.js — POS System (MySQL Edition) — refactored, layered architecture
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initializeDatabase } = require("./config/database");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "https://kasircoba-xzc7-e7460cwc6-dickaaardiansyahs-projects.vercel.app",
      "https://qasirqu.my.id",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(
      `[${new Date().toTimeString().slice(0, 8)}] ${req.method} ${req.path}`,
    );
    next();
  });
}

app.get("/health", (req, res) => {
  res.json({ status: "OK", db: "MySQL", timestamp: new Date().toISOString() });
});

initializeDatabase()
  .then(() => {
    // /api/auth/login tidak butuh token (belum login). Semua route /api
    // lainnya wajib melewati authenticate (verifikasi token JWT) dulu.
    app.use("/api/auth", require("./routes/auth.routes"));
    app.use("/api", authenticate, require("./routes/index"));

    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║        POS System Backend v2.0 (MySQL)       ║
║        Layered: Model → Service → Controller  ║
╠══════════════════════════════════════════════╣
║  PORT : ${PORT.toString().padEnd(36)}║
║  DB   : ${(process.env.DB_NAME || "pos_system").padEnd(36)}║
╚══════════════════════════════════════════════╝`);
    });
  })
  .catch((err) => {
    console.error("❌ Startup gagal:", err.message);
    process.exit(1);
  });
