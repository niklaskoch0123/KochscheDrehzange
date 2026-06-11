"use strict";

const app = document.querySelector("#app");

const games = {
  zip: {
    name: "Zip",
    tag: "Complete the path",
    text: "Connect numbered dots in order and fill every cell with one path.",
    icon: "Z"
  },
  patches: {
    name: "Patches",
    tag: "Piece it together",
    text: "Fit every patch onto the board without overlap.",
    icon: "P"
  },
  queens: {
    name: "Queens",
    tag: "Crown each region",
    text: "Place one crown in every row, column, and color region.",
    icon: "Q"
  }
};

const difficulty = {
  Easy: { zip: 5, queens: 5, patches: 5, patchPieces: 5 },
  Medium: { zip: 6, queens: 6, patches: 6, patchPieces: 7 },
  Hard: { zip: 7, queens: 7, patches: 7, patchPieces: 9 }
};

const regionColors = ["#efb9b2", "#f1dc99", "#b9d7a3", "#a9d9d3", "#b6c5e9", "#cbb6e3", "#e8acc9", "#f0be8a", "#bad2b8"];
const patchColors = ["#0a66c2", "#008a5a", "#d47a20", "#8d67c8", "#c9527e", "#4d8b42", "#4b789f", "#b25f43", "#7b7f2b"];

const state = {
  screen: "home",
  game: null,
  level: null,
  number: 0,
  elapsed: 0,
  startedAt: 0,
  timer: null,
  puzzle: null,
  mode: "queen",
  message: "",
  messageType: "",
  won: false,
  audio: {}
};

init();

