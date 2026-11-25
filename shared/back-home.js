/* 心奇学习应用集合 v1.1 —— 子应用「返回主页」外挂按钮
 * 用法：在各子应用 HTML 的 </body> 前加一行
 *   <script src="../../shared/back-home.js" data-home="../../index.html" defer></script>
 * 不修改子应用任何业务逻辑，子应用整目录升级后重新补这一行即可。
 */
(function () {
  "use strict";

  function mount() {
    var self = document.querySelector('script[data-back-home], script[data-home]');
    var home = (self && self.getAttribute("data-home")) || "../../index.html";
    if (document.getElementById("xq-back-home")) return;

    var css = [
      "#xq-back-home{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));",
      "z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:8px 13px;",
      "border-radius:999px;background:rgba(255,255,255,.92);color:#1f3a5f;",
      "font:14px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;",
      "text-decoration:none;box-shadow:0 4px 16px rgba(31,58,95,.18);border:1px solid rgba(31,58,95,.12);",
      "opacity:.72;transition:opacity .18s ease,transform .18s ease;backdrop-filter:blur(6px);",
      "-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent;}",
      "#xq-back-home:hover,#xq-back-home:focus-visible{opacity:1;transform:translateY(-1px);}",
      "#xq-back-home .xq-back-ico{font-size:15px;line-height:1;}",
      "@media (max-width:640px){#xq-back-home{bottom:calc(88px + env(safe-area-inset-bottom,0px));padding:7px 11px;font-size:13px;}}",
      "@media (max-width:360px){#xq-back-home .xq-back-txt{display:none;}}",
      "@media print{#xq-back-home{display:none;}}"
    ].join("");

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var a = document.createElement("a");
    a.id = "xq-back-home";
    a.href = home;
    a.setAttribute("aria-label", "返回心奇学习官网页");
    a.title = "返回心奇学习官网";
    a.innerHTML = '<span class="xq-back-ico">🏠</span><span class="xq-back-txt">返回主页</span>';

    document.body.appendChild(a);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
