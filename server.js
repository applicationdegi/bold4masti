const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Change this before you share the admin link! ----
const ADMIN_KEY = process.env.ADMIN_KEY || "mystories123";

// ---- Set this in Render's Environment settings (see instructions) ----
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    "ERROR: MONGODB_URI is not set. Add it in Render's Environment tab, or in a local .env file."
  );
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ---------- Schemas ----------
const storySchema = new mongoose.Schema({
  title: String,
  content: String,
  author: String,
  createdAt: { type: Date, default: Date.now },
});
const Story = mongoose.model("Story", storySchema);

const eventSchema = new mongoose.Schema({
  event: String,
  page: String,
  detail: String,
  ip: String,
  timestamp: { type: Date, default: Date.now },
});
const Event = mongoose.model("Event", eventSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

async function logEvent(event, page, detail, ip) {
  try {
    await Event.create({ event, page, detail, ip });
  } catch (e) {
    console.error("Failed to log event:", e.message);
  }
}

// ---------- Public API: get all stories ----------
app.get("/api/stories", async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Track any event from the frontend ----------
app.post("/api/track", async (req, res) => {
  const { event, page, detail } = req.body || {};
  await logEvent(event || "unknown", page || "-", detail || "-", getIp(req));
  res.json({ ok: true });
});

// ---------- Admin: add a new story (needs the admin key) ----------
app.post("/api/stories", async (req, res) => {
  const { title, content, author, key } = req.body || {};

  if (key !== ADMIN_KEY) {
    await logEvent("admin_upload_failed_wrong_key", "-", "-", getIp(req));
    return res.status(401).json({ ok: false, error: "Wrong admin key" });
  }
  if (!title || !content) {
    return res.status(400).json({ ok: false, error: "Title/content missing" });
  }

  try {
    const story = await Story.create({
      title,
      content,
      author: author || "Anonymous",
    });
    await logEvent("story_uploaded", "-", title, getIp(req));
    res.json({ ok: true, story });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// ---------- Admin: delete a story ----------
app.delete("/api/stories/:id", async (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Wrong admin key" });
  }
  try {
    await Story.findByIdAndDelete(req.params.id);
    await logEvent("story_deleted", "-", req.params.id, getIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// ---------- Admin: view the events log as plain text ----------
app.get("/admin/events", async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send("Wrong or missing ?key=");
  }
  try {
    const events = await Event.find().sort({ timestamp: 1 });
    if (!events.length) {
      return res.type("text/plain").send("(no events yet)");
    }
    const lines = events.map(
      (e) =>
        `[${e.timestamp.toISOString()}] EVENT="${e.event}" PAGE="${e.page}" DETAIL="${e.detail}" IP=${e.ip}`
    );
    res.type("text/plain").send(lines.join("\n"));
  } catch (e) {
    res.status(500).send("Database error");
  }
});

// ---------- Admin: download the events log as a .txt file ----------
app.get("/admin/events/download", async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send("Wrong or missing ?key=");
  }
  try {
    const events = await Event.find().sort({ timestamp: 1 });
    const lines = events.map(
      (e) =>
        `[${e.timestamp.toISOString()}] EVENT="${e.event}" PAGE="${e.page}" DETAIL="${e.detail}" IP=${e.ip}`
    );
    const content = lines.join("\n") || "(no events yet)";
    res.setHeader("Content-Disposition", "attachment; filename=events.txt");
    res.type("text/plain").send(content);
  } catch (e) {
    res.status(500).send("Database error");
  }
});

app.listen(PORT, () => {
  console.log(`Story site running on port ${PORT}`);
});
