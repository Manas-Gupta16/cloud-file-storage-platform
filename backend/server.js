const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
require("dotenv").config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait a moment." },
});
app.use("/api/", apiLimiter);

// DB setup
const dbPath = path.join(__dirname, "data.db");
let db;

(async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      uploaded_at INTEGER NOT NULL,
      is_trashed INTEGER DEFAULT 0,
      download_count INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );
  `);

  const fileColumns = await db.all("PRAGMA table_info(files)");
  const columnNames = fileColumns.map((col) => col.name);

  if (!columnNames.includes("is_trashed")) {
    await db.exec("ALTER TABLE files ADD COLUMN is_trashed INTEGER DEFAULT 0");
  }
  if (!columnNames.includes("download_count")) {
    await db.exec("ALTER TABLE files ADD COLUMN download_count INTEGER DEFAULT 0");
  }
  if (!columnNames.includes("tags")) {
    await db.exec("ALTER TABLE files ADD COLUMN tags TEXT DEFAULT ''");
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });

const authRouter = express.Router();
const apiRouter = express.Router();

const jwtSecret = process.env.JWT_SECRET || "super-secret-key";

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hashed) {
  return bcrypt.compare(password, hashed);
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const registerUser = async (req, res) => {
  console.log('REGISTER route called');
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const existing = await db.get("SELECT id FROM users WHERE email = ?", email.toLowerCase());
  if (existing) return res.status(409).json({ error: "User already exists" });

  const hashed = await hashPassword(password);
  const now = Date.now();
  const result = await db.run("INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)", email.toLowerCase(), hashed, now);
  const user = { id: result.lastID, email: email.toLowerCase() };
  res.json({ token: generateToken(user), user });
};

authRouter.post("/register", registerUser);
app.post("/api/register", registerUser);

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await db.get("SELECT * FROM users WHERE email = ?", email.toLowerCase());
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const matched = await verifyPassword(password, user.password);
  if (!matched) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ token: generateToken(user), user: { id: user.id, email: user.email } });
};

authRouter.post("/login", loginUser);
app.post("/api/login", loginUser);

apiRouter.use(authenticate);

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), user: req.user.email });
});

apiRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { filename, originalname, size, mimetype } = req.file;
  const now = Date.now();

  await db.run(
    `INSERT INTO files (filename, original_name, size, mime_type, owner_id, uploaded_at, is_trashed, download_count, tags) VALUES (?, ?, ?, ?, ?, ?, 0, 0, '')`,
    filename,
    originalname,
    size,
    mimetype,
    req.user.id,
    now
  );

  res.json({ message: "File uploaded successfully", file: filename });
});

apiRouter.get("/files", async (req, res) => {
  const qs = (req.query.q || "").trim().toLowerCase();
  const sort = ["name", "size", "date", "downloads"].includes(req.query.sort) ? req.query.sort : "date";
  const direction = req.query.direction === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const orderMapping = {
    name: "original_name",
    size: "size",
    date: "uploaded_at",
    downloads: "download_count",
  };

  const baseQuery = `SELECT id, filename, original_name, size, mime_type, uploaded_at, download_count FROM files WHERE owner_id = ? AND is_trashed = 0`;
  const whereQuery = qs ? ` AND lower(original_name) LIKE ?` : "";
  const orderQuery = ` ORDER BY ${orderMapping[sort]} ${direction}`;
  const paging = ` LIMIT ? OFFSET ?`;

  const params = qs ? [req.user.id, `%${qs}%`, limit, offset] : [req.user.id, limit, offset];
  const files = await db.all(baseQuery + whereQuery + orderQuery + paging, ...params);

  const totalQuery = `SELECT COUNT(*) as total FROM files WHERE owner_id = ? AND is_trashed = 0${qs ? ` AND lower(original_name) LIKE ?` : ""}`;
  const totalResult = qs ? await db.get(totalQuery, req.user.id, `%${qs}%`) : await db.get(totalQuery, req.user.id);

  res.json({ files, total: totalResult.total, limit, offset });
});

apiRouter.get("/trash", async (req, res) => {
  const files = await db.all(`SELECT id, filename, original_name, size, mime_type, uploaded_at, download_count FROM files WHERE owner_id = ? AND is_trashed = 1 ORDER BY uploaded_at DESC`, req.user.id);
  res.json({ files });
});

apiRouter.post("/trash/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  await db.run("UPDATE files SET is_trashed = 1 WHERE filename = ? AND owner_id = ?", filename, req.user.id);
  res.json({ message: "File moved to trash" });
});

apiRouter.post("/restore/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  await db.run("UPDATE files SET is_trashed = 0 WHERE filename = ? AND owner_id = ?", filename, req.user.id);
  res.json({ message: "File restored" });
});

apiRouter.delete("/permanent/:filename", async (req, res, next) => {
  const filename = path.basename(req.params.filename);
  const file = await db.get("SELECT * FROM files WHERE filename = ? AND owner_id = ? AND is_trashed = 1", filename, req.user.id);
  if (!file) return res.status(404).json({ error: "File not found in trash" });

  const filePath = path.join(uploadsDir, filename);
  try {
    if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    await db.run("DELETE FROM files WHERE id = ?", file.id);
    res.json({ message: "File permanently deleted" });
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/download/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const file = await db.get("SELECT * FROM files WHERE filename = ? AND owner_id = ? AND is_trashed = 0", filename, req.user.id);
  if (!file) return res.status(404).json({ error: "File not found" });

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on server" });

  await db.run("UPDATE files SET download_count = download_count + 1 WHERE id = ?", file.id);
  res.download(filePath, file.original_name);
});

apiRouter.delete("/delete/:filename", async (req, res, next) => {
  const filename = path.basename(req.params.filename);
  const file = await db.get("SELECT * FROM files WHERE filename = ? AND owner_id = ?", filename, req.user.id);
  if (!file) return res.status(404).json({ error: "File not found" });

  const filePath = path.join(uploadsDir, filename);
  try {
    if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    await db.run("DELETE FROM files WHERE id = ?", file.id);
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// shared link endpoint
apiRouter.post("/share/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const file = await db.get("SELECT * FROM files WHERE filename = ? AND owner_id = ?", filename, req.user.id);
  if (!file) return res.status(404).json({ error: "File not found" });

  const token = jwt.sign({ filename: file.filename }, jwtSecret, { expiresIn: "1h" });
  res.json({ link: `${req.protocol}://${req.get("host")}/api/shared/${token}` });
});

app.get("/api/shared/:token", (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, jwtSecret);
    const filePath = path.join(uploadsDir, payload.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.download(filePath);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired share link" });
  }
});

app.use("/api", authRouter);
app.use("/api", apiRouter);

app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});