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

// Every map hides the same coin stashes on random tiles:
// 5 tiles with 1 coin, 2 with 2, 3 with 3, 2 with 4 and 1 with 5.
const COIN_STASHES = [1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5];

// Arrow tiles: 3 of each type per map, each rotated by a random multiple
// of 90 degrees when the map is generated. Directions are [dr, dc].
const N = [-1, 0];
const E = [0, 1];
const S = [1, 0];
const W = [0, -1];
const NE = [-1, 1];
const SE = [1, 1];
const SW = [1, -1];
const NW = [-1, -1];

export const ARROW_TYPES = {
  "straight-1": [N],
  "diagonal-1": [NE],
  "straight-2": [N, S],
  "diagonal-2": [NE, SW],
  "three-way": [S, W, NE],
  "straight-4": [N, E, S, W],
  "diagonal-4": [NE, SE, SW, NW],
};
const ARROWS_PER_TYPE = 3;

function rotateDir([dr, dc], quarters) {
  for (let i = 0; i < quarters; i++) [dr, dc] = [dc, -dr];
  return [dr, dc];
}

// Slow tiles take several turns to cross: entering is the first turn,
// then the pirate must step in place until it has spent `steps` turns
// on the tile before it may move on.
export const SLOW_TILES = [
  { slow: "jungle", steps: 2, count: 5 },
  { slow: "desert", steps: 3, count: 4 },
  { slow: "island", steps: 4, count: 1 },
  { slow: "mountain", steps: 5, count: 1 },
];

// Crocodile tiles chase the pirate back to where it came from.
const CROC_COUNT = 4;

// Rum tiles knock the pirate out for its player's next turn.
const RUM_COUNT = 4;

// Ice tiles are slippery: the pirate slides one more cell onward.
const ICE_COUNT = 6;

// Trap tiles hold a lone pirate until an ally steps in to free it.
const TRAP_COUNT = 3;

// Parachute tiles fly the pirate straight back to its ship.
const CHUTE_COUNT = 2;

// The cannibal eats any pirate who steps into its lair. There is one.
const CANNIBAL_COUNT = 1;

// Fortresses shelter their occupants from attack. One of the three is
// home to a native woman who can revive a fallen pirate.
const FORT_COUNT = 2;
const NATIVE_COUNT = 1;

