const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Change this password before you share the admin link! ----
const ADMIN_KEY = process.env.ADMIN_KEY || "mystories123";

const STORIES_FILE = path.join(__dirname, "data", "stories.json");
const EVENTS_FILE = path.join(__dirname, "events.txt");

// make sure data files exist
if (!fs.existsSync(STORIES_FILE)) {
  fs.writeFileSync(STORIES_FILE, "[]", "utf8");
}
if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, "", "utf8");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readStories() {
  try {
    return JSON.parse(fs.readFileSync(STORIES_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeStories(stories) {
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2), "utf8");
}

function logEvent(entry) {
  const time = new Date().toISOString();
  const line = `[${time}] ${entry}\n`;
  fs.appendFileSync(EVENTS_FILE, line, "utf8");
}

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ---------- Public API: get all stories ----------
app.get("/api/stories", (req, res) => {
  res.json(readStories());
});

// ---------- Track any event from the frontend ----------
app.post("/api/track", (req, res) => {
  const { event, page, detail } = req.body || {};
  const ip = getIp(req);
  logEvent(
    `EVENT="${event || "unknown"}" PAGE="${page || "-"}" DETAIL="${
      detail || "-"
    }" IP=${ip}`
  );
  res.json({ ok: true });
});

// ---------- Admin: add a new story (needs the admin key) ----------
app.post("/api/stories", (req, res) => {
  const { title, content, author, key } = req.body || {};

  if (key !== ADMIN_KEY) {
    logEvent(`EVENT="admin_upload_failed_wrong_key" IP=${getIp(req)}`);
    return res.status(401).json({ ok: false, error: "Wrong admin key" });
  }
  if (!title || !content) {
    return res.status(400).json({ ok: false, error: "Title/content missing" });
  }

  const stories = readStories();
  const newStory = {
    id: Date.now().toString(),
    title,
    content,
    author: author || "Anonymous",
    createdAt: new Date().toISOString(),
  };
  stories.unshift(newStory);
  writeStories(stories);

  logEvent(`EVENT="story_uploaded" TITLE="${title}" IP=${getIp(req)}`);
  res.json({ ok: true, story: newStory });
});

// ---------- Admin: delete a story ----------
app.delete("/api/stories/:id", (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Wrong admin key" });
  }
  let stories = readStories();
  stories = stories.filter((s) => s.id !== req.params.id);
  writeStories(stories);
  logEvent(`EVENT="story_deleted" ID="${req.params.id}" IP=${getIp(req)}`);
  res.json({ ok: true });
});

// ---------- Admin: view/download the events log ----------
app.get("/admin/events", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send("Wrong or missing ?key=");
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(fs.readFileSync(EVENTS_FILE, "utf8") || "(no events yet)");
});

app.get("/admin/events/download", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send("Wrong or missing ?key=");
  }
  res.download(EVENTS_FILE, "events.txt");
});

app.listen(PORT, () => {
  console.log(`Story site running on port ${PORT}`);
});
