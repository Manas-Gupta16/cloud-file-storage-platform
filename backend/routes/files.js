const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, `../${config.uploadsDir}`),
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomBytes(16).toString('hex')}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

/**
 * GET /api/files - Get all files for the authenticated user
 */
router.get('/files', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q = '', sort = 'date', direction = 'desc', limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM files WHERE owner_id = ? AND is_trashed = 0';
    const params = [userId];

    if (q) {
      query += ' AND original_name LIKE ?';
      params.push(`%${q}%`);
    }

    const orderByMap = {
      name: 'original_name',
      size: 'size',
      date: 'uploaded_at',
      downloads: 'download_count',
    };

    const orderBy = orderByMap[sort] || 'uploaded_at';
    const dir = direction === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${orderBy} ${dir}`;

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const files = await req.db.all(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM files WHERE owner_id = ? AND is_trashed = 0';
    const countParams = [userId];
    if (q) {
      countQuery += ' AND original_name LIKE ?';
      countParams.push(`%${q}%`);
    }
    const countResult = await req.db.get(countQuery, countParams);

    res.json({
      files: files || [],
      total: countResult?.count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Get files failed:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

/**
 * POST /api/upload - Upload a new file
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, filename, size, mimetype } = req.file;
    const uploadedAt = Date.now();

    const result = await req.db.run(
      `INSERT INTO files (filename, original_name, size, mime_type, owner_id, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [filename, originalname, size, mimetype, userId, uploadedAt]
    );

    logger.info(`File uploaded: ${originalname}`, { userId, fileId: result.lastID });

    res.status(201).json({
      id: result.lastID,
      filename,
      originalName: originalname,
      size,
      mimeType: mimetype,
      uploadedAt,
      downloadCount: 0,
    });
  } catch (error) {
    logger.error('Upload failed:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

/**
 * GET /api/download/:filename - Download a file
 */
router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { filename } = req.params;

    const file = await req.db.get(
      'SELECT * FROM files WHERE filename = ? AND owner_id = ? AND is_trashed = 0',
      [filename, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(__dirname, `../${config.uploadsDir}/${filename}`);

    // Check if file exists on disk
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Update download count
    await req.db.run(
      'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
      [file.id]
    );

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Length', file.size);

    logger.info(`File downloaded: ${file.original_name}`, { userId, fileId: file.id });

    return res.sendFile(filePath);
  } catch (error) {
    logger.error('Download failed:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * DELETE /api/delete/:id - Permanently delete a file
 */
router.delete('/delete/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const file = await req.db.get(
      'SELECT * FROM files WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from database
    await req.db.run('DELETE FROM files WHERE id = ?', [file.id]);

    // Delete file from disk
    const filePath = path.join(__dirname, `../${config.uploadsDir}/${file.filename}`);
    await fs.unlink(filePath).catch(() => {});

    logger.info(`File permanently deleted: ${file.original_name}`, { userId, fileId: file.id });

    res.json({ message: 'File deleted', id: file.id });
  } catch (error) {
    logger.error('Delete failed:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

/**
 * POST /api/trash/:id - Move file to trash
 */
router.post('/trash/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const file = await req.db.get(
      'SELECT * FROM files WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await req.db.run(
      'UPDATE files SET is_trashed = 1 WHERE id = ?',
      [file.id]
    );

    logger.info(`File moved to trash: ${file.original_name}`, { userId, fileId: file.id });

    res.json({ message: 'File moved to trash', id: file.id });
  } catch (error) {
    logger.error('Trash failed:', error);
    res.status(500).json({ error: 'Trash operation failed' });
  }
});

/**
 * POST /api/restore/:id - Restore file from trash
 */
router.post('/restore/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const file = await req.db.get(
      'SELECT * FROM files WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await req.db.run(
      'UPDATE files SET is_trashed = 0 WHERE id = ?',
      [file.id]
    );

    logger.info(`File restored from trash: ${file.original_name}`, { userId, fileId: file.id });

    res.json({ message: 'File restored', id: file.id });
  } catch (error) {
    logger.error('Restore failed:', error);
    res.status(500).json({ error: 'Restore operation failed' });
  }
});

/**
 * GET /api/trash - Get all trashed files
 */
router.get('/trash', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const files = await req.db.all(
      'SELECT * FROM files WHERE owner_id = ? AND is_trashed = 1 ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
      [userId, parseInt(limit), parseInt(offset)]
    );

    const countResult = await req.db.get(
      'SELECT COUNT(*) as count FROM files WHERE owner_id = ? AND is_trashed = 1',
      [userId]
    );

    res.json({
      files: files || [],
      total: countResult?.count || 0,
    });
  } catch (error) {
    logger.error('Get trash failed:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

/**
 * DELETE /api/permanent/:id - Permanently delete a file from trash
 */
router.delete('/permanent/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const file = await req.db.get(
      'SELECT * FROM files WHERE id = ? AND owner_id = ? AND is_trashed = 1',
      [id, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    await req.db.run('DELETE FROM files WHERE id = ?', [file.id]);

    const filePath = path.join(__dirname, `../${config.uploadsDir}/${file.filename}`);
    await fs.unlink(filePath).catch(() => {});

    logger.info(`File permanently deleted from trash: ${file.original_name}`, { userId });

    res.json({ message: 'File permanently deleted', id: file.id });
  } catch (error) {
    logger.error('Permanent delete failed:', error);
    res.status(500).json({ error: 'Permanent delete failed' });
  }
});

module.exports = router;
