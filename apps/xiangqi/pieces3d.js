'use strict';
/* ============================================================
 * pieces3d.js — 心奇学象棋 卡通 3D 棋子
 *   - 三种形象：model / model_char / char
 *   - 整体压暗配色，帝王(K)改为坐像 + 印玺
 *   - 汉字样式：边角圆润的扁圆柱 + 隶书汉字
 * 所有模型以「脚底 y=0、正面朝 +Z」构建，由 buildPiece 负责转向。
 * ============================================================ */
(function () {
  const THREE = window.THREE;

  /* ---------------- 调色板（整体压暗 25%~35%） ---------------- */
  const C = {
    skin: 0xc49978,
    hair: 0x1d1814,
    redMain: 0xa8392b, redDark: 0x722018, redSoft: 0xb8604a,
    blkMain: 0x333b46, blkDark: 0x1d232b, blkSoft: 0x4d5563,
    gold: 0xc79a40, goldDark: 0x86601a,
    bronze: 0x9c7340, bronzeDark: 0x664322,
    steel: 0xb6bbc2, steelDark: 0x707680,
    wood: 0x82582a, woodDark: 0x553718, woodLight: 0x946230,
    horse: 0x80542a, horseDark: 0x4a2f17,
    cream: 0xd8c8a2, white: 0xe8e0c6,
    jade: 0x5a8278,
    ribbon: 0x648aa0,
    outline: 0x1a0f08,
  };

  const BASE_TOP = 0.105;
  const MODEL_SCALE = 1.35;

  // 含坐像、王座后的总高（脚底到头顶）
  const FIGURE_H = { P: 0.62, R: 0.52, N: 0.74, C: 0.64, B: 0.76, A: 0.78, K: 1.08 };
  const FLAT_H = 0.18;   // 汉字样式扁圆柱厚度

  /* ---------------- 卡通材质 ---------------- */
  let GRAD = null;
  function gradMap() {
    if (GRAD) return GRAD;
    const data = new Uint8Array([74, 148, 208, 255]);
    GRAD = new THREE.DataTexture(data, 4, 1, THREE.LuminanceFormat);
    GRAD.minFilter = THREE.NearestFilter;
    GRAD.magFilter = THREE.NearestFilter;
    GRAD.generateMipmaps = false;
    GRAD.needsUpdate = true;
    return GRAD;
  }
  function toonMat(color) {
    if (THREE.MeshToonMaterial) return new THREE.MeshToonMaterial({ color: color, gradientMap: gradMap() });
    return new THREE.MeshLambertMaterial({ color: color, flatShading: true });
  }

  /* ---------------- 基础几何体 ---------------- */
  function boxM(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color)); }
  function cylM(rt, rb, h, color, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 14), toonMat(color)); }
  function sphM(r, color, w, h) { return new THREE.Mesh(new THREE.SphereGeometry(r, w || 14, h || 10), toonMat(color)); }
  function coneM(r, h, color, seg) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 12), toonMat(color)); }
  function domeM(r, color, frac, seg) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 14, 7, 0, Math.PI * 2, 0, Math.PI * (frac || 0.55)), toonMat(color));
  }
  function bandM(r, h, color) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14, 1, true), toonMat(color)); }
  function discM(r, h, color) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), toonMat(color)); }

  /* ---------------- 描边 ---------------- */
  let OUT_MAT = null;
  function outlineMat() {
    if (!OUT_MAT) OUT_MAT = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });
    return OUT_MAT;
  }
  function addOutline(parent, m, t) {
    if (!t) return null;
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const s = new THREE.Vector3();
    g.boundingBox.getSize(s);
    const o = new THREE.Mesh(g, outlineMat());
    const sx = Math.max(s.x * m.scale.x, 1e-3);
    const sy = Math.max(s.y * m.scale.y, 1e-3);
    const sz = Math.max(s.z * m.scale.z, 1e-3);
    o.scale.set(m.scale.x * (sx + 2 * t) / sx, m.scale.y * (sy + 2 * t) / sy, m.scale.z * (sz + 2 * t) / sz);
    o.position.copy(m.position);
    o.quaternion.copy(m.quaternion);
    parent.add(o);
    return o;
  }
  function part(parent, m, t) {
    parent.add(m);
    if (t) addOutline(parent, m, t);
    return m;
  }

  /* ---------------- 通用部件 ---------------- */
  function legs(g, o) {
    for (let i = -1; i <= 1; i += 2) {
      const l = cylM(o.r || 0.035, (o.r || 0.035) * 1.15, o.h, o.color, 10);
      l.position.set(i * (o.spread || 0.05), o.h / 2, 0);
      part(g, l, 0.007);
    }
  }
  function torso(g, o) {
    const t = cylM(o.rt, o.rb, o.h, o.color, 14);
    t.position.y = o.y;
    part(g, t, 0.010);
    return t;
  }
  function belt(g, r, y, color) {
    const b = cylM(r, r, 0.032, color || C.goldDark, 14);
    b.position.y = y;
    part(g, b, 0.005);
  }
  function arm(g, o) {
    const a = cylM(o.r || 0.026, o.r || 0.026, o.len, o.color, 10);
    a.position.set(o.x, o.y - o.len / 2, o.z || 0);
    if (o.rotX) a.rotation.x = o.rotX;
    if (o.rotZ) a.rotation.z = o.rotZ;
    part(g, a, 0.006);
    return a;
  }
  function shoulder(g, x, y, r, color) {
    const s = sphM(r, color, 10, 8);
    s.position.set(x, y, 0);
    part(g, s, 0.006);
  }

  /* ---------------- 头部（支持发式/冠冕/胄/纶巾/王冠） ---------------- */
  function head(g, o) {
    const y = o.y, r = o.r;
    const skin = o.skin || C.skin;
    const hair = o.hair || C.hair;

    const h = sphM(r, skin, 14, 12);
    h.position.y = y;
    part(g, h, 0.009);

    // 头发（上半球）
    const dome = domeM(r * 1.05, hair, 0.56, 14);
    dome.position.y = y + r * 0.05;
    part(g, dome, 0.009);

    if (o.hat === 'bun' || !o.hat) {
      const knot = sphM(r * 0.40, hair, 10, 8);
      knot.position.set(0, y + r * 1.00, -r * 0.16);
      part(g, knot, 0.006);
      const bd = bandM(r * 1.00, r * 0.24, o.accent || C.redDark);
      bd.position.y = y + r * 0.50;
      part(g, bd, 0.004);
    } else if (o.hat === 'scarf') {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.20, r * 0.74, 14, 1, true), toonMat(o.accent));
      sc.position.y = y + r * 0.60;
      part(g, sc, 0.007);
      const cap = domeM(r * 1.02, o.accent, 0.5, 14);
      cap.position.y = y + r * 0.96;
      part(g, cap, 0.006);
      for (let i = -1; i <= 1; i += 2) {
        const tail = boxM(r * 0.16, r * 0.85, 0.022, o.accent);
        tail.position.set(i * r * 0.72, y - r * 0.25, -r * 0.42);
        tail.rotation.z = i * 0.22;
        part(g, tail, 0.004);
      }
    } else if (o.hat === 'helm') {
      const hm = domeM(r * 1.16, o.accent || C.bronze, 0.58, 14);
      hm.position.y = y + r * 0.14;
      part(g, hm, 0.010);
      const rim = bandM(r * 1.17, r * 0.18, o.accent2 || C.gold);
      rim.position.y = y + r * 0.18;
      part(g, rim, 0.005);
      const crest = coneM(r * 0.20, r * 0.75, o.crest || C.redMain, 8);
      crest.position.set(0, y + r * 1.28, 0);
      part(g, crest, 0.006);
    } else if (o.hat === 'crown') {
      // 冠 + 冕板 + 旒（前后两排）
      const band = bandM(r * 1.06, r * 0.34, C.goldDark);
      band.position.y = y + r * 0.56;
      part(g, band, 0.005);
      const board = boxM(r * 1.95, r * 0.14, r * 1.15, C.gold);
      board.position.y = y + r * 1.06;
      part(g, board, 0.006);
      // 前后旒珠
      for (let i = -1; i <= 1; i++) {
        for (let k = 0; k < 3; k++) {
          for (let sgn = -1; sgn <= 1; sgn += 2) {
            const bead = sphM(r * 0.105, 0xd9c69a, 8, 6);
            bead.position.set(i * r * 0.46, y + r * 0.78 - k * r * 0.24, sgn * r * 0.92);
            g.add(bead);
          }
        }
      }
    }

    for (let i = -1; i <= 1; i += 2) {
      const e = sphM(r * 0.115, 0x1c1410, 8, 6);
      e.position.set(i * r * 0.34, y + r * 0.10, r * 0.90);
      g.add(e);
    }
    if (o.fierce) {
      for (let i = -1; i <= 1; i += 2) {
        const b = boxM(r * 0.36, r * 0.10, r * 0.12, hair);
        b.position.set(i * r * 0.34, y + r * 0.32, r * 0.80);
        b.rotation.z = i * -0.45;
        g.add(b);
      }
    }
    if (o.beard) {
      const bd = coneM(r * 0.46, r * 1.05, o.beardColor || hair, 10);
      bd.rotation.x = Math.PI;
      bd.position.set(0, y - r * 0.62, r * 0.42);
      part(g, bd, 0.006);
      for (let i = -1; i <= 1; i += 2) {
        const m = boxM(r * 0.30, r * 0.08, r * 0.12, o.beardColor || hair);
        m.position.set(i * r * 0.26, y - r * 0.26, r * 0.76);
        m.rotation.z = i * 0.38;
        g.add(m);
      }
    }
    return y + r * 2.0;
  }

  function poleWeapon(g, o) {
    const w = new THREE.Group();
    const grip = o.grip != null ? o.grip : 0.35;
    const pole = cylM(0.012, 0.014, o.len, o.poleColor || C.woodDark, 8);
    pole.position.y = o.len * (0.5 - grip);
    part(w, pole, 0.004);
    const topY = o.len * (1 - grip);
    const neck = boxM(0.030, 0.10, 0.018, C.bronze);
    neck.position.y = topY + 0.03;
    part(w, neck, 0.003);
    if (o.kind === 'spear') {
      const blade = coneM(0.030, 0.16, C.steel, 8);
      blade.position.y = topY + 0.15;
      part(w, blade, 0.004);
    } else if (o.kind === 'axe') {
      const blade = boxM(0.17, 0.11, 0.018, C.bronze);
      blade.position.set(0.055, topY + 0.05, 0);
      part(w, blade, 0.004);
      const back = boxM(0.05, 0.06, 0.018, C.bronzeDark);
      back.position.set(-0.055, topY + 0.05, 0);
      part(w, back, 0.003);
    } else {
      const blade = boxM(0.115, 0.045, 0.016, C.bronze);
      blade.position.set(0.05, topY + 0.045, 0);
      part(w, blade, 0.003);
      const tip = coneM(0.024, 0.07, C.bronze, 6);
      tip.rotation.z = -Math.PI / 2;
      tip.position.set(0.135, topY + 0.045, 0);
      part(w, tip, 0.003);
    }
    w.position.set(o.x, o.y, o.z || 0);
    if (o.rotX) w.rotation.x = o.rotX;
    if (o.rotZ) w.rotation.z = o.rotZ;
    g.add(w);
    return w;
  }

  function wheelX(g, o) {
    const w = new THREE.Group();
    const t = o.t || 0.024;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(o.r, t, 6, 18), toonMat(o.color));
    rim.rotation.y = Math.PI / 2;
    part(w, rim, 0.006);
    const hub = cylM(o.r * 0.22, o.r * 0.22, t * 1.8, o.hub || C.woodDark, 10);
    hub.rotation.z = Math.PI / 2;
    part(w, hub, 0.005);
    const spokes = o.spokes != null ? o.spokes : 6;
    for (let i = 0; i < spokes; i++) {
      const s = boxM(t * 0.8, o.r * 1.8, t * 0.8, o.spokeColor || o.color);
      s.rotation.x = (Math.PI / spokes) * i;
      w.add(s);
    }
    w.position.set(o.x, o.y, o.z || 0);
    g.add(w);
    return w;
  }

  /* ============================================================
   * 兵 / 卒 —— 小号 · 持长戈的朴素步兵
   * ============================================================ */
  function buildPawn(side) {
    const g = new THREE.Group();
    const cloth = side === 'red' ? 0x8a4830 : 0x424751;
    const dark = side === 'red' ? 0x5d2e1c : 0x2d323a;
    const accent = side === 'red' ? C.redDark : C.blkDark;

    legs(g, { h: 0.12, spread: 0.048, color: dark });
    torso(g, { y: 0.12 + 0.10, h: 0.20, rt: 0.072, rb: 0.095, color: cloth });
    belt(g, 0.098, 0.155, accent);
    shoulder(g, -0.082, 0.285, 0.038, cloth);
    shoulder(g, 0.082, 0.285, 0.038, cloth);
    arm(g, { x: -0.082, y: 0.285, len: 0.15, color: cloth, rotZ: 0.22 });
    arm(g, { x: 0.082, y: 0.285, len: 0.15, color: cloth, rotZ: -0.30, rotX: -0.35 });
    head(g, { y: 0.40, r: 0.082, hat: 'bun', accent: accent });
    poleWeapon(g, { x: 0.105, y: 0.20, z: 0.02, len: 0.52, rotZ: 0.20, rotX: -0.16, kind: 'dagger' });
    return g;
  }

  /* 车 —— 中号 · 春秋双人战车 */
  function buildChariot(side) {
    const g = new THREE.Group();
    const wood = C.wood, woodD = C.woodDark;
    const cloth = side === 'red' ? C.redMain : C.blkMain;
    const accent = side === 'red' ? C.redDark : C.blkDark;

    const floor = boxM(0.30, 0.030, 0.24, wood);
    floor.position.y = 0.185;
    part(g, floor, 0.006);
    const railF = boxM(0.30, 0.085, 0.022, woodD);
    railF.position.set(0, 0.235, 0.118);
    part(g, railF, 0.005);
    for (let i = -1; i <= 1; i += 2) {
      const rs = boxM(0.022, 0.085, 0.24, woodD);
      rs.position.set(i * 0.148, 0.235, 0);
      part(g, rs, 0.005);
    }
    const axle = cylM(0.018, 0.018, 0.40, woodD, 10);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.135, -0.02);
    part(g, axle, 0.005);
    for (let i = -1; i <= 1; i += 2) {
      wheelX(g, { x: i * 0.195, y: 0.135, z: -0.02, r: 0.135, color: woodD, spokeColor: wood, spokes: 6 });
    }
    const pole = boxM(0.032, 0.026, 0.30, woodD);
    pole.position.set(0, 0.20, 0.255);
    part(g, pole, 0.004);
    const yoke = boxM(0.26, 0.024, 0.026, woodD);
    yoke.position.set(0, 0.20, 0.395);
    part(g, yoke, 0.004);
    const rider1 = smallRider(cloth, accent, side, true);
    rider1.position.set(0.075, 0.20, 0.045);
    g.add(rider1);
    const rider2 = smallRider(cloth, accent, side, false);
    rider2.position.set(-0.075, 0.20, -0.06);
    rider2.rotation.y = Math.PI;
    g.add(rider2);
    const flagPole = cylM(0.008, 0.008, 0.26, C.woodDark, 6);
    flagPole.position.set(-0.13, 0.32, -0.10);
    part(g, flagPole, 0.003);
    const flag = boxM(0.10, 0.065, 0.008, side === 'red' ? C.redMain : C.blkMain);
    flag.position.set(-0.082, 0.42, -0.10);
    part(g, flag, 0.003);
    return g;
  }
  function smallRider(cloth, accent, side, withWeapon) {
    const g = new THREE.Group();
    const t = cylM(0.045, 0.058, 0.13, cloth, 12);
    t.position.y = 0.065;
    part(g, t, 0.006);
    head(g, { y: 0.165, r: 0.055, hat: 'bun', accent: accent });
    arm(g, { x: -0.055, y: 0.115, len: 0.09, color: cloth, rotZ: 0.35 });
    arm(g, { x: 0.055, y: 0.115, len: 0.09, color: cloth, rotZ: -0.35 });
    if (withWeapon) {
      poleWeapon(g, { x: 0.075, y: 0.06, len: 0.30, rotZ: 0.26, kind: 'dagger' });
    } else {
      const rein = boxM(0.12, 0.012, 0.012, C.woodDark);
      rein.position.set(0, 0.10, 0.07);
      g.add(rein);
    }
    return g;
  }

  /* 马 —— 中号 · 持长矛的骑马骑士 */
  function buildHorse(side) {
    const g = new THREE.Group();
    const hc = C.horse, hd = C.horseDark;
    const cloth = side === 'red' ? C.redMain : C.blkMain;
    const accent = side === 'red' ? C.redDark : C.blkDark;

    const body = boxM(0.135, 0.135, 0.32, hc);
    body.position.y = 0.295;
    part(g, body, 0.010);
    const chest = boxM(0.14, 0.12, 0.10, hc);
    chest.position.set(0, 0.30, 0.175);
    part(g, chest, 0.008);
    const neck = boxM(0.085, 0.17, 0.095, hc);
    neck.position.set(0, 0.40, 0.205);
    neck.rotation.x = 0.42;
    part(g, neck, 0.008);
    const headM = boxM(0.072, 0.072, 0.17, hc);
    headM.position.set(0, 0.475, 0.315);
    headM.rotation.x = -0.25;
    part(g, headM, 0.008);
    const muzzle = boxM(0.062, 0.055, 0.06, hd);
    muzzle.position.set(0, 0.455, 0.395);
    part(g, muzzle, 0.005);
    for (let i = -1; i <= 1; i += 2) {
      const ear = coneM(0.020, 0.05, hd, 6);
      ear.position.set(i * 0.030, 0.528, 0.255);
      g.add(ear);
    }
    const mane = boxM(0.032, 0.075, 0.20, hd);
    mane.position.set(0, 0.462, 0.175);
    mane.rotation.x = 0.42;
    part(g, mane, 0.005);
    const tail = boxM(0.038, 0.16, 0.045, hd);
    tail.position.set(0, 0.33, -0.185);
    tail.rotation.x = -0.45;
    part(g, tail, 0.005);
    const legPos = [[-0.05, 0.115], [0.05, 0.115], [-0.05, -0.115], [0.05, -0.115]];
    for (let i = 0; i < legPos.length; i++) {
      const l = boxM(0.038, 0.235, 0.042, hc);
      l.position.set(legPos[i][0], 0.1175, legPos[i][1]);
      part(g, l, 0.006);
      const hoof = boxM(0.044, 0.030, 0.048, C.horseDark);
      hoof.position.set(legPos[i][0], 0.015, legPos[i][1]);
      part(g, hoof, 0.004);
    }
    const saddle = boxM(0.15, 0.035, 0.16, accent);
    saddle.position.set(0, 0.375, 0.01);
    part(g, saddle, 0.005);

    const r = new THREE.Group();
    legs(r, { h: 0.055, spread: 0.055, color: accent, r: 0.030 });
    torso(r, { y: 0.115, h: 0.13, rt: 0.058, rb: 0.072, color: cloth });
    belt(r, 0.074, 0.068, C.goldDark);
    shoulder(r, -0.072, 0.16, 0.030, cloth);
    shoulder(r, 0.072, 0.16, 0.030, cloth);
    arm(r, { x: -0.072, y: 0.16, len: 0.11, color: cloth, rotZ: 0.55, rotX: -0.5 });
    arm(r, { x: 0.072, y: 0.16, len: 0.11, color: cloth, rotZ: -0.45 });
    head(r, { y: 0.235, r: 0.062, hat: 'helm', accent: C.bronze, accent2: C.gold, crest: side === 'red' ? C.redMain : C.blkSoft });
    poleWeapon(r, { x: 0.095, y: 0.12, z: 0.03, len: 0.52, rotZ: 0.16, rotX: -0.30, kind: 'spear' });
    r.position.set(0, 0.395, 0.01);
    g.add(r);
    return g;
  }

  /* 炮 —— 中号 · 单人操作投石车 */
  function buildCannon(side) {
    const g = new THREE.Group();
    const wood = C.woodDark, woodL = C.wood;
    const cloth = side === 'red' ? C.redMain : C.blkMain;
    const accent = side === 'red' ? C.redDark : C.blkDark;

    for (let i = -1; i <= 1; i += 2) {
      const beam = boxM(0.040, 0.045, 0.34, wood);
      beam.position.set(i * 0.10, 0.075, 0);
      part(g, beam, 0.005);
    }
    for (let i = -1; i <= 1; i += 2) {
      const cb = boxM(0.24, 0.035, 0.035, wood);
      cb.position.set(0, 0.075, i * 0.14);
      part(g, cb, 0.005);
    }
    for (let i = -1; i <= 1; i += 2) {
      wheelX(g, { x: i * 0.135, y: 0.085, z: -0.05, r: 0.085, color: wood, spokeColor: woodL, spokes: 6 });
    }
    for (let i = -1; i <= 1; i += 2) {
      const legA = boxM(0.035, 0.34, 0.035, woodL);
      legA.position.set(i * 0.085, 0.235, 0.02);
      legA.rotation.z = i * 0.30;
      part(g, legA, 0.005);
    }
    const axle = cylM(0.020, 0.020, 0.24, C.bronze, 10);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.385, 0.02);
    part(g, axle, 0.004);
    const armG = new THREE.Group();
    const beam = boxM(0.038, 0.46, 0.038, woodL);
    beam.position.y = 0.20;
    part(armG, beam, 0.005);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.07, 12, 1, true), toonMat(0x4d3320));
    cup.position.y = 0.42;
    part(armG, cup, 0.004);
    const stone = sphM(0.042, 0x6a6a72, 10, 8);
    stone.position.y = 0.44;
    part(armG, stone, 0.004);
    const cw = boxM(0.085, 0.085, 0.085, C.bronze);
    cw.position.y = -0.10;
    part(armG, cw, 0.004);
    armG.position.set(0, 0.385, 0.02);
    armG.rotation.x = 0.85;
    g.add(armG);
    const winch = cylM(0.038, 0.038, 0.10, C.bronze, 10);
    winch.rotation.z = Math.PI / 2;
    winch.position.set(0, 0.15, -0.14);
    part(g, winch, 0.004);

    const op = new THREE.Group();
    legs(op, { h: 0.075, spread: 0.045, color: accent, r: 0.030 });
    torso(op, { y: 0.145, h: 0.14, rt: 0.062, rb: 0.078, color: cloth });
    belt(op, 0.080, 0.095, C.goldDark);
    arm(op, { x: -0.072, y: 0.185, len: 0.12, color: cloth, rotZ: 0.45 });
    arm(op, { x: 0.072, y: 0.185, len: 0.12, color: cloth, rotZ: -0.75, rotX: -0.5 });
    head(op, { y: 0.275, r: 0.066, hat: 'bun', accent: accent });
    op.position.set(0, 0, -0.20);
    g.add(op);
    return g;
  }

  /* 相 / 象 —— 大号 · 羽扇纶巾的文官 */
  function buildElephant(side) {
    const g = new THREE.Group();
    const robe = side === 'red' ? 0x8a3c25 : 0x325265;
    const robeD = side === 'red' ? 0x6c2f1c : 0x22384a;
    const trim = side === 'red' ? C.gold : C.steel;
    const scarf = C.ribbon;

    const robeM = cylM(0.088, 0.165, 0.50, robe, 16);
    robeM.position.y = 0.25;
    part(g, robeM, 0.011);
    const hem = cylM(0.168, 0.172, 0.055, robeD, 16);
    hem.position.y = 0.028;
    part(g, hem, 0.007);
    const collar = boxM(0.115, 0.075, 0.03, C.cream);
    collar.position.set(0, 0.44, 0.072);
    part(g, collar, 0.004);
    belt(g, 0.116, 0.30, trim);
    const buckle = boxM(0.05, 0.05, 0.03, C.gold);
    buckle.position.set(0, 0.30, 0.105);
    part(g, buckle, 0.003);
    for (let i = -1; i <= 1; i += 2) {
      const sleeve = coneM(0.075, 0.20, robe, 10);
      sleeve.rotation.x = Math.PI;
      sleeve.rotation.z = i * 0.30;
      sleeve.position.set(i * 0.115, 0.34, 0);
      part(g, sleeve, 0.006);
    }
    const handL = sphM(0.040, C.skin, 10, 8);
    handL.position.set(-0.085, 0.295, 0.075);
    part(g, handL, 0.004);
    const handR = sphM(0.040, C.skin, 10, 8);
    handR.position.set(0.100, 0.335, 0.085);
    part(g, handR, 0.004);

    head(g, { y: 0.60, r: 0.088, hat: 'scarf', accent: scarf });

    const fan = new THREE.Group();
    const fanFace = new THREE.Mesh(new THREE.CircleGeometry(0.115, 14, -1.05, 2.10), toonMat(C.white));
    fanFace.rotation.y = Math.PI / 2;
    part(fan, fanFace, 0.003);
    const fanRim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 6, 20, 2.10), toonMat(C.goldDark));
    fanRim.rotation.y = Math.PI / 2;
    fanRim.rotation.z = -1.05;
    part(fan, fanRim, 0.003);
    const handle = cylM(0.014, 0.014, 0.10, C.woodDark, 8);
    handle.position.y = -0.10;
    part(fan, handle, 0.003);
    fan.position.set(0.115, 0.375, 0.10);
    fan.rotation.z = -0.35;
    g.add(fan);
    return g;
  }

  /* 士 / 仕 —— 大号 · 左盾右剑的近卫精英 */
  function buildAdvisor(side) {
    const g = new THREE.Group();
    const armor = side === 'red' ? 0x8a3028 : 0x2c343f;
    const armorD = side === 'red' ? 0x63211a : 0x1c2229;
    const trim = C.gold;

    legs(g, { h: 0.14, spread: 0.055, color: armorD, r: 0.040 });
    const t = cylM(0.088, 0.105, 0.28, armor, 14);
    t.position.y = 0.28;
    part(g, t, 0.010);
    for (let i = 0; i < 3; i++) {
      const plate = cylM(0.100, 0.104, 0.018, armorD, 14);
      plate.position.y = 0.20 + i * 0.075;
      part(g, plate, 0.004);
    }
    for (let i = -1; i <= 1; i += 2) {
      const pad = sphM(0.055, armorD, 10, 8);
      pad.position.set(i * 0.100, 0.405, 0);
      part(g, pad, 0.006);
    }
    const cape = boxM(0.20, 0.30, 0.022, armorD);
    cape.position.set(0, 0.26, -0.10);
    cape.rotation.x = -0.10;
    part(g, cape, 0.006);
    belt(g, 0.108, 0.165, trim);
    shoulder(g, 0.095, 0.40, 0.042, armor);
    arm(g, { x: 0.095, y: 0.40, len: 0.17, color: armor, rotZ: -0.28 });
    const handR = sphM(0.038, C.skin, 10, 8);
    handR.position.set(0.135, 0.245, 0.03);
    part(g, handR, 0.004);
    shoulder(g, -0.095, 0.40, 0.042, armor);
    arm(g, { x: -0.095, y: 0.40, len: 0.16, color: armor, rotZ: 0.20 });

    head(g, { y: 0.50, r: 0.082, hat: 'helm', accent: C.bronze, accent2: trim, crest: side === 'red' ? C.redMain : C.blkSoft });

    const shield = new THREE.Group();
    const disc = cylM(0.125, 0.125, 0.028, side === 'red' ? 0x802b22 : 0x252c36, 18);
    disc.rotation.x = Math.PI / 2;
    part(shield, disc, 0.006);
    const boss = sphM(0.040, C.bronze, 10, 8);
    boss.position.z = 0.028;
    part(shield, boss, 0.004);
    const rimS = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.014, 6, 20), toonMat(C.gold));
    part(shield, rimS, 0.004);
    shield.position.set(-0.145, 0.30, 0.045);
    g.add(shield);

    const sword = new THREE.Group();
    const blade = boxM(0.030, 0.24, 0.012, C.steel);
    blade.position.y = 0.135;
    part(sword, blade, 0.004);
    const guard = boxM(0.075, 0.020, 0.022, C.gold);
    guard.position.y = 0.012;
    part(sword, guard, 0.003);
    const hilt = cylM(0.016, 0.016, 0.075, 0x4a2f1a, 8);
    hilt.position.y = -0.035;
    part(sword, hilt, 0.003);
    const pommel = sphM(0.022, C.gold, 8, 6);
    pommel.position.y = -0.075;
    part(sword, pommel, 0.003);
    sword.position.set(0.140, 0.245, 0.045);
    sword.rotation.z = -0.22;
    sword.rotation.x = -0.30;
    g.add(sword);
    return g;
  }

  /* ============================================================
   * 帝王（K） —— 坐于王座的帝王
   *   - 花纹长袍（金带宽袍）+ 冠冕
   *   - 坐姿：臀部坐于座面，小腿前伸下垂，双手搭在两侧扶手上
   *   - 刻意让身体宽度 < 扶手内宽、躯干 < 靠背前沿，避免背后/两侧穿模
   *   - 高于其他棋子（FIGURE_H.K = 1.10）
   * ============================================================ */

  // 沿两点连线画一个锥台（用于手臂/小腿等倾斜部件）
  function limb(parent, ax, ay, az, bx, by, bz, ra, rb, color, ol) {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = cylM(ra, rb, len, color, 12);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    part(parent, m, ol || 0.006);
    return m;
  }

  // 花纹长袍（坐姿下摆呈喇叭形垂到膝下）
  function patternedRobe(g, o) {
    const robe = o.robe, robeD = o.robeD, trim = o.trim, gold = o.gold;
    // 上身（窄，胸至腰）
    const up = cylM(0.088, 0.118, 0.30, robe, 18);
    up.position.set(0, 0.67, 0.0);
    part(g, up, 0.010);
    // 下摆（喇叭形，覆盖膝部，后沿控制在靠背之前）
    const lo = cylM(0.115, 0.152, 0.30, robe, 18);
    lo.position.set(0, 0.35, 0.02);
    part(g, lo, 0.010);
    // 花纹：上摆 + 下摆各 2 道金环带（直径略小于袍体避免外凸穿模）
    const rings = [
      { y: 0.52, r: 0.106 },
      { y: 0.60, r: 0.099 },
      { y: 0.40, r: 0.130 },
      { y: 0.29, r: 0.142 },
    ];
    for (let i = 0; i < rings.length; i++) {
      const bnd = cylM(rings[i].r, rings[i].r, 0.022, trim, 18);
      bnd.position.set(0, rings[i].y, 0.02);
      part(g, bnd, 0.004);
    }
    // 前襟：两条竖向金饰 + 交领
    for (let i = -1; i <= 1; i += 2) {
      const front = boxM(0.018, 0.42, 0.02, trim);
      front.position.set(i * 0.045, 0.66, 0.108);
      part(g, front, 0.003);
    }
    const lapel = boxM(0.13, 0.09, 0.024, robeD);
    lapel.position.set(0, 0.79, 0.082);
    lapel.rotation.x = -0.18;
    part(g, lapel, 0.004);
    // 玉带扣
    const belt = cylM(0.105, 0.105, 0.05, robeD, 18);
    belt.position.set(0, 0.535, 0.0);
    part(g, belt, 0.006);
    const buckle = boxM(0.075, 0.055, 0.03, gold);
    buckle.position.set(0, 0.535, 0.115);
    part(g, buckle, 0.003);
    // 龙纹胸饰（近似圆片 + 两侧菱形）
    const med = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 18), toonMat(gold));
    med.position.set(0, 0.70, 0.115);
    med.rotation.x = 0.35;
    g.add(med);
  }

  // 王座（坐板 + 靠背 + 双侧扶手，宽度刻意内收避免与帝王身体穿模）
  function throne(g, o) {
    const wood = o.wood, woodD = o.woodD, gold = o.gold;
    // —— 坐板（顶 y=0.40）——
    const seat = boxM(0.40, 0.07, 0.30, wood);
    seat.position.set(0, 0.365, 0.02);
    part(g, seat, 0.007);
    // 坐垫软包
    const cush = boxM(0.34, 0.05, 0.24, 0x7a2a20);
    cush.position.set(0, 0.43, 0.02);
    part(g, cush, 0.005);
    // 座侧垂板 + 四腿
    for (let i = -1; i <= 1; i += 2) {
      const skirt = boxM(0.40, 0.10, 0.03, woodD);
      skirt.position.set(0, 0.17, i * 0.13);
      part(g, skirt, 0.005);
      for (let j = -1; j <= 1; j += 2) {
        const leg = boxM(0.055, 0.14, 0.055, woodD);
        leg.position.set(i * 0.15, 0.07, j * 0.115);
        part(g, leg, 0.005);
      }
    }
    // —— 靠背（前沿 z=-0.13，躯干后沿约 z=-0.09，留间隙不穿模）——
    const back = boxM(0.40, 0.55, 0.05, wood);
    back.position.set(0, 0.65, -0.155);
    back.rotation.x = -0.05;
    part(g, back, 0.008);
    // 靠背金饰边
    const backTrim1 = boxM(0.42, 0.035, 0.055, gold);
    backTrim1.position.set(0, 0.90, -0.155);
    part(g, backTrim1, 0.004);
    const backTrim2 = boxM(0.42, 0.035, 0.055, gold);
    backTrim2.position.set(0, 0.45, -0.155);
    part(g, backTrim2, 0.004);
    // 靠背顶端龙首中饰
    const crest = boxM(0.16, 0.07, 0.06, gold);
    crest.position.set(0, 0.985, -0.155);
    part(g, crest, 0.004);
    const orb = sphM(0.055, gold, 10, 8);
    orb.position.set(0, 1.05, -0.155);
    part(g, orb, 0.003);
    // 靠背两侧立柱（兽头朝前）
    for (let i = -1; i <= 1; i += 2) {
      const post = boxM(0.06, 0.62, 0.06, wood);
      post.position.set(i * 0.21, 0.72, -0.155);
      part(g, post, 0.006);
      const beast = sphM(0.045, woodD, 10, 8);
      beast.position.set(i * 0.21, 1.05, -0.155);
      part(g, beast, 0.004);
      // 小耳/角
      for (let j = -1; j <= 1; j += 2) {
        const horn = coneM(0.012, 0.05, gold, 6);
        horn.position.set(i * 0.21 + j * 0.02, 1.09, -0.145);
        g.add(horn);
      }
    }
    // —— 双侧扶手（顶 y≈0.56；帝王前臂正好搭在上面）——
    for (let i = -1; i <= 1; i += 2) {
      const rail = boxM(0.055, 0.06, 0.24, woodD);
      rail.position.set(i * 0.20, 0.555, 0.04);
      part(g, rail, 0.006);
      const railTop = boxM(0.06, 0.018, 0.24, gold);
      railTop.position.set(i * 0.20, 0.594, 0.04);
      part(g, railTop, 0.003);
      // 前立柱支撑
      const postF = boxM(0.055, 0.30, 0.06, wood);
      postF.position.set(i * 0.20, 0.25, 0.14);
      part(g, postF, 0.006);
      // 扶手前端卷头
      const vol = sphM(0.04, gold, 10, 8);
      vol.position.set(i * 0.20, 0.60, 0.17);
      part(g, vol, 0.004);
    }
  }

  // 帝王（黑/红）：端正坐姿，双手搭扶手，花纹长袍+冠冕
  function buildEmperor(side) {
    const g = new THREE.Group();
    const isRed = side === 'red';
    const robe = isRed ? 0x8e2418 : 0x262c35;      // 袍色：红袍 / 黑袍
    const robeD = isRed ? 0x6c1a10 : 0x181c22;      // 深色（前襟/暗纹）
    const trim = isRed ? C.goldDark : C.gold;       // 金/暗金环带
    const gold = C.gold;

    // 王座（先放，人物随后叠在座面之上）
    throne(g, { wood: 0x4a2e18, woodD: 0x2e1b0d, gold: gold });

    // —— 坐姿人物（脚底 y≈0，臀部坐于座面 y=0.40 之上）——
    const body = new THREE.Group();
    // 双腿：大腿水平前伸到膝（z 0.05→0.13），小腿垂向地面，鞋前伸
    for (let i = -1; i <= 1; i += 2) {
      // 大腿（被下摆遮住大半，仍给出体量）
      const thigh = boxM(0.075, 0.075, 0.10, robeD);
      thigh.position.set(i * 0.05, 0.42, 0.075);
      part(body, thigh, 0.004);
      // 小腿
      limb(body, i * 0.055, 0.44, 0.12, i * 0.055, 0.10, 0.13, 0.035, 0.038, robeD, 0.004);
      // 鞋（前伸，黑靴）
      const shoe = boxM(0.075, 0.045, 0.12, 0x1c1208);
      shoe.position.set(i * 0.055, 0.045, 0.185);
      part(body, shoe, 0.004);
    }
    // 花纹长袍（盖住腰以下，垂至小腿上部）
    patternedRobe(body, { robe: robe, robeD: robeD, trim: trim, gold: gold });
    // 颈
    const neck = cylM(0.032, 0.042, 0.09, C.skin, 10);
    neck.position.set(0, 0.855, 0.0);
    part(body, neck, 0.004);
    // 头（戴冠冕）
    head(body, { y: 0.945, r: 0.092, hat: 'crown' });

    // 双手搭在两侧扶手上（扶手顶 y≈0.56）
    const shoulderY = 0.80;
    for (let i = -1; i <= 1; i += 2) {
      // 肩
      const sh = sphM(0.045, robe, 10, 8);
      sh.position.set(i * 0.105, shoulderY, 0.02);
      part(body, sh, 0.005);
      // 上臂（肩→肘，向下微前）
      limb(body, i * 0.105, shoulderY, 0.02, i * 0.155, 0.685, 0.075, 0.048, 0.042, robe, 0.005);
      // 前臂（肘→腕，水平搭在扶手上）
      limb(body, i * 0.155, 0.685, 0.075, i * 0.195, 0.575, 0.085, 0.042, 0.034, robe, 0.005);
      // 金袖口
      const cuff = cylM(0.038, 0.038, 0.03, gold, 10);
      cuff.position.set(i * 0.186, 0.625, 0.082);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(i * 0.05, -0.135, 0.013).normalize());
      part(body, cuff, 0.003);
      // 手（皮肤，搭在扶手顶面）
      const hand = sphM(0.036, C.skin, 10, 8);
      hand.position.set(i * 0.205, 0.585, 0.10);
      part(body, hand, 0.004);
    }

    g.add(body);
    return g;
  }

  function buildGeneralBlack() { return buildEmperor('black'); }
  function buildGeneralRed()   { return buildEmperor('red');   }

  /* ---------------- 底座 ---------------- */
  function buildBase(side) {
    const g = new THREE.Group();
    const main = side === 'red' ? C.redMain : C.blkMain;
    const dark = side === 'red' ? C.redDark : C.blkDark;
    const rim = discM(0.395, 0.075, dark);
    rim.position.y = 0.0375;
    part(g, rim, 0.008);
    // 底座顶面：用沉稳的暗木/暗青灰色，避免刺眼的白圆盘
    const face = discM(0.355, 0.030, side === 'red' ? 0x8a6b52 : 0x6b7280);
    face.position.y = 0.090;
    part(g, face, 0.006);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.372, 0.017, 6, 28), toonMat(C.gold));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.100;
    g.add(ring);
    const dot = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.008, 6, 28), toonMat(main));
    dot.rotation.x = Math.PI / 2;
    dot.position.y = 0.1055;
    g.add(dot);
    return g;
  }

  /* ---------------- 汉字标牌（始终朝向相机） ---------------- */
  const _plaqueCache = {};
  function plaqueTexture(char, side) {
    const key = 'p|' + side + '|' + char;
    if (_plaqueCache[key]) return _plaqueCache[key];
    const S = 128;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const x = cv.getContext('2d');
    const pad = 8, r = 24;
    x.beginPath();
    x.moveTo(pad + r, pad);
    x.arcTo(S - pad, pad, S - pad, S - pad, r);
    x.arcTo(S - pad, S - pad, pad, S - pad, r);
    x.arcTo(pad, S - pad, pad, pad, r);
    x.arcTo(pad, pad, S - pad, pad, r);
    x.closePath();
    const grd = x.createLinearGradient(0, pad, 0, S - pad);
    grd.addColorStop(0, '#c0a878');
    grd.addColorStop(1, '#9c804e');
    x.fillStyle = grd;
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = side === 'red' ? '#7a2018' : '#1f242c';
    x.stroke();
    x.fillStyle = side === 'red' ? '#7a2018' : '#1f242c';
    x.font = 'bold 76px "KaiTi","STKaiti","SimSun","Microsoft YaHei",serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(char, S / 2, S / 2 + 4);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    _plaqueCache[key] = t;
    return t;
  }
  function plaqueSprite(char, side) {
    const mat = new THREE.SpriteMaterial({
      map: plaqueTexture(char, side), transparent: true,
      depthTest: false, depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.34, 0.34, 1);
    sp.renderOrder = 20;
    return sp;
  }

  /* ---------------- 汉字样式：边角圆润的扁圆柱 + 隶书汉字 ---------------- */
  // 生成 LatheGeometry 用的轮廓（中心轴 r=0, y=0 -> 上 -> 圆角 -> 下 -> 圆角 -> 中心轴 r=0, y=0）
  // 总高度 = FLAT_H
  function flatProfile() {
    const R = 0.34, T = FLAT_H;          // 半径、高度
    const rc = 0.07;                      // 圆角半径
    const y0 = 0;
    const yT = T;
    const pts = [];
    // 底面圆角（从中心 r=0 沿 r 增到 R - rc，y 增到 rc）
    pts.push(new THREE.Vector2(0.0, y0));
    pts.push(new THREE.Vector2(R - rc, y0));
    // 底面外缘四分之一圆：从 (R-rc, 0) 到 (R, rc)
    for (let i = 0; i <= 8; i++) {
      const a = i / 8 * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - rc + Math.sin(a) * rc, rc - Math.cos(a) * rc));
    }
    // 侧壁：y 从 rc 升到 T - rc，r = R
    pts.push(new THREE.Vector2(R, T - rc));
    // 顶面外缘四分之一圆：(R, T-rc) -> (R-rc, T)
    for (let i = 0; i <= 8; i++) {
      const a = i / 8 * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - rc + Math.cos(a) * rc, T - rc + Math.sin(a) * rc));
    }
    // 顶面到中心
    pts.push(new THREE.Vector2(0, T));
    return pts;
  }

  const _charTexCache = {};
  function flatCharTexture(char, side) {
    const key = 'f|' + side + '|' + char;
    if (_charTexCache[key]) return _charTexCache[key];
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, S, S);
    // 隶书字体
    x.fillStyle = side === 'red' ? '#7a2018' : '#1f242c';
    x.font = 'bold 180px "LiSu","STLiti","华文隶书","SimSun",serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    // 轻微描边感
    x.lineWidth = 6;
    x.strokeStyle = side === 'red' ? '#3a0e0a' : '#0a0d11';
    x.strokeText(char, S / 2, S / 2 + 6);
    x.fillText(char, S / 2, S / 2 + 6);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 8;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    _charTexCache[key] = t;
    return t;
  }

  function buildFlatPiece(type, side, char) {
    const g = new THREE.Group();
    const main = side === 'red' ? 0x8a281d : 0x252a33;
    const dark = side === 'red' ? 0x5c1810 : 0x171a20;
    const matBody = toonMat(main);
    matBody.color = new THREE.Color(main);
    const lathe = new THREE.Mesh(new THREE.LatheGeometry(flatProfile(), 28), matBody);
    lathe.castShadow = true;
    g.add(lathe);
    // 反向描边（略放大）
    const latheOut = new THREE.Mesh(new THREE.LatheGeometry(flatProfile(), 28), outlineMat());
    latheOut.scale.set(1.04, 1.05, 1.04);
    g.add(latheOut);
    // 顶面圆环装饰
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.014, 6, 28), toonMat(C.gold));
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = FLAT_H - 0.001;
    g.add(topRing);
    // 底色暗边
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 6, 28), toonMat(dark));
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.005;
    g.add(baseRing);
    // 顶面汉字
    const topFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.27, 32),
      new THREE.MeshBasicMaterial({ map: flatCharTexture(char, side), transparent: true, depthWrite: false })
    );
    topFace.rotation.x = -Math.PI / 2;
    topFace.position.y = FLAT_H + 0.002;
    g.add(topFace);
    return { group: g, model: g, height: FLAT_H, sprite: null };
  }

  /* ---------------- 对外接口 ---------------- */
  function buildFigure(type, side) {
    switch (type) {
      case 'P': return buildPawn(side);
      case 'R': return buildChariot(side);
      case 'N': return buildHorse(side);
      case 'C': return buildCannon(side);
      case 'B': return buildElephant(side);
      case 'A': return buildAdvisor(side);
      case 'K': return side === 'red' ? buildGeneralRed() : buildGeneralBlack();
      default: return buildPawn(side);
    }
  }

  function buildPiece(type, side, char, style) {
    const s = style || 'model_char';
    if (s === 'char') return buildFlatPiece(type, side, char);
    const g = new THREE.Group();
    g.add(buildBase(side));
    const model = buildFigure(type, side);
    model.position.y = BASE_TOP;
    model.scale.setScalar(MODEL_SCALE);
    model.rotation.y = (side === 'red') ? Math.PI : 0;
    g.add(model);
    const h = (FIGURE_H[type] || 0.7) * MODEL_SCALE;
    let sprite = null;
    if (s === 'model_char') {
      sprite = plaqueSprite(char, side);
      sprite.position.set(0, BASE_TOP + h + 0.20, 0);
      sprite.raycast = function () {};
      g.add(sprite);
    }
    return { group: g, model: model, height: BASE_TOP + h, sprite: sprite };
  }

  window.XiangqiPieces3D = {
    buildPiece, buildFigure, buildFlatPiece,
    figureHeight: function (type) { return FIGURE_H[type] || 0.7; },
    BASE_TOP, FLAT_H, palette: C,
  };
})();
