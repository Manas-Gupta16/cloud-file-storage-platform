import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);

  const API = "http://localhost:5000/api";

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API}/files`);
      setFiles(res.data.files);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API}/upload`, formData);
      setFile(null);
      fetchFiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (filename) => {
    try {
      await axios.delete(`${API}/delete/${filename}`);
      fetchFiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = (filename) => {
    window.open(`${API}/download/${filename}`);
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>☁️ Cloud File Storage</h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button onClick={handleUpload} style={{ marginLeft: "10px" }}>
          Upload
        </button>
      </div>

      <h2>Files</h2>

      {files.length === 0 && <p>No files uploaded</p>}

      <ul>
        {files.map((f) => (
          <li key={f} style={{ marginBottom: "10px" }}>
            {f}

            <button
              onClick={() => handleDownload(f)}
              style={{ marginLeft: "10px" }}
            >
              Download
            </button>

            <button
              onClick={() => handleDelete(f)}
              style={{ marginLeft: "10px", color: "red" }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;