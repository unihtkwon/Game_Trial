/**
 * Bingo Game — Series Edition
 * ===========================
 * Series rules:
 *   - Up to 9 individual games per series
 *   - First player to reach 5 wins ends the series early
 *   - On a draw, BOTH players receive a win point
 *   - After 9 games, player with more wins wins the series
 *   - Equal wins after 9 games → series tie
 */

// ============================================================
// Constants
// ============================================================

/** All 8 lines on a 3x3 board (3 rows, 3 cols, 2 diagonals). */
const WIN_LINES = [
  [[0,0],[0,1],[0,2]],  // row 0
  [[1,0],[1,1],[1,2]],  // row 1
  [[2,0],[2,1],[2,2]],  // row 2
  [[0,0],[1,0],[2,0]],  // col 0
  [[0,1],[1,1],[2,1]],  // col 1
  [[0,2],[1,2],[2,2]],  // col 2
  [[0,0],[1,1],[2,2]],  // diagonal
  [[0,2],[1,1],[2,0]],  // anti-diagonal
];

/** Spin animation frame delays (ms) — fast at first, slows to a stop. */
const SPIN_DELAYS = [55, 60, 65, 70, 80, 95, 115, 140, 170, 210, 260, 320];

const SERIES_WIN_TARGET = 5;   // wins needed to claim the series
const MAX_GAMES         = 9;

// ============================================================
// State
// ============================================================
let state = {};

// ============================================================
// Series Init  (full reset — called by "New Series" button)
// ============================================================
function initSeries() {
  state = {
    // Current-game fields (reset each game)
    board1:    null,
    board2:    null,
    marked1:   null,
    marked2:   null,
    called:    null,
    remaining: null,
    turn:      1,
    over:      false,
    moves:     0,

    // Series fields (persist across games)
    series: {
      wins1:   0,
      wins2:   0,
      results: Array(MAX_GAMES).fill(null),  // null | 'p1' | 'p2' | 'draw'
      gameNum: 1,   // 1-indexed current game
      over:    false,
    },
  };

  initGame();
}

// ============================================================
// Game Init  (resets only the current game; preserves series)
// ============================================================
function initGame() {
  state.board1    = makeBoard();
  state.board2    = makeBoard();
  state.marked1   = make3x3(false);
  state.marked2   = make3x3(false);
  state.called    = new Set();
  state.remaining = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  state.turn      = 1;
  state.over      = false;
  state.moves     = 0;

  renderAll();
  setSpinEnabled(true);
  hideAllModals();

  // Reset spin display
  document.getElementById('spinNumber').textContent = '?';
  document.getElementById('spinDisplay').className  = 'spin-display';
}

// ============================================================
// Board / Array Helpers
// ============================================================
function makeBoard() {
  return chunkArray(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]), 3);
}

function make3x3(value) {
  return Array.from({ length: 3 }, () => Array(3).fill(value));
}

/** Fisher-Yates shuffle — returns a new shuffled array. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunkArray(arr, size) {
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size)
  );
}

// ============================================================
// Win Detection
// ============================================================

/**
 * Scan all 8 lines for a completed row/col/diagonal.
 * Returns a Set of "row,col" key strings for every cell in a winning line.
 * Empty Set = no win yet.
 */
function checkWin(marked) {
  const winCells = new Set();
  for (const line of WIN_LINES) {
    if (line.every(([r, c]) => marked[r][c])) {
      line.forEach(([r, c]) => winCells.add(`${r},${c}`));
    }
  }
  return winCells;
}

// ============================================================
// Spin
// ============================================================

