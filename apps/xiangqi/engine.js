'use strict';

/* ============================================================
 * Chinese Chess (Xiangqi) Rules Engine
 * ----------------------------------------------------------
 * Runs in BOTH the browser (window.XiangqiEngine) and Node
 * (module.exports) so the same code can be unit-tested.
 *
 * Board model
 *   - 9 columns (c: 0..8) x 10 rows (r: 0..9)
 *   - rows 0..4  -> black half (top of the screen)
 *   - rows 5..9  -> red half   (bottom of the screen)
 *   - Red moves first.
 *
 * Coordinates used inside move objects are [col, row] => [c, r].
 *
 * Piece object: { type, side }
 *   type: 'R' chariot(车) | 'N' horse(马) | 'B' elephant(相/象)
 *         'A' advisor(仕/士) | 'K' general(帅/将)
 *         'C' cannon(炮) | 'P' pawn(兵/卒)
 *   side: 'red' | 'black'
 *
 * Board object: { grid: Piece[10][9] | null, turn: 'red' | 'black' }
 *   grid[r][c] addresses a square.
 * ============================================================ */

const RED = 'red';
const BLACK = 'black';

const PIECE_TYPES = {
  CHARIOT: 'R',
  HORSE: 'N',
  ELEPHANT: 'B',
  ADVISOR: 'A',
  GENERAL: 'K',
  CANNON: 'C',
  PAWN: 'P',
};

const ROWS = 10;
const COLS = 9;

/* ---------------------------------------------------------- *
 * Small helpers
 * ---------------------------------------------------------- */

function makePiece(type, side) {
  return { type: type, side: side };
}

function inBounds(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

function cloneBoard(board) {
  const grid = board.grid.map(function (row) { return row.slice(); });
  return { grid: grid, turn: board.turn };
}

/* ---------------------------------------------------------- *
 * Initial board
 * ---------------------------------------------------------- */

function createInitialBoard() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill(null));
  }

  // Black pieces (top half)
  grid[0][0] = makePiece(PIECE_TYPES.CHARIOT, BLACK);
  grid[0][1] = makePiece(PIECE_TYPES.HORSE, BLACK);
  grid[0][2] = makePiece(PIECE_TYPES.ELEPHANT, BLACK);
  grid[0][3] = makePiece(PIECE_TYPES.ADVISOR, BLACK);
  grid[0][4] = makePiece(PIECE_TYPES.GENERAL, BLACK);
  grid[0][5] = makePiece(PIECE_TYPES.ADVISOR, BLACK);
  grid[0][6] = makePiece(PIECE_TYPES.ELEPHANT, BLACK);
  grid[0][7] = makePiece(PIECE_TYPES.HORSE, BLACK);
  grid[0][8] = makePiece(PIECE_TYPES.CHARIOT, BLACK);
  grid[2][1] = makePiece(PIECE_TYPES.CANNON, BLACK);
  grid[2][7] = makePiece(PIECE_TYPES.CANNON, BLACK);
  [0, 2, 4, 6, 8].forEach(function (c) {
    grid[3][c] = makePiece(PIECE_TYPES.PAWN, BLACK);
  });

  // Red pieces (bottom half)
  grid[9][0] = makePiece(PIECE_TYPES.CHARIOT, RED);
  grid[9][1] = makePiece(PIECE_TYPES.HORSE, RED);
  grid[9][2] = makePiece(PIECE_TYPES.ELEPHANT, RED);
  grid[9][3] = makePiece(PIECE_TYPES.ADVISOR, RED);
  grid[9][4] = makePiece(PIECE_TYPES.GENERAL, RED);
  grid[9][5] = makePiece(PIECE_TYPES.ADVISOR, RED);
  grid[9][6] = makePiece(PIECE_TYPES.ELEPHANT, RED);
  grid[9][7] = makePiece(PIECE_TYPES.HORSE, RED);
  grid[9][8] = makePiece(PIECE_TYPES.CHARIOT, RED);
  grid[7][1] = makePiece(PIECE_TYPES.CANNON, RED);
  grid[7][7] = makePiece(PIECE_TYPES.CANNON, RED);
  [0, 2, 4, 6, 8].forEach(function (c) {
    grid[6][c] = makePiece(PIECE_TYPES.PAWN, RED);
  });

  return { grid: grid, turn: RED };
}

/* ---------------------------------------------------------- *
 * Pseudo-legal move generation (ignores check / facing)
 * ---------------------------------------------------------- */

function addMove(moves, c, r, tc, tr, board) {
  const piece = board.grid[r][c];
  const captured = board.grid[tr][tc];
  moves.push({
    from: [c, r],
    to: [tc, tr],
    piece: piece,
    captured: captured || null,
  });
}

