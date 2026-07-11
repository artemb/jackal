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
  canPickUp,
  pickUpCoin,
  dropCoin,
  chooseArrowMove,
} from "./state.js";

const DIR_GLYPHS = {
  "-1,0": "↑",
  "-1,1": "↗",
  "0,1": "→",
  "1,1": "↘",
  "1,0": "↓",
  "1,-1": "↙",
  "0,-1": "←",
  "-1,-1": "↖",
};

const state = createGame();
const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn-indicator");
const scoresEl = document.getElementById("scores");
const actionsEl = document.getElementById("actions");
let justFlipped = null; // key of a cell to play the flip animation on

function selectedPirate() {
  if (state.selected?.kind !== "pirate") return null;
  return state.pirates[state.selected.id];
}

function pirateAboard(pirate) {
  const ship = state.players[pirate.player].ship;
  return ship.r === pirate.pos.r && ship.c === pirate.pos.c;
}

// When the selected pirate is aboard, the ship's shore moves are offered
// alongside the disembark tile; clicking a sea cell sails the whole ship.
function currentShipMoves() {
  const pirate = selectedPirate();
  if (!pirate || !pirateAboard(pirate)) return [];
  return legalShipMoves(state, state.players[pirate.player]);
}

function currentMoves() {
  const pirate = selectedPirate();
  if (!pirate) return [];
  return [...legalMoves(state, pirate), ...currentShipMoves()];
}

function shipAt(r, c) {
  return state.players.find((p) => p.ship.r === r && p.ship.c === c) ?? null;
}

function sameSelection(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.id === b.id;
}

function onCellClick(r, c) {
  // A pirate mid-flight on a multi-direction arrow locks the input:
  // the only valid clicks are the arrow's destinations.
  if (state.pending) {
    if (state.pending.options.some((o) => o.r === r && o.c === c)) {
      chooseArrowMove(state, { r, c });
      render();
    }
    return;
  }

  const pirate = selectedPirate();
  if (pirate) {
    if (currentShipMoves().some((m) => m.r === r && m.c === c)) {
      moveShip(state, state.players[pirate.player], r, c);
      justFlipped = null;
      render();
      return;
    }
    if (legalMoves(state, pirate).some((m) => m.r === r && m.c === c)) {
      const flipped = movePirate(state, pirate, r, c);
      justFlipped = flipped ? key(r, c) : null;
      render();
      justFlipped = null;
      return;
    }
  }

  // Select one of the current player's pirates on this cell; clicking
  // again cycles when several share the cell.
  const options = piratesAt(state, r, c)
    .filter((p) => p.player === state.current)
    .map((p) => ({ kind: "pirate", id: p.id }));

  if (options.length === 0) {
    state.selected = null;
  } else {
    const idx = options.findIndex((o) => sameSelection(o, state.selected));
    state.selected = options[(idx + 1) % options.length];
  }
  render();
}

function render() {
  const moves = state.pending ? state.pending.options : currentMoves();
  const moveClass = state.pending ? "arrow-target" : "move-target";
  boardEl.innerHTML = "";

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (isIsland(r, c)) {
        const tile = state.tiles.get(key(r, c));
        cell.classList.add("tile", tile.open ? "open" : "closed");
        if (justFlipped === key(r, c)) cell.classList.add("flipping");
        if (tile.open && tile.type === "arrow") {
          cell.classList.add("arrow");
          const arrowsEl = document.createElement("div");
          arrowsEl.className = "arrows";
          arrowsEl.textContent = tile.dirs
            .map((d) => DIR_GLYPHS[d.join(",")])
            .join("");
          cell.appendChild(arrowsEl);
        }
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
        cell.appendChild(shipEl);
      }

      const here = piratesAt(state, r, c);
      if (here.length > 0) {
        const group = document.createElement("div");
        group.className = "pirates";
        for (const p of here) {
          const el = document.createElement("div");
          el.className = `pirate p${p.player + 1}`;
          if (p.carrying) el.classList.add("carrying");
          if (selectedPirate()?.id === p.id) el.classList.add("selected");
          group.appendChild(el);
        }
        cell.appendChild(group);
        if (here.some((p) => p.player === state.current)) {
          cell.classList.add("selectable");
        }
      }

      if (moves.some((m) => m.r === r && m.c === c)) {
        cell.classList.add(moveClass);
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

  scoresEl.textContent = state.players
    .map((p) => `${p.name} 🪙 ${p.gold}`)
    .join("  ·  ");

  renderActions();
}

function renderActions() {
  actionsEl.innerHTML = "";
  if (state.pending) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Arrow! Choose where the pirate flies.";
    actionsEl.appendChild(hint);
    return;
  }
  const pirate = selectedPirate();
  if (!pirate || pirate.player !== state.current) return;

  if (canPickUp(state, pirate)) {
    const btn = document.createElement("button");
    btn.textContent = "Pick up coin";
    btn.addEventListener("click", () => {
      pickUpCoin(state, pirate);
      render();
    });
    actionsEl.appendChild(btn);
  }

  if (pirate.carrying) {
    const btn = document.createElement("button");
    btn.textContent = "Drop coin";
    btn.addEventListener("click", () => {
      dropCoin(state, pirate);
      render();
    });
    actionsEl.appendChild(btn);
  }
}

render();