function init() {
  registerServiceWorker();
  loadSounds();
  render();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function loadSounds() {
  state.audio.tap = new Audio("./assets/tap.wav");
  state.audio.success = new Audio("./assets/success.wav");
  state.audio.error = new Audio("./assets/error.wav");
  Object.values(state.audio).forEach(audio => {
    audio.preload = "auto";
    audio.volume = 0.32;
  });
}

function playSound(name) {
  const audio = state.audio[name];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function render() {
  stopTimer();
  if (state.screen === "home") renderHome();
  if (state.screen === "difficulty") renderDifficulty();
  if (state.screen === "play") renderPlay();
}

function topbar(backAction = "") {
  return `
    <div class="topbar">
      <div class="brand"><span class="brand-mark">in</span><span>Puzzle Break</span></div>
      ${backAction ? `<button class="round-button" data-action="${backAction}" aria-label="Back">${iconBack()}</button>` : ""}
    </div>
  `;
}

function renderHome() {
  app.innerHTML = `
    ${topbar()}
    <section class="screen intro">
      <p class="kicker">Offline puzzle app</p>
      <h1>Pick a quick game.</h1>
      <p class="lede">Choose a mode, choose a difficulty, then keep getting fresh random levels.</p>
      <div class="picker">
        ${Object.entries(games).map(([id, game]) => choiceButton(id, game)).join("")}
      </div>
      <p class="install-note">On iPhone, open this over HTTPS, tap Share, then Add to Home Screen. After the first load, the app works offline.</p>
    </section>
  `;
}

function choiceButton(id, game) {
  return `
    <button class="choice" data-action="choose-game" data-game="${id}">
      <span class="choice-icon">${game.icon}</span>
      <span>
        <span class="choice-title">${game.name}</span>
        <span class="choice-subtitle">${game.tag}</span>
      </span>
      <span class="chevron">›</span>
    </button>
  `;
}

function renderDifficulty() {
  const game = games[state.game];
  app.innerHTML = `
    ${topbar("home")}
    <section class="screen intro">
      <p class="kicker">${game.name}</p>
      <h1>${game.tag}.</h1>
      <p class="lede">${game.text}</p>
      <div class="picker">
        ${Object.keys(difficulty).map(name => `
          <button class="choice" data-action="start" data-level="${name}">
            <span class="choice-icon">${name[0]}</span>
            <span>
              <span class="choice-title">${name}</span>
              <span class="choice-subtitle">${difficultyText(state.game, name)}</span>
            </span>
            <span class="chevron">›</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlay() {
  if (!state.puzzle) nextPuzzle();
  const game = games[state.game];
  app.innerHTML = `
    ${topbar("difficulty")}
    <section class="game">
      <header class="game-header">
        <div class="title-row">
          <div>
            <h2 class="game-title">${game.name}</h2>
            <p class="game-tag">${game.tag}</p>
          </div>
          <button class="round-button" data-action="new" aria-label="New level">${iconRefresh()}</button>
        </div>
        <div class="stats">
          <div class="stat"><span>Difficulty</span><b>${state.level}</b></div>
          <div class="stat"><span>Level</span><b>${state.number}</b></div>
          <div class="stat"><span>Time</span><b id="timer">${formatTime(state.elapsed)}</b></div>
        </div>
      </header>
      <div class="board-panel">
        <div class="board" style="--size:${state.puzzle.size}" data-game="${state.game}">
          ${Array.from({ length: state.puzzle.size * state.puzzle.size }, (_, index) => renderCell(index)).join("")}
        </div>
      </div>
      ${renderControls()}
      <div class="message ${state.messageType}">${state.message || defaultMessage()}</div>
    </section>
    ${state.won ? winSheet() : ""}
  `;
  startTimer();
}

function renderCell(index) {
  if (state.game === "zip") return zipCell(index);
  if (state.game === "queens") return queensCell(index);
  return patchesCell(index);
}

function zipCell(index) {
  const puzzle = state.puzzle;
  const clue = puzzle.clues.find(item => item.index === index);
  const inPath = puzzle.path.includes(index);
  return `
    <button class="cell" data-cell="${index}" aria-label="Cell ${index + 1}">
      ${inPath ? zipLine(index) : ""}
      ${clue ? `<span class="zip-dot">${clue.number}</span>` : ""}
    </button>
  `;
}

function zipLine(index) {
  const path = state.puzzle.path;
  const size = state.puzzle.size;
  const position = path.indexOf(index);
  if (position < 0) return "";
  const parts = [`<span class="zip-core"></span>`];
  const previous = path[position - 1];
  const next = path[position + 1];
  [previous, next].filter(item => item !== undefined).forEach(neighbor => {
    const [x, y] = toXY(index, size);
    const [nx, ny] = toXY(neighbor, size);
    if (nx < x) parts.push(`<span class="zip-segment left"></span>`);
    if (nx > x) parts.push(`<span class="zip-segment right"></span>`);
    if (ny < y) parts.push(`<span class="zip-segment up"></span>`);
    if (ny > y) parts.push(`<span class="zip-segment down"></span>`);
  });
  if (position === 0 || position === path.length - 1) parts.push(`<span class="zip-cap ${position === 0 ? "start" : "end"}"></span>`);
  return parts.join("");
}

function queensCell(index) {
  const puzzle = state.puzzle;
  const mark = puzzle.marks[index];
  const region = puzzle.regions[index];
  const conflict = puzzle.conflicts.has(index) ? "region-conflict" : "";
  return `
    <button class="cell ${conflict}" style="background:${regionColors[region % regionColors.length]}" data-cell="${index}" aria-label="Cell ${index + 1}">
      ${mark === "queen" ? `<span class="queen-mark"></span>` : ""}
      ${mark === "x" ? `<span class="x-mark"></span>` : ""}
    </button>
  `;
}

function patchesCell(index) {
  const puzzle = state.puzzle;
  const pieceId = puzzle.board[index];
  const ghost = puzzle.ghost.has(index) && pieceId === null ? "ghost" : "";
  const style = pieceId !== null ? `style="background:${puzzle.pieces[pieceId].color}"` : "";
  return `
    <button class="cell ${ghost}" ${style} data-cell="${index}" aria-label="Cell ${index + 1}">
      ${pieceId !== null ? `<span class="placed-label">${pieceId + 1}</span>` : ""}
    </button>
  `;
}

function renderControls() {
  if (state.game === "zip") {
    return `
      <div class="controls">
        <div class="toolbar">
          <button class="pill" data-action="undo">Undo</button>
          <button class="pill" data-action="clear">Clear</button>
        </div>
      </div>
    `;
  }
  if (state.game === "queens") {
    return `
      <div class="controls">
        <div class="toolbar">
          <button class="pill ${state.mode === "queen" ? "active" : ""}" data-action="mode" data-mode="queen">Crown</button>
          <button class="pill ${state.mode === "x" ? "active" : ""}" data-action="mode" data-mode="x">X</button>
        </div>
        <div class="toolbar">
          <button class="pill" data-action="clear">Clear</button>
          <button class="pill" data-action="check">Check</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="controls">
      <div class="pieces">
        ${state.puzzle.pieces.map(piece => pieceButton(piece)).join("")}
      </div>
      <div class="toolbar">
        <button class="pill" data-action="rotate">Rotate</button>
        <button class="pill" data-action="clear">Clear</button>
      </div>
    </div>
  `;
}

function pieceButton(piece) {
  const width = Math.max(...piece.shape.map(([x]) => x)) + 1;
  const height = Math.max(...piece.shape.map(([, y]) => y)) + 1;
  const filled = new Set(piece.shape.map(([x, y]) => `${x},${y}`));
  let html = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      html += `<span class="mini-cell" style="background:${filled.has(`${x},${y}`) ? piece.color : "transparent"}"></span>`;
    }
  }
  return `
    <button class="piece-button ${state.puzzle.selected === piece.id ? "selected" : ""} ${piece.placed ? "placed" : ""}" data-action="piece" data-piece="${piece.id}" aria-label="Patch ${piece.id + 1}">
      <span class="mini-piece" style="grid-template-columns:repeat(${width}, 13px)">${html}</span>
    </button>
  `;
}

function winSheet() {
  return `
    <aside class="win-sheet">
      <h2>Solved.</h2>
      <p>${games[state.game].name} level ${state.number} finished in ${formatTime(state.elapsed)}.</p>
      <button class="primary" data-action="new">Next random level</button>
    </aside>
  `;
}

function difficultyText(game, level) {
  const cfg = difficulty[level];
  if (game === "patches") return `${cfg.patches} by ${cfg.patches}, ${cfg.patchPieces} patches`;
  return `${cfg[game]} by ${cfg[game]} board`;
}

function defaultMessage() {
  if (state.game === "zip") return "Tap 1, then draw one connected path through every cell.";
  if (state.game === "queens") return "Every row, column, and color region needs one crown.";
  return "Select a patch, rotate it if needed, then tap the board.";
}

app.addEventListener("click", event => {
  const action = event.target.closest("[data-action]");
  const cell = event.target.closest("[data-cell]");
  if (action) handleAction(action);
  else if (cell) handleCell(Number(cell.dataset.cell));
});

app.addEventListener("pointermove", event => {
  if (state.game !== "zip" || state.won || event.buttons !== 1) return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cell]");
  if (cell) zipTap(Number(cell.dataset.cell), true);
});

function handleAction(target) {
  const action = target.dataset.action;
  playSound("tap");
  if (action === "choose-game") {
    state.game = target.dataset.game;
    state.screen = "difficulty";
    state.puzzle = null;
  }
  if (action === "home") {
    state.screen = "home";
    state.puzzle = null;
  }
  if (action === "difficulty") {
    state.screen = "difficulty";
    state.puzzle = null;
  }
  if (action === "start") {
    state.level = target.dataset.level;
    state.screen = "play";
    state.number = 0;
    state.puzzle = null;
  }
  if (action === "new") nextPuzzle();
  if (action === "clear") clearPuzzle();
  if (action === "undo") undoZip();
  if (action === "mode") state.mode = target.dataset.mode;
  if (action === "check") checkQueens(true);
  if (action === "piece") selectPiece(Number(target.dataset.piece));
  if (action === "rotate") rotatePiece();
  render();
}

function handleCell(index) {
  if (state.won) return;
  playSound("tap");
  if (state.game === "zip") zipTap(index, false);
  if (state.game === "queens") queenTap(index);
  if (state.game === "patches") patchTap(index);
  render();
}

function nextPuzzle() {
  state.number += 1;
  state.elapsed = 0;
  state.startedAt = Date.now();
  state.message = "";
  state.messageType = "";
  state.won = false;
  state.mode = "queen";
  if (state.game === "zip") state.puzzle = createZip();
  if (state.game === "queens") state.puzzle = createQueens();
  if (state.game === "patches") state.puzzle = createPatches();
}

function clearPuzzle() {
  if (state.game === "zip") state.puzzle.path = [];
  if (state.game === "queens") {
    state.puzzle.marks = Array(state.puzzle.size * state.puzzle.size).fill(null);
    state.puzzle.conflicts = new Set();
  }
  if (state.game === "patches") {
    state.puzzle.board = Array(state.puzzle.size * state.puzzle.size).fill(null);
    state.puzzle.pieces.forEach(piece => {
      piece.placed = false;
      piece.anchor = null;
    });
    state.puzzle.selected = state.puzzle.pieces[0]?.id ?? 0;
    state.puzzle.ghost = new Set();
  }
  state.won = false;
  setMessage("Cleared.", "");
}

function setMessage(text, type = "") {
  state.message = text;
  state.messageType = type;
}

function startTimer() {
  if (state.won) return;
  state.startedAt = Date.now() - state.elapsed * 1000;
  state.timer = window.setInterval(() => {
    state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const timer = document.querySelector("#timer");
    if (timer) timer.textContent = formatTime(state.elapsed);
  }, 1000);
}

function stopTimer() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function createZip() {
  const size = difficulty[state.level].zip;
  const solution = transformPath(serpentine(size), size);
  const clueCount = size === 5 ? 7 : size === 6 ? 10 : 16;
  const cluePositions = [0, solution.length - 1];
  while (cluePositions.length < clueCount) {
    cluePositions.push(rand(1, solution.length - 2));
  }
  cluePositions.sort((a, b) => a - b);
  const unique = [...new Set(cluePositions)];
  return {
    size,
    solution,
    path: [],
    clues: unique.map((position, index) => ({ index: solution[position], position, number: index + 1 }))
  };
}

function serpentine(size) {
  const path = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x++) path.push(toIndex(x, y, size));
    } else {
      for (let x = size - 1; x >= 0; x--) path.push(toIndex(x, y, size));
    }
  }
  return path;
}

