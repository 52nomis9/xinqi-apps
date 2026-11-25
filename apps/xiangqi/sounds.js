'use strict';
/* ============================================================
 * sounds.js — 心奇学象棋 音效（纯 WebAudio 合成，无外部资源）
 *   lift  : 提棋（点击选子，短促沉闷拖动声）
 *   drop  : 落棋（清脆短促的棋子敲击木棋盘声）
 *   eat   : 吃子（汉语「吃！」语音，在落棋音效之后触发）
 *   check : 将军（汉语「将军！」语音，在所有音效最后触发）
 *   mute  : 一键静音（喇叭/静音切换）
 * 用法: window.XiangqiSounds.lift() / drop() / eat() / check()
 *       .setMuted(true|false) / .isMuted() / .unlock()
 * ============================================================ */
(function () {
  var ctx = null;
  var master = null;
  var muted = false;

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null; master = null;
    }
    return ctx;
  }

  function unlock() {
    ensureCtx();
    warmSpeech();
  }

  function setMuted(m) {
    muted = !!m;
    if (ctx && master) {
      master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.01);
    }
    if (muted) {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    }
  }
  function isMuted() { return muted; }

  // 通用包络发生器
  function env(peak, t0, a, d) {
    var g = ctx.createGain();
    var now = ctx.currentTime + (t0 || 0);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
    g.connect(master);
    return { gain: g, at: now, a: a, d: d };
  }

  // 噪声源
  function noiseBuf(dur) {
    var sr = ctx.sampleRate;
    var len = Math.max(1, Math.floor(sr * dur));
    var buf = ctx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // —— 提棋音效：低频短促的沉闷拖动/提子声 ——
  function lift() {
    var c = ensureCtx();
    if (!c || muted) return;
    try {
      // 低沉的 "thud"（短促）
      var o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.14);
      var e = env(0.5, 0, 0.012, 0.16);
      o.connect(e.gain);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.18);
      // 微噪声（拖动质感）
      var n = c.createBufferSource();
      n.buffer = noiseBuf(0.13);
      var bp = c.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.setValueAtTime(900, c.currentTime);
      bp.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.13);
      var e2 = env(0.22, 0.005, 0.01, 0.13);
      n.connect(bp); bp.connect(e2.gain);
      n.start(c.currentTime + 0.005);
      n.stop(c.currentTime + 0.16);
    } catch (e) {}
  }

  // —— 落棋音效：清脆短促敲击木棋盘 ——
  function drop() {
    var c = ensureCtx();
    if (!c || muted) return;
    try {
      // 木质敲击高频 "tick"
      var n = c.createBufferSource();
      n.buffer = noiseBuf(0.06);
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 2.2;
      var e1 = env(0.65, 0, 0.002, 0.055);
      n.connect(bp); bp.connect(e1.gain);
      n.start(c.currentTime);
      n.stop(c.currentTime + 0.07);
      // 短促共鸣（木盘腔体）
      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(720, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(480, c.currentTime + 0.09);
      var e2 = env(0.30, 0.003, 0.003, 0.10);
      o.connect(e2.gain);
      o.start(c.currentTime + 0.003);
      o.stop(c.currentTime + 0.12);
      // 轻微低频体感
      var o3 = c.createOscillator();
      o3.type = 'sine';
      o3.frequency.setValueAtTime(170, c.currentTime);
      o3.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.08);
      var e3 = env(0.28, 0.002, 0.004, 0.09);
      o3.connect(e3.gain);
      o3.start(c.currentTime + 0.002);
      o3.stop(c.currentTime + 0.11);
    } catch (e) {}
  }

  // —— 语音就绪管理：iOS / 部分浏览器 getVoices() 首次为空，需等 voiceschanged ——
  var voicesReady = false;

  function getVoices() {
    try { return window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }

  // 挑选普通话（简体）语音：绝不选粤语/繁体地区（zh-HK / zh-TW / zh-MO）
  function pickMandarinVoice() {
    var vs = getVoices();
    if (!vs.length) return null;
    var i, v, lang, name;
    // 1) 严格简体普通话
    for (i = 0; i < vs.length; i++) {
      v = vs[i]; lang = (v.lang || '').toLowerCase(); name = (v.name || '').toLowerCase();
      if (/^zh[-_]?cn/.test(lang) || /^cmn/.test(lang) || /zh[-_]?hans/.test(lang)) return v;
      if (/mandarin|simplified|mainland|china/.test(name) || /普通话|简体|中文（中国）/.test(v.name || '')) return v;
    }
    // 2) 任意中文，但排除粤语/繁体地区
    for (i = 0; i < vs.length; i++) {
      v = vs[i]; lang = (v.lang || '').toLowerCase();
      if (/^zh/.test(lang) && !/(hk|tw|mo|cantonese|yue|hant)/.test(lang)) return v;
    }
    return null;
  }

  // 首次用户手势时预热语音（部分浏览器需先说一句才能稳定发声）
  function warmSpeech() {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      if (!voicesReady) {
        var first = function () { voicesReady = true; };
        try { window.speechSynthesis.addEventListener('voiceschanged', first); } catch (e) {}
        if (getVoices().length) voicesReady = true;
      }
      var u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      try { window.speechSynthesis.speak(u); } catch (e) {}
    } catch (e) {}
  }

  // 汉语普通话语音（吃！/ 将军！），失败时以合成双音替代
  // 移动端稳健策略：不把 speak() 同步抛异常当作 fallback 触发条件，
  // 改用 utterance 生命周期 + 兜底超时判定是否需要放电子音兜底。
  function speak(text, fallbackFreq1, fallbackFreq2) {
    if (muted) return;
    var synth = window.speechSynthesis;
    if (!(synth && window.SpeechSynthesisUtterance)) {
      fallbackBeeps(fallbackFreq1, fallbackFreq2);
      return;
    }

    // 真正尝试发声（在语音列表就绪后调用）
    function attempt() {
      var u = new SpeechSynthesisUtterance(text);
      // 只设 lang，让系统/浏览器自动挑普通话，对移动端最稳
      u.lang = 'zh-CN';
      u.rate = 0.95;
      u.pitch = 1.1;
      u.volume = 1;

      // 仅当明确挑到"简体中文"voice 时才绑定；避免塞入失效 voice 导致 speak 抛异常
      var v = pickMandarinVoice();
      if (v) {
        var vlang = (v.lang || '').toLowerCase();
        if (/^zh[-_]?cn/.test(vlang) || /^cmn/.test(vlang) || /zh[-_]?hans/.test(vlang)) {
          u.voice = v;
        }
      }

      var resolved = false;     // 已触发 onstart / onend / onerror 之一
      var fallbackDone = false; // 已放过兜底电子音（防重复）

      u.onstart = function () { resolved = true; };
      u.onend = function () { resolved = true; };
      u.onerror = function () {
        if (!fallbackDone) { fallbackDone = true; fallbackBeeps(fallbackFreq1, fallbackFreq2); }
      };

      // 兜底超时：2500ms 内既没 onstart 也没 onerror，则放电子音兜底
      setTimeout(function () {
        if (!resolved && !fallbackDone) {
          fallbackDone = true;
          fallbackBeeps(fallbackFreq1, fallbackFreq2);
        }
      }, 2500);

      // speak() 不视为异常源：同步抛异常也不立刻 fallback，交由 onerror / 超时判定
      try { synth.speak(u); } catch (e) {}
    }

    // 语音列表尚未加载：等 voiceschanged 后再尝试（无论是否挑到 voice 都尝试 speak）
    if (!voicesReady && !getVoices().length) {
      var done = false;
      var handler = function () {
        if (done) return; done = true;
        voicesReady = true;
        try { synth.removeEventListener('voiceschanged', handler); } catch (e) {}
        attempt();
      };
      try { synth.addEventListener('voiceschanged', handler); } catch (e) {}
      setTimeout(function () { if (!done) handler(); }, 1200);
      return;
    }

    voicesReady = true;
    attempt();
  }

  function fallbackBeeps(fallbackFreq1, fallbackFreq2) {
    var c = ensureCtx();
    if (!c) return;
    try {
      var t = c.currentTime;
      [fallbackFreq1, fallbackFreq2].forEach(function (f, i) {
        var o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        var g = env(0.12, i * 0.12, 0.008, 0.12);
        o.connect(g.gain);
        o.start(t + i * 0.12);
        o.stop(t + i * 0.12 + 0.15);
      });
    } catch (e2) {}
  }

  function eat()   { speak('吃！', 520, 380); }
  function check() { speak('将军！', 440, 660); }

  window.XiangqiSounds = {
    unlock: unlock, lift: lift, drop: drop, eat: eat, check: check,
    setMuted: setMuted, isMuted: isMuted,
  };
})();
