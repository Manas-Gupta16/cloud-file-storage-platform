import { useState, useEffect } from 'react';
import { shareAPI } from '../utils/api';

export default function ShareModal({ fileId, fileName, onClose }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expirationOption, setExpirationOption] = useState('7d');
  const [oneTime, setOneTime] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetchShares();
  }, [fileId]);

  const fetchShares = async () => {
    try {
      setLoading(true);
      const response = await shareAPI.getShares(fileId);
      setShares(response.data);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    try {
      setCreating(true);
      const response = await shareAPI.createShare(fileId, expirationOption, oneTime);
      setShares([response.data, ...shares]);
      setExpirationOption('7d');
      setOneTime(false);
    } catch (error) {
      console.error('Failed to create share:', error);
      alert(error.response?.data?.error || 'Failed to create share');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (shareId) => {
    if (confirm('Are you sure you want to revoke this share link?')) {
      try {
        await shareAPI.revokeShare(shareId);
        setShares(shares.filter(s => s.id !== shareId));
      } catch (error) {
        console.error('Failed to revoke share:', error);
        alert(error.response?.data?.error || 'Failed to revoke share');
      }
    }
  };

  const handleCopyLink = (shareUrl) => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(shareUrl);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatExpiration = (expiresAt) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isExpired = (expiresAt) => expiresAt && expiresAt < Date.now();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Share File</h2>
              <p className="text-gray-600 mt-1">{fileName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Create Share Section */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Share Link</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration
                </label>
                <select
                  value={expirationOption}
                  onChange={(e) => setExpirationOption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="never">Never expires</option>
                </select>
              </div>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={oneTime}
                  onChange={(e) => setOneTime(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">One-time download (link expires after use)</span>
              </label>

              <button
                onClick={handleCreateShare}
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition"
              >
                {creating ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </div>

          {/* Existing Shares */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">
              Active Share Links ({shares.length})
            </h3>

            {loading && <p className="text-gray-600">Loading shares...</p>}

            {shares.length === 0 && !loading && (
              <p className="text-gray-500 text-sm">No share links created yet</p>
            )}

            <div className="space-y-3">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className={`border rounded-lg p-3 ${
                    isExpired(share.expiresAt) ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 break-all">
                          {share.token.substring(0, 12)}...
                        </code>
                        {share.oneTime && (
                          <span className="inline-block bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded">
                            One-time
                          </span>
                        )}
                        {isExpired(share.expiresAt) && (
                          <span className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Expires: {formatExpiration(share.expiresAt)} • 
                        Accessed: {share.accessCount} time{share.accessCount !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(share.shareUrl)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm rounded transition"
                      >
                        {copied === share.shareUrl ? '✓ Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded transition"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