// Horse tiles launch the pirate on a chess-knight jump.
const HORSE_COUNT = 2;
const KNIGHT_JUMPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGame() {
  const tiles = new Map();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isIsland(r, c)) continue;
      tiles.set(key(r, c), { type: "empty", open: false, coins: 0 });
    }
  }
  const spots = shuffle([...tiles.keys()]);
  COIN_STASHES.forEach((coins, i) => {
    tiles.get(spots[i]).coins = coins;
  });
  let spot = COIN_STASHES.length;
  for (const [arrow, dirs] of Object.entries(ARROW_TYPES)) {
    for (let n = 0; n < ARROWS_PER_TYPE; n++) {
      const tile = tiles.get(spots[spot++]);
      const quarters = Math.floor(Math.random() * 4);
      tile.type = "arrow";
      tile.arrow = arrow;
      tile.dirs = dirs.map((d) => rotateDir(d, quarters));
    }
  }
  for (const { slow, steps, count } of SLOW_TILES) {
    for (let n = 0; n < count; n++) {
      const tile = tiles.get(spots[spot++]);
      tile.type = "slow";
      tile.slow = slow;
      tile.steps = steps;
    }
  }
  for (let n = 0; n < CROC_COUNT; n++) {
    tiles.get(spots[spot++]).type = "croc";
  }
  for (let n = 0; n < RUM_COUNT; n++) {
    tiles.get(spots[spot++]).type = "rum";
  }
  for (let n = 0; n < ICE_COUNT; n++) {
    tiles.get(spots[spot++]).type = "ice";
  }
  for (let n = 0; n < TRAP_COUNT; n++) {
    tiles.get(spots[spot++]).type = "trap";
  }
  for (let n = 0; n < CHUTE_COUNT; n++) {
    tiles.get(spots[spot++]).type = "chute";
  }
  for (let n = 0; n < HORSE_COUNT; n++) {
    tiles.get(spots[spot++]).type = "horse";
  }
  for (let n = 0; n < CANNIBAL_COUNT; n++) {
    tiles.get(spots[spot++]).type = "cannibal";
  }
  for (let n = 0; n < FORT_COUNT; n++) {
    tiles.get(spots[spot++]).type = "fort";
  }
  for (let n = 0; n < NATIVE_COUNT; n++) {
    tiles.get(spots[spot++]).type = "native";
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
        alive: true,
        carrying: false,
        // turns spent on the current slow tile (0 when not on one)
        progress: 0,
        // rum hangover: counts down one per turn end, blocks the pirate
        // while positive (so it sits out its player's next turn)
        drunk: 0,
        // held by a trap tile until an ally steps in
        trapped: false,
      });
    }
  }

  // selected is null or { kind: "pirate", id }. pending is set while a
  // pirate stands on a multi-direction arrow and must choose where to fly:
  // { pirateId, options: [{r,c}], visited: Set<tileKey> }.
  return { tiles, players, pirates, current: 0, selected: null, pending: null };
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

  // Sleeping off the rum: the pirate cannot move at all this turn.
  if (pirate.drunk > 0) return moves;

  // Held by a trap: only an ally stepping onto the tile can free it.
  if (pirate.trapped) return moves;

  const canEnterTile = (nr, nc) => {
    if (!isIsland(nr, nc)) return false;
    if (fortBlocked(state, pirate, nr, nc)) return false;
    return !pirate.carrying || state.tiles.get(key(nr, nc)).open;
  };

  if (onShip(state, pirate)) {
    const player = state.players[pirate.player];
    const fr = r + player.forward;
    if (canEnterTile(fr, c)) moves.push({ r: fr, c });
    return moves;
  }

  // Overboard: swim one step to adjacent sea cells. That includes the
  // own ship (climbing back aboard) and the enemy ship (fatal, O4).
  // A swimmer can never climb onto the island.
  if (isOverboard(state, pirate)) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (!isIsland(nr, nc)) moves.push({ r: nr, c: nc });
      }
    }
    return moves;
  }

  // Still crossing a slow tile: the only move is to keep walking in place.
  const here = state.tiles.get(key(r, c));
  if (here?.type === "slow" && pirate.progress < here.steps) {
    return [{ r, c }];
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
// pirate on every subsequent move and is stashed automatically when the
// pirate boards its own ship. Dropping leaves the coin on the tile.
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

// The native woman: a pirate standing in her fortress may spend the
// turn to revive one of its player's fallen pirates, which reappears
// in that same fortress.
export function canRevive(state, pirate) {
  const tile = state.tiles.get(key(pirate.pos.r, pirate.pos.c));
  if (tile?.type !== "native") return false;
  return state.pirates.some((p) => p.player === pirate.player && !p.alive);
}

export function revivePirate(state, pirate) {
  if (!canRevive(state, pirate)) return;
  const dead = state.pirates.find(
    (p) => p.player === pirate.player && !p.alive,
  );
  dead.alive = true;
  dead.pos = { ...pirate.pos };
  dead.carrying = false;
  dead.progress = 0;
  dead.drunk = 0;
  dead.trapped = false;
  endTurn(state);
}

export function dropCoin(state, pirate) {
  if (!pirate.carrying || onShip(state, pirate)) return;
  state.tiles.get(key(pirate.pos.r, pirate.pos.c)).coins += 1;
  pirate.carrying = false;
}

function endTurn(state) {
  state.selected = null;
  state.pending = null;
  state.current = state.current === 0 ? 1 : 0;
  for (const p of state.pirates) {
    if (p.drunk > 0) p.drunk -= 1;
  }
}

// Move a pirate, flipping the destination tile if it is still face down.
// Returns true if any tile was flipped. Boarding the own ship while
// carrying a coin stashes it automatically as the player's gold.
// Moving onto the enemy ship is fatal. Landing in the sea leaves the
// pirate overboard (a carried coin sinks).
//
// Landing on an arrow tile forces an extra move in one of the arrow's
// directions within the same turn (chaining across further arrows). With
// a single direction the extra move happens automatically; with several,
// state.pending is set and chooseArrowMove must be called. The turn ends
// once the chain settles.
export function movePirate(state, pirate, r, c) {
  // ctx follows the whole move, including arrow chains: origin is where
  // the pirate stood when the turn began (the crocodile sends it back
  // there), visited guards against arrow loops.
  const ctx = {
    origin: { pos: { ...pirate.pos }, progress: pirate.progress },
    visited: new Set(),
  };
  return stepPirate(state, pirate, r, c, ctx);
}

function stepPirate(state, pirate, r, c, ctx) {
  if (isEnemyShip(state, pirate.player, r, c)) {
    kill(state, pirate);
    endTurn(state);
    return false;
  }

  // A fortress held by the enemy repels even forced arrivals (arrows,
  // ice, jumps): the intruder retreats to its ship instead of fighting.
  if (fortBlocked(state, pirate, r, c)) {
    sendHome(state, pirate);
    endTurn(state);
    return false;
  }

  // The direction this step travels in (ice keeps the pirate sliding
  // the same way). Steps are always one cell, so dr/dc are -1..1.
  const dr = r - pirate.pos.r;
  const dc = c - pirate.pos.c;
  const stayed = dr === 0 && dc === 0;

  // Fight: every enemy pirate standing on the destination retreats to
  // its own ship before the attacker settles in.
  for (const foe of piratesAt(state, r, c)) {
    if (foe.player !== pirate.player) sendHome(state, foe);
  }

  pirate.pos = { r, c };
  let flipped = false;
  const tile = state.tiles.get(key(r, c));
  if (tile && !tile.open) {
    tile.open = true;
    flipped = true;
  }
  if (pirate.carrying && onShip(state, pirate)) {
    state.players[pirate.player].gold += 1;
    pirate.carrying = false;
  }
  if (isOverboard(state, pirate)) {
    pirate.carrying = false; // the coin sinks
  }

  if (tile?.type === "croc") {
    // The crocodile chases the pirate back to where its turn started,
    // without re-triggering that cell's effect. Crossing progress on a
    // slow tile it had left is restored.
    pirate.pos = { ...ctx.origin.pos };
    pirate.progress = ctx.origin.progress;
    endTurn(state);
    return flipped;
  }

  if (tile?.type === "ice") {
    // Slippery: slide one more cell in the direction the pirate came
    // from, normalized to a single step (a knight jump onto ice slides
    // diagonally). Island tiles are never on the board edge, so the
    // slide target is always on the board; stepPirate handles whatever
    // is there (sea, ships, more ice, anything).
    const target = { r: r + Math.sign(dr), c: c + Math.sign(dc) };
    return followArrow(state, pirate, target, ctx) || flipped;
  }

  if (tile?.type === "arrow" || tile?.type === "horse") {
    if (ctx.visited.has(key(r, c))) {
      // A loop within one turn: the pirate dies.
      kill(state, pirate);
      endTurn(state);
      return flipped;
    }
    ctx.visited.add(key(r, c));
    // The horse jumps like a chess knight (any on-board landing cell);
    // an arrow flies in one of its directions. Both are forced moves:
    // automatic with a single option, the player's choice otherwise.
    const jumps = tile.type === "horse" ? KNIGHT_JUMPS : tile.dirs;
    const options = jumps
      .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
      .filter((o) => o.r >= 0 && o.r < SIZE && o.c >= 0 && o.c < SIZE);
    if (options.length === 1) {
      return followArrow(state, pirate, options[0], ctx) || flipped;
    }
    state.pending = { pirateId: pirate.id, options, ctx };
    state.selected = { kind: "pirate", id: pirate.id };
    return flipped;
  }

  if (tile?.type === "cannibal") {
    // Eaten. The tile stays revealed as a warning to the others.
    kill(state, pirate);
    endTurn(state);
    return flipped;
  }

  if (tile?.type === "chute") {
    // The parachute flies the pirate straight home; boarding handles a
    // carried coin (stashed as gold) and ends the turn.
    const ship = state.players[pirate.player].ship;
    return stepPirate(state, pirate, ship.r, ship.c, ctx) || flipped;
  }

  if (tile?.type === "trap") {
    // Alone, the pirate is caught. With an ally already on the tile,
    // nobody is caught and any trapped allies are pulled free.
    const allies = piratesAt(state, r, c).filter(
      (p) => p.player === pirate.player && p.id !== pirate.id,
    );
    if (allies.length > 0) {
      for (const ally of allies) ally.trapped = false;
    } else {
      pirate.trapped = true;
    }
  }

  if (tile?.type === "rum") {
    // The barrel is irresistible: this pirate sits out its player's next
    // turn. drunk=3 survives exactly two turn ends (this one and the
    // opponent's), leaving it positive during that next turn.
    pirate.drunk = 3;
  }

  // Crossing progress: entering a slow tile is the first turn, stepping
  // in place adds one; anything else resets it.
  pirate.progress =
    tile?.type === "slow" ? (stayed ? pirate.progress + 1 : 1) : 0;

  endTurn(state);
  return flipped;
}

// Arrow targets are always on the board; stepPirate handles every kind
// of cell (island, sea, either ship).
function followArrow(state, pirate, target, ctx) {
  return stepPirate(state, pirate, target.r, target.c, ctx);
}

// Resolve a pending multi-direction arrow by picking one of its options.
export function chooseArrowMove(state, target) {
  const pending = state.pending;
  if (!pending) return;
  if (!pending.options.some((o) => o.r === target.r && o.c === target.c)) {
    return;
  }
  const pirate = state.pirates[pending.pirateId];
  state.pending = null;
  followArrow(state, pirate, target, pending.ctx);
}

export function piratesAt(state, r, c) {
  return state.pirates.filter(
    (p) => p.alive && p.pos.r === r && p.pos.c === c,
  );
}

function isEnemyShip(state, playerId, r, c) {
  return state.players.some(
    (pl) => pl.id !== playerId && pl.ship.r === r && pl.ship.c === c,
  );
}

// Overboard: in the sea, neither on the island nor aboard the own ship.
export function isOverboard(state, pirate) {
  const { r, c } = pirate.pos;
  return !isIsland(r, c) && !onShip(state, pirate);
}

export function isFort(tile) {
  return tile?.type === "fort" || tile?.type === "native";
}

// A fortress with enemy pirates inside cannot be entered or attacked.
function fortBlocked(state, pirate, r, c) {
  if (!isFort(state.tiles.get(key(r, c)))) return false;
  return piratesAt(state, r, c).some((p) => p.player !== pirate.player);
}

function kill(state, pirate) {
  pirate.alive = false;
  pirate.carrying = false;
  pirate.progress = 0;
  pirate.trapped = false;
}

// A pirate beaten in a fight retreats aboard its own ship: a carried
// coin is dropped where it stood, crossing progress and any rum
// hangover are gone.
function sendHome(state, pirate) {
  const tile = state.tiles.get(key(pirate.pos.r, pirate.pos.c));
  if (pirate.carrying && tile) tile.coins += 1;
  pirate.carrying = false;
  pirate.progress = 0;
  pirate.drunk = 0;
  pirate.trapped = false;
  pirate.pos = { ...state.players[pirate.player].ship };
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

// Move a ship along the shore, carrying everyone aboard. Enemy pirates
// swimming in the target cell are run over and die; an own swimmer there
// simply finds itself back aboard. Ends the turn.
export function moveShip(state, player, r, c) {
  for (const p of piratesAboard(state, player)) {
    p.pos = { r, c };
  }
  player.ship = { r, c };
  for (const p of piratesAt(state, r, c)) {
    if (p.player !== player.id) kill(state, p);
  }
  endTurn(state);
}
