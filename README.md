# Lofi Arcade

A cozy retro arcade in the browser — Pong, Snake, and Brick Breaker — with a synthesized lofi music player and server-tracked high scores.

## Tech stack

- **Front-end:** HTML, CSS, vanilla JavaScript (Canvas 2D for the games, Web Audio API for the music)
- **Back-end:** Node.js + Express
- **Data storage:** JSON files on disk (`data/highscores.json`, `data/music.json`)

## Features

- Three playable games (Pong vs. an adaptive AI, Snake, Brick Breaker), all keyboard- and touch-controlled
- A background music player that synthesizes lofi tracks live from chord/melody data, rather than playing audio files
- High scores are persisted server-side and fetched/updated over the API as you play
- Responsive layout for desktop, tablet, and mobile

## Getting started

### Requirements

- [Node.js](https://nodejs.org/) 18 or later

### Install

```
npm install
```

### Run

```
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. The port can be overridden with the `PORT` environment variable.

### Run the tests

```
npm test
```

This runs the API test suite (Node's built-in test runner + `supertest`) against the high scores and music endpoints.

## Project structure

```
server.js              Entry point — starts the Express server
src/
  app.js                Builds the Express app (routes + static files)
  routes/
    highscores.js        GET/POST /api/highscores
    music.js              GET /api/music/tracks
  data/
    scoreStore.js         Reads/writes data/highscores.json
    musicStore.js         Reads data/music.json
public/
  index.html              Page markup
  css/styles.css          Styling, including responsive layout
  js/app.js               Game logic, music player, API calls
  assets/covers/          Album cover art (SVG)
data/
  highscores.json         Persisted high scores
  music.json              Track definitions (chords, melody, tempo, cover art)
tests/
  highscores.test.js       API tests for the high scores endpoints
  music.test.js             API tests for the music endpoint
```

## API

| Method | Route | Description |
|---|---|---|
| GET | `/api/highscores` | Returns the current high scores for all games |
| POST | `/api/highscores` | Submits a score (or a Pong win/loss result) and returns the updated scores |
| GET | `/api/music/tracks` | Returns the list of playable tracks |

## Notes

- No external/third-party APIs are used — all data is generated and served locally, so no API keys are required.
