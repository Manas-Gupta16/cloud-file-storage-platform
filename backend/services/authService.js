const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

class AuthService {
  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: "7d" }
    );
  }

  static async register(db, email, password) {
    // Check if user already exists
    const existingUser = await User.findByEmail(db, email);
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await User.create(db, email, hashedPassword);

    // Generate token
    const token = this.generateToken(user);

    return { user: user.toJSON(), token };
  }

  static async login(db, email, password) {
    // Find user
    const user = await User.findByEmail(db, email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate token
    const token = this.generateToken(user);

    return { user: user.toJSON(), token };
  }

  static async getUserById(db, id) {
    const user = await User.findById(db, id);
    return user ? user.toJSON() : null;
  }
}

module.exports = AuthService;