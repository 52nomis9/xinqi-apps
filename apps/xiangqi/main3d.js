'use strict';
/* ============================================================
 * main3d.js — 3D 版主控：对局状态、交互、视角设置、侧栏
 * ============================================================ */
(function () {
  const E = window.XiangqiEngine;
  const Core = window.XiangqiCore;
  const RED = E.RED;
  const BLACK = E.BLACK;
  const COLS = E.COLS;
  const ROWS = E.ROWS;
  const CHARS = Core.PIECE_CHARS;

  const AI_SIDE = BLACK;
  const AI_DEPTH = Core.AI_DEPTH;

  /* ---------------- 状态 ---------------- */
  let pieceStyle = 'model_char';   // 'model' | 'model_char' | 'char'
  let handicap = 'none';           // 让子设置
  let giver = 'red';               // 让子方：'red' 红方让子 / 'black' 黑方让子
  let difficulty = 1;              // 人机难度 1~7
  let soundOn = true;              // 音效开关（默认开）

  let board = Core.createHandicapBoard ? Core.createHandicapBoard('none', 'red') : E.createInitialBoard();
  let boardStates = [Core.cloneBoard(board)];
  let moveList = [];
  let selected = null;
  let legalTargets = [];
  let mode = 'pvp';
  let gameOver = false;
  let busy = false;
  let selMoveIdx = -1;             // 着法记录中当前选中的步（用于复盘重下）
  let lastCapKey = '';

  let viewMode = 'angle';   // 'angle' | 'top'
  let autoSwitch = true;
  let plaquesOn = true;

  let initialCounts = Core.computeCounts(board);
  let scene = null;

  /* ---------------- 工具 ---------------- */
  function el(id) { return document.getElementById(id); }

  function findGeneralPos(b, side) {
    const g = E.findGeneral(b, side);
    return g ? [g.c, g.r] : null;
  }

  function computeCaptured() {
    return Core.computeCaptured(board, initialCounts);
  }

  // 当前让子设置下的开局局面（红/黑让子按 giver 决定）
  function startBoard() {
    return Core.createHandicapBoard ? Core.createHandicapBoard(handicap, giver) : E.createInitialBoard();
  }

  function giverName() {
    return giver === 'black' ? '黑方' : '红方';
  }

  function handicapName(id) {
    const list = Core.HANDICAPS || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) {
      return id === 'none' ? list[i].name : giverName() + '·' + list[i].desc;
    }
    return '常规对局';
  }

  function levelName(lv) {
    const L = Core.LEVELS && Core.LEVELS[lv - 1];
    return L ? (lv + ' 级 · ' + L.name) : (lv + ' 级');
  }

  // 战果变化时同步到棋盘外右侧的 3D 展示（内容没变就不重建）
  function syncCaptured() {
    const caps = computeCaptured();
    const key = caps.red.join(',') + '|' + caps.black.join(',');
    if (key === lastCapKey) return;
    lastCapKey = key;
    scene.setCaptured(caps);
  }

  /* ---------------- 3D 渲染同步 ---------------- */
  function refreshHighlights() {
    const inCheck = E.isInCheck(board, board.turn);
    scene.setCheck(inCheck && !gameOver ? findGeneralPos(board, board.turn) : null);
    scene.setSelection(selected);
    scene.setLegalMoves(legalTargets, board);
  }

  // 视角文案（45° 与 90° 都支持「随走棋方切换」）
  function updateViewStatus() {
    const s = el('view-status');
    if (!s) return;
    if (viewMode === 'top') {
      s.textContent = autoSwitch
        ? '90° 全程俯视 · 随走棋方自动切换'
        : '90° 全程俯视 · 固定' + (lastManualSide === 'red' ? '红方' : '黑方') + '在下';
    } else {
      s.textContent = autoSwitch
        ? '45° 斜视 · 随走棋方自动切换'
        : '45° 斜视 · 固定' + (lastManualSide === 'red' ? '红方' : '黑方') + '后方';
    }
  }

  // 应用视角：勾选「视角随走棋方切换」时始终跟到当前走棋方（45°/90° 均生效）
  function applyView() {
    const side = autoSwitch ? board.turn : lastManualSide;
    scene.setView(viewMode === 'top' ? 'top' : 'angle', side);
    updateViewStatus();
  }

  let lastManualSide = 'red';

  /* ---------------- 交互 ---------------- */
  function clearSelection() {
    selected = null;
    legalTargets = [];
    refreshHighlights();
  }

  function selectPiece(c, r) {
    selected = [c, r];
    legalTargets = E.generateLegalMoves(board, board.turn)
      .filter(function (m) { return m.from[0] === c && m.from[1] === r; })
      .map(function (m) { return m.to; });
    refreshHighlights();
    if (window.XiangqiSounds) window.XiangqiSounds.lift();   // 提棋音效
  }

  function isLegalTarget(cell) {
    for (let i = 0; i < legalTargets.length; i++) {
      if (legalTargets[i][0] === cell[0] && legalTargets[i][1] === cell[1]) return true;
    }
    return false;
  }

  /**
   * 点击判定优先级（已选子时）：
   *   1. 点中的棋子恰好是合法落点（吃子）
   *   2. 地面格是合法落点（普通落子，含被前排棋子遮挡的格子）
   *   3. 点中己方棋子 → 改选
   *   4. 其他 → 取消选择
   */
  function onBoardClick(det) {
    if (gameOver || busy) return;
    if (mode === 'pve' && board.turn === AI_SIDE) return;
    const pc = det.pieceCell;
    const gc = det.groundCell;

    if (selected) {
      if (pc && isLegalTarget(pc)) { doMove({ from: [selected[0], selected[1]], to: pc }); return; }
      if (gc && isLegalTarget(gc)) { doMove({ from: [selected[0], selected[1]], to: gc }); return; }
      if (pc) {
        const p = board.grid[pc[1]][pc[0]];
        if (p && p.side === board.turn) { selectPiece(pc[0], pc[1]); return; }
      }
      clearSelection();
      return;
    }

    const cell = pc || gc;
    if (!cell) return;
    const p = board.grid[cell[1]][cell[0]];
    if (p && p.side === board.turn) selectPiece(cell[0], cell[1]);
  }

  function makeFullMove(from, to) {
    return {
      from: from, to: to,
      piece: board.grid[from[1]][from[0]],
      captured: board.grid[to[1]][to[0]] || null,
    };
  }

  function doMove(move) {
    const full = move.piece ? move : makeFullMove(move.from, move.to);
    const side = full.piece.side;
    const captured = full.captured;

    board = E.applyMove(board, full);
    // 落子后判定是否将军（轮到的对方被将）
    const deliversCheck = E.isInCheck(board, board.turn);
    boardStates.push(Core.cloneBoard(board));
    moveList.push(Core.moveToNotation(full, side));

    selected = null;
    legalTargets = [];
    scene.setSelection(null);
    scene.setLegalMoves([], board);

    selMoveIdx = -1;
    updateReplayButton();

    // 音效：落棋声 → 吃！ → 将军！ 全部放在同步段（animateMove 之前）直接调用，
    // 紧贴用户手势栈按正确顺序播放；drop 为 WebAudio 合成音，无手势限制，提前也照常响
    if (window.XiangqiSounds) {
      window.XiangqiSounds.drop();
      if (captured) window.XiangqiSounds.eat();
      if (deliversCheck) window.XiangqiSounds.check();
    }

    scene.animateMove(full, captured, function () {
      updatePanel();
      refreshHighlights();
    });

    // 视角切换（45° / 90° 都跟随走棋方）
    if (autoSwitch) applyView();

    const status = E.getGameStatus(board);
    if (status.over) {
      gameOver = true;
      showGameOver(status);
    }
    updatePanel();

    if (!gameOver && mode === 'pve' && board.turn === AI_SIDE) scheduleAiMove();
  }

  /* ---------------- AI ---------------- */
  function scheduleAiMove() {
    busy = true;
    el('thinking-indicator').style.display = 'block';
    setTimeout(function () {
      const mv = Core.aiMove ? Core.aiMove(board, AI_SIDE, difficulty) : Core.aiBestMove(board, AI_SIDE, AI_DEPTH);
      busy = false;
      el('thinking-indicator').style.display = 'none';
      if (mv) doMove(mv);
      else updatePanel();
    }, 320);
  }

  /* ---------------- 侧栏 ---------------- */
  function updatePanel() {
    const turnEl = el('turn-indicator');
    turnEl.textContent = (board.turn === RED ? '红方' : '黑方') + '走棋';
    turnEl.className = 'turn ' + board.turn;

    const inChk = E.isInCheck(board, board.turn);
    const banner = el('check-banner');
    if (inChk && !gameOver) banner.classList.add('show');
    else banner.classList.remove('show');

    renderMoveList();
    syncCaptured();
  }

  // 着法记录（每一步可点选，用于"复盘重下"）
  function renderMoveList() {
    const listEl = el('move-list');
    listEl.innerHTML = '';
    if (moveList.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'move-row empty';
      empty.textContent = '暂无着法';
      listEl.appendChild(empty);
      return;
    }
    for (let i = 0; i < moveList.length; i += 2) {
      const red = document.createElement('span');
      red.className = 'mv-cell mv-red' + (i === selMoveIdx ? ' picked' : '');
      red.textContent = moveList[i];
      red.dataset.idx = i;
      red.title = '点击选中第 ' + (i + 1) + ' 步，可复盘重下';

      const blk = document.createElement('span');
      blk.className = 'mv-cell mv-black' + (i + 1 === selMoveIdx ? ' picked' : '');
      blk.textContent = moveList[i + 1] || '';
      blk.dataset.idx = i + 1;

      const row = document.createElement('div');
      row.className = 'move-row';
      const num = document.createElement('span');
      num.className = 'mv-num';
      num.textContent = ((i / 2) + 1) + '.';
      row.appendChild(num);
      row.appendChild(red);
      row.appendChild(blk);
      if (moveList[i + 1] === undefined) blk.className += ' pending';
      listEl.appendChild(row);
    }
    listEl.scrollTop = listEl.scrollHeight;
  }

  // 点选着法
  function onMoveClick(e) {
    const cell = e.target.closest ? e.target.closest('.mv-cell') : null;
    if (!cell || cell.dataset.idx === undefined || cell.textContent === '') return;
    const idx = parseInt(cell.dataset.idx, 10);
    selMoveIdx = (selMoveIdx === idx) ? -1 : idx;
    renderMoveList();
    updateReplayButton();
  }

  function updateReplayButton() {
    const btn = el('btn-replay');
    if (!btn) return;
    if (selMoveIdx >= 0 && selMoveIdx < moveList.length) {
      btn.style.display = 'inline-block';
      btn.textContent = '复盘重下（回到第 ' + (selMoveIdx + 1) + ' 步）';
    } else {
      btn.style.display = 'none';
    }
  }

  /* ---------------- 棋谱导入 / 导出 ---------------- */
  function exportGame() {
    if (!moveList.length) { alert('当前还没有着法，无法导出棋谱。'); return; }
    const meta = {
      mode: mode === 'pve' ? '人机对战（难度：' + levelName(difficulty) + '）' : '双人对战',
      handicap: handicapName(handicap),
    };
    const text = Core.exportGame(moveList, meta);
    const d = new Date();
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    const name = '棋谱-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.txt';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importGame(text) {
    const list = Core.parseGameText(text);
    if (!list.length) { alert('没有解析到任何着法，请检查棋谱文件。'); return; }
    const res = Core.replayNotations(startBoard(), list);
    if (!res.ok) {
      alert('棋谱第 ' + (res.index + 1) + ' 步「' + (list[res.index] || '') + '」无法在当前局面下走通，已停在上一手。');
    }
    board = res.board;
    moveList = list.slice(0, res.moves.length);
    boardStates = [Core.cloneBoard(startBoard())];
    for (let i = 0; i < res.moves.length; i++) {
      boardStates.push(Core.cloneBoard(E.applyMove(boardStates[i], res.moves[i].move)));
    }
    selMoveIdx = -1;
    selected = null;
    legalTargets = [];
    gameOver = false;
    busy = false;
    hideGameOver();
    scene.rebuild(board);
    lastCapKey = '';
    syncCaptured();
    applyView();
    updatePanel();
    refreshHighlights();
    updateReplayButton();
  }

  function pickFile() {
    const input = el('file-import');
    input.value = '';
    input.click();
  }

  function buildLegend() {
    const box = el('legend-list');
    if (!box) return;
    const items = [
      ['P', '兵 / 卒', '小号 · 持长戈的朴素步兵'],
      ['R', '车 / 車', '中号 · 春秋双人战车'],
      ['N', '马 / 馬', '中号 · 持长矛的骑马骑士'],
      ['C', '炮 / 砲', '中号 · 单人操作投石车'],
      ['B', '相 / 象', '大号 · 羽扇纶巾的文官'],
      ['A', '仕 / 士', '大号 · 左盾右剑的近卫'],
      ['K', '帅 / 将', '大号 · 红袍冠冕儒将 / 黑衣大胡子猛将'],
    ];
    box.innerHTML = items.map(function (it) {
      return '<li><span class="lg-red">' + CHARS.red[it[0]] + '</span>' +
        '<span class="lg-black">' + CHARS.black[it[0]] + '</span>' +
        '<span class="lg-desc">' + it[2] + '</span></li>';
    }).join('');
  }

  /* ---------------- 控制 ---------------- */
  function undo() {
    if (busy || boardStates.length <= 1) return;
    boardStates.pop();
    if (mode === 'pve' && board.turn === AI_SIDE && boardStates.length > 1) boardStates.pop();
    board = Core.cloneBoard(boardStates[boardStates.length - 1]);
    moveList = moveList.slice(0, boardStates.length - 1);
    gameOver = false;
    busy = false;
    selected = null;
    legalTargets = [];
    selMoveIdx = -1;
    hideGameOver();
    scene.rebuild(board);
    if (autoSwitch) applyView();
    updatePanel();
    refreshHighlights();
    updateReplayButton();
  }

  function restart() {
    board = startBoard();
    initialCounts = Core.computeCounts(board);
    boardStates = [Core.cloneBoard(board)];
    moveList = [];
    gameOver = false;
    busy = false;
    selected = null;
    legalTargets = [];
    selMoveIdx = -1;
    lastCapKey = '';
    hideGameOver();
    scene.rebuild(board);
    scene.setPlaquesVisible(pieceStyle === 'model_char');
    scene.setCaptured({ red: [], black: [] });
    applyView();
    updatePanel();
    refreshHighlights();
    updateReplayButton();
    if (mode === 'pve' && board.turn === AI_SIDE) scheduleAiMove();
  }

  // 复盘重下：回到第 idx+1 步走完后的局面，删除其后的所有着法
  function replayTo(idx) {
    if (busy || idx < 0 || idx >= moveList.length) return;
    const keep = idx + 1;
    board = Core.cloneBoard(boardStates[keep]);
    boardStates = boardStates.slice(0, keep + 1);
    moveList = moveList.slice(0, keep);
    gameOver = false;
    busy = false;
    selected = null;
    legalTargets = [];
    selMoveIdx = -1;
    lastCapKey = '';
    hideGameOver();
    scene.rebuild(board);
    if (autoSwitch) applyView();
    updatePanel();
    refreshHighlights();
    updateReplayButton();
    if (mode === 'pve' && board.turn === AI_SIDE) scheduleAiMove();
  }

  // 棋子形象：模型 / 模型+汉字标牌 / 汉字
  function setPieceStyle(style) {
    pieceStyle = style;
    const map = { model: 'btn-style-model', model_char: 'btn-style-both', char: 'btn-style-char' };
    Object.keys(map).forEach(function (k) {
      el(map[k]).classList.toggle('active', k === style);
    });
    scene.setPieceStyle(style);
    scene.setPlaquesVisible(style === 'model_char');
    updatePanel();
    refreshHighlights();
  }

  function setMode(m) {
    mode = m;
    el('btn-pvp').classList.toggle('active', m === 'pvp');
    el('btn-pve').classList.toggle('active', m === 'pve');
    el('mode-indicator').textContent = '模式：' + (m === 'pvp' ? '双人对战' : '人机对战（你执红）');
    el('difficulty-row').style.display = (m === 'pve') ? '' : 'none';
    restart();
  }

  function setDifficulty(lv) {
    difficulty = Math.max(1, Math.min(7, parseInt(lv, 10) || 1));
    el('sel-difficulty').value = String(difficulty);
  }

  function setHandicap(h) {
    handicap = h;
    el('sel-handicap').value = h;
    restart();
  }

  // 让子方：红方/黑方；调整后已设置的让子棋局按新让子方重建开局
  function setGiver(side) {
    giver = (side === 'black') ? 'black' : 'red';
    el('sel-giver').value = giver;
    if (handicap !== 'none') restart();
  }

  // 音效开关（喇叭/静音）
  function setSoundOn(on) {
    soundOn = !!on;
    const btn = el('btn-sound');
    if (btn) {
      btn.textContent = soundOn ? '🔊' : '🔇';
      btn.title = soundOn ? '音效：开（点击静音）' : '音效：关（点击开启）';
      btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    }
    if (window.XiangqiSounds) window.XiangqiSounds.setMuted(!soundOn);
  }

  // 侧栏收起/展开
  let panelHidden = false;
  function togglePanel() {
    panelHidden = !panelHidden;
    const layout = document.querySelector('.layout');
    const btn = el('btn-toggle-panel');
    if (layout) layout.classList.toggle('panel-hidden', panelHidden);
    if (btn) {
      btn.textContent = panelHidden ? '❮' : '❯';
      btn.title = panelHidden ? '展开右侧设置栏' : '收起右侧设置栏';
      btn.setAttribute('aria-expanded', panelHidden ? 'false' : 'true');
    }
    // 等布局切换完成后再让相机重新取景
    setTimeout(function () { if (scene) scene.resize(); }, 80);
  }

  /* ---------------- 全屏（棋盘下棋界面） ---------------- */
  function boardArea() { return document.querySelector('.board-area'); }

  function isFullscreen() {
    const d = document;
    const native = !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
    const area = boardArea();
    return native || !!(area && area.classList.contains('is-fullscreen'));
  }

  // 原生 Fullscreen API；iOS Safari 等不支持元素全屏时，回退为 .is-fullscreen 全屏遮罩
  function enterFullscreen() {
    const area = boardArea();
    if (!area) return;
    const req = area.requestFullscreen || area.webkitRequestFullscreen || area.msRequestFullscreen;
    if (!req) { area.classList.add('is-fullscreen'); return; }
    let started = false;
    try {
      const p = req.call(area);
      if (p && typeof p.then === 'function') started = true;
      if (p && typeof p.catch === 'function') {
        p.catch(function () { area.classList.add('is-fullscreen'); });
      }
    } catch (e) {
      area.classList.add('is-fullscreen');
      return;
    }
    // 调用未返回 Promise（如 iOS Safari 对 div 静默失败）：稍后仍未进入原生全屏则回退
    if (!started) {
      setTimeout(function () {
        if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
          area.classList.add('is-fullscreen');
        }
      }, 160);
    }
  }

  function exitFullscreen() {
    const d = document;
    const ex = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen;
    if ((d.fullscreenElement || d.webkitFullscreenElement) && ex) {
      try { ex.call(d); } catch (e) {}
    }
    const area = boardArea();
    if (area) area.classList.remove('is-fullscreen');
  }

  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreen();
    else enterFullscreen();
    setTimeout(function () {
      if (scene) scene.resize();
      updateFsButton();
    }, 220);
    updateFsButton();
  }

  function updateFsButton() {
    const btn = el('btn-fullscreen');
    if (!btn) return;
    const on = isFullscreen();
    btn.textContent = on ? '✕' : '⛶';
    btn.title = on ? '退出全屏' : '全屏显示棋盘下棋界面';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function bindFullscreenEvents() {
    const handler = function () {
      if (scene) scene.resize();
      updateFsButton();
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('msfullscreenchange', handler);
    // 回退模式（无原生全屏）用 Esc 退出
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isFullscreen()) exitFullscreen();
    });
    updateFsButton();
  }

  function showGameOver(status) {
    const title = el('go-title');
    if (status.winner) {
      title.textContent = (status.winner === RED ? '红方' : '黑方') + '胜利！';
      title.className = 'go-title ' + status.winner;
    } else {
      title.textContent = '和棋';
      title.className = 'go-title';
    }
    el('go-desc').textContent = status.reason === 'checkmate'
      ? '将死 — 对方无子可动且被将军'
      : '困毙 — 对方无子可动，未被将军（和棋）';
    el('gameover-modal').classList.add('show');
  }
  function hideGameOver() { el('gameover-modal').classList.remove('show'); }

  /* ---------------- 初始化 ---------------- */
  function bindBoardEvents() {
    const dom = scene.renderer.domElement;
    let down = null;
    let dragged = false;

    dom.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY };
      dragged = false;
    });
    dom.addEventListener('pointermove', function (e) {
      if (!down) {
        const cell = scene.pick(e.clientX, e.clientY);
        scene.setHover(cell);
        return;
      }
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!dragged && Math.sqrt(dx * dx + dy * dy) > 6) dragged = true;
      // 勾选「视角随走棋方切换」时视角锁定：不调整视角（仅标记为拖拽，避免被误判为点击）
      if (autoSwitch) return;
      if (dragged) {
        scene.orbit(dx * 0.006, -dy * 0.005);
        down.x = e.clientX;
        down.y = e.clientY;
        lastManualSide = scene.viewSide || 'red';
        updateViewStatus();
      }
    });
    dom.addEventListener('pointerup', function (e) {
      if (down && !dragged) {
        const det = scene.pickDetailed(e.clientX, e.clientY);
        if (det.pieceCell || det.groundCell) onBoardClick(det);
      }
      down = null;
    });
    dom.addEventListener('pointerleave', function () {
      scene.setHover(null);
      down = null;
    });
    dom.addEventListener('wheel', function (e) {
      e.preventDefault();
      scene.setZoom(scene.zoom + Math.sign(e.deltaY) * 0.08);
    }, { passive: false });
  }

  function init() {
    scene = new window.XiangqiScene3D(el('board-container'));
    scene.rebuild(board);
    scene.setPlaquesVisible(pieceStyle === 'model_char');
    applyView();
    updatePanel();
    refreshHighlights();
    bindBoardEvents();

    // 模式 / 操作
    el('btn-undo').addEventListener('click', undo);
    el('btn-restart').addEventListener('click', restart);
    el('btn-pvp').addEventListener('click', function () { setMode('pvp'); });
    el('btn-pve').addEventListener('click', function () { setMode('pve'); });
    el('btn-close-modal').addEventListener('click', restart);

    // 视角
    el('btn-view-top').addEventListener('click', function () {
      viewMode = 'top';
      el('btn-view-top').classList.add('active');
      el('btn-view-angle').classList.remove('active');
      applyView();
    });
    el('btn-view-angle').addEventListener('click', function () {
      viewMode = 'angle';
      el('btn-view-angle').classList.add('active');
      el('btn-view-top').classList.remove('active');
      applyView();
    });
    el('chk-autoswitch').addEventListener('change', function (e) {
      autoSwitch = e.target.checked;
      lastManualSide = board.turn;
      // 45° 与 90° 都保留在当前模式，不再强制切回 45°
      if (autoSwitch) applyView();
      else scene.setView(viewMode === 'top' ? 'top' : 'angle', lastManualSide);
      updateViewStatus();
    });
    el('btn-flip').addEventListener('click', function () {
      autoSwitch = false;
      el('chk-autoswitch').checked = false;
      lastManualSide = (lastManualSide === 'red') ? 'black' : 'red';
      scene.setView(viewMode === 'top' ? 'top' : 'angle', lastManualSide);
      updateViewStatus();
    });

    // 棋子形象
    el('btn-style-model').addEventListener('click', function () { setPieceStyle('model'); });
    el('btn-style-both').addEventListener('click', function () { setPieceStyle('model_char'); });
    el('btn-style-char').addEventListener('click', function () { setPieceStyle('char'); });
    setPieceStyle(pieceStyle);

    // 让子方 / 让子 / 难度
    function fillHandicapOptions() {
      const sel = el('sel-handicap');
      const cur = sel.value || 'none';
      sel.innerHTML = '';
      (Core.HANDICAPS || []).forEach(function (h) {
        const op = document.createElement('option');
        op.value = h.id;
        op.textContent = h.desc;   // 常规对局 / 让出左侧马 / …
        if (h.id === 'none') op.textContent = '常规对局';
        sel.appendChild(op);
      });
      sel.value = cur;
    }
    function fillDifficultyOptions() {
      const sel = el('sel-difficulty');
      const cur = sel.value || String(difficulty);
      sel.innerHTML = '';
      (Core.LEVELS || []).forEach(function (L) {
        const op = document.createElement('option');
        op.value = String(L.level);
        op.textContent = L.level + ' 级 · ' + L.name;
        sel.appendChild(op);
      });
      sel.value = cur;
    }
    fillHandicapOptions();
    fillDifficultyOptions();
    el('sel-handicap').addEventListener('change', function (e) { setHandicap(e.target.value); });
    el('sel-giver').addEventListener('change', function (e) { setGiver(e.target.value); });
    el('sel-difficulty').addEventListener('change', function (e) { setDifficulty(e.target.value); });
    setGiver(giver);
    setHandicap(handicap);
    setDifficulty(difficulty);
    el('difficulty-row').style.display = (mode === 'pve') ? '' : 'none';

    // 音效：解锁（浏览器需用户手势）+ 喇叭/静音切换
    function unlockSnd() { if (window.XiangqiSounds) window.XiangqiSounds.unlock(); }
    document.addEventListener('pointerdown', unlockSnd);
    el('btn-sound').addEventListener('click', function () { setSoundOn(!soundOn); });
    setSoundOn(true);

    // 侧栏收起/展开
    el('btn-toggle-panel').addEventListener('click', togglePanel);

    // 全屏（棋盘下棋界面）
    el('btn-fullscreen').addEventListener('click', toggleFullscreen);
    bindFullscreenEvents();

    // 着法记录与棋谱
    el('move-list').addEventListener('click', onMoveClick);
    el('btn-export').addEventListener('click', exportGame);
    el('btn-import').addEventListener('click', pickFile);
    el('btn-replay').addEventListener('click', function () { replayTo(selMoveIdx); });
    el('file-import').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function () { importGame(String(r.result || '')); };
      r.readAsText(f, 'utf-8');
    });
    updateReplayButton();

    window.addEventListener('resize', function () { scene.resize(); });

    // 调试 / 自动化测试入口
    window.__scene = scene;
    window.__game = {
      board: function () { return board; },
      doMove: doMove,
      restart: restart,
      setPieceStyle: setPieceStyle,
      setDifficulty: setDifficulty,
      setHandicap: setHandicap,
      replayTo: replayTo,
      importText: importGame,
      exportText: function () { return Core.exportGame(moveList, { mode: mode === 'pve' ? ('人机(' + levelName(difficulty) + ')') : '双人对战', handicap: handicapName(handicap) }); },
      setGiver: setGiver,
      setSoundOn: setSoundOn,
      togglePanel: togglePanel,
      toggleFullscreen: toggleFullscreen,
      isFullscreen: isFullscreen,
      isSoundOn: function () { return soundOn; },
      isPanelHidden: function () { return panelHidden; },
      state: function () { return { mode: mode, handicap: handicap, giver: giver, difficulty: difficulty, pieceStyle: pieceStyle, selMoveIdx: selMoveIdx, viewMode: viewMode, autoSwitch: autoSwitch, soundOn: soundOn, panelHidden: panelHidden }; },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
