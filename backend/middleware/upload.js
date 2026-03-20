const multer = require("multer");
const path = require("path");
const fs = require("fs");
const config = require("../config/config");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", config.uploadsDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter to allow only certain file types
const fileFilter = (req, file, cb) => {
  // Allow all file types for now, but you can restrict here
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter,
});

module.exports = { upload };