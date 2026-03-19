import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const showToast = (text, type = "success") => {
    setMessage(text);
    setError(type === "error" ? text : "");
    setTimeout(() => {
      setMessage("");
      setError("");
    }, 2800);
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/files`);
      setFiles(res.data.files || []);
    } catch (err) {
      showToast("Unable to fetch files, try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      showToast("Select a file first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      showToast("Upload completed 🎉");
      await fetchFiles();
    } catch (err) {
      showToast("Upload failed. Please try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename) => {
    setLoading(true);
    try {
      await axios.delete(`${API}/delete/${filename}`);
      showToast("File deleted");
      await fetchFiles();
    } catch (err) {
      showToast("Delete failed.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (filename) => {
    window.open(`${API}/download/${filename}`, "_blank");
  };

  return (
    <div className="app-shell">
      <section className="hero-card slide-in">
        <h1>☁️ Cloud File Storage</h1>
        <p>Fast, secure, and animated file management (upload, download, delete).</p>
      </section>

      <section className="panel fade-in">
        <h2>Upload a File</h2>
        <div className="upload-row">
          <label className="file-input-label">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? file.name : "Choose a file..."}
          </label>

          <button
            className="primary-btn"
            onClick={handleUpload}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Processing..." : "Upload"}
          </button>
        </div>
      </section>

      <section className="panel fade-in delay-1">
        <h2>Your Files</h2>

        {loading && files.length === 0 ? (
          <div className="loader" aria-label="Loading files"></div>
        ) : files.length === 0 ? (
          <p className="muted">No files uploaded yet.</p>
        ) : (
          <div className="file-grid">
            {files.map((f) => (
              <article key={f} className="file-card zoom-in">
                <p className="file-name" title={f}>{f}</p>
                <div className="actions">
                  <button onClick={() => handleDownload(f)} className="action-btn blue">
                    Download
                  </button>
                  <button onClick={() => handleDelete(f)} className="action-btn red">
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {(message || error) && (
        <div className={`toast ${error ? "toast-error" : "toast-success"}`}>
          {error || message}
        </div>
      )}
    </div>
  );
}

export default App;