function genChariot(board, c, r, side, moves) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < dirs.length; i++) {
    const dc = dirs[i][0];
    const dr = dirs[i][1];
    let nc = c + dc;
    let nr = r + dr;
    while (inBounds(nc, nr)) {
      const target = board.grid[nr][nc];
      if (target === null) {
        addMove(moves, c, r, nc, nr, board);
      } else {
        if (target.side !== side) {
          addMove(moves, c, r, nc, nr, board);
        }
        break; // blocked by a piece (own or enemy)
      }
      nc += dc;
      nr += dr;
    }
  }
}

function genHorse(board, c, r, side, moves) {
  // [dc, dr, legDc, legDr]
  const candidates = [
    [1, 2, 0, 1], [-1, 2, 0, 1],
    [1, -2, 0, -1], [-1, -2, 0, -1],
    [2, 1, 1, 0], [-2, 1, -1, 0],
    [2, -1, 1, 0], [-2, -1, -1, 0],
  ];
  for (let i = 0; i < candidates.length; i++) {
    const dc = candidates[i][0];
    const dr = candidates[i][1];
    const ldc = candidates[i][2];
    const ldr = candidates[i][3];
    const nc = c + dc;
    const nr = r + dr;
    if (!inBounds(nc, nr)) continue;
    const leg = board.grid[r + ldr][c + ldc];
    if (leg !== null) continue; // 蹩马腿
    const target = board.grid[nr][nc];
    if (target !== null && target.side === side) continue; // own piece
    addMove(moves, c, r, nc, nr, board);
  }
}

function genElephant(board, c, r, side, moves) {
  const candidates = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
  for (let i = 0; i < candidates.length; i++) {
    const dc = candidates[i][0];
    const dr = candidates[i][1];
    const nc = c + dc;
    const nr = r + dr;
    if (!inBounds(nc, nr)) continue;
    // 相/象 cannot cross the river
    if (side === RED && nr < 5) continue;
    if (side === BLACK && nr > 4) continue;
    // 塞象眼: the centre point of the 田 must be empty
    const ec = c + dc / 2;
    const er = r + dr / 2;
    if (board.grid[er][ec] !== null) continue;
    const target = board.grid[nr][nc];
    if (target !== null && target.side === side) continue;
    addMove(moves, c, r, nc, nr, board);
  }
}

function genAdvisor(board, c, r, side, moves) {
  const candidates = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let i = 0; i < candidates.length; i++) {
    const dc = candidates[i][0];
    const dr = candidates[i][1];
    const nc = c + dc;
    const nr = r + dr;
    if (!inBounds(nc, nr)) continue;
    if (nc < 3 || nc > 5) continue; // palace columns
    if (side === RED && (nr < 7 || nr > 9)) continue;
    if (side === BLACK && (nr < 0 || nr > 2)) continue;
    const target = board.grid[nr][nc];
    if (target !== null && target.side === side) continue;
    addMove(moves, c, r, nc, nr, board);
  }
}

function genGeneral(board, c, r, side, moves) {
  const candidates = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < candidates.length; i++) {
    const dc = candidates[i][0];
    const dr = candidates[i][1];
    const nc = c + dc;
    const nr = r + dr;
    if (!inBounds(nc, nr)) continue;
    if (nc < 3 || nc > 5) continue; // palace columns
    if (side === RED && (nr < 7 || nr > 9)) continue;
    if (side === BLACK && (nr < 0 || nr > 2)) continue;
    const target = board.grid[nr][nc];
    if (target !== null && target.side === side) continue;
    addMove(moves, c, r, nc, nr, board);
  }
}

function genCannon(board, c, r, side, moves) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < dirs.length; i++) {
    const dc = dirs[i][0];
    const dr = dirs[i][1];
    let nc = c + dc;
    let nr = r + dr;
    // Phase 1: slide over empty squares (non-capturing)
    while (inBounds(nc, nr) && board.grid[nr][nc] === null) {
      addMove(moves, c, r, nc, nr, board);
      nc += dc;
      nr += dr;
    }
    // Phase 2: we hit the first piece (the screen). Keep going to find a capture.
    if (inBounds(nc, nr)) {
      nc += dc;
      nr += dr;
      while (inBounds(nc, nr) && board.grid[nr][nc] === null) {
        nc += dc;
        nr += dr;
      }
      if (inBounds(nc, nr)) {
        const target = board.grid[nr][nc];
        if (target !== null && target.side !== side) {
          addMove(moves, c, r, nc, nr, board); // capture over exactly one screen
        }
      }
    }
  }
}

