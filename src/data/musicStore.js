const fs = require("fs/promises");
const path = require("path");

const MUSIC_FILE = path.join(__dirname, "..", "..", "data", "music.json");

async function readTracks() {
  const data = await fs.readFile(MUSIC_FILE, "utf8");
  return { source: "procedural", ...JSON.parse(data) };
}

module.exports = { readTracks };
