import {
  SIZE,
  isIsland,
  key,
  createGame,
  legalMoves,
  movePirate,
  piratesAt,
  piratesAboard,
  legalShipMoves,
  moveShip,
} from "./state.js";

const state = createGame();
const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn-indicator");
let justFlipped = null; // key of a cell to play the flip animation on

function selectedPirate() {
  if (state.selected?.kind !== "pirate") return null;
  return state.pirates[state.selected.id];
}

function shipSelected() {
  return state.selected?.kind === "ship";
}

function currentMoves() {
  if (shipSelected()) {
    return legalShipMoves(state, state.players[state.current]);
  }
  const pirate = selectedPirate();
  return pirate ? legalMoves(state, pirate) : [];
}

function shipAt(r, c) {
  return state.players.find((p) => p.ship.r === r && p.ship.c === c) ?? null;
}

function sameSelection(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.id === b.id;
}

function onCellClick(r, c) {
  if (currentMoves().some((m) => m.r === r && m.c === c)) {
    if (shipSelected()) {
      moveShip(state, state.players[state.current], r, c);
      justFlipped = null;
    } else {
      const flipped = movePirate(state, selectedPirate(), r, c);
      justFlipped = flipped ? key(r, c) : null;
    }
    render();
    justFlipped = null;
    return;
  }

  // Build what can be selected on this cell: the current player's pirates,
  // then their ship (if it is here and can sail). Clicking cycles through.
  const player = state.players[state.current];
  const options = piratesAt(state, r, c)
    .filter((p) => p.player === state.current)
    .map((p) => ({ kind: "pirate", id: p.id }));
  const shipHere = player.ship.r === r && player.ship.c === c;
  if (shipHere && legalShipMoves(state, player).length > 0) {
    options.push({ kind: "ship" });
  }

  if (options.length === 0) {
    state.selected = null;
  } else {
    const idx = options.findIndex((o) => sameSelection(o, state.selected));
    state.selected = options[(idx + 1) % options.length];
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
        if (tile.open && tile.coins > 0) {
          const coinsEl = document.createElement("div");
          coinsEl.className = "coins";
          coinsEl.textContent = tile.coins;
          cell.appendChild(coinsEl);
        }
      } else {
        cell.classList.add("sea");
      }

      const ship = shipAt(r, c);
      if (ship) {
        const shipEl = document.createElement("div");
        shipEl.className = `ship p${ship.id + 1}`;
        shipEl.textContent = "⛵";
        if (shipSelected() && ship.id === state.current) {
          shipEl.classList.add("selected");
        }
        cell.appendChild(shipEl);
      }

      const here = piratesAt(state, r, c);
      if (here.length > 0) {
        const group = document.createElement("div");
        group.className = "pirates";
        for (const p of here) {
          const el = document.createElement("div");
          el.className = `pirate p${p.player + 1}`;
          if (selectedPirate()?.id === p.id) el.classList.add("selected");
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
