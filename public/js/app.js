const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const canvasWrap = document.querySelector(".canvas-wrap");
const gameStage = document.querySelector("#gameStage");
const backButton = document.querySelector("#backButton");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const stageTitle = document.querySelector("#stageTitle");
const stageSubtitle = document.querySelector("#stageSubtitle");
const currentScore = document.querySelector("#currentScore");
const stageHighScore = document.querySelector("#stageHighScore");
const controlHint = document.querySelector("#controlHint");
const gameMessage = document.querySelector("#gameMessage");
const messageTitle = document.querySelector("#messageTitle");
const messageBody = document.querySelector("#messageBody");
const highScoreLabels = document.querySelectorAll("[data-high-score]");
const touchButtons = document.querySelectorAll("[data-control]");
const trackCover = document.querySelector("#trackCover");
const trackTitle = document.querySelector("#trackTitle");
const trackArtist = document.querySelector("#trackArtist");
const rewindTrack = document.querySelector("#rewindTrack");
const toggleMusic = document.querySelector("#toggleMusic");
const skipTrack = document.querySelector("#skipTrack");
const volumeSlider = document.querySelector("#volumeSlider");
const trackProgress = document.querySelector("#trackProgress");
const elapsedTime = document.querySelector("#elapsedTime");
const remainingTime = document.querySelector("#remainingTime");

const gameMeta = {
  pong: {
    title: "Pong",
    subtitle: "two-player classic",
    hint: "Use W/S to move. Beat the AI opponent to 7 points as it gets sharper."
  },
  snake: {
    title: "Snake",
    subtitle: "zone-out survival",
    hint: "Use arrow keys or WASD. Eat snacks, avoid walls and your tail."
  },
  brickBreaker: {
    title: "Brick Breaker",
    subtitle: "soft neon chaos",
    hint: "Move with Left/Right or A/D. Clear bricks before losing all lives."
  }
};

let highScores = {
  pong: {
    playerWins: 0,
    aiWins: 0
  },
  snake: 0,
  brickBreaker: 0
};

// Canvas backdrop gradient stops per game theme, kept close in tone to that
// game's stage background (set in styles.css) but darker/cooler so the
// playfield still reads as a distinct "screen" rather than blending in.
const backdropThemes = {
  pong: ["#292335", "#24333f", "#3b2b3d"],
  snake: ["#2e2116", "#3d2c1c", "#4a3320"],
  brickBreaker: ["#182219", "#233024", "#2b3a2a"]
};

let currentTheme = "pong";
let activeGame = null;
let animationFrame = null;
let keys = {};
let musicTracks = [];
let currentTrackIndex = 0;
let audioContext = null;
let musicTimer = null;
let progressTimer = null;
let musicStep = 0;
let musicPlaying = false;
let masterGain = null;
let musicGain = null;
let delayNode = null;
let delayFeedback = null;
let trackStartedAt = 0;
let pausedPosition = 0;
let isSeeking = false;

const touchKeyMap = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
};

// Semitone distance from A4, used to convert note names (e.g. "C#3") to a
// playable frequency in noteToFrequency().
const noteOffsets = {
  C: -9,
  "C#": -8,
  Db: -8,
  D: -7,
  "D#": -6,
  Eb: -6,
  E: -5,
  F: -4,
  "F#": -3,
  Gb: -3,
  G: -2,
  "G#": -1,
  Ab: -1,
  A: 0,
  "A#": 1,
  Bb: 1,
  B: 2
};

async function loadHighScores() {
  try {
    const response = await fetch("/api/highscores");
    highScores = await response.json();
    renderHighScores();
  } catch (error) {
    console.warn("High scores could not be loaded.", error);
  }
}

async function loadMusicTracks() {
  try {
    const response = await fetch("/api/music/tracks");
    const playlist = await response.json();
    musicTracks = playlist.tracks || [];
    renderTrack();
  } catch (error) {
    console.warn("Music tracks could not be loaded.", error);
    trackTitle.textContent = "Music unavailable";
    trackArtist.textContent = "Try refreshing the page";
  }
}

async function saveHighScore(game, score) {
  // Pong tracks wins/losses instead of a numeric score, so it goes through
  // savePongResult() below rather than this path.
  if (game === "pong") {
    return;
  }

  if (score <= (highScores[game] || 0)) {
    return;
  }

  try {
    const response = await fetch("/api/highscores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, score })
    });
    highScores = await response.json();
    renderHighScores();
    stageHighScore.textContent = formatScoreRecord(game);
  } catch (error) {
    console.warn("High score could not be saved.", error);
  }
}

