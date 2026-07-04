const express = require("express");
const { readTracks } = require("../data/musicStore");

const router = express.Router();

router.get("/tracks", async (request, response) => {
  try {
    response.json(await readTracks());
  } catch (error) {
    // Only real failure case here is music.json being missing/unreadable,
    // which would otherwise crash the request with an unhandled rejection.
    response.status(500).json({ error: "Music tracks could not be loaded." });
  }
});

module.exports = router;
