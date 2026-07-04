// Entry point for running the app for real. Kept separate from src/app.js
// so the app itself can be built and tested without binding a port.
const createApp = require("./src/app");

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Lofi Arcade running at http://localhost:${PORT}`);
});
