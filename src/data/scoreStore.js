const fs = require("fs/promises");
const path = require("path");

const SCORE_FILE = path.join(__dirname, "..", "..", "data", "highscores.json");

const defaultScores = {
  pong: {
    playerWins: 0,
    aiWins: 0
  },
  snake: 0,
  brickBreaker: 0
};

// Merges stored scores over the defaults so a partially written or
// legacy file never leaves a game's score undefined on the front-end.
function normalizeScores(scores) {
  return {
    ...defaultScores,
    ...scores,
    pong: {
      ...defaultScores.pong,
      ...(typeof scores.pong === "object" && scores.pong !== null ? scores.pong : {})
    }
  };
}

async function readScores() {
  try {
    const data = await fs.readFile(SCORE_FILE, "utf8");
    return normalizeScores(JSON.parse(data));
  } catch (error) {
    // No file yet (first run) or corrupted contents: fall back to defaults
    // and persist them so subsequent reads succeed.
    await writeScores(defaultScores);
    return normalizeScores(defaultScores);
  }
}

async function writeScores(scores) {
  await fs.mkdir(path.dirname(SCORE_FILE), { recursive: true });
  await fs.writeFile(SCORE_FILE, `${JSON.stringify(scores, null, 2)}\n`);
}

module.exports = { readScores, writeScores, defaultScores };
