const fs = require("fs/promises");
const path = require("path");

const MUSIC_FILE = path.join(__dirname, "..", "..", "data", "music.json");

async function readTracks() {
  const data = await fs.readFile(MUSIC_FILE, "utf8");
  // "source: procedural" flags to the front-end that these tracks are
  // synthesised live from the chord/melody data below, not audio files.
  return { source: "procedural", ...JSON.parse(data) };
}

module.exports = { readTracks };
