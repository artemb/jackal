// A computer player for Jackal.
//
// The bot picks its turn by simulating every candidate action on a
// *masked* clone of the game — every face-down tile is replaced with an
// anonymous empty one, so the bot cannot peek under tiles a human could
// not see either. Forced-move chains (arrows, ice, horses, cannons) are
// resolved inside the simulation, choosing greedily where the rules
// offer a choice, and the resulting position is scored.
import {
  serializeGame,
  deserializeGame,
  legalMoves,
  legalShipMoves,
  movePirate,
  moveShip,
  chooseArrowMove,
  canPickUp,
  pickUpCoin,
  dropCoin,
  canRevive,
  revivePirate,
} from "./state.js";

function cloneMasked(state) {
  const s = deserializeGame(JSON.parse(JSON.stringify(serializeGame(state))));
  for (const tile of s.tiles.values()) {
    if (!tile.open) {
      tile.type = "empty";
      tile.coins = 0;
      delete tile.dirs;
      delete tile.arrow;
      delete tile.slow;
      delete tile.steps;
      delete tile.dir;
      delete tile.used;
    }
  }
  return s;
}

const cheby = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

// Positional score from one team's point of view. Bigger is better.
export function evaluate(state, crewId) {
  const myTeam = state.players[crewId].team;

  const gold = new Map();
  for (const pl of state.players) {
    gold.set(pl.team, (gold.get(pl.team) ?? 0) + pl.gold);
  }
  let rival = 0;
  for (const [team, g] of gold) if (team !== myTeam) rival = Math.max(rival, g);
  let score = 220 * (gold.get(myTeam) ?? 0) - 240 * rival;

  if (state.winner !== null) {
    score += state.winner === myTeam ? 1e6 : -1e6;
  }

  const coinCells = [];
  let openCount = 0;
  for (const [k, tile] of state.tiles) {
    if (!tile.open) continue;
    openCount++;
    if (tile.coins > 0) {
      const [r, c] = k.split(",").map(Number);
      coinCells.push({ r, c, coins: tile.coins });
    }
  }
  score += openCount * 2.5; // exploring is worth something by itself

  for (const p of state.pirates) {
    if (!p.alive) continue;
    const mine = state.players[p.player].team === myTeam;
    const sign = mine ? 1 : -1;
    score += sign * 55; // a pirate is worth keeping alive

    const home = state.players[p.player].ship;
    if (p.carrying) {
      // A carried coin is nearly banked; closer to the ship is better.
      score += sign * (35 + 14 * (1 - cheby(p.pos, home) / 12));
    } else if (mine && coinCells.length > 0) {
      // Pull free pirates toward the richest reachable stash; standing
      // right on one (pickup imminent) is worth a lot more.
      let pull = 0;
      for (const cc of coinCells) {
        const d = cheby(p.pos, cc);
        pull = Math.max(pull, cc.coins * 2.5 - d + (d === 0 ? 8 : 0));
      }
      score += Math.max(0, Math.min(pull, 20));
    }
    if (p.trapped) score += sign * -30;
    if (p.drunk > 0) score += sign * -8;
  }
  return score;
}

// Resolve a pending forced-move choice inside a simulation, picking the
// best branch for `crewId` (depth-limited; beyond that, take the first).
function settled(sim, crewId, depth) {
  if (!sim.pending) return sim;
  if (depth <= 0) {
    let guard = 30;
    while (sim.pending && guard-- > 0) {
      chooseArrowMove(sim, sim.pending.options[0]);
    }
    return sim;
  }
  let best = null;
  let bestScore = -Infinity;
  for (const option of sim.pending.options) {
    let branch = cloneMasked(sim);
    chooseArrowMove(branch, option);
    branch = settled(branch, crewId, depth - 1);
    const score = evaluate(branch, crewId);
    if (score > bestScore) {
      bestScore = score;
      best = branch;
    }
  }
  return best;
}

// Choose a full turn: an optional free action (pick up / drop) plus one
// turn-spending action. Returns null only if the crew has no action.
export function chooseBotAction(state, crewId, { noise = 3 } = {}) {
  const rand = () => (Math.random() * 2 - 1) * noise;
  let best = null;

  const consider = (candidate, sim, before = null) => {
    const done = settled(sim, crewId, 2);
    let score = evaluate(done, crewId) + rand();
    // A move that ends where it started with nothing gained (e.g. an
    // arrow bouncing the pirate straight back) wastes the turn — punish
    // it so the bot routes around instead of stalling forever.
    if (before) {
      const after = done.pirates[before.id];
      if (
        after.alive &&
        after.pos.r === before.pos.r &&
        after.pos.c === before.pos.c &&
        after.progress <= before.progress &&
        after.carrying === before.carrying
      ) {
        score -= 25;
      }
    }
    if (!best || score > best.score) best = { ...candidate, score };
  };

  const mine = state.pirates.filter((p) => p.alive && p.player === crewId);
  for (const p of mine) {
    const pres = [null];
    if (canPickUp(state, p)) pres.push("pickup");
    if (p.carrying) pres.push("drop");
    for (const pre of pres) {
      const preSim = cloneMasked(state);
      const sp = preSim.pirates[p.id];
      if (pre === "pickup") pickUpCoin(preSim, sp);
      if (pre === "drop") dropCoin(preSim, sp);
      const before = {
        id: p.id,
        pos: { ...sp.pos },
        progress: sp.progress,
        carrying: sp.carrying,
      };
      for (const mv of legalMoves(preSim, sp)) {
        const sim = cloneMasked(preSim);
        movePirate(sim, sim.pirates[p.id], mv.r, mv.c);
        consider(
          { pre, action: { kind: "move", pirateId: p.id, r: mv.r, c: mv.c } },
          sim,
          before,
        );
      }
    }
    if (canRevive(state, p)) {
      const sim = cloneMasked(state);
      revivePirate(sim, sim.pirates[p.id]);
      consider({ pre: null, action: { kind: "revive", pirateId: p.id } }, sim);
    }
  }

  for (const mv of legalShipMoves(state, state.players[crewId])) {
    const sim = cloneMasked(state);
    moveShip(sim, sim.players[crewId], mv.r, mv.c);
    consider({ pre: null, action: { kind: "ship", r: mv.r, c: mv.c } }, sim);
  }

  return best;
}

// Choose a direction for a real pending forced move.
export function chooseBotChoice(state, crewId, { noise = 2 } = {}) {
  let best = null;
  for (const option of state.pending.options) {
    let sim = cloneMasked(state);
    chooseArrowMove(sim, option);
    sim = settled(sim, crewId, 2);
    const score = evaluate(sim, crewId) + (Math.random() * 2 - 1) * noise;
    if (!best || score > best.score) best = { option, score };
  }
  return best.option;
}
