const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

let db = null;

async function initializeDatabase() {
  if (db) return db;

  const dbPath = path.join(__dirname, "../data.db");

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Create files table
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

  // Migration: Add missing columns if they don't exist
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

  return db;
}

module.exports = { initializeDatabase };