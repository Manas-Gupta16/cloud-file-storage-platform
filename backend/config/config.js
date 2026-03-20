require("dotenv").config();

const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || "super-secret-key",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  uploadsDir: process.env.UPLOADS_DIR || "uploads",
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 80 * 1024 * 1024, // 80MB
  rateLimit: {
    windowMs: 30 * 1000, // 30 seconds
    max: 40, // 40 requests per window
  },
};

module.exports = config;