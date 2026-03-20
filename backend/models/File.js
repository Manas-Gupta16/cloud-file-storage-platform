class File {
  constructor(data) {
    this.id = data.id;
    this.filename = data.filename;
    this.originalName = data.original_name;
    this.size = data.size;
    this.mimeType = data.mime_type;
    this.ownerId = data.owner_id;
    this.uploadedAt = data.uploaded_at;
    this.isTrashed = data.is_trashed || false;
    this.downloadCount = data.download_count || 0;
    this.tags = data.tags || "";
  }

  // Static methods for database operations
  static async findById(db, id) {
    const row = await db.get("SELECT * FROM files WHERE id = ?", id);
    return row ? new File(row) : null;
  }

  static async findByOwner(db, ownerId, options = {}) {
    const { limit = 50, offset = 0, sortBy = "uploaded_at", sortOrder = "DESC", search = "" } = options;

    let query = "SELECT * FROM files WHERE owner_id = ? AND is_trashed = 0";
    const params = [ownerId];

    if (search) {
      query += " AND original_name LIKE ?";
      params.push(`%${search}%`);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await db.all(query, params);
    return rows.map((row) => new File(row));
  }

  static async create(db, fileData) {
    const now = Date.now();
    const result = await db.run(
      `INSERT INTO files (filename, original_name, size, mime_type, owner_id, uploaded_at, is_trashed, download_count, tags)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      fileData.filename,
      fileData.originalName,
      fileData.size,
      fileData.mimeType,
      fileData.ownerId,
      now,
      fileData.tags || ""
    );

    return new File({
      id: result.lastID,
      ...fileData,
      uploaded_at: now,
      is_trashed: false,
      download_count: 0,
    });
  }

  static async update(db, id, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    await db.run(`UPDATE files SET ${fields.join(", ")} WHERE id = ?`, values);

    return File.findById(db, id);
  }

  static async delete(db, id) {
    await db.run("DELETE FROM files WHERE id = ?", id);
  }

  // Instance methods
  toJSON() {
    return {
      id: this.id,
      filename: this.filename,
      originalName: this.originalName,
      size: this.size,
      mimeType: this.mimeType,
      ownerId: this.ownerId,
      uploadedAt: this.uploadedAt,
      isTrashed: Boolean(this.isTrashed),
      downloadCount: this.downloadCount,
      tags: this.tags,
    };
  }
}

module.exports = File;