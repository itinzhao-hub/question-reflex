(() => {
  const AUDIO_CACHE = "question-reflex-audio-v1";

  const installBtn = document.getElementById("installPwaBtn");
  const cacheAllBtn = document.getElementById("cacheAllAudioBtn");
  const clearAudioBtn = document.getElementById("clearAudioCacheBtn");
  const offlineStatus = document.getElementById("offlineStatus");
  const offlineProgress = document.getElementById("offlineProgress");
  const installHelp = document.getElementById("installHelp");

  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      offlineStatus.textContent = "此浏览器不支持 Service Worker。";
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js",
        { scope: "./" }
      );
      await navigator.serviceWorker.ready;
      offlineStatus.textContent = navigator.onLine
        ? "PWA 离线引擎已就绪。"
        : "当前离线；正在使用本地缓存。";
      return registration;
    } catch (err) {
      console.error(err);
      offlineStatus.textContent =
        "Service Worker 注册失败。请确认页面来自 HTTPS 或 localhost。";
    }
  }

  function allAudioPaths() {
    const set = new Set();
    for (const item of (window.STIMULI || [])) {
      for (const variant of (item.audioVariants || [])) {
        if (variant.path) set.add(variant.path);
      }
    }
    return [...set];
  }

  async function countCachedAudio() {
    if (!("caches" in window)) return { cached: 0, total: 0 };

    const paths = allAudioPaths();
    const cache = await caches.open(AUDIO_CACHE);
    let cached = 0;

    for (const path of paths) {
      const url = new URL(path, location.href).href;
      if (await cache.match(url)) cached++;
    }

    return { cached, total: paths.length };
  }

  async function storageText() {
    if (!navigator.storage?.estimate) return "";
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const mb = n => (n / 1024 / 1024).toFixed(1);
      if (usage != null && quota != null) {
        return ` · 浏览器存储 ${mb(usage)} / ${mb(quota)} MB`;
      }
    } catch {}
    return "";
  }

  async function refreshOfflineStatus() {
    const { cached, total } = await countCachedAudio();
    const storage = await storageText();
    offlineProgress.textContent =
      `固定音频缓存：${cached}/${total}${storage}`;
  }

  async function cacheOne(cache, path) {
    const url = new URL(path, location.href).href;
    const hit = await cache.match(url);
    if (hit) return "skip";

    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) {
      throw new Error(`${response.status} ${path}`);
    }
    await cache.put(url, response.clone());
    return "cached";
  }

  async function cacheAllAudio() {
    const paths = allAudioPaths();

    if (!paths.length) {
      alert("当前 stimuli.js 中没有固定 MP3。");
      return;
    }

    cacheAllBtn.disabled = true;
    clearAudioBtn.disabled = true;

    const cache = await caches.open(AUDIO_CACHE);
    let done = 0;
    let failed = 0;

    offlineProgress.textContent = `准备缓存 ${paths.length} 个音频……`;

    // Small worker pool: avoids opening ~200 requests simultaneously on mobile.
    let cursor = 0;
    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= paths.length) break;

        try {
          await cacheOne(cache, paths[index]);
        } catch (err) {
          console.error("Cache failed:", paths[index], err);
          failed++;
        }

        done++;
        if (done % 3 === 0 || done === paths.length) {
          offlineProgress.textContent =
            `正在缓存固定音频：${done}/${paths.length}` +
            (failed ? ` · 失败 ${failed}` : "");
        }
      }
    }

    try {
      await Promise.all([worker(), worker(), worker(), worker()]);
      await refreshOfflineStatus();

      if (failed) {
        offlineStatus.textContent =
          `缓存完成，但有 ${failed} 个文件失败；联网后可再次点击补齐。`;
      } else {
        offlineStatus.textContent =
          "全部固定音频已缓存；断网后也可训练。";
      }
    } finally {
      cacheAllBtn.disabled = false;
      clearAudioBtn.disabled = false;
    }
  }

  async function clearAudioCache() {
    const ok = confirm(
      "清除手机/当前浏览器中缓存的 MP3？\n\n" +
      "训练记录（IndexedDB）不会被删除。联网时仍可重新播放或再次缓存。"
    );
    if (!ok) return;

    await caches.delete(AUDIO_CACHE);
    offlineStatus.textContent = "固定音频缓存已清除。";
    await refreshOfflineStatus();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;

    if (!isStandalone()) {
      installBtn.hidden = false;
    }
  });

  installBtn?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
      return;
    }

    installHelp.hidden = false;
  });

  cacheAllBtn?.addEventListener("click", cacheAllAudio);
  clearAudioBtn?.addEventListener("click", clearAudioCache);

  window.addEventListener("online", () => {
    offlineStatus.textContent = "网络已恢复。";
  });

  window.addEventListener("offline", () => {
    offlineStatus.textContent = "当前离线；正在使用本地缓存。";
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    installHelp.hidden = true;
    offlineStatus.textContent = "PWA 已安装。";
  });

  async function init() {
    if (isStandalone()) {
      installBtn.hidden = true;
      installHelp.hidden = true;
    } else if (isIOS()) {
      // iOS generally uses browser UI rather than beforeinstallprompt.
      installBtn.hidden = false;
      installBtn.textContent = "手机安装方法";
    }

    await registerServiceWorker();
    await refreshOfflineStatus();
  }

  init();
})();
