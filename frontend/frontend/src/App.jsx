import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("files"); // files or trash
  const [sort, setSort] = useState("date");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const showToast = (text, type = "success") => {
    setMessage(type === "success" ? text : "");
    setError(type === "error" ? text : "");
    setTimeout(() => {
      setMessage("");
      setError("");
    }, 2800);
  };

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API });
    if (token) instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return instance;
  }, [token]);

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setFiles([]);
  };

  const authRequest = async (route) => {
    if (!email || !password) {
      showToast("Email and password are required", "error");
      return;
    }

    try {
      const { data } = await axios.post(`${API}/${route}`, { email, password });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setEmail("");
      setPassword("");
      showToast(`${authMode === "login" ? "Logged in" : "Registered"} successfully`);
      await fetchFiles(data.token);
    } catch (err) {
      const msg = err.response?.data?.error || "Authentication failed";
      showToast(msg, "error");
      console.error(err);
    }
  };

  const fetchFiles = async (explicitToken) => {
    setLoading(true);
    try {
      const target = view === "trash" ? "/trash" : "/files";
      const headers = explicitToken
        ? { Authorization: `Bearer ${explicitToken}` }
        : undefined;
      const res = await axios.get(`${API}${target}`, {
        headers,
        params: {
          q: query,
          sort,
          direction,
          limit: pageSize,
          offset: page * pageSize,
        },
      });
      setFiles(res.data.files || []);
    } catch (err) {
      showToast("Unable to fetch files, try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchFiles();
  }, [token, query, view, sort, direction, page]);

  const sendUpload = async () => {
    if (!file) {
      showToast("Select a file first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      showToast("Upload completed 🎉");
      await fetchFiles();
    } catch (err) {
      showToast(err.response?.data?.error || "Upload failed. Please try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrash = async (fileItem) => {
    setLoading(true);
    try {
      await api.post(`/trash/${fileItem.filename}`);
      showToast("Moved to trash");
      await fetchFiles();
    } catch (err) {
      showToast(err.response?.data?.error || "Unable to move to trash.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (fileItem) => {
    setLoading(true);
    try {
      await api.post(`/restore/${fileItem.filename}`);
      showToast("Restored from trash");
      await fetchFiles();
    } catch (err) {
      showToast(err.response?.data?.error || "Unable to restore.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (fileItem) => {
    setLoading(true);
    try {
      await api.delete(`/permanent/${fileItem.filename}`);
      showToast("Permanently deleted");
      await fetchFiles();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (fileItem) => {
    window.open(`${API}/download/${fileItem.filename}`, "_blank");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const [dropped] = Array.from(e.dataTransfer.files);
    setFile(dropped);
  };

  const filteredFiles = files;

  if (!token) {
    return (
      <div className="app-shell">
        <section className="hero-card slide-in">
          <h1>☁️ Cloud Storage Access</h1>
          <p>Register or login to manage your files securely.</p>
        </section>

        <section className="panel fade-in">
          <div className="auth-toggle">
            <button onClick={() => setAuthMode("login")} className={authMode === "login" ? "active" : ""}>Login</button>
            <button onClick={() => setAuthMode("register")} className={authMode === "register" ? "active" : ""}>Register</button>
          </div>

          <input type="email" value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" value={password} placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button className="primary-btn" onClick={() => authRequest(authMode)}>{authMode === "login" ? "Login" : "Register"}</button>

          <p className="muted">Use any email; the demo stores credentials locally (SQLite).</p>
        </section>

        {(message || error) && (
          <div className={`toast ${error ? "toast-error" : "toast-success"}`}>{error || message}</div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero-card slide-in">
        <div>
          <h1>☁️ Cloud File Storage</h1>
          <p>Secure personal folder for your files (per-user isolation).</p>
        </div>
        <button className="action-btn red" onClick={logout}>Logout</button>
      </header>

      <section className="panel fade-in">
        <div className="board">
          <input 
            type="text" 
            value={query} 
            placeholder="Search files..." 
            onChange={(e) => setQuery(e.target.value)} 
          />
          <span className="muted">{filteredFiles.length} files</span>
        </div>

        <div className="upload-row" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <label className="file-input-label">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file ? file.name : "Drop a file or select"}
          </label>
          <button className="primary-btn" onClick={sendUpload} disabled={loading}>{loading ? "Processing..." : "Upload"}</button>
        </div>
      </section>

      <section className="panel fade-in delay-1">
        <div className="table-toolbar">
          <h2>{view === "trash" ? "Trash" : "Your Files"}</h2>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date">Recent</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="downloads">Downloads</option>
          </select>
          <button className="soft-btn" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}>{direction === "asc" ? "Asc" : "Desc"}</button>
          <button className={`soft-btn ${view === "files" ? "active" : ""}`} onClick={() => {setView("files"); setPage(0);}}>Files</button>
          <button className={`soft-btn ${view === "trash" ? "active" : ""}`} onClick={() => {setView("trash"); setPage(0);}}>Trash</button>
        </div>

        {loading && files.length === 0 ? (
          <div className="loader" aria-label="Loading files" />
        ) : filteredFiles.length === 0 ? (
          <p className="muted">No files {view === "trash" ? "in trash" : "match your query"}.</p>
        ) : (
          <div className="data-table">
            <div className="header-row">
              <div>Name</div>
              <div>Type</div>
              <div>Size</div>
              <div>Updated</div>
              <div>Downloads</div>
              <div>Actions</div>
            </div>
            {filteredFiles.map((f) => (
              <div key={f.id} className="data-row">
                <div title={f.original_name}>{f.original_name}</div>
                <div>{f.mime_type}</div>
                <div>{(f.size / 1024).toFixed(1)} KB</div>
                <div>{new Date(f.uploaded_at).toLocaleString()}</div>
                <div>{f.download_count || 0}</div>
                <div className="row-actions">
                  {view === "trash" ? (
                    <>
                      <button onClick={() => handleRestore(f)} className="action-btn blue">Restore</button>
                      <button onClick={() => handlePermanentDelete(f)} className="action-btn red">Delete</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleDownload(f)} className="action-btn blue">Download</button>
                      <button onClick={() => handleTrash(f)} className="action-btn red">Trash</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page <= 0}>Prev</button>
          <span>Page {page + 1}</span>
          <button onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </section>

      {(message || error) && (
        <div className={`toast ${error ? "toast-error" : "toast-success"}`}>{error || message}</div>
      )}
    </div>
  );
}

export default App;