function transformPath(path, size) {
  const mode = rand(0, 7);
  const mapped = path.map(index => {
    let [x, y] = toXY(index, size);
    if (mode & 1) x = size - 1 - x;
    if (mode & 2) y = size - 1 - y;
    if (mode & 4) [x, y] = [y, x];
    return toIndex(x, y, size);
  });
  return Math.random() > 0.5 ? mapped.reverse() : mapped;
}

function zipTap(index, fromDrag) {
  const puzzle = state.puzzle;
  const clue = puzzle.clues.find(item => item.index === index);
  if (!puzzle.path.length) {
    if (!clue || clue.number !== 1) {
      if (!fromDrag) warn("Start at 1.");
      return;
    }
    puzzle.path.push(index);
    return;
  }
  const last = puzzle.path[puzzle.path.length - 1];
  const previous = puzzle.path[puzzle.path.length - 2];
  if (index === previous) {
    puzzle.path.pop();
    return;
  }
  if (puzzle.path.includes(index)) {
    if (!fromDrag) warn("The path cannot cross itself.");
    return;
  }
  if (!adjacent(last, index, puzzle.size)) {
    if (!fromDrag) warn("Use neighboring cells.");
    return;
  }
  const expected = nextZipClue();
  if (clue && clue.number !== expected) {
    warn(`Find ${expected} before ${clue.number}.`);
    return;
  }
  puzzle.path.push(index);
  if (puzzle.path.length === puzzle.size * puzzle.size) checkZip();
}

