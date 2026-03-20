class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.createdAt = data.created_at;
  }

  // Static methods for database operations
  static async findByEmail(db, email) {
    const row = await db.get("SELECT * FROM users WHERE email = ?", email.toLowerCase());
    return row ? new User(row) : null;
  }

  static async findById(db, id) {
    const row = await db.get("SELECT * FROM users WHERE id = ?", id);
    return row ? new User(row) : null;
  }

  static async create(db, email, hashedPassword) {
    const now = Date.now();
    const result = await db.run(
      "INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)",
      email.toLowerCase(),
      hashedPassword,
      now
    );
    return new User({
      id: result.lastID,
      email: email.toLowerCase(),
      password: hashedPassword,
      created_at: now,
    });
  }

  // Instance methods
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt,
    };
  }
}

module.exports = User;