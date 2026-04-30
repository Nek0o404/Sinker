// ── 白名單：已知合法的社群平台登入網域 ──────────────────────────
const TRUSTED_DOMAINS = [
  "instagram.com", "www.instagram.com",
  "facebook.com", "www.facebook.com",
  "accounts.google.com",
  "login.microsoftonline.com",
  "twitter.com", "x.com",
  "linkedin.com", "www.linkedin.com"
];

// ── 可疑關鍵字：表單 action 或頁面 URL 中出現這些字串視為高風險 ──
const SUSPICIOUS_KEYWORDS = [
  "login", "signin", "account", "auth",
  "credential", "verify", "secure", "update"
];

// ── 輔助函式：取得有效頂層域名 (eTLD+1) ──────────────────────────
function getBaseDomain(hostname) {
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

// ── 核心判斷：此表單提交是否可疑？ ─────────────────────────────────
function isSuspiciousSubmission(form) {
  const currentHost = location.hostname;
  const baseDomain = getBaseDomain(currentHost);

  // 檢查 1：目前網域是否在白名單中？
  const isTrusted = TRUSTED_DOMAINS.some(d => currentHost === d || currentHost.endsWith("." + d));
  if (isTrusted) return false;

  // 檢查 2：表單是否包含 password 欄位？
  const hasPassword = !!form.querySelector('input[type="password"]');
  if (!hasPassword) return false;

  // 檢查 3：表單 action 指向外部網域？
  const action = form.action || "";
  try {
    const actionHost = action ? new URL(action).hostname : currentHost;
    const actionBase = getBaseDomain(actionHost);
    if (actionBase !== baseDomain) return true;  // action 跨域 → 直接高風險
  } catch (_) {}

  // 檢查 4：URL 或 action 含可疑關鍵字且非白名單
  const urlLower = (location.href + action).toLowerCase();
  const hasSuspiciousKeyword = SUSPICIOUS_KEYWORDS.some(kw => urlLower.includes(kw));

  return hasSuspiciousKeyword;
}

// ── 警告 UI：注入警告橫幅至頁面頂端 ─────────────────────────────
function showWarningBanner(form) {
  if (document.getElementById("phishguard-banner")) return;  // 避免重複顯示

  const banner = document.createElement("div");
  banner.id = "phishguard-banner";
  banner.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #a32d2d; color: #fff;
      font-family: system-ui, sans-serif; font-size: 14px;
      padding: 12px 20px; display: flex; align-items: center; gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    ">
      <span style="font-size:18px;">⚠</span>
      <span>
        <strong>PhishGuard 偵測到可疑登入表單。</strong>
        此網域（${location.hostname}）不在可信任清單中，但偵測到密碼輸入。
        請確認您目前位於正確的官方網站後再繼續。
      </span>
      <button id="phishguard-block" style="
        margin-left: auto; background: #fff; color: #a32d2d;
        border: none; border-radius: 4px; padding: 6px 14px;
        font-size: 13px; font-weight: 600; cursor: pointer;
      ">阻斷提交</button>
      <button id="phishguard-allow" style="
        background: transparent; color: #ffcdd2; border: 1px solid #ffcdd2;
        border-radius: 4px; padding: 6px 14px; font-size: 13px; cursor: pointer;
      ">我信任此網站</button>
    </div>
  `;

  document.body.prepend(banner);

  document.getElementById("phishguard-block").onclick = () => {
    // 阻斷：移除 action、停用 submit 按鈕
    form.action = "javascript:void(0)";
    form.querySelectorAll('[type="submit"]').forEach(btn => btn.disabled = true);
    banner.querySelector("span:nth-child(2)").textContent =
      "已阻斷表單提交。若確認安全，請重新整理頁面。";
    document.getElementById("phishguard-block").remove();
  };

  document.getElementById("phishguard-allow").onclick = () => {
    banner.remove();  // 使用者自行確認，移除警告
  };
}

// ── 主監聽：攔截所有 submit 事件（捕捉階段）─────────────────────
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (isSuspiciousSubmission(form)) {
    event.preventDefault();  // 阻止原生提交
    event.stopImmediatePropagation();
    showWarningBanner(form);
  }
}, true);  // 使用 capture = true 確保最早被觸發

// ── 輔助監聽：偵測 fetch / XMLHttpRequest 發出的非同步憑證提交 ──
(function patchFetch() {
  const _fetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    const body = init.body;
    if (typeof body === "string" && body.includes("pass")) {
      const url = typeof input === "string" ? input : input.url;
      const host = new URL(url, location.href).hostname;
      if (!TRUSTED_DOMAINS.some(d => host === d || host.endsWith("." + d))) {
        console.warn("[PhishGuard] 偵測到可疑 fetch 憑證提交：", url);
        // 僅記錄警告，不強制阻斷（避免誤殺合法 XHR）
      }
    }
    return _fetch.apply(this, arguments);
  };
})();
