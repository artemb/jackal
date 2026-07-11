# Jackal

A web-based version of the pirate board game **Jackal**, built incrementally.

## Current state (iteration 1)

- 13×13 board: a ring of sea around an island of 117 face-down tiles
  (all tiles are empty for now).
- Two ships on opposite sides of the island (Red at the bottom, Blue at
  the top), each with three pirates starting aboard.
- Turn-based play: click one of your pirates to select it (click again to
  cycle when several share a cell), then click a highlighted cell to move.
- Pirates disembark straight ahead from the ship; on land they move one
  step in any of the 8 directions. Stepping on a face-down tile flips it
  open, and the turn passes to the other player.

## Running locally

```sh
npm install
npm run dev   # serves on http://localhost:4173
```

## Planned next

- Real tile types (gold, arrows, traps, …) and treasure carrying.
- Ship movement along the coast.
- Combat: landing on enemy pirates sends them back to their ship.
- Win condition: bring the most gold back to your ship.
