const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/*
Ensure uploads folder exists
*/
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/*
Configure storage for uploaded files
*/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

/*
Health check route
*/
app.get("/api/health", (req, res) => {
  res.json({
    status: "Server running 🚀"
  });
});

/*
Upload file
*/
app.post("/api/upload", upload.single("file"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      message: "No file uploaded"
    });
  }

  res.json({
    message: "File uploaded successfully",
    file: req.file.filename
  });

});

/*
List files
*/
app.get("/api/files", (req, res) => {

  fs.readdir(uploadsDir, (err, files) => {

    if (err) {
      return res.status(500).json({
        message: "Unable to scan files"
      });
    }

    res.json({
      files: files
    });

  });

});

/*
Download file
*/
app.get("/api/download/:filename", (req, res) => {

  const filePath = path.join(uploadsDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: "File not found"
    });
  }

  res.download(filePath);

});

/*
Delete file
*/
app.delete("/api/delete/:filename", (req, res) => {

  const filePath = path.join(uploadsDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: "File not found"
    });
  }

  fs.unlink(filePath, (err) => {

    if (err) {
      return res.status(500).json({
        message: "Error deleting file"
      });
    }

    res.json({
      message: "File deleted successfully"
    });

  });

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});