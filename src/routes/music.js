const express = require("express");
const { readTracks } = require("../data/musicStore");

const router = express.Router();

router.get("/tracks", async (request, response) => {
  try {
    response.json(await readTracks());
  } catch (error) {
    response.status(500).json({ error: "Music tracks could not be loaded." });
  }
});

module.exports = router;