async function savePongResult(result) {
  try {
    const response = await fetch("/api/highscores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "pong", result })
    });
    highScores = await response.json();
    renderHighScores();
    stageHighScore.textContent = formatScoreRecord("pong");
  } catch (error) {
    console.warn("Pong result could not be saved.", error);
  }
}

function formatScoreRecord(game) {
  if (game === "pong") {
    const record = highScores.pong || {};
    return `Wins ${record.playerWins || 0} | AI ${record.aiWins || 0}`;
  }

  return highScores[game] || 0;
}

function renderHighScores() {
  highScoreLabels.forEach((label) => {
    const game = label.dataset.highScore;
    label.textContent = formatScoreRecord(game);
  });
}

function currentTrack() {
  return musicTracks[currentTrackIndex];
}

function renderTrack() {
  const track = currentTrack();
  if (!track) {
    return;
  }

  trackCover.src = track.cover;
  trackCover.alt = `${track.album} album cover`;
  trackCover.onerror = () => {
    trackCover.onerror = null;
    trackCover.removeAttribute("src");
  };
  trackTitle.textContent = track.title;
  trackArtist.textContent = `${track.artist} - ${track.album}`;
  trackProgress.max = track.durationSeconds || 120;
  updateProgressDisplay(getTrackPosition());
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getTrackDuration() {
  return currentTrack()?.durationSeconds || 120;
}

// Each "step" is a sixteenth note at the track's BPM; the music scheduler
// below fires once per step to decide what to play.
function getStepDuration(track = currentTrack()) {
  return (60 / (track?.bpm || 80)) / 2;
}

function getTrackPosition() {
  if (!musicPlaying) {
    return pausedPosition;
  }

  return Math.min(getTrackDuration(), Math.max(0, (performance.now() - trackStartedAt) / 1000));
}

function positionToStep(position, track = currentTrack()) {
  return Math.floor(position / getStepDuration(track)) % 64;
}

function updateProgressDisplay(position = getTrackPosition()) {
  const duration = getTrackDuration();
  const safePosition = Math.min(duration, Math.max(0, position));

  if (!isSeeking) {
    trackProgress.value = String(Math.floor(safePosition));
  }

  elapsedTime.textContent = formatTime(safePosition);
  remainingTime.textContent = `-${formatTime(duration - safePosition)}`;
}

function startProgressTimer() {
  clearInterval(progressTimer);
  updateProgressDisplay();
  progressTimer = setInterval(() => {
    const position = getTrackPosition();
    updateProgressDisplay(position);

    if (position >= getTrackDuration()) {
      changeTrack(1);
    }
  }, 250);
}

function seekTrack(position) {
  const duration = getTrackDuration();
  pausedPosition = Math.min(duration, Math.max(0, Number(position)));
  musicStep = positionToStep(pausedPosition);

  if (musicPlaying) {
    trackStartedAt = performance.now() - pausedPosition * 1000;
  }

  updateProgressDisplay(pausedPosition);
}

// Converts a note name like "C#3" into a frequency in Hz, relative to A4 (440Hz).
function noteToFrequency(note) {
  const match = /^([A-G][b#]?)(-?\d)$/.exec(note);
  if (!match) {
    return 440;
  }

  const [, pitch, octave] = match;
  const semitonesFromA4 = noteOffsets[pitch] + (Number(octave) - 4) * 12;
  return 440 * 2 ** (semitonesFromA4 / 12);
}

// The music is not pre-recorded audio: it's synthesized live with the Web
// Audio API from the chord/melody/beat data in music.json. This builds the
// node graph (oscillators feed into a shared gain + delay for a lo-fi echo).
function ensureAudioContext() {
  if (audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  musicGain = audioContext.createGain();
  delayNode = audioContext.createDelay();
  delayFeedback = audioContext.createGain();

  masterGain.gain.value = Number(volumeSlider.value);
  musicGain.gain.value = 1;
  delayNode.delayTime.value = 0.24;
  delayFeedback.gain.value = 0.22;

  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(musicGain);
  musicGain.connect(masterGain);
  masterGain.connect(audioContext.destination);
}

function playTone(frequency, startTime, duration, options = {}) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(options.filter || 1600, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);
  gain.connect(delayNode);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

// Generates a short burst of filtered white noise, used for the
// percussive/hi-hat-like hits in playBeat() below.
function playNoise(startTime, duration) {
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = (Math.random() * 2 - 1) * 0.22;
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.05, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);
  source.start(startTime);
  source.stop(startTime + duration);
}

// Each track's beatPattern name selects a rhythm made of kick/snare-style
// hits on specific 16th-note steps, looping every 16 steps.
function playBeat(pattern, startTime, beat) {
  const step = musicStep % 16;

  if (["dusty", "four", "shuffle", "bright", "rain"].includes(pattern) && step % 4 === 0) {
    playTone(54, startTime, beat * 0.32, {
      type: "sine",
      volume: pattern === "bright" ? 0.22 : 0.16,
      filter: 420
    });
  }

  if (pattern === "halfTime" && step % 8 === 0) {
    playTone(48, startTime, beat * 0.5, {
      type: "sine",
      volume: 0.2,
      filter: 380
    });
  }

  if (pattern === "sparse" && step % 12 === 0) {
    playTone(44, startTime, beat * 0.55, {
      type: "sine",
      volume: 0.18,
      filter: 340
    });
  }

  if (["dusty", "halfTime", "shuffle", "bright"].includes(pattern) && step % 8 === 4) {
    playNoise(startTime, beat * 0.26);
  }

  if (pattern === "four" && step % 4 === 2) {
    playNoise(startTime, beat * 0.18);
  }

  if (pattern === "rain" && step % 3 === 0) {
    playNoise(startTime, beat * 0.12);
  }

  if (pattern === "shuffle" && (step === 3 || step === 11)) {
    playNoise(startTime + beat * 0.18, beat * 0.12);
  }

  if (pattern === "bright" && step % 2 === 1) {
    playNoise(startTime, beat * 0.08);
  }
}

// Fires once per 16th-note step while music is playing: picks the current
// chord/melody note from the track data, triggers the tones/beat for this
// step, fades out near the end of the track, and advances to the next track
// once the duration runs out.
function scheduleMusicStep() {
  const track = currentTrack();
  if (!track || !audioContext) {
    return;
  }

  const beat = 60 / track.bpm;
  const now = audioContext.currentTime;
  const duration = getTrackDuration();
  const position = getTrackPosition();
  const remaining = duration - position;
  const chordEvery = track.chordEvery || 8;
  const melodyEvery = track.melodyEvery || 2;
  const chord = track.progression[Math.floor(musicStep / chordEvery) % track.progression.length];
  const melodyNote = track.melody[musicStep % track.melody.length];

  if (remaining <= 0) {
    changeTrack(1);
    return;
  }

  if (musicGain) {
    const fadeLevel = remaining < 8 ? Math.max(0.02, remaining / 8) : 1;
    musicGain.gain.setTargetAtTime(fadeLevel, now, 0.12);
  }

  if (musicStep % chordEvery === 0) {
    chord.forEach((note, index) => {
      playTone(noteToFrequency(note), now + index * 0.014, beat * (track.beatPattern === "sparse" ? 5 : 3.6), {
        type: track.wave || "triangle",
        volume: track.beatPattern === "bright" ? 0.04 : 0.055,
        filter: track.wave === "square" ? 720 : 950
      });
    });
  }

  if (musicStep % (track.beatPattern === "sparse" ? 8 : 4) === 0) {
    playTone(noteToFrequency(chord[0]) / 2, now, beat * 1.4, {
      type: "sine",
      volume: track.beatPattern === "halfTime" ? 0.2 : 0.16,
      filter: 500
    });
  }

  if (musicStep % melodyEvery === 0) {
    playTone(noteToFrequency(melodyNote), now, beat * (melodyEvery > 3 ? 1.4 : 0.8), {
      type: track.wave === "square" ? "triangle" : track.wave || "triangle",
      volume: track.beatPattern === "bright" ? 0.06 : 0.08,
      filter: track.beatPattern === "bright" ? 2400 : 1800
    });
  }

  playBeat(track.beatPattern || "dusty", now, beat);

  musicStep = (musicStep + 1) % 64;
}

async function playMusic() {
  if (!musicTracks.length) {
    await loadMusicTracks();
  }

  if (!musicTracks.length) {
    return;
  }

  ensureAudioContext();
  await audioContext.resume();
  trackStartedAt = performance.now() - pausedPosition * 1000;
  musicPlaying = true;
  toggleMusic.classList.add("is-playing");
  clearInterval(musicTimer);
  if (musicGain) {
    musicGain.gain.cancelScheduledValues(audioContext.currentTime);
    musicGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.2);
  }
  scheduleMusicStep();
  musicTimer = setInterval(scheduleMusicStep, getStepDuration() * 1000);
  startProgressTimer();
}

function pauseMusic() {
  pausedPosition = getTrackPosition();
  musicPlaying = false;
  toggleMusic.classList.remove("is-playing");
  clearInterval(musicTimer);
  clearInterval(progressTimer);
  musicTimer = null;
  progressTimer = null;
  updateProgressDisplay(pausedPosition);
}

function changeTrack(direction, startAt = 0) {
  if (!musicTracks.length) {
    return;
  }

  clearInterval(musicTimer);
  currentTrackIndex = (currentTrackIndex + direction + musicTracks.length) % musicTracks.length;
  pausedPosition = startAt;
  musicStep = positionToStep(startAt);
  renderTrack();

  if (musicPlaying) {
    if (musicGain && audioContext) {
      musicGain.gain.cancelScheduledValues(audioContext.currentTime);
      musicGain.gain.setValueAtTime(0.05, audioContext.currentTime);
    }
    playMusic();
  }
}

// Browsers block audio playback until a user gesture. This listens for the
// first click/keypress anywhere outside the music player itself and uses it
// to kick off playback automatically.
function startMusicFromFirstInteraction(event) {
  if (event.target instanceof Element && event.target.closest(".music-player")) {
    return;
  }

  if (!musicPlaying) {
    playMusic();
  }
  window.removeEventListener("pointerdown", startMusicFromFirstInteraction);
  window.removeEventListener("keydown", startMusicFromFirstInteraction);
}

function setScore(score) {
  currentScore.textContent = score;
}

function showMessage(title, body) {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  gameMessage.classList.remove("hidden");
}

function hideMessage() {
  gameMessage.classList.add("hidden");
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackdrop() {
  const [start, mid, end] = backdropThemes[currentTheme] || backdropThemes.pong;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(0.5, mid);
  gradient.addColorStop(1, end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 247, 237, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawText(text, x, y, size = 22, align = "center") {
  context.fillStyle = "#fff7ed";
  context.font = `700 ${size}px Space Mono, monospace`;
  context.textAlign = align;
  context.fillText(text, x, y);
}

// Sizes the canvas to fit .canvas-wrap while keeping its 16:9 aspect ratio.
// Done in JS (against the wrapper's actual measured box) rather than pure
// CSS, because percentage max-height combined with aspect-ratio inside a
// grid row does not resolve reliably across browsers.
function fitCanvasToStage() {
  if (!canvasWrap || !canvasWrap.clientWidth || !canvasWrap.clientHeight) {
    return;
  }

  const maxWidth = Math.min(canvasWrap.clientWidth, 1120);
  const maxHeight = canvasWrap.clientHeight;
  let width = maxWidth;
  let height = (width * 9) / 16;

  if (height > maxHeight) {
    height = maxHeight;
    width = (height * 16) / 9;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

window.addEventListener("resize", () => {
  fitCanvasToStage();
  if (activeGame) {
    activeGame.draw();
  }
});

// All three games share this loop: each active game object exposes
// update()/draw()/reset() and a running flag, so the loop itself doesn't
// need to know which game is active.
function loop() {
  if (!activeGame || !activeGame.running) {
    return;
  }

  activeGame.update();
  activeGame.draw();
  animationFrame = requestAnimationFrame(loop);
}

function startLoop() {
  cancelAnimationFrame(animationFrame);
  hideMessage();
  activeGame.running = true;
  animationFrame = requestAnimationFrame(loop);
}

function stopGame() {
  cancelAnimationFrame(animationFrame);
  if (activeGame) {
    activeGame.running = false;
  }
}

function openGame(gameName) {
  stopGame();
  keys = {};
  activeGame = createGame(gameName);

  const meta = gameMeta[gameName];
  stageTitle.textContent = meta.title;
  stageSubtitle.textContent = meta.subtitle;
  controlHint.textContent = meta.hint;
  setScore(0);
  stageHighScore.textContent = formatScoreRecord(gameName);
  currentTheme = gameName;
  gameStage.dataset.theme = gameName;
  gameStage.classList.add("active");
  gameStage.setAttribute("aria-hidden", "false");
  fitCanvasToStage();
  activeGame.reset();
  activeGame.draw();
  showMessage(meta.title, "Press Start to play.");
}

function closeGame() {
  stopGame();
  activeGame = null;
  gameStage.classList.remove("active");
  gameStage.setAttribute("aria-hidden", "true");
  clearCanvas();
}

function endRound(title, body) {
  stopGame();
  showMessage(title, body);
}

function createGame(gameName) {
  if (gameName === "pong") {
    return createPong();
  }

  if (gameName === "snake") {
    return createSnake();
  }

  return createBrickBreaker();
}

function createPong() {
  const paddleWidth = 16;
  const paddleHeight = 104;
  const targetScore = 7;
  const state = {
    running: false,
    p1: 0,
    p2: 0,
    leftY: canvas.height / 2 - paddleHeight / 2,
    rightY: canvas.height / 2 - paddleHeight / 2,
    aiTargetY: canvas.height / 2,
    ballX: canvas.width / 2,
    ballY: canvas.height / 2,
    ballVX: 3.4,
    ballVY: 2.2
  };

  // The base rally speed climbs gradually with the total points played so
  // far (capped at the old fixed speed), so the very first serve is gentle
  // and the match ramps up over time instead of starting at full speed.
  function getBaseBallSpeed() {
    return Math.min(6, 3.4 + (state.p1 + state.p2) * 0.35);
  }

  function resetBall(direction = 1) {
    const speed = getBaseBallSpeed();
    state.ballX = canvas.width / 2;
    state.ballY = canvas.height / 2;
    state.ballVX = speed * direction;
    state.ballVY = (Math.random() > 0.5 ? 1 : -1) * (speed * 0.65);
  }

  function scorePoint(player) {
    if (player === 1) {
      state.p1 += 1;
      resetBall(1);
    } else {
      state.p2 += 1;
      resetBall(-1);
    }

    const total = Math.max(state.p1, state.p2);
    setScore(total);

    if (state.p1 >= targetScore || state.p2 >= targetScore) {
      const playerWon = state.p1 >= targetScore;
      savePongResult(playerWon ? "player" : "ai");
      endRound(
        playerWon ? "You beat the AI" : "The AI wins",
        `Final score ${state.p1} - ${state.p2}. Press Restart for another match.`
      );
    }
  }

  // Difficulty ramps from 0 to 1 as the player's own score climbs, so the
  // AI gets sharper the better the player is doing (see mistake/reaction below).
  function getAiDifficulty() {
    return Math.min(1, state.p1 / 7);
  }

  // Simulates the ball bouncing off the top/bottom walls to estimate where
  // it will cross the AI's paddle line, so the AI can move toward that spot
  // in advance instead of just reacting to the ball's current position.
  function predictBallY() {
    let predictedX = state.ballX;
    let predictedY = state.ballY;
    let velocityX = Math.abs(state.ballVX);
    let velocityY = state.ballVY;
    const targetX = canvas.width - 44;
    let safety = 0;

    while (predictedX < targetX && safety < 220) {
      predictedX += velocityX;
      predictedY += velocityY;

      if (predictedY <= 14 || predictedY >= canvas.height - 14) {
        velocityY *= -1;
        predictedY = Math.max(14, Math.min(canvas.height - 14, predictedY));
      }

      safety += 1;
    }

    return predictedY;
  }

  // "mistake" adds a wobble to the AI's target so it isn't a perfect wall at
  // low difficulty; "reaction" and "maxSpeed" control how quickly/eagerly it
  // chases that target, both scaling up with difficulty.
  function updateAiPaddle() {
    const difficulty = getAiDifficulty();
    const paddleCenter = state.rightY + paddleHeight / 2;
    const ballIsApproaching = state.ballVX > 0;
    const centerCourt = canvas.height / 2;
    const prediction = ballIsApproaching ? predictBallY() : centerCourt;
    const mistake = (1 - difficulty) * 62 + 14;
    const drift = Math.sin((state.p1 + state.p2 + state.ballX) * 0.018) * mistake;
    const reaction = 0.045 + difficulty * 0.075;
    const maxSpeed = 4.2 + difficulty * 2.9;

    state.aiTargetY += (prediction + drift - state.aiTargetY) * reaction;

    if (Math.abs(state.aiTargetY - paddleCenter) > 10) {
      state.rightY += Math.sign(state.aiTargetY - paddleCenter) * maxSpeed;
    }

    state.rightY = Math.max(18, Math.min(canvas.height - paddleHeight - 18, state.rightY));
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.p1 = 0;
      state.p2 = 0;
      state.leftY = canvas.height / 2 - paddleHeight / 2;
      state.rightY = canvas.height / 2 - paddleHeight / 2;
      state.aiTargetY = canvas.height / 2;
      resetBall(Math.random() > 0.5 ? 1 : -1);
      setScore(0);
    },
    update() {
      const speed = 8;
      if (keys.KeyW) state.leftY -= speed;
      if (keys.KeyS) state.leftY += speed;
      state.leftY = Math.max(18, Math.min(canvas.height - paddleHeight - 18, state.leftY));
      updateAiPaddle();

      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballY <= 14 || state.ballY >= canvas.height - 14) {
        state.ballVY *= -1;
      }

      const hitsLeft = state.ballX <= 44 && state.ballY >= state.leftY && state.ballY <= state.leftY + paddleHeight;
      const hitsRight = state.ballX >= canvas.width - 44 && state.ballY >= state.rightY && state.ballY <= state.rightY + paddleHeight;

      if (hitsLeft || hitsRight) {
        state.ballVX *= -1.08;
        const paddleY = hitsLeft ? state.leftY : state.rightY;
        state.ballVY = ((state.ballY - (paddleY + paddleHeight / 2)) / (paddleHeight / 2)) * 6;
      }

      if (state.ballX < 0) scorePoint(2);
      if (state.ballX > canvas.width) scorePoint(1);
    },
    draw() {
      drawBackdrop();
      context.fillStyle = "rgba(255, 247, 237, 0.22)";
      for (let y = 18; y < canvas.height; y += 34) {
        context.fillRect(canvas.width / 2 - 3, y, 6, 18);
      }

      context.fillStyle = "#fff7ed";
      context.fillRect(28, state.leftY, paddleWidth, paddleHeight);
      context.fillRect(canvas.width - 44, state.rightY, paddleWidth, paddleHeight);
      context.beginPath();
      context.arc(state.ballX, state.ballY, 13, 0, Math.PI * 2);
      context.fill();
      drawText(`${state.p1}  ${state.p2}`, canvas.width / 2, 66, 38);
      drawText(`AI level ${Math.round(1 + getAiDifficulty() * 4)}`, canvas.width - 24, canvas.height - 24, 16, "right");
    }
  };
}

function createSnake() {
  const tile = 24;
  const columns = Math.floor(canvas.width / tile);
  const rows = Math.floor(canvas.height / tile);
  const state = {
    running: false,
    tick: 0,
    score: 0,
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    snake: [],
    snack: { x: 10, y: 10 }
  };

  // The snake advances one tile every N animation frames rather than every
  // frame (otherwise it would be uncontrollably fast). N starts high (slow)
  // and steps down as the score grows, so the game speeds up gradually
  // instead of being at top speed from the first snack.
  function getMoveInterval() {
    const startInterval = 12;
    const minInterval = 5;
    const step = Math.floor(state.score / 20);
    return Math.max(minInterval, startInterval - step);
  }

  function placeSnack() {
    do {
      state.snack = {
        x: Math.floor(Math.random() * columns),
        y: Math.floor(Math.random() * rows)
      };
    } while (state.snake.some((segment) => segment.x === state.snack.x && segment.y === state.snack.y));
  }

  // Buffers the requested direction in nextDirection rather than applying it
  // immediately, and blocks a direct reversal (which would run the snake
  // straight into its own neck).
  function changeDirection() {
    const requested = { ...state.nextDirection };
    if (keys.ArrowUp || keys.KeyW) Object.assign(requested, { x: 0, y: -1 });
    if (keys.ArrowDown || keys.KeyS) Object.assign(requested, { x: 0, y: 1 });
    if (keys.ArrowLeft || keys.KeyA) Object.assign(requested, { x: -1, y: 0 });
    if (keys.ArrowRight || keys.KeyD) Object.assign(requested, { x: 1, y: 0 });

    const reversing = requested.x + state.direction.x === 0 && requested.y + state.direction.y === 0;
    if (!reversing) {
      state.nextDirection = requested;
    }
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.score = 0;
      state.tick = 0;
      state.direction = { x: 1, y: 0 };
      state.nextDirection = { x: 1, y: 0 };
      state.snake = [
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 }
      ];
      placeSnack();
      setScore(0);
    },
    update() {
      changeDirection();
      state.tick += 1;
      if (state.tick % getMoveInterval() !== 0) return;

      state.direction = { ...state.nextDirection };
      const head = state.snake[0];
      const next = {
        x: head.x + state.direction.x,
        y: head.y + state.direction.y
      };

      const crashed = next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows ||
        state.snake.some((segment) => segment.x === next.x && segment.y === next.y);

      if (crashed) {
        saveHighScore("snake", state.score);
        endRound("Game over", `You scored ${state.score}. Press Restart to try again.`);
        return;
      }

      state.snake.unshift(next);
      if (next.x === state.snack.x && next.y === state.snack.y) {
        state.score += 10;
        setScore(state.score);
        saveHighScore("snake", state.score);
        placeSnack();
      } else {
        state.snake.pop();
      }
    },
    draw() {
      drawBackdrop();
      context.fillStyle = "#e2a94e";
      context.fillRect(state.snack.x * tile + 4, state.snack.y * tile + 4, tile - 8, tile - 8);

      state.snake.forEach((segment, index) => {
        context.fillStyle = index === 0 ? "#fff7ed" : "#4aa6a0";
        context.fillRect(segment.x * tile + 3, segment.y * tile + 3, tile - 6, tile - 6);
      });
      drawText(`Score ${state.score}`, 24, 38, 20, "left");
    }
  };
}

function createBrickBreaker() {
  const maxRows = 5;
  const columns = 10;
  const brickGap = 8;
  const brickWidth = (canvas.width - 120 - brickGap * (columns - 1)) / columns;
  const brickHeight = 28;
  const paddleWidth = 128;
  const paddleHeight = 16;
  const ballRadius = 12;
  const state = {
    running: false,
    score: 0,
    lives: 3,
    level: 1,
    levelBannerTicks: 0,
    paddleX: canvas.width / 2 - 64,
    ballX: canvas.width / 2,
    ballY: canvas.height - 90,
    ballVX: 3.2,
    ballVY: -3.2,
    bricks: []
  };

  function getLevelRows() {
    return Math.min(state.level, maxRows);
  }

  // Speed ramps a little every level from the very first one, then keeps
  // climbing (a bit faster) once the row count has capped out at maxRows,
  // so the ball is gentle at level 1 and gradually builds up from there.
  function getLevelSpeed() {
    const rampedLevels = Math.min(state.level, maxRows) - 1;
    const extraLevels = Math.max(0, state.level - maxRows);
    return 3.2 + rampedLevels * 0.35 + extraLevels * 0.65;
  }

  // Launches at a random angle (mostly upward, ±35 degrees from vertical)
  // rather than a fixed 45 degrees every time. A fixed launch angle plus
  // deterministic bounces meant the ball could settle into an exact,
  // never-ending loop once a lane was cleared of bricks.
  function resetBall() {
    const speed = getLevelSpeed();
    const angle = (Math.random() - 0.5) * ((Math.PI / 180) * 70);
    state.paddleX = canvas.width / 2 - paddleWidth / 2;
    state.ballX = canvas.width / 2;
    state.ballY = canvas.height - 90;
    state.ballVX = Math.sin(angle) * speed;
    state.ballVY = -Math.cos(angle) * speed;
  }

  // Nudges the ball's angle by a small random amount while keeping its
  // speed the same, so wall/ceiling bounces never repeat an identical path
  // forever (which is what let the ball get stuck bouncing between the
  // same two points indefinitely).
  function jitterAngle() {
    const speed = Math.hypot(state.ballVX, state.ballVY);
    const currentAngle = Math.atan2(state.ballVY, state.ballVX);
    const jitter = (Math.random() - 0.5) * 0.2;
    const nextAngle = currentAngle + jitter;
    state.ballVX = Math.cos(nextAngle) * speed;
    state.ballVY = Math.sin(nextAngle) * speed;
  }

  function buildBricks() {
    const rows = getLevelRows();
    state.bricks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        state.bricks.push({
          x: 60 + column * (brickWidth + brickGap),
          y: 62 + row * (brickHeight + brickGap),
          width: brickWidth,
          height: brickHeight,
          alive: true,
          color: ["#d96b78", "#e2a94e", "#4aa6a0", "#cde8cf", "#fff7ed"][row]
        });
      }
    }
  }

  function advanceLevel() {
    state.level += 1;
    state.score += 50;
    state.levelBannerTicks = 140;
    setScore(state.score);
    saveHighScore("brickBreaker", state.score);
    buildBricks();
    resetBall();
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.score = 0;
      state.lives = 3;
      state.level = 1;
      state.levelBannerTicks = 120;
      buildBricks();
      resetBall();
      setScore(0);
    },
    update() {
      const paddleSpeed = 9;
      if (keys.ArrowLeft || keys.KeyA) state.paddleX -= paddleSpeed;
      if (keys.ArrowRight || keys.KeyD) state.paddleX += paddleSpeed;
      state.paddleX = Math.max(20, Math.min(canvas.width - paddleWidth - 20, state.paddleX));
      state.levelBannerTicks = Math.max(0, state.levelBannerTicks - 1);

      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballX <= ballRadius || state.ballX >= canvas.width - ballRadius) {
        state.ballVX *= -1;
        jitterAngle();
      }
      if (state.ballY <= ballRadius) {
        state.ballVY *= -1;
        jitterAngle();
      }

      const hitsPaddle = state.ballVY > 0 &&
        state.ballY + ballRadius >= canvas.height - 48 &&
        state.ballY <= canvas.height - 30 &&
        state.ballX >= state.paddleX &&
        state.ballX <= state.paddleX + paddleWidth;

      if (hitsPaddle) {
        // Deflect based on where the ball hit the paddle, but preserve its
        // current speed and cap the angle so a paddle-edge hit still makes
        // solid upward progress instead of skimming almost horizontally.
        const speed = Math.hypot(state.ballVX, state.ballVY);
        const offset = Math.max(-1, Math.min(1, (state.ballX - (state.paddleX + paddleWidth / 2)) / (paddleWidth / 2)));
        const angle = offset * (Math.PI / 3);
        state.ballVX = Math.sin(angle) * speed;
        state.ballVY = -Math.cos(angle) * speed;
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;

        // Treat the ball as a circle against the brick's rectangle (not
        // just its centre point), and bounce off whichever face — top/
        // bottom or left/right — it actually struck, instead of always
        // flipping vertical velocity regardless of the hit angle.
        const closestX = Math.max(brick.x, Math.min(state.ballX, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(state.ballY, brick.y + brick.height));
        const dx = state.ballX - closestX;
        const dy = state.ballY - closestY;

        if (dx * dx + dy * dy > ballRadius * ballRadius) {
          continue;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          state.ballVX *= -1;
        } else {
          state.ballVY *= -1;
        }

        brick.alive = false;
        state.score += 10;
        setScore(state.score);
        saveHighScore("brickBreaker", state.score);
        break;
      }

      if (state.bricks.every((brick) => !brick.alive)) {
        advanceLevel();
      }

      if (state.ballY > canvas.height + 20) {
        state.lives -= 1;
        if (state.lives <= 0) {
          saveHighScore("brickBreaker", state.score);
          endRound("Game over", `You scored ${state.score}. Press Restart to play again.`);
        } else {
          resetBall();
        }
      }
    },
    draw() {
      drawBackdrop();
      state.bricks.forEach((brick) => {
        if (!brick.alive) return;
        context.fillStyle = brick.color;
        context.fillRect(brick.x, brick.y, brick.width, brick.height);
      });

      context.fillStyle = "#fff7ed";
      context.fillRect(state.paddleX, canvas.height - 44, 128, 16);
      context.beginPath();
      context.arc(state.ballX, state.ballY, ballRadius, 0, Math.PI * 2);
      context.fill();
      drawText(`Score ${state.score}`, 24, 38, 20, "left");
      drawText(`Level ${state.level}`, canvas.width / 2, 38, 20);
      drawText(`Lives ${state.lives}`, canvas.width - 24, 38, 20, "right");

      if (state.levelBannerTicks > 0) {
        drawText(`Level ${state.level}`, canvas.width / 2, canvas.height / 2 - 8, 42);
        drawText(`${getLevelRows()} brick row${getLevelRows() === 1 ? "" : "s"}`, canvas.width / 2, canvas.height / 2 + 32, 18);
      }
    }
  };
}

