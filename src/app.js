const express = require("express");
const path = require("path");
const highscoresRouter = require("./routes/highscores");
const musicRouter = require("./routes/music");

// The app is built here (rather than in server.js) so tests can import it
// directly with supertest, without needing to bind a real port.
function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use("/api/highscores", highscoresRouter);
  app.use("/api/music", musicRouter);

  app.use("/api", (request, response) => {
    response.status(404).json({ error: "API route not found." });
  });

  return app;
}

module.exports = createApp;
