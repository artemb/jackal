import { SIZE, isIsland, key, createGame } from "./state.js";

const state = createGame();
const boardEl = document.getElementById("board");

function render() {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (isIsland(r, c)) {
        const tile = state.tiles.get(key(r, c));
        cell.classList.add("tile", tile.open ? "open" : "closed");
      } else {
        cell.classList.add("sea");
      }
      boardEl.appendChild(cell);
    }
  }
}

render();