document.querySelectorAll(".game-card").forEach((card) => {
  card.addEventListener("click", () => openGame(card.dataset.game));
});

backButton.addEventListener("click", closeGame);
startButton.addEventListener("click", () => {
  if (!activeGame) return;
  startLoop();
});
restartButton.addEventListener("click", () => {
  if (!activeGame) return;
  activeGame.reset();
  activeGame.draw();
  startLoop();
});

toggleMusic.addEventListener("click", () => {
  if (musicPlaying) {
    pauseMusic();
    return;
  }

  playMusic();
});

skipTrack.addEventListener("click", () => {
  changeTrack(1);
});

rewindTrack.addEventListener("click", () => {
  changeTrack(-1);
});

volumeSlider.addEventListener("input", () => {
  if (masterGain) {
    masterGain.gain.value = Number(volumeSlider.value);
  }
});

trackProgress.addEventListener("input", () => {
  isSeeking = true;
  updateProgressDisplay(Number(trackProgress.value));
});

trackProgress.addEventListener("change", () => {
  isSeeking = false;
  seekTrack(Number(trackProgress.value));
});

trackProgress.addEventListener("pointerup", () => {
  isSeeking = false;
  seekTrack(Number(trackProgress.value));
});

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  // Enter mirrors the Start button (only meaningful while a game is loaded
  // but paused/not yet running), Escape mirrors Back and works at any point
  // during play, not just on the "press start" screen.
  if (event.code === "Enter" && activeGame && !activeGame.running) {
    event.preventDefault();
    startLoop();
  }

  if (event.code === "Escape" && gameStage.classList.contains("active")) {
    event.preventDefault();
    closeGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

touchButtons.forEach((button) => {
  const key = touchKeyMap[button.dataset.control];

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    keys[key] = true;
  });

  button.addEventListener("pointerup", () => {
    keys[key] = false;
  });

  button.addEventListener("pointercancel", () => {
    keys[key] = false;
  });

  button.addEventListener("pointerleave", () => {
    keys[key] = false;
  });
});

window.addEventListener("pointerdown", startMusicFromFirstInteraction);
window.addEventListener("keydown", startMusicFromFirstInteraction);

loadHighScores();
loadMusicTracks();
