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
      const headers = explicitToken
        ? { Authorization: `Bearer ${explicitToken}` }
        : undefined;
      const res = await axios.get(`${API}/files`, { headers, params: { q: query } });
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
  }, [token, query]);

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

  const handleDelete = async (fileItem) => {
    setLoading(true);
    try {
      await api.delete(`/delete/${fileItem.filename}`);
      showToast("File deleted");
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
        <h2>Your Files</h2>

        {loading && files.length === 0 ? (
          <div className="loader" aria-label="Loading files" />
        ) : filteredFiles.length === 0 ? (
          <p className="muted">No files match your query yet.</p>
        ) : (
          <div className="file-grid">
            {filteredFiles.map((f) => (
              <article key={f.id} className="file-card zoom-in">
                <p className="file-name" title={f.original_name}>{f.original_name}</p>
                <small className="muted">{Math.round(f.size / 1024)} KB • {f.mime_type}</small>
                <div className="actions">
                  <button onClick={() => handleDownload(f)} className="action-btn blue">Download</button>
                  <button onClick={() => handleDelete(f)} className="action-btn red">Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {(message || error) && (
        <div className={`toast ${error ? "toast-error" : "toast-success"}`}>{error || message}</div>
      )}
    </div>
  );
}

export default App;
