// ─── PROGRESS TRACKING (syncs with DynamoDB via API) ─────────────────────────
const Progress = (() => {
  let syncTimer = null;
  let dirty = false;

  function getLocal() {
    try {
      return JSON.parse(localStorage.getItem("st_progress")) || defaultProgress();
    } catch { return defaultProgress(); }
  }

  function defaultProgress() {
    return { learned: [], streak: 0, lastScore: null, quizHistory: [] };
  }

  function saveLocal(data) {
    localStorage.setItem("st_progress", JSON.stringify(data));
  }

  function getLearned() {
    return new Set(getLocal().learned);
  }

  function getStreak() {
    return getLocal().streak;
  }

  function getLastScore() {
    return getLocal().lastScore;
  }

  function markLearned(word) {
    const data = getLocal();
    if (!data.learned.includes(word)) {
      data.learned.push(word);
      saveLocal(data);
      dirty = true;
      schedulSync();
    }
  }

  function updateStreak(streak) {
    const data = getLocal();
    data.streak = streak;
    saveLocal(data);
    dirty = true;
    schedulSync();
  }

  function updateLastScore(score) {
    const data = getLocal();
    data.lastScore = score;
    saveLocal(data);
    dirty = true;
    schedulSync();
  }

  function recordQuiz(mode, score, total) {
    const data = getLocal();
    data.quizHistory.push({ date: new Date().toISOString(), mode, score, total });
    // keep last 100
    if (data.quizHistory.length > 100) data.quizHistory = data.quizHistory.slice(-100);
    saveLocal(data);
    dirty = true;
    schedulSync();
  }

  function schedulSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncToCloud(), 3000);
  }

  async function syncToCloud() {
    if (!Auth.isLoggedIn() || !dirty) return;
    const token = Auth.getIdToken();
    if (!token) return;
    const data = getLocal();

    try {
      await fetch(`${APP_CONFIG.API_ENDPOINT}/api/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          learned: data.learned,
          streak: data.streak,
          lastScore: data.lastScore,
        }),
      });
      dirty = false;
    } catch (e) {
      console.warn("Progress sync failed:", e.message);
    }
  }

  async function loadFromCloud() {
    if (!Auth.isLoggedIn()) return;
    const token = Auth.getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`${APP_CONFIG.API_ENDPOINT}/api/progress`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return;
      const cloud = await res.json();

      // Merge: union of learned words, keep higher streak
      const local = getLocal();
      const merged = {
        learned: [...new Set([...local.learned, ...cloud.learned])],
        streak: Math.max(local.streak, cloud.streak || 0),
        lastScore: cloud.lastScore || local.lastScore,
        quizHistory: [...(local.quizHistory || []), ...(cloud.quizHistory || [])],
      };
      saveLocal(merged);
    } catch (e) {
      console.warn("Progress load failed:", e.message);
    }
  }

  return {
    getLearned, getStreak, getLastScore,
    markLearned, updateStreak, updateLastScore,
    recordQuiz, syncToCloud, loadFromCloud, getLocal,
  };
})();
