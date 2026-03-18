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
    if (!file) {
      alert("Please select a file first");
      return;
    }

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
    <div
      style={{
        padding: "30px",
        fontFamily: "Arial",
        background: "#f5f7fb",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: "20px" }}>☁️ Cloud Storage Dashboard</h1>

      {/* Upload Section */}
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          marginBottom: "30px",
        }}
      >
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button
          onClick={handleUpload}
          style={{
            marginLeft: "10px",
            padding: "8px 15px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Upload
        </button>
      </div>

      {/* Files Section */}
      <h2>Your Files</h2>

      {files.length === 0 ? (
        <p>No files uploaded</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "20px",
          }}
        >
          {files.map((f) => (
            <div
              key={f}
              style={{
                background: "white",
                padding: "15px",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
            >
              <p
                style={{
                  fontWeight: "bold",
                  wordBreak: "break-all",
                }}
              >
                {f}
              </p>

              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => handleDownload(f)}
                  style={{
                    marginRight: "5px",
                    padding: "5px 10px",
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Download
                </button>

                <button
                  onClick={() => handleDelete(f)}
                  style={{
                    padding: "5px 10px",
                    background: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;