/** Called when the SPIN button is pressed. */
function spin() {
  if (state.over || state.series.over || state.remaining.length === 0) return;
  setSpinEnabled(false);

  // Draw a random number from the remaining pool (no replacement)
  const idx = Math.floor(Math.random() * state.remaining.length);
  const num  = state.remaining.splice(idx, 1)[0];
  state.called.add(num);
  state.moves++;

  animateSpin(num, () => {
    markNumber(num);
    highlightBall(num);
    updateRemaining();

    const win1 = checkWin(state.marked1);
    const win2 = checkWin(state.marked2);
    renderBoard('board1', state.board1, state.marked1, win1);
    renderBoard('board2', state.board2, state.marked2, win2);

    if (win1.size > 0 || win2.size > 0) {
      // Someone got BINGO — end this game
      state.over = true;
      launchConfetti();
      setTimeout(() => afterGame(win1.size > 0, win2.size > 0), 800);
    } else {
      // No winner yet — switch turn and continue
      state.turn = state.turn === 1 ? 2 : 1;
      updateTurnUI();
      setSpinEnabled(true);
    }
  });
}

/** Mark `num` on both players' marked arrays. */
function markNumber(num) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (state.board1[r][c] === num) state.marked1[r][c] = true;
      if (state.board2[r][c] === num) state.marked2[r][c] = true;
    }
  }
}

// ============================================================
// Spin Animation (slot-machine effect)
// ============================================================

/**
 * Cycles random numbers with decreasing speed, then locks on `finalNum`.
 * Calls `callback` after the landing animation completes.
 */
function animateSpin(finalNum, callback) {
  const numEl   = document.getElementById('spinNumber');
  const display = document.getElementById('spinDisplay');

  display.classList.add('spinning');
  let frameIndex = 0;

  function tick() {
    if (frameIndex < SPIN_DELAYS.length) {
      numEl.textContent = Math.ceil(Math.random() * 9);
      setTimeout(tick, SPIN_DELAYS[frameIndex++]);
    } else {
      numEl.textContent = finalNum;
      display.classList.remove('spinning');
      display.classList.add('landed');
      setTimeout(() => {
        display.classList.remove('landed');
        callback();
      }, 700);
    }
  }

  tick();
}

// ============================================================
// Series Logic
// ============================================================

/**
 * Process the result of a completed game.
 * - Awards series win points (draw = both +1)
 * - Records the result in the scoreboard
 * - Decides whether the series is over
 */
function afterGame(p1WonGame, p2WonGame) {
  const s = state.series;

  // Award series win points
  if (p1WonGame) s.wins1++;
  if (p2WonGame) s.wins2++;

  // Record result for the scoreboard
  const result = (p1WonGame && p2WonGame) ? 'draw' : p1WonGame ? 'p1' : 'p2';
  s.results[s.gameNum - 1] = result;

  renderScoreboard(result, s.gameNum - 1);  // pass slot index for pop animation

  // Animate score counter if it changed
  if (p1WonGame) popScore('seriesWins1');
  if (p2WonGame) popScore('seriesWins2');

  // Series ends when a player reaches the win target OR all games are played
  const seriesOver = s.wins1 >= SERIES_WIN_TARGET ||
                     s.wins2 >= SERIES_WIN_TARGET ||
                     s.gameNum >= MAX_GAMES;

  if (seriesOver) {
    s.over = true;
    setTimeout(() => showSeriesModal(), 500);
  } else {
    s.gameNum++;
    setTimeout(() => showGameModal(p1WonGame, p2WonGame), 500);
  }
}

/** Determine the series winner after the series is over. */
function determineSeriesWinner() {
  const { wins1, wins2 } = state.series;
  // Both hit 5+ (possible via draws)
  if (wins1 >= SERIES_WIN_TARGET && wins2 >= SERIES_WIN_TARGET) return 'draw';
  if (wins1 >= SERIES_WIN_TARGET) return 'p1';
  if (wins2 >= SERIES_WIN_TARGET) return 'p2';
  // Decided by total after 9 games
  if (wins1 > wins2) return 'p1';
  if (wins2 > wins1) return 'p2';
  return 'draw';
}

