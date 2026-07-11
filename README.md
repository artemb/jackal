# Jackal

A web-based version of the pirate board game **Jackal**, built incrementally.

## Current state (iteration 2)

- 13×13 board: a ring of sea around an island of 117 face-down tiles.
- Two ships on opposite sides of the island (Red at the bottom, Blue at
  the top), each with three pirates starting aboard.
- Turn-based play: click one of your pirates to select it (click again to
  cycle when several share a cell), then click a highlighted cell to move.
- Pirates disembark straight ahead from the ship; on land they move one
  step in any of the 8 directions. Stepping on a face-down tile flips it
  open, and the turn passes to the other player.
- Ships can sail one step sideways along their shore (click the ship to
  select it, cycling past the pirates aboard). Sailing needs at least one
  pirate aboard, carries everyone on the ship, and spends the turn.
- Coins: each tile has a 15% chance to hide 1–5 coins, shown as a gold
  counter once flipped. A pirate standing on coins can pick one up (a free
  action); while carrying it can only move to already discovered tiles or
  its own ship. It can drop the coin anywhere, or stash it aboard the ship
  where it counts toward the player's gold shown in the top bar.

## Running locally

```sh
npm install
npm run dev   # serves on http://localhost:4173
```

## Planned next

- Real tile types (arrows, traps, …).
- Combat: landing on enemy pirates sends them back to their ship.
- Win condition: bring the most gold back to your ship.
