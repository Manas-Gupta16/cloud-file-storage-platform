const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const {
  createShare,
  validateShare,
  incrementShareAccess,
  getFileShares,
  revokeShare,
  revokeShareByToken,
  SHARE_DEFAULTS,
} = require('../services/shareService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/shares - Create a new share link
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { fileId, expirationOption = '7d', oneTime = false } = req.body;
    const userId = req.user.id;

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    if (!SHARE_DEFAULTS[expirationOption]) {
      return res.status(400).json({ error: 'Invalid expiration option' });
    }

    const share = await createShare(req.db, fileId, userId, expirationOption, oneTime);
    res.status(201).json(share);
  } catch (error) {
    logger.error('Create share failed:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/shares/:fileId - Get all shares for a file
 */
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const shares = await getFileShares(req.db, fileId, userId);
    res.json(shares);
  } catch (error) {
    logger.error('Get shares failed:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/shares/:shareId - Revoke a share
 */
router.delete('/:shareId', authenticate, async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    await revokeShare(req.db, shareId, userId);
    res.json({ success: true, message: 'Share revoked' });
  } catch (error) {
    logger.error('Revoke share failed:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/share/:token/info - Get public share info (no auth required)
 */
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const share = await validateShare(req.db, token);

    res.json({
      fileName: share.original_name,
      fileSize: share.size,
      mimeType: share.mime_type,
      expiresAt: share.expires_at,
      oneTime: share.one_time === 1,
      accessCount: share.access_count,
    });
  } catch (error) {
    logger.error('Public share info failed:', error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /api/share/:token/download - Public download endpoint
 */
router.get('/:token/download', async (req, res) => {
  try {
    const { token } = req.params;
    const { fs: downloadOnce } = req.query; // fs=true for immediate download, false for inline/preview

    const share = await validateShare(req.db, token);
    const filePath = path.join(__dirname, `../uploads/${share.filename}`);

    // Check if file exists
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Increment access count
    await incrementShareAccess(req.db, token);

    // If one-time, revoke after download
    if (share.one_time === 1) {
      await revokeShareByToken(req.db, token);
    }

    // Set response headers
    res.setHeader('Content-Type', share.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      downloadOnce === 'true' ? `attachment; filename="${share.original_name}"` : `inline; filename="${share.original_name}"`
    );
    res.setHeader('Content-Length', share.size);

    logger.info(`Share download: ${token}`, { fileName: share.original_name });

    // Stream the file
    return res.sendFile(filePath);
  } catch (error) {
    logger.error('Share download failed:', error);
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;
