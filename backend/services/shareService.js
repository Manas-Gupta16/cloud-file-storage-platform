const crypto = require('crypto');
const logger = require('../utils/logger');

const SHARE_DEFAULTS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'never': null,
};

/**
 * Generate a unique share token
 */
function generateShareToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new share link
 */
async function createShare(db, fileId, ownerId, expirationOption = '7d', oneTime = false) {
  try {
    const file = await db.get('SELECT * FROM files WHERE id = ? AND owner_id = ?', [fileId, ownerId]);
    
    if (!file) {
      throw new Error('File not found or access denied');
    }

    const token = generateShareToken();
    const createdAt = Date.now();
    const expiresAt = SHARE_DEFAULTS[expirationOption] ? createdAt + SHARE_DEFAULTS[expirationOption] : null;

    await db.run(
      `INSERT INTO shares (file_id, owner_id, token, expires_at, one_time, access_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileId, ownerId, token, expiresAt, oneTime ? 1 : 0, 0, createdAt]
    );

    logger.info(`Share created for file ${fileId}`, { fileId, ownerId, token });

    return {
      id: token,
      token,
      fileId,
      expiresAt,
      oneTime,
      url: `/api/share/${token}/download`,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${token}`,
    };
  } catch (error) {
    logger.error('Share creation failed:', error);
    throw error;
  }
}

/**
 * Validate and get share details
 */
async function validateShare(db, token) {
  try {
    const share = await db.get(
      `SELECT s.*, f.filename, f.original_name, f.size, f.mime_type
       FROM shares s
       JOIN files f ON s.file_id = f.id
       WHERE s.token = ?`,
      [token]
    );

    if (!share) {
      throw new Error('Share not found');
    }

    // Check if expired
    if (share.expires_at && share.expires_at < Date.now()) {
      throw new Error('Share link has expired');
    }

    // Check if one-time and already accessed
    if (share.one_time && share.access_count > 0) {
      throw new Error('This one-time link has already been used');
    }

    return share;
  } catch (error) {
    logger.error('Share validation failed:', error);
    throw error;
  }
}

/**
 * Increment access count for a share
 */
async function incrementShareAccess(db, token) {
  try {
    await db.run(
      'UPDATE shares SET access_count = access_count + 1 WHERE token = ?',
      [token]
    );
  } catch (error) {
    logger.error('Failed to update share access count:', error);
  }
}

/**
 * Get all shares for a file
 */
async function getFileShares(db, fileId, ownerId) {
  try {
    const shares = await db.all(
      `SELECT id, token, expires_at, one_time, access_count, created_at
       FROM shares
       WHERE file_id = ? AND owner_id = ?
       ORDER BY created_at DESC`,
      [fileId, ownerId]
    );

    return shares.map(share => ({
      ...share,
      isExpired: share.expires_at && share.expires_at < Date.now(),
      url: `/api/share/${share.token}/download`,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${share.token}`,
    }));
  } catch (error) {
    logger.error('Failed to get file shares:', error);
    throw error;
  }
}

/**
 * Revoke a share
 */
async function revokeShare(db, shareId, ownerId) {
  try {
    // Get share to verify ownership
    const share = await db.get(
      'SELECT * FROM shares WHERE id = ? AND owner_id = ?',
      [shareId, ownerId]
    );

    if (!share) {
      throw new Error('Share not found or access denied');
    }

    await db.run('DELETE FROM shares WHERE id = ?', [shareId]);

    logger.info(`Share revoked: ${shareId}`);
    return { success: true };
  } catch (error) {
    logger.error('Share revocation failed:', error);
    throw error;
  }
}

/**
 * Revoke a share by token (for one-time links)
 */
async function revokeShareByToken(db, token) {
  try {
    await db.run('DELETE FROM shares WHERE token = ?', [token]);
  } catch (error) {
    logger.error('Failed to revoke share by token:', error);
  }
}

module.exports = {
  createShare,
  validateShare,
  incrementShareAccess,
  getFileShares,
  revokeShare,
  revokeShareByToken,
  generateShareToken,
  SHARE_DEFAULTS,
};
