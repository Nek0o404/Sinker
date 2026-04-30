const TRUSTED_DOMAINS = [
  "instagram.com", "facebook.com", "accounts.google.com",
  "login.microsoftonline.com", "twitter.com", "x.com",
  "linkedin.com"
];

function getBaseDomain(hostname) {
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

const toggle = document.getElementById("toggleInterception");
const badge  = document.getElementById("statusBadge");

// 讀取儲存的開關狀態
chrome.storage.local.get("interceptEnabled", (data) => {
  const enabled = data.interceptEnabled !== false; // 預設開啟
  toggle.checked = enabled;
  updateBadge(enabled);
});

// 切換開關時儲存狀態
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ interceptEnabled: enabled });
  updateBadge(enabled);
});

function updateBadge(enabled) {
  if (enabled) {
    badge.textContent = "攔截已啟用";
    badge.className = "status-badge on";
  } else {
    badge.textContent = "攔截已停用";
    badge.className = "status-badge off";
  }
}

// 顯示目前分頁的網域與信任狀態
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  try {
    const url  = new URL(tabs[0].url);
    const host = url.hostname;
    document.getElementById("currentDomain").textContent = host || "—";

    const trusted = TRUSTED_DOMAINS.some(
      d => host === d || host.endsWith("." + d)
    );
    const el = document.getElementById("trustStatus");
    el.textContent = trusted ? "信任" : "不在白名單";
    el.style.color  = trusted ? "#639922" : "#e24b4a";
  } catch (_) {
    document.getElementById("currentDomain").textContent = "無法取得";
  }
});
