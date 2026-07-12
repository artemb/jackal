# Jackal

A web-based version of the pirate board game **Jackal**, built incrementally.

## Current state (iteration 2)

- 13×13 board: a ring of sea around an island of 117 face-down tiles.
- Four crews with ships on all four sides (Red, Blue, Green, Yellow),
  each with three pirates starting aboard; team assignment decides who
  is allied with whom (2, 3 or 4 players).
- Turn-based play: click one of your pirates to select it (click again to
  cycle when several share a cell), then click a highlighted cell to move.
- Pirates disembark straight ahead from the ship; on land they move one
  step in any of the 8 directions. Stepping on a face-down tile flips it
  open, and the turn passes to the other player.
- Ships can sail one step sideways along their shore: select a pirate
  aboard and the adjacent shore cells light up next to the disembark
  tile — clicking one sails the whole ship. Sailing needs at least one
  pirate aboard, carries everyone on the ship, and spends the turn.
- Coins: every map hides 13 stashes (5×1, 2×2, 3×3, 2×4, 1×5 coins) on
  random tiles, shown as a gold counter once flipped. A pirate standing on
  coins can pick one up (a free action); while carrying it can only move
  to already discovered tiles or its own ship. It can drop the coin on its
  tile, and boarding its own ship stashes the coin automatically as the
  player's gold shown in the top bar.

- Arrows: 21 arrow tiles (7 types × 3, randomly rotated) force the pirate
  that lands on them to fly on in one of the arrow's directions — chosen
  by the player when there are several, automatic when there is one, and
  chaining across further arrows.
- Overboard and death: an arrow into the sea throws the pirate overboard
  (a carried coin sinks); a swimmer moves between sea cells or climbs back
  aboard its own ship. Boarding the enemy ship, being run over by it, or
  getting caught in an arrow loop kills the pirate for good.

- Slow tiles: 5 jungle (2 turns), 4 desert (3), 1 island (4) and
  1 mountain (5). Crossing takes that many turns — entering counts as the
  first, then the pirate steps in place (click its own tile) until the
  crossing is done.
- Crocodiles: 4 tiles that chase the pirate straight back to where its
  turn began, spending the turn.
- Rum: 4 tiles that knock the landing pirate out for its player's next
  turn (other pirates and the ship can still move).
- Fighting: moving onto enemy pirates sends them all back aboard their
  ship; a beaten pirate drops its carried coin where it stood.
- Ice: 6 slippery tiles that slide the pirate one more cell in the
  direction it entered, chaining across other special tiles.
- Traps: 3 tiles that hold a lone pirate until an ally steps onto the
  same tile, freeing both.
- Parachutes: 2 tiles that fly the pirate straight back aboard its ship
  (stashing a carried coin as gold).
- Horses: 2 tiles that launch the pirate on a chess-knight jump of the
  player's choice.

The full rule set lives in [RULES.md](RULES.md) — tests are written
against those numbered rules.

## Running locally

```sh
npm install
npm run server   # authoritative game server on :4174 (WebSocket)
npm run dev      # client on http://localhost:4173 (proxies /ws to the server)
npm test         # run the rule tests
```

## Deploying (Docker / Coolify)

The repo ships a `Dockerfile` that builds the client and runs the game
server, which serves both the static client and the WebSocket endpoint
on a single port (3000 by default, `PORT` to override). State lives in
memory only — no volumes, no database; a restart simply forgets running
games. `/health` answers 200 for health checks.

On Coolify: create an application from this GitHub repository with the
Dockerfile build pack, set the exposed port to 3000, and give it a
domain with HTTPS — the client automatically uses `wss://` behind TLS.

```sh
docker build -t jackal .
docker run -p 3000:3000 jackal
```

## Multiplayer

The game is online multiplayer. Open the client, enter a name and create
a game — you get a shareable link (`/?room=CODE`). Friends open the link
and join the lobby. The host assigns the four crews (Red, Blue, Green,
Yellow) to connected players — crews controlled by the same player are
allies, so two players take two opposite crews each — and starts the
game. The server owns the game state and validates every action; clients
just render and submit moves. Presence is live: everyone sees who is
connected, and players who drop off are marked until they reconnect
(same browser re-joins into its seat automatically). Players can rename
themselves in the lobby; seats are laid out around a little island the
way the crews sit on the board. If someone disappears for good, the
host can hand their crew to another player mid-game from the sidebar —
alliances stay as they were at the start. The first team to bank more
gold than any rival can still reach wins on the spot.

## Planned next

- More tile types (traps, rum, crocodile, …).
- Combat: landing on enemy pirates sends them back to their ship.
- Win condition: bring the most gold back to your ship.
