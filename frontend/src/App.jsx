import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function App() {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`${API}/todos`);
    const data = await r.json();
    setItems(data.items || []);
  }

  useEffect(() => { load(); }, []);

  async function addTodo(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch(`${API}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      setTitle("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id) {
    await fetch(`${API}/todos/${id}/toggle`, { method: "PATCH" });
    await load();
  }

  async function del(id) {
    await fetch(`${API}/todos/${id}`, { method: "DELETE" });
    await load();
  }

  async function uploadAttachment(id, file) {
    // 1) ask server for signed URL
    const r = await fetch(`${API}/todos/${id}/attachment-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" })
    });
    const { uploadUrl } = await r.json();

    // 2) upload directly to S3
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });

    await load();
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>TO-DO</h1>

      <form onSubmit={addTodo} style={{ display: "flex", gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          style={{ flex: 1, padding: 10 }}
        />
        <button disabled={busy} style={{ padding: "10px 14px" }}>
          Add
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {items.map((t) => (
          <li key={t.id} style={{ padding: 12, border: "1px solid #ddd", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={!!t.completed} onChange={() => toggle(t.id)} />
                <span style={{ textDecoration: t.completed ? "line-through" : "none" }}>
                  {t.title}
                </span>
              </label>
              <button onClick={() => del(t.id)}>Delete</button>
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAttachment(t.id, f);
                }}
              />
              {t.attachment?.fileName ? (
                <span style={{ fontSize: 13 }}>Attached: {t.attachment.fileName}</span>
              ) : (
                <span style={{ fontSize: 13, opacity: 0.7 }}>No attachment</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
