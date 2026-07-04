const express = require("express");
const { readScores, writeScores, defaultScores } = require("../data/scoreStore");

const router = express.Router();

router.get("/", async (request, response) => {
  response.json(await readScores());
});

router.post("/", async (request, response) => {
  const game = String(request.body.game || "");

  if (!Object.hasOwn(defaultScores, game)) {
    response.status(400).json({ error: "Invalid game or score." });
    return;
  }

  const scores = await readScores();

  // Pong is scored as a match win/loss tally rather than a single number,
  // so it's submitted and stored differently from the other two games.
  if (game === "pong") {
    const result = String(request.body.result || "");
    if (!["player", "ai"].includes(result)) {
      response.status(400).json({ error: "Invalid Pong result." });
      return;
    }

    const key = result === "player" ? "playerWins" : "aiWins";
    scores.pong[key] += 1;
  } else {
    const score = Number(request.body.score);
    if (!Number.isFinite(score) || score < 0) {
      response.status(400).json({ error: "Invalid game or score." });
      return;
    }

    // Only ever keep the best score for a game, never overwrite with a lower one.
    scores[game] = Math.max(scores[game] || 0, Math.floor(score));
  }

  await writeScores(scores);
  response.json(scores);
});

module.exports = router;