function undoZip() {
  if (state.game !== "zip" || !state.puzzle.path.length) return;
  state.puzzle.path.pop();
  setMessage("Undone.", "");
}

function nextZipClue() {
  const puzzle = state.puzzle;
  return puzzle.clues.filter(clue => puzzle.path.includes(clue.index)).length + 1;
}

function checkZip() {
  const puzzle = state.puzzle;
  const ordered = puzzle.clues.every((clue, index) => {
    if (index === 0) return true;
    return puzzle.path.indexOf(clue.index) > puzzle.path.indexOf(puzzle.clues[index - 1].index);
  });
  if (ordered) finish();
  else warn("Dots must be connected in order.");
}

function createQueens() {
  const size = difficulty[state.level].queens;
  const queens = queenSolution(size);
  return {
    size,
    queens,
    regions: queenRegions(size, queens),
    marks: Array(size * size).fill(null),
    conflicts: new Set()
  };
}

function queenSolution(size) {
  const cols = shuffle(Array.from({ length: size }, (_, index) => index));
  const placed = [];
  function place(row) {
    if (row === size) return true;
    for (const col of shuffle(cols)) {
      if (placed.includes(col)) continue;
      let ok = true;
      for (let r = 0; r < placed.length; r++) {
        if (Math.abs(placed[r] - col) <= 1 && Math.abs(r - row) <= 1) ok = false;
      }
      if (!ok) continue;
      placed[row] = col;
      if (place(row + 1)) return true;
      placed.pop();
    }
    return false;
  }
  if (!place(0)) return queenSolution(size);
  return placed.map((col, row) => toIndex(col, row, size));
}

