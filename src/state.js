// Game state and rules for Jackal.
//
// The board is a 13x13 grid. The outer ring is sea; the island is the inner
// 11x11 area minus its four corner cells (117 tiles). Every island tile
// starts face down and is flipped open the first time a pirate steps on it.

export const SIZE = 13;

export function isIsland(r, c) {
  if (r < 1 || r > 11 || c < 1 || c > 11) return false;
  const corner = (r === 1 || r === 11) && (c === 1 || c === 11);
  return !corner;
}

export function key(r, c) {
  return `${r},${c}`;
}

// Chance that a freshly generated tile hides coins (1-5 of them).
const COIN_CHANCE = 0.15;

export function createGame() {
  const tiles = new Map();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isIsland(r, c)) continue;
      const coins =
        Math.random() < COIN_CHANCE ? 1 + Math.floor(Math.random() * 5) : 0;
      tiles.set(key(r, c), { type: "empty", open: false, coins });
    }
  }

  const players = [
    { id: 0, name: "Red", ship: { r: 12, c: 6 }, forward: -1, gold: 0 },
    { id: 1, name: "Blue", ship: { r: 0, c: 6 }, forward: 1, gold: 0 },
  ];

  const pirates = [];
  for (const player of players) {
    for (let i = 0; i < 3; i++) {
      pirates.push({
        id: pirates.length,
        player: player.id,
        pos: { ...player.ship },
        carrying: false,
      });
    }
  }

  // selected is null, { kind: "pirate", id } or { kind: "ship" }
  // (the ship of the current player).
  return { tiles, players, pirates, current: 0, selected: null };
}

function isOwnShip(state, playerId, r, c) {
  const ship = state.players[playerId].ship;
  return ship.r === r && ship.c === c;
}

function onShip(state, pirate) {
  return isOwnShip(state, pirate.player, pirate.pos.r, pirate.pos.c);
}

// Legal destinations for a pirate. From the ship a pirate may only
// disembark straight ahead; on land it moves one step in any of the
// 8 directions onto island tiles, or back onto its own ship. A pirate
// carrying a coin may only enter already discovered (open) tiles.
export function legalMoves(state, pirate) {
  const { r, c } = pirate.pos;
  const moves = [];

  const canEnterTile = (nr, nc) => {
    if (!isIsland(nr, nc)) return false;
    return !pirate.carrying || state.tiles.get(key(nr, nc)).open;
  };

  if (onShip(state, pirate)) {
    const player = state.players[pirate.player];
    const fr = r + player.forward;
    if (canEnterTile(fr, c)) moves.push({ r: fr, c });
    return moves;
  }

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (canEnterTile(nr, nc) || isOwnShip(state, pirate.player, nr, nc)) {
        moves.push({ r: nr, c: nc });
      }
    }
  }
  return moves;
}

// Picking up and dropping coins are free actions (they do not end the
// turn). A pirate carries at most one coin; the coin travels with the
// pirate on every subsequent move. Dropping on the own ship banks the
// coin as the player's gold; dropping on a tile leaves it there.
export function canPickUp(state, pirate) {
  if (pirate.carrying || onShip(state, pirate)) return false;
  const tile = state.tiles.get(key(pirate.pos.r, pirate.pos.c));
  return tile != null && tile.coins > 0;
}

export function pickUpCoin(state, pirate) {
  if (!canPickUp(state, pirate)) return;
  state.tiles.get(key(pirate.pos.r, pirate.pos.c)).coins -= 1;
  pirate.carrying = true;
}

export function dropCoin(state, pirate) {
  if (!pirate.carrying) return;
  if (onShip(state, pirate)) {
    state.players[pirate.player].gold += 1;
  } else {
    state.tiles.get(key(pirate.pos.r, pirate.pos.c)).coins += 1;
  }
  pirate.carrying = false;
}

// Move a pirate, flipping the destination tile if it is still face down.
// Returns true if a tile was flipped. Ends the current player's turn.
export function movePirate(state, pirate, r, c) {
  pirate.pos = { r, c };
  let flipped = false;
  const tile = state.tiles.get(key(r, c));
  if (tile && !tile.open) {
    tile.open = true;
    flipped = true;
  }
  state.selected = null;
  state.current = state.current === 0 ? 1 : 0;
  return flipped;
}

export function piratesAt(state, r, c) {
  return state.pirates.filter((p) => p.pos.r === r && p.pos.c === c);
}

export function piratesAboard(state, player) {
  return piratesAt(state, player.ship.r, player.ship.c).filter(
    (p) => p.player === player.id,
  );
}

// A ship slides one cell sideways along its own shore, staying where it
// still faces an island tile (columns 2-10). It needs at least one of its
// pirates aboard to sail.
export function legalShipMoves(state, player) {
  if (piratesAboard(state, player).length === 0) return [];
  const moves = [];
  for (const dc of [-1, 1]) {
    const c = player.ship.c + dc;
    if (c >= 2 && c <= 10) moves.push({ r: player.ship.r, c });
  }
  return moves;
}

// Move a ship along the shore, carrying everyone aboard. Ends the turn.
export function moveShip(state, player, r, c) {
  for (const p of piratesAboard(state, player)) {
    p.pos = { r, c };
  }
  player.ship = { r, c };
  state.selected = null;
  state.current = state.current === 0 ? 1 : 0;
}
