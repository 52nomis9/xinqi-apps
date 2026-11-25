'use strict';
/* ============================================================
 * core.js — 共享逻辑：棋子汉字、中文记谱、AI 7 级、让子、棋谱
 * 浏览器 (window.XiangqiCore) 与 Node (module.exports) 双环境可用
 * ============================================================ */
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const E = isNode ? require('./engine.js') : window.XiangqiEngine;

  const RED = E.RED;
  const BLACK = E.BLACK;
  const COLS = E.COLS;
  const ROWS = E.ROWS;

  const PIECE_CHARS = {
    red:   { R: '车', N: '马', B: '相', A: '仕', K: '帅', C: '炮', P: '兵' },
    black: { R: '車', N: '馬', B: '象', A: '士', K: '将', C: '砲', P: '卒' },
  };

  const PIECE_MODELS = {
    R: '春秋双人战车',
    N: '持长矛的骑马骑士',
    B: '羽扇纶巾的文官',
    A: '左盾右剑的近卫',
    K: '坐在王座上的帝王',
    C: '单人操作投石车',
    P: '持长戈的步兵',
  };

  const PIECE_VALUES = { K: 10000, R: 600, C: 300, N: 270, B: 120, A: 120, P: 60 };
  const AI_DEPTH = 3;

  /* ---------------- 让子开局 ---------------- */
  // 让方 = red：默认按红方左侧（c 小的一侧）让子；让方 = black：按中心对称（180°旋转）映射到黑方左侧
  const HANDICAPS = [
    { id: 'none', name: '常规对局', desc: '不设让子', cells: [] },
    { id: 'leftHorse', name: '让单马', desc: '让出左侧马', cells: [[1, 9]] },
    { id: 'leftChariot', name: '让单车', desc: '让出左侧车', cells: [[0, 9]] },
    { id: 'twoCannons', name: '让双炮', desc: '让出两门炮', cells: [[1, 7], [7, 7]] },
    { id: 'twoChariots', name: '让双车', desc: '让出两辆车', cells: [[0, 9], [8, 9]] },
    { id: 'chariotHorseCannon', name: '让车马炮', desc: '让出左侧车马炮', cells: [[0, 9], [1, 9], [1, 7]] },
  ];

  function createHandicapBoard(kind, giver) {
    const b = E.createInitialBoard();
    const h = HANDICAPS.filter(function (x) { return x.id === kind; })[0];
    if (!h || kind === 'none') return b;
    for (let i = 0; i < h.cells.length; i++) {
      let c = h.cells[i][0];
      let r = h.cells[i][1];
      if (giver === 'black') {          // 中心对称映射到黑方一侧
        c = (E.COLS - 1) - c;
        r = (E.ROWS - 1) - r;
      }
      b.grid[r][c] = null;
    }
    return b;
  }

  /* ---------------- 基础工具 ---------------- */
  function cloneBoard(b) {
    return { grid: b.grid.map(function (r) { return r.slice(); }), turn: b.turn };
  }

  function computeCounts(b) {
    const counts = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b.grid[r][c];
        if (p) {
          const k = p.side + ':' + p.type;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
    }
    return counts;
  }

  function computeCaptured(board, initialCounts) {
    const cur = computeCounts(board);
    const caps = { red: [], black: [] };
    for (const k in initialCounts) {
      const parts = k.split(':');
      const side = parts[0];
      const type = parts[1];
      const missing = initialCounts[k] - (cur[k] || 0);
      for (let i = 0; i < missing; i++) caps[side].push(type);
    }
    return caps;
  }

  /* ---------------- 中文记谱 ---------------- */
  const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function numText(n, side) {
    return side === RED ? CN_NUMS[n - 1] : String(n);
  }
  function fileOf(c, side) {
    return side === RED ? (COLS - c) : (c + 1);
  }
  function moveToNotation(move, side) {
    const piece = move.piece;
    const fc = move.from[0], fr = move.from[1];
    const tc = move.to[0], tr = move.to[1];
    const name = PIECE_CHARS[piece.side][piece.type];
    const fromFile = numText(fileOf(fc, side), side);
    if (fr === tr) {
      return name + fromFile + '平' + numText(fileOf(tc, side), side);
    }
    const forward = side === RED ? (tr < fr) : (tr > fr);
    const verb = forward ? '进' : '退';
    if (piece.type === 'R' || piece.type === 'C' || piece.type === 'P' || piece.type === 'K') {
      return name + fromFile + verb + numText(Math.abs(tr - fr), side);
    }
    return name + fromFile + verb + numText(fileOf(tc, side), side);
  }

  // 归一化：把汉字数字一~九 替换为 1~9，去掉全角空白
  function normalizeNotation(text) {
    if (!text) return '';
    let s = String(text).replace(/[一-九]/g, function (ch) {
      return String(CN_NUMS.indexOf(ch) + 1);
    });
    s = s.replace(/[　\s]/g, '');
    return s;
  }

  function notationToMove(board, text, side) {
    const target = normalizeNotation(text);
    if (!target) return null;
    const moves = E.generateLegalMoves(board, side);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (normalizeNotation(moveToNotation(m, side)) === target) return m;
    }
    return null;
  }

  /* ---------------- 评估（含位置分，5+ 启用） ---------------- */
  // 简单位置分：兵(过河/挺进)、马(中央活跃)、车(开放线)、将(九宫安全)、炮(中路控制)
  const PST = {
    P: [
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [2,0,4,0,6,0,4,0,2],
      [3,2,5,6,8,6,5,2,3],
      [6,8,12,16,20,16,12,8,6],
      [10,16,22,30,40,30,22,16,10],
      [14,22,30,44,60,44,30,22,14],
      [18,28,40,60,80,60,40,28,18],
      [0,0,0,0,0,0,0,0,0],
    ],
    N: [
      [0,0,0,0,0,0,0,0,0],
      [0,2,3,4,4,4,3,2,0],
      [0,3,6,8,10,8,6,3,0],
      [0,4,10,14,16,14,10,4,0],
      [0,6,14,22,26,22,14,6,0],
      [0,6,14,22,26,22,14,6,0],
      [0,4,10,14,16,14,10,4,0],
      [0,3,6,8,10,8,6,3,0],
      [0,2,3,4,4,4,3,2,0],
      [0,0,0,0,0,0,0,0,0],
    ],
    R: [
      [4,6,8,10,10,10,8,6,4],
      [6,10,14,18,18,18,14,10,6],
      [8,14,18,22,24,22,18,14,8],
      [8,14,22,24,28,24,22,14,8],
      [10,16,24,28,32,28,24,16,10],
      [10,16,24,28,32,28,24,16,10],
      [8,14,22,24,28,24,22,14,8],
      [8,14,18,22,24,22,18,14,8],
      [6,10,14,18,18,18,14,10,6],
      [4,6,8,10,10,10,8,6,4],
    ],
    C: [
      [6,4,0,-2,-2,-2,0,4,6],
      [4,2,0,-2,-2,-2,0,2,4],
      [2,0,0,-2,-2,-2,0,0,2],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [2,0,0,0,0,0,0,0,2],
      [4,2,0,2,2,2,0,2,4],
      [6,4,2,4,4,4,2,4,6],
    ],
    K: [
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,2,0,0,0,0],
      [0,0,0,0,4,0,0,0,0],
      [0,0,0,0,8,0,0,0,0],
    ],
  };

  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b.grid[r][c];
        if (!p) continue;
        let v = PIECE_VALUES[p.type];
        if (p.type === 'P') {
          const adv = p.side === RED ? (ROWS - 1 - r) : r;
          v += adv * 3;
        }
        if (PST[p.type]) {
          const tbl = (p.side === RED) ? PST[p.type] : PST[p.type].slice().reverse();
          v += tbl[r][c];
        }
        score += (p.side === RED) ? v : -v;
      }
    }
    return score;
  }

  function orderMoves(moves) {
    return moves.slice().sort(function (a, b) {
      return (b.captured ? 1 : 0) - (a.captured ? 1 : 0);
    });
  }

  // 1~7 级配置（难度平滑递增：1 级明显漏棋 → 2 偶尔漏 → 3 很少漏 → 4 起不再漏棋）
  const LEVELS = [
    { level: 1, name: '兵/卒级（初学）', depth: 1, blunder: 0.50, noise: 55, pstOn: false, timeMs: 260  },
    { level: 2, name: '仕/士级（新手）', depth: 2, blunder: 0.26, noise: 38, pstOn: false, timeMs: 420  },
    { level: 3, name: '相/象级（入门）', depth: 3, blunder: 0.12, noise: 22, pstOn: false, timeMs: 680  },
    { level: 4, name: '炮/砲级（业余）', depth: 3, blunder: 0.00, noise: 8,  pstOn: false, timeMs: 900  },
    { level: 5, name: '马级（高手）',   depth: 4, blunder: 0.00, noise: 0,  pstOn: true,  timeMs: 1200 },
    { level: 6, name: '车级（棋士）',   depth: 5, blunder: 0.00, noise: 0,  pstOn: true,  timeMs: 1550 },
    { level: 7, name: '帅/将级（大师）', depth: 6, blunder: 0.00, noise: 0,  pstOn: true,  timeMs: 1900 },
  ];

  // negamax（带 alpha-beta）
  // opts: { depth, timeMs, pstOn, noise, startTime }
  function negamax(b, depth, alpha, beta, side, opts, deadline) {
    if (deadline && Date.now() > deadline) {
      throw new Error('timeup');
    }
    const moves = orderMoves(E.generateLegalMoves(b, side));
    if (moves.length === 0) {
      return E.isInCheck(b, side) ? (-100000 - depth) : 0;
    }
    if (depth === 0) {
      let s = (opts.pstOn ? evaluate(b) : simpleEvaluate(b));
      if (opts.noise) s += (Math.random() * 2 - 1) * opts.noise;
      return side === RED ? s : -s;
    }
    let best = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      const next = E.applyMove(b, moves[i]);
      const val = -negamax(next, depth - 1, -beta, -alpha, side === RED ? BLACK : RED, opts, deadline);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // 不带 PST 的简化评估（低级别用，避免低级别棋力变强）
  function simpleEvaluate(b) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b.grid[r][c];
        if (!p) continue;
        let v = PIECE_VALUES[p.type];
        if (p.type === 'P') {
          const adv = p.side === RED ? (ROWS - 1 - r) : r;
          v += adv * 3;
        }
        score += (p.side === RED) ? v : -v;
      }
    }
    return score;
  }

  // 迭代加深：depth 1..cfg.depth，超时返回上一层 bestMove
  function searchWithPonder(b, side, cfg) {
    const moves = E.generateLegalMoves(b, side);
    if (moves.length === 0) return null;
    let best = moves[0];
    const opts = { pstOn: cfg.pstOn, noise: 0 };
    const deadline = Date.now() + cfg.timeMs;
    for (let d = 1; d <= cfg.depth; d++) {
      let currBest = moves[0];
      let currVal = -Infinity;
      const ordered = orderMoves(moves);
      let alpha = -Infinity, beta = Infinity;
      for (let i = 0; i < ordered.length; i++) {
        if (Date.now() > deadline) break;
        const next = E.applyMove(b, ordered[i]);
        let val;
        try {
          val = -negamax(next, d - 1, -beta, -alpha, side === RED ? BLACK : RED, opts, deadline);
        } catch (e) {
          if (e.message === 'timeup') break;
          throw e;
        }
        if (val > currVal) { currVal = val; currBest = ordered[i]; }
        if (currVal > alpha) alpha = currVal;
      }
      if (Date.now() > deadline && d > 1) break;   // 当前层没搜完，使用上一层结果
      best = currBest;
      if (currVal >= 90000) break;                  // 找到必杀，够了
    }
    return best;
  }

  // 故意低级失误：挑一个静态评估明显差于最优的着法
  function pickBlunder(b, side, cfg) {
    const moves = E.generateLegalMoves(b, side);
    if (moves.length <= 1) return moves[0] || null;
    const scored = moves.map(function (m) {
      const nb = E.applyMove(b, m);
      return { m: m, v: side === RED ? -simpleEvaluate(nb) : simpleEvaluate(nb) };
    });
    scored.sort(function (a, c) { return c.v - a.v; });   // 降序：最优在前
    const best = scored[0].v;
    const bad = scored.filter(function (x) { return (best - x.v) >= 120; });
    const pool = bad.length ? bad : scored.slice(1);     // 找不到"差 120"的就用非最优
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  // 新主入口：按等级思考
  function aiMove(b, side, level) {
    const lv = Math.max(1, Math.min(7, level | 0));
    const cfg = LEVELS[lv - 1];
    const moves = E.generateLegalMoves(b, side);
    if (moves.length === 0) return null;
    if (Math.random() < cfg.blunder) return pickBlunder(b, side, cfg);
    return searchWithPonder(b, side, cfg);
  }

  // 旧版（深度搜索）保留
  function aiBestMove(b, side, depth) {
    const d = depth || AI_DEPTH;
    const moves = orderMoves(E.generateLegalMoves(b, side));
    if (moves.length === 0) return null;
    let best = -Infinity;
    let bestMove = moves[0];
    for (let i = 0; i < moves.length; i++) {
      const next = E.applyMove(b, moves[i]);
      const val = -negamax(next, d - 1, -Infinity, Infinity, side === RED ? BLACK : RED,
        { pstOn: false, noise: 0 }, null);
      if (val > best) { best = val; bestMove = moves[i]; }
    }
    return bestMove;
  }

  /* ---------------- 棋谱导出 / 解析 / 重放 ---------------- */
  function exportGame(moveList, meta) {
    meta = meta || {};
    const lines = [];
    lines.push('# 心奇学象棋 棋谱');
    if (meta.mode) lines.push('# 模式：' + meta.mode);
    if (meta.handicap) lines.push('# 让子：' + meta.handicap);
    for (let i = 0; i < moveList.length; i += 2) {
      const n = (i / 2) + 1;
      const r = moveList[i] || '';
      const bl = moveList[i + 1] || '';
      if (bl) lines.push(n + '. ' + r + ' ' + bl);
      else lines.push(n + '. ' + r);
    }
    return lines.join('\n') + '\n';
  }

  function parseGameText(text) {
    if (!text) return [];
    const lines = String(text).split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      if (raw.charAt(0) === '#' || raw.charAt(0) === ';') continue;
      // 形如 "1. 马八进七 砲2平3" 或 "1." 单独一行
      const noNum = raw.replace(/^\d+\s*\.\s*/, '');
      const toks = noNum.split(/[\s　]+/).filter(Boolean);
      for (let k = 0; k < toks.length; k++) out.push(toks[k]);
    }
    return out;
  }

  function replayNotations(startBoard, list) {
    const out = { ok: true, board: startBoard, moves: [], error: null, index: -1 };
    let cur = startBoard;
    let side = cur.turn;
    for (let i = 0; i < list.length; i++) {
      const m = notationToMove(cur, list[i], side);
      if (!m) {
        out.ok = false;
        out.index = i;
        out.error = '非法着法 ' + list[i];
        break;
      }
      cur = E.applyMove(cur, m);
      out.moves.push({ notation: list[i], move: m });
      side = cur.turn;
    }
    out.board = cur;
    return out;
  }

  /* ---------------- 导出 ---------------- */
  const api = {
    PIECE_CHARS, PIECE_MODELS, PIECE_VALUES, AI_DEPTH,
    LEVELS, HANDICAPS,
    createHandicapBoard,
    cloneBoard, computeCounts, computeCaptured,
    moveToNotation, notationToMove,
    aiBestMove, aiMove,
    exportGame, parseGameText, replayNotations,
  };
  if (isNode) module.exports = api;
  else window.XiangqiCore = api;
})();