function queenRegions(size, queens) {
  const regions = Array(size * size).fill(-1);
  queens.forEach((index, region) => {
    regions[index] = region;
  });
  while (regions.includes(-1)) {
    shuffle(Array.from({ length: size * size }, (_, index) => index)).forEach(index => {
      if (regions[index] !== -1) return;
      const options = neighbors(index, size).map(cell => regions[cell]).filter(region => region >= 0);
      if (options.length) regions[index] = options[rand(0, options.length - 1)];
    });
  }
  return regions;
}

function queenTap(index) {
  const puzzle = state.puzzle;
  const current = puzzle.marks[index];
  puzzle.marks[index] = current === state.mode ? null : state.mode;
  checkQueens(false);
}

function checkQueens(show) {
  const puzzle = state.puzzle;
  const queens = puzzle.marks.map((mark, index) => mark === "queen" ? index : null).filter(index => index !== null);
  puzzle.conflicts = new Set();
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const a = queens[i];
      const b = queens[j];
      const [ax, ay] = toXY(a, puzzle.size);
      const [bx, by] = toXY(b, puzzle.size);
      if (ax === bx || ay === by || puzzle.regions[a] === puzzle.regions[b] || (Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1)) {
        puzzle.conflicts.add(a);
        puzzle.conflicts.add(b);
      }
    }
  }
  const rows = new Set();
  const cols = new Set();
  const regions = new Set();
  queens.forEach(index => {
    const [x, y] = toXY(index, puzzle.size);
    rows.add(y);
    cols.add(x);
    regions.add(puzzle.regions[index]);
  });
  if (queens.length === puzzle.size && rows.size === puzzle.size && cols.size === puzzle.size && regions.size === puzzle.size && puzzle.conflicts.size === 0) finish();
  else if (puzzle.conflicts.size) warn("Some crowns conflict.");
  else if (show) warn("You need one crown in every row, column, and color.");
  else setMessage("", "");
}

