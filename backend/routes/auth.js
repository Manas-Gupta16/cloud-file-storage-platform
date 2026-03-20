const express = require("express");
const AuthController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

// Protected routes
router.get("/profile", authenticate, AuthController.getProfile);

module.exports = router;