const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

// Import our modules
const { initializeDatabase } = require("./config/database");
const config = require("./config/config");
const logger = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait a moment." },
});
app.use("/api/", apiLimiter);

// Static files
app.use("/uploads", express.static(path.join(__dirname, config.uploadsDir)));

// Database initialization
let db;
(async () => {
  try {
    db = await initializeDatabase();
    logger.info("Database initialized successfully");

    // Make db available to all routes via req.db
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Routes
    app.use("/api/auth", authRoutes);

    // Health check
    app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      console.log(`Server running on port ${config.port}`);
    });

  } catch (error) {
    logger.error("Failed to initialize database:", error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down server...");
  if (db) {
    await db.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down server...");
  if (db) {
    await db.close();
  }
  process.exit(0);
});