/** Start the next game in the series (called by "Next Game" button). */
function nextGame() {
  hideAllModals();
  initGame();
  renderScoreboard();
}

// ============================================================
// Modals
// ============================================================

/** Show the between-games result modal. */
function showGameModal(p1WonGame, p2WonGame) {
  const { wins1, wins2 } = state.series;

  let emoji, title;
  if (p1WonGame && p2WonGame) {
    emoji = '🤝';
    title = 'Draw! Both players earn a point.';
  } else if (p1WonGame) {
    emoji = '🎉';
    title = 'Player 1 wins the game!';
  } else {
    emoji = '🎉';
    title = 'Player 2 wins the game!';
  }

  document.getElementById('gameEmoji').textContent     = emoji;
  document.getElementById('gameTitle').textContent     = title;
  document.getElementById('gameSeriesScore').innerHTML =
    `Series &nbsp; <strong style="color:var(--p1)">${wins1}</strong>` +
    ` &ndash; ` +
    `<strong style="color:var(--p2)">${wins2}</strong>`;

  document.getElementById('gameModalOverlay').classList.add('active');
}

/** Show the end-of-series modal. */
function showSeriesModal() {
  const { wins1, wins2 } = state.series;
  const winner = determineSeriesWinner();

  let emoji, title;
  if (winner === 'draw') {
    emoji = '🤝';
    title = "It's a Series Tie!";
  } else if (winner === 'p1') {
    emoji = '🏆';
    title = 'Player 1 Wins the Series!';
  } else {
    emoji = '🏆';
    title = 'Player 2 Wins the Series!';
  }

  document.getElementById('seriesEmoji').textContent = emoji;
  document.getElementById('seriesTitle').textContent = title;
  document.getElementById('seriesFinalScore').innerHTML =
    `<span style="color:var(--p1)">${wins1}</span>` +
    ` &ndash; ` +
    `<span style="color:var(--p2)">${wins2}</span>`;

  // Mini recap row: one dot per completed game
  const recap = document.getElementById('seriesRecap');
  recap.innerHTML = '';
  state.series.results.forEach((r, i) => {
    if (r === null) return;
    const dot = document.createElement('div');
    dot.className = `recap-dot recap-${r}`;
    dot.title     = `Game ${i + 1}: ${r === 'draw' ? 'Draw' : r === 'p1' ? 'Player 1' : 'Player 2'}`;
    recap.appendChild(dot);
  });

  document.getElementById('seriesModalOverlay').classList.add('active');
  launchConfetti();
}

function hideAllModals() {
  document.getElementById('gameModalOverlay').classList.remove('active');
  document.getElementById('seriesModalOverlay').classList.remove('active');
}

