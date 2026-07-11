import {
  SIZE,
  isIsland,
  key,
  createGame,
  legalMoves,
  movePirate,
  piratesAt,
} from "./state.js";

const state = createGame();
const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn-indicator");
let justFlipped = null; // key of a cell to play the flip animation on

function selectedPirate() {
  return state.selected == null ? null : state.pirates[state.selected];
}

function currentMoves() {
  const pirate = selectedPirate();
  return pirate ? legalMoves(state, pirate) : [];
}

function shipAt(r, c) {
  return state.players.find((p) => p.ship.r === r && p.ship.c === c) ?? null;
}

function onCellClick(r, c) {
  const pirate = selectedPirate();
  if (pirate && currentMoves().some((m) => m.r === r && m.c === c)) {
    const flipped = movePirate(state, pirate, r, c);
    justFlipped = flipped ? key(r, c) : null;
    render();
    justFlipped = null;
    return;
  }

  // Select (or cycle through) the current player's pirates on this cell.
  const own = piratesAt(state, r, c).filter((p) => p.player === state.current);
  if (own.length > 0) {
    const idx = own.findIndex((p) => p.id === state.selected);
    state.selected = own[(idx + 1) % own.length].id;
  } else {
    state.selected = null;
  }
  render();
}

function render() {
  const moves = currentMoves();
  boardEl.innerHTML = "";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (isIsland(r, c)) {
        const tile = state.tiles.get(key(r, c));
        cell.classList.add("tile", tile.open ? "open" : "closed");
        if (justFlipped === key(r, c)) cell.classList.add("flipping");
      } else {
        cell.classList.add("sea");
      }

      const ship = shipAt(r, c);
      if (ship) {
        const shipEl = document.createElement("div");
        shipEl.className = `ship p${ship.id + 1}`;
        shipEl.textContent = "⛵";
        cell.appendChild(shipEl);
      }

      const here = piratesAt(state, r, c);
      if (here.length > 0) {
        const group = document.createElement("div");
        group.className = "pirates";
        for (const p of here) {
          const el = document.createElement("div");
          el.className = `pirate p${p.player + 1}`;
          if (p.id === state.selected) el.classList.add("selected");
          group.appendChild(el);
        }
        cell.appendChild(group);
        if (here.some((p) => p.player === state.current)) {
          cell.classList.add("selectable");
        }
      }

      if (moves.some((m) => m.r === r && m.c === c)) {
        cell.classList.add("move-target");
      }

      cell.addEventListener("click", () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }

  const player = state.players[state.current];
  turnEl.innerHTML = "";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = player.id === 0 ? "var(--p1)" : "var(--p2)";
  turnEl.appendChild(dot);
  turnEl.appendChild(document.createTextNode(`${player.name}'s turn`));
}

render();
