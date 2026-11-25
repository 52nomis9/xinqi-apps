'use strict';
/* ============================================================
 * scene3d.js — 卡通 3D 场景：棋盘、棋子、相机视角、拾取、动画
 * 依赖: three.js / pieces3d.js / engine.js
 * ============================================================ */
(function () {
  const THREE = window.THREE;
  const E = window.XiangqiEngine;
  const P = window.XiangqiPieces3D;

  const COLS = E.COLS;   // 9
  const ROWS = E.ROWS;   // 10
  const CELL = 1.0;
  const MARGIN = 0.6;
  const BOARD_W = MARGIN * 2 + CELL * (COLS - 1);   // 9.2
  const BOARD_D = MARGIN * 2 + CELL * (ROWS - 1);   // 10.2

  function cellToWorld(c, r) {
    return new THREE.Vector3((c - 4) * CELL, 0, (r - 4.5) * CELL);
  }

  /* ============================================================
   * 棋盘贴图（Canvas 绘制：线条、河界、九宫、炮兵位）
   * ============================================================ */
  function makeBoardTexture() {
    const PX = 110;
    const mpx = MARGIN * PX;
    const cell = CELL * PX;
    const W = Math.round(BOARD_W * PX);
    const H = Math.round(BOARD_D * PX);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const x = cv.getContext('2d');
    const px = function (c) { return mpx + c * cell; };
    const py = function (r) { return mpx + r * cell; };

    // 木质底（整体压暗，避免过于刺眼）
    const grd = x.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#cfa871');
    grd.addColorStop(0.5, '#c39760');
    grd.addColorStop(1, '#b3894f');
    x.fillStyle = grd;
    x.fillRect(0, 0, W, H);

    // 木纹
    x.globalAlpha = 0.06;
    x.strokeStyle = '#8a5a24';
    for (let i = 0; i < 40; i++) {
      const yy = (i / 40) * H + Math.sin(i * 1.7) * 6;
      x.beginPath();
      x.moveTo(0, yy);
      x.bezierCurveTo(W * 0.3, yy + 8, W * 0.7, yy - 8, W, yy + 3);
      x.lineWidth = 1 + (i % 3);
      x.stroke();
    }
    x.globalAlpha = 1;

    // 河界底色
    x.fillStyle = 'rgba(86, 146, 186, 0.30)';
    x.fillRect(px(0) - 18, py(4), px(8) - px(0) + 36, py(5) - py(4));

    // 外框
    x.strokeStyle = '#5b3714';
    x.lineWidth = 9;
    x.strokeRect(px(0) - 16, py(0) - 16, px(8) - px(0) + 32, py(9) - py(0) + 32);

    // 横线
    x.strokeStyle = '#432c11';
    x.lineWidth = 2.4;
    for (let r = 0; r < ROWS; r++) {
      x.beginPath();
      x.moveTo(px(0), py(r));
      x.lineTo(px(COLS - 1), py(r));
      x.stroke();
    }
    // 竖线（河界处断开，左右边线贯通）
    for (let c = 0; c < COLS; c++) {
      x.beginPath();
      if (c === 0 || c === COLS - 1) {
        x.moveTo(px(c), py(0));
        x.lineTo(px(c), py(ROWS - 1));
      } else {
        x.moveTo(px(c), py(0));
        x.lineTo(px(c), py(4));
        x.moveTo(px(c), py(5));
        x.lineTo(px(c), py(ROWS - 1));
      }
      x.stroke();
    }

    // 九宫斜线
    function diag(c1, r1, c2, r2) {
      x.beginPath();
      x.moveTo(px(c1), py(r1));
      x.lineTo(px(c2), py(r2));
      x.stroke();
    }
    diag(3, 0, 5, 2); diag(5, 0, 3, 2);
    diag(3, 7, 5, 9); diag(5, 7, 3, 9);

    // 炮位 / 兵位 标记
    const marks = [
      [1, 2], [7, 2], [1, 7], [7, 7],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
    ];
    x.lineWidth = 3.2;
    x.strokeStyle = '#432c11';
    marks.forEach(function (m) {
      const cx = px(m[0]), cy = py(m[1]);
      const d = cell * 0.17, L = cell * 0.20;
      const seg = [
        [cx - d, cy - d - L, cx - d, cy - d, cx - d - L, cy - d],
        [cx + d, cy - d - L, cx + d, cy - d, cx + d + L, cy - d],
        [cx - d, cy + d + L, cx - d, cy + d, cx - d - L, cy + d],
        [cx + d, cy + d + L, cx + d, cy + d, cx + d + L, cy + d],
      ];
      seg.forEach(function (s) {
        x.beginPath();
        x.moveTo(s[0], s[1]);
        x.lineTo(s[2], s[3]);
        x.lineTo(s[4], s[5]);
        x.stroke();
      });
    });

    // 楚河漢界
    const riverY = (py(4) + py(5)) / 2;
    x.fillStyle = '#4a3013';
    x.font = 'bold ' + Math.round(cell * 0.52) + 'px "KaiTi","STKaiti","SimSun",serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('楚 河', px(1.7), riverY);
    x.fillText('漢 界', px(6.3), riverY);

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeSkyTexture() {
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 256;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#63b6e8');
    g.addColorStop(0.5, '#a9dcf5');
    g.addColorStop(1, '#f6e9cf');
    x.fillStyle = g;
    x.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ============================================================
   * 场景类
   * ============================================================ */
  function Scene3D(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

    // 相机球坐标：theta=0 -> +Z(红方)侧, phi=PI/2 -> 正俯视
    this.cam = { theta: 0, phi: Math.PI / 4, r: 16 };
    this.camTarget = { theta: 0, phi: Math.PI / 4, r: 16 };
    this.zoom = 1.0;
    // 俯视模式下相机 up 向量绕 Y 轴翻转角（0=红方在下，PI=黑方在下），用于 90° 俯视也随走棋方切换
    this.upBeta = 0;
    this._upTween = null;

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.pieceRoot = new THREE.Group();
    this.scene.add(this.pieceRoot);
    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);
    this.capRoot = new THREE.Group();     // 棋盘外右侧的战果（被吃棋子）
    this.scene.add(this.capRoot);

    this.pieces = {};       // "c,r" -> { group, type, side, c, r }
    this.protos = {};       // "style|type|side" -> THREE.Group
    this.anims = [];
    this.selectedCell = null;
    this.hoverCell = null;
    this.pickEnabled = true;

    this.pieceStyle = 'model_char';   // 'model' | 'model_char' | 'char'
    this.plaquesOn = true;
    this._board = null;
    this._captured = { red: [], black: [] };
    this.viewMode = 'angle';
    this.viewSide = 'red';

    this._buildLights();
    this._buildBoard();
    this._buildMarkers();

    this.resize();
    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
  }

  Scene3D.prototype._buildLights = function () {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7c62, 0.52);
    this.scene.add(hemi);
    const amb = new THREE.AmbientLight(0xffffff, 0.20);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffeecb, 0.66);
    dir.position.set(6.5, 15, 9);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 9.5; sc.bottom = -9.5;
    sc.near = 1; sc.far = 45;
    dir.shadow.bias = -0.0009;
    dir.shadow.normalBias = 0.02;
    this.scene.add(dir);
    this.scene.add(dir.target);

    // 补光
    const fill = new THREE.DirectionalLight(0xcfe6ff, 0.20);
    fill.position.set(-8, 7, -7);
    this.scene.add(fill);
  };

  Scene3D.prototype._buildBoard = function () {
    const g = new THREE.Group();

    // 台面（贴图）
    const tex = makeBoardTexture();
    const topMat = new THREE.MeshLambertMaterial({ map: tex });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_D), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.004;
    top.receiveShadow = true;
    g.add(top);
    this.boardTop = top;

    // 台体
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W, 0.22, BOARD_D),
      new THREE.MeshLambertMaterial({ color: 0x8d6839 })
    );
    slab.position.y = -0.11;
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);

    // 外框
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W + 0.40, 0.15, BOARD_D + 0.40),
      new THREE.MeshLambertMaterial({ color: 0x5c3a17 })
    );
    frame.position.y = -0.295;
    frame.receiveShadow = true;
    frame.castShadow = true;
    g.add(frame);

    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshLambertMaterial({ color: 0x6f9558 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.38;
    ground.receiveShadow = true;
    g.add(ground);

    // 拾取用的水平面（不可见）
    const pickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_W + 1.2, BOARD_D + 1.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    pickPlane.rotation.x = -Math.PI / 2;
    pickPlane.position.y = 0.001;
    g.add(pickPlane);
    this.pickPlane = pickPlane;

    this.scene.add(g);
    this.boardGroup = g;
  };

  Scene3D.prototype._buildMarkers = function () {
    // 选中框
    const sel = new THREE.Mesh(
      new THREE.RingGeometry(0.40, 0.47, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
    );
    sel.rotation.x = -Math.PI / 2;
    sel.position.y = 0.012;
    sel.visible = false;
    this.fxRoot.add(sel);
    this.selRing = sel;

    // 悬停框
    const hov = new THREE.Mesh(
      new THREE.RingGeometry(0.41, 0.45, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    hov.rotation.x = -Math.PI / 2;
    hov.position.y = 0.010;
    hov.visible = false;
    this.fxRoot.add(hov);
    this.hovRing = hov;

    // 将军警示环
    const chk = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 32),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    chk.rotation.x = -Math.PI / 2;
    chk.position.y = 0.014;
    chk.visible = false;
    this.fxRoot.add(chk);
    this.checkRing = chk;

    // 走法提示池
    this.markers = [];
    for (let i = 0; i < 32; i++) {
      const grp = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 20),
        new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: 0.92, depthWrite: false })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.y = 0.012;
      grp.add(dot);
      // 可吃子：蓝色底部外圈（包住敌方棋子底盘）
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.415, 0.495, 34),
        new THREE.MeshBasicMaterial({ color: 0x2f7bd6, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      ring.visible = false;
      grp.add(ring);
      grp.visible = false;
      this.fxRoot.add(grp);
      this.markers.push({ group: grp, dot: dot, ring: ring });
    }
  };

  /* ---------------- 棋子原型 / 实例 ---------------- */
  Scene3D.prototype._proto = function (type, side) {
    const key = this.pieceStyle + '|' + type + '|' + side;
    if (!this.protos[key]) {
      const built = P.buildPiece(type, side, this._charOf(type, side), this.pieceStyle);
      this.protos[key] = built.group;
    }
    return this.protos[key];
  };

  Scene3D.prototype._charOf = function (type, side) {
    return window.XiangqiCore.PIECE_CHARS[side][type];
  };

  Scene3D.prototype._makePiece = function (type, side, c, r) {
    const grp = this._proto(type, side).clone(true);
    const w = cellToWorld(c, r);
    grp.position.set(w.x, 0, w.z);
    grp.userData.cell = [c, r];
    grp.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });
    this.pieceRoot.add(grp);
    return { group: grp, type: type, side: side, c: c, r: r, baseY: 0 };
  };

  /* ---------------- 同步棋盘 ---------------- */
  Scene3D.prototype.rebuild = function (board) {
    this._board = board;
    // 清除全部棋子
    const self = this;
    Object.keys(this.pieces).forEach(function (k) {
      self.pieceRoot.remove(self.pieces[k].group);
    });
    this.pieces = {};
    this.anims = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board.grid[r][c];
        if (!p) continue;
        this.pieces[c + ',' + r] = this._makePiece(p.type, p.side, c, r);
      }
    }
  };

  /* ---------------- 走子动画 ---------------- */
  Scene3D.prototype.animateMove = function (move, captured, onDone) {
    const fromKey = move.from[0] + ',' + move.from[1];
    const toKey = move.to[0] + ',' + move.to[1];
    const pc = this.pieces[fromKey];
    if (!pc) { if (onDone) onDone(); return; }

    if (captured) {
      const cap = this.pieces[toKey];
      if (cap) {
        this.anims.push({
          kind: 'capture', obj: cap, t: 0, dur: 0.30,
          onEnd: (function (self, c) {
            return function () {
              self.pieceRoot.remove(c.group);
            };
          })(this, cap),
        });
        delete this.pieces[toKey];
      }
    }

    delete this.pieces[fromKey];
    pc.c = move.to[0];
    pc.r = move.to[1];
    pc.group.userData.cell = [pc.c, pc.r];
    this.pieces[toKey] = pc;

    const a = cellToWorld(move.from[0], move.from[1]);
    const b = cellToWorld(move.to[0], move.to[1]);
    this.anims.push({
      kind: 'move', obj: pc, t: 0, dur: 0.34,
      from: new THREE.Vector2(a.x, a.z),
      to: new THREE.Vector2(b.x, b.z),
      onEnd: (function (self) {
        return function () {
          if (onDone) onDone();
        };
      })(this),
    });
  };

  Scene3D.prototype._updateAnims = function (dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const an = this.anims[i];
      an.t += dt;
      let k = an.t / an.dur;
      if (k > 1) k = 1;
      if (an.kind === 'move') {
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = an.from.x + (an.to.x - an.from.x) * e;
        const z = an.from.y + (an.to.y - an.from.y) * e;
        const hop = Math.sin(Math.PI * e) * 0.28;
        an.obj.group.position.set(x, hop, z);
      } else if (an.kind === 'capture') {
        const s = Math.max(0.001, 1 - k);
        an.obj.group.scale.setScalar(s);
        an.obj.group.rotation.y += dt * 8;
        an.obj.group.position.y = k * 0.35;
      }
      if (k >= 1) {
        if (an.onEnd) an.onEnd();
        this.anims.splice(i, 1);
      }
    }
  };

  /* ---------------- 高亮 ---------------- */
  Scene3D.prototype.setSelection = function (cell) {
    this.selectedCell = cell;
    if (!cell) {
      this.selRing.visible = false;
      return;
    }
    const w = cellToWorld(cell[0], cell[1]);
    this.selRing.position.set(w.x, 0.012, w.z);
    this.selRing.visible = true;
  };

  Scene3D.prototype.setLegalMoves = function (cells, board) {
    for (let i = 0; i < this.markers.length; i++) {
      const mk = this.markers[i];
      if (i < cells.length) {
        const t = cells[i];
        const w = cellToWorld(t[0], t[1]);
        const isCapture = board && board.grid[t[1]][t[0]] !== null;
        mk.group.position.set(w.x, 0, w.z);
        mk.group.visible = true;
        mk.dot.visible = !isCapture;
        mk.ring.visible = isCapture;
      } else {
        mk.group.visible = false;
      }
    }
  };

  Scene3D.prototype.setCheck = function (cell) {
    if (!cell) { this.checkRing.visible = false; return; }
    const w = cellToWorld(cell[0], cell[1]);
    this.checkRing.position.set(w.x, 0.014, w.z);
    this.checkRing.visible = true;
  };

  Scene3D.prototype.setHover = function (cell) {
    this.hoverCell = cell;
    if (!cell) { this.hovRing.visible = false; return; }
    const w = cellToWorld(cell[0], cell[1]);
    this.hovRing.position.set(w.x, 0.010, w.z);
    this.hovRing.visible = true;
  };

  /* ---------------- 棋子形象（模型 / 模型+标牌 / 汉字） ---------------- */
  Scene3D.prototype.setPieceStyle = function (style) {
    if (!style || style === this.pieceStyle) return;
    this.pieceStyle = style;
    this.protos = {};
    if (this._board) this.rebuild(this._board);
    this.setPlaquesVisible(this.plaquesOn);
    this.setCaptured(this._captured);
  };

  /* ---------------- 战果：棋盘外右侧摆放被吃的棋子 ---------------- */
  Scene3D.prototype.setCaptured = function (caps) {
    this._captured = caps || { red: [], black: [] };
    const root = this.capRoot;
    while (root.children.length) root.remove(root.children[0]);
    const self = this;
    [['red', 1], ['black', -1]].forEach(function (p) {
      const owner = p[0];   // 吃棋方
      const dir = p[1];     // +1 红方半场(+Z) / -1 黑方半场(-Z)
      const list = self._captured[owner] || [];
      for (let i = 0; i < list.length && i < 20; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const item = self._makeCapturedItem(list[i], owner);
        item.position.set(5.30 + col * 0.47, 0.01, dir * (1.70 + row * 0.76));
        root.add(item);
      }
    });
  };

  // 单个战果棋子：不论棋子形象设置，一律使用"汉字"样式的扁圆柱体小棋子（立放）
  Scene3D.prototype._makeCapturedItem = function (type, owner) {
    const pieceSide = (owner === 'red') ? 'black' : 'red';
    const outer = new THREE.Group();
    const flat = P.buildFlatPiece(type, pieceSide, this._charOf(type, pieceSide));
    const g = flat.group || flat;
    g.scale.setScalar(0.62);
    outer.add(g);
    outer.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return outer;
  };

  Scene3D.prototype.setPlaquesVisible = function (v) {
    const self = this;
    Object.keys(this.pieces).forEach(function (k) {
      const grp = self.pieces[k].group;
      grp.children.forEach(function (ch) { if (ch.isSprite) ch.visible = v; });
    });
    this.plaquesOn = v;
    Object.keys(this.protos).forEach(function (k) {
      self.protos[k].children.forEach(function (ch) { if (ch.isSprite) ch.visible = v; });
    });
  };

  /* ---------------- 相机 ---------------- */
  Scene3D.prototype._fitRadius = function (phi) {
    const fov = this.camera.fov * Math.PI / 180;
    const aspect = this.camera.aspect || 1;
    const vExtent = BOARD_D * Math.max(0.45, Math.sin(phi)) + 1.4;
    const hExtent = BOARD_W + 0.9;
    const dV = (vExtent / 2) / Math.tan(fov / 2);
    const dH = (hExtent / 2) / (Math.tan(fov / 2) * aspect);
    // 斜视时近端棋子更容易出画，边距随倾角自适应
    let k = (Math.PI / 2 - phi) / (Math.PI / 4);
    k = Math.max(0, Math.min(1, k));
    return Math.max(dV, dH) * (1.05 + 0.16 * k) * this.zoom;
  };

  Scene3D.prototype._startTween = function (to, dur) {
    this._tween = {
      t: 0,
      dur: dur || 0.85,
      from: { theta: this.cam.theta, phi: this.cam.phi, r: this.cam.r },
      to: { theta: to.theta, phi: to.phi, r: to.r },
    };
    this.camTarget = { theta: to.theta, phi: to.phi, r: to.r };
  };

  // 阵营基准角：红方 0（相机在 +Z 侧），黑方 π（相机在 -Z 侧）
  Scene3D.prototype._baseTheta = function (side) {
    return (side === 'black') ? Math.PI : 0;
  };

  // 取与 base 同余、且离当前角度最近的值（保证最短路径 + 立场绝对正确）
  Scene3D.prototype._nearestEquivalent = function (base) {
    const cur = this.cam.theta;
    let x = base;
    while (x - cur > Math.PI) x -= Math.PI * 2;
    while (x - cur < -Math.PI) x += Math.PI * 2;
    return x;
  };

  // 补间结束后把角度吸附到基准角，避免长时间来回切换后累积漂移
  Scene3D.prototype._snapTheta = function () {
    if (this.viewMode === 'top') return;
    const t = this._nearestEquivalent(this._baseTheta(this.viewSide || 'red'));
    this.cam.theta = t;
    this.camTarget.theta = t;
  };

  Scene3D.prototype.setView = function (mode, side) {
    const phi = (mode === 'top') ? Math.PI / 2 : Math.PI / 4;
    let theta;
    if (side) this.viewSide = side;
    else side = this.viewSide || 'red';
    if (mode === 'top') {
      // 正俯视时 theta 无视觉意义，改用 up 向量翻转表达「走棋方朝下」
      theta = this._nearestEquivalent(this._baseTheta(side));
      this._startUpTween(side === 'black' ? Math.PI : 0, 0.7);
    } else {
      theta = this._nearestEquivalent(this._baseTheta(side));
      this._startUpTween(0, 0.5);
    }
    this.viewMode = mode;
    this._startTween({ theta: theta, phi: phi, r: this._fitRadius(phi) }, mode === 'top' ? 0.7 : 0.95);
  };

  // up 向量绕 Y 轴翻转的补间（与相机补间并行，俯视随走棋方切换时平滑翻转）
  Scene3D.prototype._startUpTween = function (to, dur) {
    this._upTween = { t: 0, dur: dur || 0.7, from: this.upBeta, to: to };
  };

  // 当前相机所处的阵营（用于外部判断立场是否正确）
  Scene3D.prototype.currentSide = function () {
    const c = Math.cos(this.cam.theta % (Math.PI * 2));
    return c >= 0 ? 'red' : 'black';
  };

  Scene3D.prototype.flip = function () {
    this.viewSide = (this.viewSide === 'red') ? 'black' : 'red';
    if (this.viewMode === 'top') {
      this.viewMode = 'angle';
    }
    const phi = Math.PI / 4;
    const theta = this._nearestEquivalent(this._baseTheta(this.viewSide));
    this._startTween({ theta: theta, phi: phi, r: this._fitRadius(phi) }, 0.95);
  };

  Scene3D.prototype.setZoom = function (z) {
    this.zoom = Math.max(0.5, Math.min(1.9, z));
    const phi = this.camTarget.phi;
    this._startTween({ theta: this.camTarget.theta, phi: phi, r: this._fitRadius(phi) }, 0.35);
  };

  Scene3D.prototype.orbit = function (dTheta, dPhi) {
    // 拖拽为即时响应：取消进行中的补间
    this._tween = null;
    let theta = this.camTarget.theta - dTheta;
    while (theta > Math.PI) theta -= Math.PI * 2;
    while (theta <= -Math.PI) theta += Math.PI * 2;
    let phi = Math.max(0.32, Math.min(Math.PI / 2, this.camTarget.phi + dPhi));
    const r = this._fitRadius(phi);
    this.camTarget = { theta: theta, phi: phi, r: r };
    this.cam = { theta: theta, phi: phi, r: r };
    // 俯视时方位角没有"站在哪一方"的意义，不要刷新立场，避免切回 45° 时立场错乱
    if (this.viewMode !== 'top') {
      this.viewSide = Math.cos(theta) >= 0 ? 'red' : 'black';
    }
  };

  Scene3D.prototype._updateCamera = function (dt) {
    if (this._tween) {
      const tw = this._tween;
      tw.t += dt;
      let k = tw.t / tw.dur;
      if (k >= 1) k = 1;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.cam.theta = tw.from.theta + (tw.to.theta - tw.from.theta) * e;
      this.cam.phi = tw.from.phi + (tw.to.phi - tw.from.phi) * e;
      this.cam.r = tw.from.r + (tw.to.r - tw.from.r) * e;
      if (k >= 1) {
        this._tween = null;
        this._snapTheta();
      }
    } else {
      this.cam.theta = this.camTarget.theta;
      this.cam.phi = this.camTarget.phi;
      this.cam.r = this.camTarget.r;
    }

    // up 向量翻转补间
    if (this._upTween) {
      const ut = this._upTween;
      ut.t += dt;
      let k = ut.t / ut.dur;
      if (k >= 1) k = 1;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.upBeta = ut.from + (ut.to - ut.from) * e;
      if (k >= 1) this._upTween = null;
    }

    const R = this.cam.r, phi = this.cam.phi, th = this.cam.theta;
    this.camera.position.set(
      R * Math.cos(phi) * Math.sin(th),
      R * Math.sin(phi),
      R * Math.cos(phi) * Math.cos(th)
    );
    // 俯视时 up 由 (0,1,0) 平滑过渡到接近水平；再绕 Y 轴按 upBeta 翻转，
    // 使「走棋方朝下」（红方在下 upBeta=0，黑方在下 upBeta=PI），实现 90° 也随走棋方切换
    let a = (phi - Math.PI / 4) / (Math.PI / 2 - Math.PI / 4);
    a = Math.max(0, Math.min(1, a));
    a = a * a * (3 - 2 * a) * Math.PI / 2;
    const sa = Math.sin(a), b = this.upBeta;
    this.camera.up.set(-sa * Math.sin(b), Math.cos(a), -sa * Math.cos(b));
    this.camera.lookAt(0, 0.15, 0);
  };

  /* ---------------- 拾取 ---------------- */
  Scene3D.prototype.pickDetailed = function (clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);

    let pieceCell = null;
    const hits = this.raycaster.intersectObjects(this.pieceRoot.children, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o) {
        if (o.userData && o.userData.cell) { pieceCell = o.userData.cell.slice(); break; }
        o = o.parent;
      }
      if (pieceCell) break;
    }

    let groundCell = null;
    const gh = this.raycaster.intersectObject(this.pickPlane, false);
    if (gh.length) {
      const p = gh[0].point;
      const c = Math.round(p.x / CELL + 4);
      const r = Math.round(p.z / CELL + 4.5);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) groundCell = [c, r];
    }
    return { pieceCell: pieceCell, groundCell: groundCell };
  };

  Scene3D.prototype.pick = function (clientX, clientY) {
    const d = this.pickDetailed(clientX, clientY);
    return d.pieceCell || d.groundCell;
  };

  /* ---------------- 循环 ---------------- */
  Scene3D.prototype._loop = function () {
    const raw = this.clock.getDelta();
    this._updateCamera(Math.min(raw, 0.25));   // 相机补间用真实时长，低帧率也能按时完成
    this._updateAnims(Math.min(raw, 0.05));

    // 选中棋子轻微浮动
    if (this.selectedCell) {
      const key = this.selectedCell[0] + ',' + this.selectedCell[1];
      const pc = this.pieces[key];
      if (pc && !this._isAnimating(pc)) {
        const t = this.clock.elapsedTime;
        pc.group.position.y = 0.06 + Math.sin(t * 4.2) * 0.022;
      }
    }
    // 未选中的棋子回落到 0
    const self = this;
    Object.keys(this.pieces).forEach(function (k) {
      const pc = self.pieces[k];
      const isSel = self.selectedCell && (self.selectedCell[0] + ',' + self.selectedCell[1]) === k;
      if (!isSel && !self._isAnimating(pc) && pc.group.position.y !== 0) {
        pc.group.position.y = 0;
      }
    });

    this.renderer.render(this.scene, this.camera);
  };

  Scene3D.prototype._isAnimating = function (pc) {
    for (let i = 0; i < this.anims.length; i++) {
      if (this.anims[i].obj === pc) return true;
    }
    return false;
  };

  Scene3D.prototype.resize = function () {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.camTarget.r = this._fitRadius(this.camTarget.phi);
    if (!this._tween) this.cam.r = this.camTarget.r;
  };

  Scene3D.prototype.isBusy = function () {
    return this.anims.length > 0;
  };

  window.XiangqiScene3D = Scene3D;
})();
