const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const path = require("path");
const request = require("supertest");
const createApp = require("../src/app");

const SCORE_FILE = path.join(__dirname, "..", "data", "highscores.json");
const defaultScores = {
  pong: { playerWins: 0, aiWins: 0 },
  snake: 0,
  brickBreaker: 0
};

async function resetScoreFile() {
  await fs.writeFile(SCORE_FILE, `${JSON.stringify(defaultScores, null, 2)}\n`);
}

test("GET /api/highscores returns the stored scores", async () => {
  await resetScoreFile();
  const app = createApp();

  const response = await request(app).get("/api/highscores");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, defaultScores);
});

test("POST /api/highscores rejects an unknown game", async () => {
  await resetScoreFile();
  const app = createApp();

  const response = await request(app)
    .post("/api/highscores")
    .send({ game: "does-not-exist", score: 100 });

  assert.equal(response.status, 400);
});

test("POST /api/highscores rejects a negative score", async () => {
  await resetScoreFile();
  const app = createApp();

  const response = await request(app)
    .post("/api/highscores")
    .send({ game: "snake", score: -5 });

  assert.equal(response.status, 400);
});

test("POST /api/highscores only keeps the higher of two scores", async () => {
  await resetScoreFile();
  const app = createApp();

  await request(app).post("/api/highscores").send({ game: "snake", score: 40 });
  const lower = await request(app).post("/api/highscores").send({ game: "snake", score: 10 });

  assert.equal(lower.status, 200);
  assert.equal(lower.body.snake, 40);
});

test("POST /api/highscores records a Pong result as a win/loss tally", async () => {
  await resetScoreFile();
  const app = createApp();

  const response = await request(app)
    .post("/api/highscores")
    .send({ game: "pong", result: "player" });

  assert.equal(response.status, 200);
  assert.equal(response.body.pong.playerWins, 1);
  assert.equal(response.body.pong.aiWins, 0);
});

test("POST /api/highscores rejects an invalid Pong result", async () => {
  await resetScoreFile();
  const app = createApp();

  const response = await request(app)
    .post("/api/highscores")
    .send({ game: "pong", result: "draw" });

  assert.equal(response.status, 400);
});

test.after(resetScoreFile);