function genPawn(board, c, r, side, moves) {
  const forward = (side === RED) ? -1 : 1; // red moves up (decreasing r)
  // forward
  const fr = r + forward;
  if (inBounds(c, fr)) {
    const target = board.grid[fr][c];
    if (target === null || target.side !== side) {
      addMove(moves, c, r, c, fr, board);
    }
  }
  // sideways only after crossing the river
  const crossed = (side === RED) ? (r <= 4) : (r >= 5);
  if (crossed) {
    const sides = [1, -1];
    for (let i = 0; i < sides.length; i++) {
      const sc = c + sides[i];
      if (inBounds(sc, r)) {
        const target = board.grid[r][sc];
        if (target === null || target.side !== side) {
          addMove(moves, c, r, sc, r, board);
        }
      }
    }
  }
}

function generatePseudoMoves(board, side) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board.grid[r][c];
      if (!p || p.side !== side) continue;
      switch (p.type) {
        case PIECE_TYPES.CHARIOT: genChariot(board, c, r, side, moves); break;
        case PIECE_TYPES.HORSE: genHorse(board, c, r, side, moves); break;
        case PIECE_TYPES.ELEPHANT: genElephant(board, c, r, side, moves); break;
        case PIECE_TYPES.ADVISOR: genAdvisor(board, c, r, side, moves); break;
        case PIECE_TYPES.GENERAL: genGeneral(board, c, r, side, moves); break;
        case PIECE_TYPES.CANNON: genCannon(board, c, r, side, moves); break;
        case PIECE_TYPES.PAWN: genPawn(board, c, r, side, moves); break;
        default: break;
      }
    }
  }
  return moves;
}

/* ---------------------------------------------------------- *
 * Check / facing / legal-move helpers
 * ---------------------------------------------------------- */

function findGeneral(board, side) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board.grid[r][c];
      if (p && p.type === PIECE_TYPES.GENERAL && p.side === side) {
        return { c: c, r: r };
      }
    }
  }
  return null;
}

// True when the two generals face each other on the same file with nothing between.
function generalsFacing(board) {
  const rg = findGeneral(board, RED);
  const bg = findGeneral(board, BLACK);
  if (!rg || !bg) return false;
  if (rg.c !== bg.c) return false;
  const c = rg.c;
  const lo = Math.min(rg.r, bg.r);
  const hi = Math.max(rg.r, bg.r);
  for (let r = lo + 1; r < hi; r++) {
    if (board.grid[r][c] !== null) return false;
  }
  return true;
}

function isInCheck(board, side) {
  const g = findGeneral(board, side);
  if (!g) return false;
  const enemy = (side === RED) ? BLACK : RED;
  const moves = generatePseudoMoves(board, enemy);
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].to[0] === g.c && moves[i].to[1] === g.r) return true;
  }
  // The generals may not face each other (treated as being in check).
  if (generalsFacing(board)) return true;
  return false;
}

function generateLegalMoves(board, side) {
  side = side || board.turn;
  const pseudo = generatePseudoMoves(board, side);
  const legal = [];
  for (let i = 0; i < pseudo.length; i++) {
    const move = pseudo[i];
    const next = applyMove(board, move);
    if (isInCheck(next, side)) continue; // cannot leave own general in check
    if (generalsFacing(next)) continue;  // cannot create a facing position
    legal.push(move);
  }
  return legal;
}

/* ---------------------------------------------------------- *
 * Apply a move (returns a NEW board, does not mutate input)
 * ---------------------------------------------------------- */

function applyMove(board, move) {
  const next = cloneBoard(board);
  const fc = move.from[0];
  const fr = move.from[1];
  const tc = move.to[0];
  const tr = move.to[1];
  const piece = next.grid[fr][fc];
  next.grid[tr][tc] = piece;
  next.grid[fr][fc] = null;
  next.turn = (board.turn === RED) ? BLACK : RED;
  return next;
}

/* ---------------------------------------------------------- *
 * Game status
 * ---------------------------------------------------------- */

function getGameStatus(board) {
  const side = board.turn;
  const moves = generateLegalMoves(board, side);
  if (moves.length > 0) {
    return { over: false, winner: null, reason: null };
  }
  const inCheck = isInCheck(board, side);
  if (inCheck) {
    return {
      over: true,
      winner: (side === RED) ? BLACK : RED,
      reason: 'checkmate', // 将死
    };
  }
  return { over: true, winner: null, reason: 'stalemate' }; // 困毙 / 和棋
}

/* ---------------------------------------------------------- *
 * Environment exports
 * ---------------------------------------------------------- */

const XiangqiEngine = {
  createInitialBoard: createInitialBoard,
  generateLegalMoves: generateLegalMoves,
  applyMove: applyMove,
  isInCheck: isInCheck,
  getGameStatus: getGameStatus,
  generalsFacing: generalsFacing,
  findGeneral: findGeneral,
  PIECE_TYPES: PIECE_TYPES,
  RED: RED,
  BLACK: BLACK,
  ROWS: ROWS,
  COLS: COLS,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = XiangqiEngine;
}
if (typeof window !== 'undefined') {
  window.XiangqiEngine = XiangqiEngine;
}