function createPatches() {
  const cfg = difficulty[state.level];
  const size = cfg.patches;
  const owners = patchRegions(size, cfg.patchPieces);
  const pieces = Array.from({ length: cfg.patchPieces }, (_, id) => {
    const cells = owners.map((owner, index) => owner === id ? index : null).filter(index => index !== null);
    const coords = cells.map(index => toXY(index, size));
    const minX = Math.min(...coords.map(([x]) => x));
    const minY = Math.min(...coords.map(([, y]) => y));
    return {
      id,
      color: patchColors[id % patchColors.length],
      shape: normalize(coords.map(([x, y]) => [x - minX, y - minY])),
      placed: false,
      anchor: null
    };
  });
  return {
    size,
    pieces,
    board: Array(size * size).fill(null),
    selected: 0,
    ghost: new Set()
  };
}

function patchRegions(size, count) {
  const total = size * size;
  const owners = Array(total).fill(null);
  shuffle(Array.from({ length: total }, (_, index) => index)).slice(0, count).forEach((cell, id) => {
    owners[cell] = id;
  });
  while (owners.includes(null)) {
    shuffle(Array.from({ length: count }, (_, id) => id)).forEach(id => {
      const mine = owners.map((owner, index) => owner === id ? index : null).filter(index => index !== null);
      const open = shuffle([...new Set(mine.flatMap(cell => neighbors(cell, size)).filter(cell => owners[cell] === null))]);
      if (open.length) owners[open[0]] = id;
    });
  }
  return owners;
}

function selectPiece(id) {
  state.puzzle.selected = id;
  state.puzzle.ghost = new Set();
}

function rotatePiece() {
  const puzzle = state.puzzle;
  const piece = puzzle.pieces[puzzle.selected];
  if (!piece || piece.placed) return;
  piece.shape = normalize(piece.shape.map(([x, y]) => [y, -x]));
  puzzle.ghost = new Set();
  setMessage("Rotated.", "");
}

function patchTap(index) {
  const puzzle = state.puzzle;
  const existing = puzzle.board[index];
  if (existing !== null) {
    removePiece(existing);
    setMessage("Patch lifted.", "");
    return;
  }
  const piece = puzzle.pieces[puzzle.selected];
  if (!piece || piece.placed) {
    warn("Select an available patch.");
    return;
  }
  const [baseX, baseY] = toXY(index, puzzle.size);
  const cells = [];
  const ok = piece.shape.every(([x, y]) => {
    const tx = baseX + x;
    const ty = baseY + y;
    if (tx < 0 || ty < 0 || tx >= puzzle.size || ty >= puzzle.size) return false;
    const target = toIndex(tx, ty, puzzle.size);
    cells.push(target);
    return puzzle.board[target] === null;
  });
  if (!ok) {
    puzzle.ghost = new Set(cells);
    warn("That patch needs open space.");
    return;
  }
  cells.forEach(cell => {
    puzzle.board[cell] = piece.id;
  });
  piece.placed = true;
  piece.anchor = index;
  const next = puzzle.pieces.find(item => !item.placed);
  if (next) puzzle.selected = next.id;
  if (puzzle.board.every(cell => cell !== null)) finish();
  else setMessage("Good fit.", "");
}

function removePiece(id) {
  const puzzle = state.puzzle;
  puzzle.board = puzzle.board.map(owner => owner === id ? null : owner);
  puzzle.pieces[id].placed = false;
  puzzle.pieces[id].anchor = null;
  puzzle.selected = id;
}

function finish() {
  state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  state.won = true;
  stopTimer();
  setMessage("Solved.", "good");
  playSound("success");
}

function warn(text) {
  setMessage(text, "warn");
  playSound("error");
}

function toIndex(x, y, size) {
  return y * size + x;
}

function toXY(index, size) {
  return [index % size, Math.floor(index / size)];
}

function adjacent(a, b, size) {
  const [ax, ay] = toXY(a, size);
  const [bx, by] = toXY(b, size);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

function neighbors(index, size) {
  const [x, y] = toXY(index, size);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size)
    .map(([nx, ny]) => toIndex(nx, ny, size));
}

function normalize(shape) {
  const minX = Math.min(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function iconBack() {
  return `<svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconRefresh() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.5A7 7 0 0 1 18.4 7M17.9 15.5A7 7 0 0 1 5.6 17" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