// ============================================================
// Confetti
// ============================================================
function launchConfetti() {
  const COLORS = ['#ffd700', '#ff4a6e', '#4a9eff', '#00e676', '#ff8c00', '#c855ff'];
  for (let i = 0; i < 70; i++) {
    const el   = document.createElement('div');
    const size = Math.random() * 8 + 4;
    el.style.cssText = [
      'position:fixed',
      `width:${size}px`, `height:${size}px`,
      `background:${COLORS[Math.floor(Math.random() * COLORS.length)]}`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
      `left:${Math.random() * 100}vw`, 'top:-20px',
      'z-index:200', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(el);

    const drift    = (Math.random() - 0.5) * 200;
    const duration = 1200 + Math.random() * 1600;
    el.animate(
      [
        { transform: `translateY(0) translateX(0) rotate(0deg)`, opacity: 1 },
        { transform: `translateY(100vh) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration, easing: 'ease-in' }
    ).onfinish = () => el.remove();
  }
}

// ============================================================
// Rendering
// ============================================================

function renderAll() {
  renderBoard('board1', state.board1, state.marked1, new Set());
  renderBoard('board2', state.board2, state.marked2, new Set());
  renderCalledBalls();
  renderScoreboard();
  updateTurnUI();
  updateRemaining();
}

/**
 * Rebuild a 3x3 bingo board in the DOM.
 * @param {string}      id       - element id of the board container
 * @param {number[][]}  board    - 3x3 numbers
 * @param {boolean[][]} marked   - which cells are marked
 * @param {Set<string>} winCells - "row,col" strings of winning cells
 */
function renderBoard(id, board, marked, winCells) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (marked[r][c])              cell.classList.add('marked');
      if (winCells.has(`${r},${c}`)) cell.classList.add('winning');
      cell.textContent = board[r][c];
      el.appendChild(cell);
    }
  }
}

/** Build the 3x3 tracker of called balls (1-9). */
function renderCalledBalls() {
  const container = document.getElementById('calledBalls');
  container.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const ball = document.createElement('div');
    ball.className   = 'ball' + (state.called.has(n) ? ' called' : '');
    ball.id          = `ball-${n}`;
    ball.textContent = n;
    container.appendChild(ball);
  }
}

/** Flash and mark a called-number ball. */
function highlightBall(num) {
  const ball = document.getElementById(`ball-${num}`);
  if (!ball) return;
  ball.classList.add('called', 'just-called');
  setTimeout(() => ball.classList.remove('just-called'), 600);
}

/** Update panel glow and turn text. */
function updateTurnUI() {
  document.getElementById('turnText').textContent = `Player ${state.turn}'s Turn`;
  document.getElementById('panel1').classList.toggle('active-turn', state.turn === 1);
  document.getElementById('panel2').classList.toggle('active-turn', state.turn === 2);
}

/** Update "N remaining" line. */
function updateRemaining() {
  const n = state.remaining.length;
  document.getElementById('remainingInfo').textContent =
    n === 0 ? 'All numbers drawn'
            : `${n} number${n !== 1 ? 's' : ''} remaining`;
}

/**
 * Re-render the 9 scoreboard slots.
 * @param {string|null} newResult  - result just recorded ('p1'|'p2'|'draw'|undefined)
 * @param {number|null} newIndex   - 0-indexed slot that just changed (for pop animation)
 */
function renderScoreboard(newResult, newIndex) {
  // Win count numbers
  document.getElementById('seriesWins1').textContent = state.series.wins1;
  document.getElementById('seriesWins2').textContent = state.series.wins2;

  // Game counter
  document.getElementById('gameNumDisplay').textContent = state.series.gameNum;

  // Rebuild the 9 slots
  const container = document.getElementById('scoreSlots');
  container.innerHTML = '';

  for (let i = 0; i < MAX_GAMES; i++) {
    const slot    = document.createElement('div');
    const gameNum = i + 1;
    const result  = state.series.results[i];
    const isCurrent = (gameNum === state.series.gameNum) && !state.series.over;

    slot.className   = 'slot';
    slot.textContent = gameNum;

    if      (result === 'p1')   { slot.classList.add('slot-p1');   slot.title = `Game ${gameNum}: Player 1`; }
    else if (result === 'p2')   { slot.classList.add('slot-p2');   slot.title = `Game ${gameNum}: Player 2`; }
    else if (result === 'draw') { slot.classList.add('slot-draw'); slot.title = `Game ${gameNum}: Draw`;     }
    else if (isCurrent)         { slot.classList.add('slot-current'); }

    // Trigger pop animation on the newly-recorded slot
    if (i === newIndex && result !== null) {
      slot.classList.add('slot-new');
    }

    container.appendChild(slot);
  }
}

/** Animate a score counter with a scale pop. */
function popScore(id) {
  const el = document.getElementById(id);
  el.classList.remove('pop');
  // Force reflow so the animation restarts even if triggered twice quickly
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 400);
}

function setSpinEnabled(enabled) {
  document.getElementById('spinBtn').disabled = !enabled;
}

// ============================================================
// Entry Point
// ============================================================
initSeries();
