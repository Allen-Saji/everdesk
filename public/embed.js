/* EverDesk widget loader. Usage:
 * <script src="https://everdesk.allensaji.dev/embed.js" data-everdesk-key="pk_..." async></script>
 */
(function () {
  var script =
    document.currentScript ||
    (function () {
      var s = document.querySelectorAll("script[data-everdesk-key]");
      return s[s.length - 1];
    })();
  if (!script) return;
  var key = script.getAttribute("data-everdesk-key");
  if (!key) return;
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    return;
  }
  if (document.getElementById("everdesk-bubble")) return;

  var style = document.createElement("style");
  style.textContent =
    "#everdesk-bubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;" +
    "background:#4f46e5;border:0;cursor:pointer;box-shadow:0 8px 24px rgba(79,70,229,.35);z-index:2147483000;" +
    "display:flex;align-items:center;justify-content:center;transition:transform .15s ease}" +
    "#everdesk-bubble:hover{transform:scale(1.06)}" +
    "#everdesk-panel{position:fixed;right:20px;bottom:88px;width:380px;height:min(600px,calc(100vh - 110px));" +
    "border:0;border-radius:16px;box-shadow:0 12px 48px rgba(15,23,42,.22);z-index:2147483000;background:#fff;" +
    "opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}" +
    "#everdesk-panel.everdesk-open{opacity:1;pointer-events:auto;transform:translateY(0)}" +
    "@media(max-width:480px){#everdesk-panel{right:0;bottom:0;width:100%;height:100%;border-radius:0}}";
  document.head.appendChild(style);

  var bubble = document.createElement("button");
  bubble.id = "everdesk-bubble";
  bubble.setAttribute("aria-label", "Open support chat");
  bubble.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var panel = null;
  var open = false;

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement("iframe");
    panel.id = "everdesk-panel";
    panel.title = "Support chat";
    panel.src = origin + "/widget?key=" + encodeURIComponent(key);
    panel.allow = "clipboard-write";
    document.body.appendChild(panel);
  }

  bubble.addEventListener("click", function () {
    ensurePanel();
    open = !open;
    panel.classList.toggle("everdesk-open", open);
    bubble.innerHTML = open
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  });

  document.body.appendChild(bubble);
})();
