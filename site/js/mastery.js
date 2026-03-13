// ── MASTERY & SPACED REPETITION ───────────────────────────────────────────────
// Tracks per-word mastery level (0-5) and SRS review scheduling.
//
// Mastery levels:
//   0 = New (never seen)
//   1 = Introduced (seen in Learn stage)
//   2 = Recognised (picked correct English meaning)
//   3 = Recalled (picked correct Spanish from English)
//   4 = Produced (typed Spanish correctly)
//   5 = Mastered (used in context / passed SRS review)
//
// SRS intervals (after mastery 3+):
//   Review 1: 1 day,  Review 2: 3 days,  Review 3: 7 days,
//   Review 4: 14 days, Review 5: 30 days

const Mastery = (() => {

  const STORAGE_KEY  = 'st_mastery';
  const SRS_KEY      = 'st_srs';
  const HISTORY_KEY  = 'st_learn_history';

  const SRS_INTERVALS = [
    1  * 86400000, // 1 day
    3  * 86400000, // 3 days
    7  * 86400000, // 7 days
    14 * 86400000, // 14 days
    30 * 86400000, // 30 days
  ];

  // ── Storage helpers ──
  function _load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  function _save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ── Mastery data: { "hola": 3, "gato": 1, ... } ──
  function getMasteryData() {
    return _load(STORAGE_KEY, {});
  }

  function getWordLevel(word) {
    return getMasteryData()[word] || 0;
  }

  function setWordLevel(word, level) {
    const data = getMasteryData();
    data[word] = Math.min(Math.max(level, 0), 5);
    _save(STORAGE_KEY, data);
    _recordEvent(word, 'level', level);
    return data[word];
  }

  // Advance word mastery by 1 (on correct answer)
  function advanceWord(word) {
    const current = getWordLevel(word);
    if (current >= 5) return 5;
    return setWordLevel(word, current + 1);
  }

  // Demote word mastery by 1 (on incorrect answer), minimum 1
  function demoteWord(word) {
    const current = getWordLevel(word);
    if (current <= 1) return 1;
    return setWordLevel(word, current - 1);
  }

  // Mark word as introduced (level 1) if currently 0
  function introduceWord(word) {
    if (getWordLevel(word) === 0) {
      setWordLevel(word, 1);
    }
  }

  // ── SRS data: { "hola": { reviewCount: 2, nextReview: 1710000000, lastReview: 1709000000 } } ──
  function getSrsData() {
    return _load(SRS_KEY, {});
  }

  function scheduleReview(word) {
    const srs = getSrsData();
    const entry = srs[word] || { reviewCount: 0, nextReview: 0, lastReview: 0 };
    const intervalIdx = Math.min(entry.reviewCount, SRS_INTERVALS.length - 1);
    entry.reviewCount++;
    entry.lastReview = Date.now();
    entry.nextReview = Date.now() + SRS_INTERVALS[intervalIdx];
    srs[word] = entry;
    _save(SRS_KEY, srs);
  }

  function failReview(word) {
    const srs = getSrsData();
    const entry = srs[word] || { reviewCount: 0, nextReview: 0, lastReview: 0 };
    // Reset review count but keep some progress
    entry.reviewCount = Math.max(0, entry.reviewCount - 2);
    entry.lastReview = Date.now();
    entry.nextReview = Date.now() + SRS_INTERVALS[0]; // review again in 1 day
    srs[word] = entry;
    _save(SRS_KEY, srs);
  }

  function getWordsDueForReview() {
    const mastery = getMasteryData();
    const srs = getSrsData();
    const now = Date.now();
    const due = [];

    for (const [word, level] of Object.entries(mastery)) {
      if (level < 2) continue;
      const entry = srs[word];
      if (!entry || entry.nextReview <= now) {
        due.push(word);
      }
    }
    return due;
  }

  // ── Learning history ──
  function _recordEvent(word, type, value) {
    const history = _load(HISTORY_KEY, []);
    history.push({ word, type, value, ts: Date.now() });
    // Keep last 2000 events
    if (history.length > 2000) history.splice(0, history.length - 2000);
    _save(HISTORY_KEY, history);
  }

  function recordAnswer(word, correct, stage) {
    _recordEvent(word, correct ? 'correct' : 'wrong', stage);
    if (correct) {
      advanceWord(word);
      if (getWordLevel(word) >= 3) scheduleReview(word);
    } else {
      demoteWord(word);
      failReview(word);
    }
  }

  // ── Stats ──
  function getOverallStats() {
    const mastery = getMasteryData();
    const total = VOCAB.length;
    const levels = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const w of VOCAB) {
      const l = mastery[w.spanish] || 0;
      levels[l]++;
    }
    levels[0] = total - Object.values(mastery).length;
    const learning = Object.values(mastery).filter(l => l >= 1 && l <= 2).length;
    const learned = Object.values(mastery).filter(l => l >= 3).length;
    const mastered = Object.values(mastery).filter(l => l >= 5).length;
    const reviewDue = getWordsDueForReview().length;

    return { total, levels, learning, learned, mastered, reviewDue };
  }

  function getStreakDays() {
    const history = _load(HISTORY_KEY, []);
    if (history.length === 0) return 0;

    const days = new Set();
    for (const e of history) {
      days.add(new Date(e.ts).toDateString());
    }
    // Count consecutive days ending today
    let streak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function getTodayWordCount() {
    const history = _load(HISTORY_KEY, []);
    const today = new Date().toDateString();
    const todayWords = new Set();
    for (const e of history) {
      if (new Date(e.ts).toDateString() === today && e.type === 'correct') {
        todayWords.add(e.word);
      }
    }
    return todayWords.size;
  }

  // ── Cloud sync helpers ──
  function exportData() {
    return {
      mastery: getMasteryData(),
      srs: getSrsData(),
      history: _load(HISTORY_KEY, []),
    };
  }

  function importData(data) {
    if (data.mastery) _save(STORAGE_KEY, data.mastery);
    if (data.srs)     _save(SRS_KEY, data.srs);
    if (data.history)  _save(HISTORY_KEY, data.history);
  }

  return {
    getMasteryData, getWordLevel, setWordLevel,
    advanceWord, demoteWord, introduceWord,
    getSrsData, scheduleReview, failReview, getWordsDueForReview,
    recordAnswer, getOverallStats, getStreakDays, getTodayWordCount,
    exportData, importData,
  };
})();
