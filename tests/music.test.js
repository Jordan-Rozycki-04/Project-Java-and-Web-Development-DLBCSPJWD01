const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const createApp = require("../src/app");

test("GET /api/music/tracks returns a non-empty track list", async () => {
  const app = createApp();

  const response = await request(app).get("/api/music/tracks");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.tracks));
  assert.ok(response.body.tracks.length > 0);
});

test("GET /api/music/tracks includes the fields the player needs", async () => {
  const app = createApp();

  const response = await request(app).get("/api/music/tracks");
  const [track] = response.body.tracks;

  assert.ok(track.title);
  assert.ok(track.artist);
  assert.ok(track.cover);
  assert.ok(track.durationSeconds > 0);
});

test("GET /api/unknown-route returns a 404 for unrecognised API paths", async () => {
  const app = createApp();

  const response = await request(app).get("/api/unknown-route");

  assert.equal(response.status, 404);
});
