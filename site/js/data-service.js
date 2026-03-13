// ── DATA SERVICE ──────────────────────────────────────────────────────────────
// Fetches curriculum from API (DynamoDB-backed), syncs progress to cloud,
// and sends learning events to the analytics pipeline.
// Falls back to local data (vocab-data.js / curriculum.js) if API unavailable.

const DataService = (() => {
  let _curriculumCache = null;
  let _syncTimer = null;
  const SYNC_INTERVAL = 30000; // auto-sync every 30s

  // ── API helpers ──
  async function apiGet(path) {
    const token = Auth.getIdToken();
    const resp = await fetch(`${APP_CONFIG.API_ENDPOINT}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return resp.json();
  }

  async function apiPost(path, body) {
    const token = Auth.getIdToken();
    const resp = await fetch(`${APP_CONFIG.API_ENDPOINT}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return resp.json();
  }

  async function apiPut(path, body) {
    const token = Auth.getIdToken();
    const resp = await fetch(`${APP_CONFIG.API_ENDPOINT}${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return resp.json();
  }

  // ── Curriculum: fetch from API, fallback to local ──
  async function loadCurriculum() {
    if (_curriculumCache) return _curriculumCache;

    try {
      const data = await apiGet("/api/curriculum/all");
      if (data.vocab && data.vocab.length > 0) {
        _curriculumCache = data;
        console.log(`[DataService] Loaded curriculum from API: ${data.vocab.length} words, ${data.units.length} units`);
        return _curriculumCache;
      }
    } catch (e) {
      console.warn("[DataService] API curriculum unavailable, using local data:", e.message);
    }

    // Fallback: build from local VOCAB + Curriculum module
    _curriculumCache = {
      vocab: typeof VOCAB !== "undefined" ? VOCAB : [],
      units: typeof Curriculum !== "undefined" ? Curriculum.getUnits() : [],
      phases: typeof Curriculum !== "undefined" ? Curriculum.getPhases() : [],
      scenarios: typeof Curriculum !== "undefined" ? Curriculum.getScenarios() : [],
      source: "local",
    };
    return _curriculumCache;
  }

  function getCachedCurriculum() {
    return _curriculumCache;
  }

  function invalidateCache() {
    _curriculumCache = null;
  }

  // ── Progress: full cloud sync ──
  async function loadProgress() {
    try {
      const data = await apiGet("/api/progress");
      // Hydrate local mastery from cloud
      if (data.mastery && Object.keys(data.mastery).length > 0) {
        Mastery.importData({
          mastery: data.mastery,
          srs: data.srs || {},
          history: data.history || [],
        });
        console.log(`[DataService] Loaded mastery from cloud: ${Object.keys(data.mastery).length} words`);
      }
      return data;
    } catch (e) {
      console.warn("[DataService] Could not load progress from cloud:", e.message);
      return null;
    }
  }

  async function saveProgress() {
    try {
      const exported = Mastery.exportData();
      await apiPut("/api/progress", {
        mastery: exported.mastery,
        srs: exported.srs,
        history: exported.history,
        streak: Mastery.getStreakDays(),
      });
      console.log("[DataService] Progress synced to cloud");
    } catch (e) {
      console.warn("[DataService] Could not save progress to cloud:", e.message);
    }
  }

  // Auto-sync: periodically save progress to cloud
  function startAutoSync() {
    if (_syncTimer) return;
    _syncTimer = setInterval(() => {
      if (Auth.isLoggedIn()) saveProgress();
    }, SYNC_INTERVAL);
    // Also sync on page unload
    window.addEventListener("beforeunload", () => {
      if (Auth.isLoggedIn()) {
        const exported = Mastery.exportData();
        const token = Auth.getIdToken();
        if (token) {
          navigator.sendBeacon(
            `${APP_CONFIG.API_ENDPOINT}/api/progress`,
            new Blob([JSON.stringify({
              mastery: exported.mastery,
              srs: exported.srs,
              history: exported.history,
              streak: Mastery.getStreakDays(),
            })], { type: "application/json" })
          );
        }
      }
    });
  }

  function stopAutoSync() {
    if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
  }

  // ── Analytics: send learning events ──
  let _eventBuffer = [];
  let _flushTimer = null;

  function trackEvent(type, detail = {}) {
    _eventBuffer.push({ type, ...detail, clientTs: Date.now() });
    // Flush when buffer hits 20 events or after 10s
    if (_eventBuffer.length >= 20) flushEvents();
    else if (!_flushTimer) _flushTimer = setTimeout(flushEvents, 10000);
  }

  async function flushEvents() {
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    if (_eventBuffer.length === 0) return;
    const batch = _eventBuffer.splice(0);
    try {
      await apiPost("/api/analytics/events", { events: batch });
    } catch (e) {
      // Put back on failure so they retry next flush
      _eventBuffer.unshift(...batch);
      console.warn("[DataService] Event flush failed:", e.message);
    }
  }

  // ── Analytics: query summaries ──
  async function getAnalyticsSummary(days = 7) {
    try {
      return await apiGet(`/api/analytics/summary?days=${days}`);
    } catch (e) {
      console.warn("[DataService] Analytics summary unavailable:", e.message);
      return null;
    }
  }

  async function getWeakWords() {
    try {
      return await apiGet("/api/analytics/weakwords");
    } catch (e) {
      return { weakWords: [] };
    }
  }

  async function getStreaks() {
    try {
      return await apiGet("/api/analytics/streaks");
    } catch (e) {
      return { currentStreak: Mastery.getStreakDays(), totalDays: 0, activeDates: [] };
    }
  }

  return {
    loadCurriculum,
    getCachedCurriculum,
    invalidateCache,
    loadProgress,
    saveProgress,
    startAutoSync,
    stopAutoSync,
    trackEvent,
    flushEvents,
    getAnalyticsSummary,
    getWeakWords,
    getStreaks,
  };
})();
