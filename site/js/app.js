// ── HELPERS ───────────────────────────────────────────────────────────────────
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function pick(arr, n) { return shuffle(arr).slice(0, n); }
function track(type, detail) { try { if (typeof DataService !== 'undefined') DataService.trackEvent(type, detail); } catch(e) {} }
function cloudSave() { try { if (typeof DataService !== 'undefined') DataService.saveProgress(); } catch(e) {} }

// ── TTS ──────────────────────────────────────────────────────────────────────
function speak(text, btnId) {
  if (!text) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'es-ES'; utt.rate = 0.9;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('es'));
  if (v) utt.voice = v;
  const btn = btnId ? document.getElementById(btnId) : null;
  if (btn) { btn.classList.add('playing'); utt.onend = () => btn.classList.remove('playing'); }
  speechSynthesis.speak(utt);
}
function speakBtn(text, id, label = '🔊') {
  const safe = (text || '').replace(/'/g, "\\'");
  return `<button class="speak-btn" id="${id}" onclick="event.stopPropagation();speak('${safe}','${id}')">${label}</button>`;
}

// ── SCREEN ROUTER ────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  if (id === 'dashboard') renderDashboard();
  updateStats();
}

// ── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
  const s = Mastery.getOverallStats();
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statLearned').textContent = s.learned;
  document.getElementById('statStreak').textContent = Mastery.getStreakDays();
  document.getElementById('statToday').textContent = Mastery.getTodayWordCount();
  document.getElementById('statReview').textContent = s.reviewDue;
  const rc = document.getElementById('reviewCount');
  if (rc) rc.textContent = s.reviewDue;
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  renderPhaseMap();
  renderScenarioCards();
  updateStats();
}

function renderPhaseMap() {
  const mastery = Mastery.getMasteryData();
  const phases = Curriculum.getPhases();
  const container = document.getElementById('phaseMap');
  let html = '';

  for (const phase of phases) {
    const unlocked = Curriculum.isPhaseUnlocked(phase.phase, mastery);
    const units = Curriculum.getPhaseUnits(phase.phase);

    html += `<div style="margin-bottom:24px;opacity:${unlocked ? 1 : 0.5}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:1.4rem">${phase.icon}</span>
        <span style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">Phase ${phase.phase}: ${phase.title}</span>
        ${!unlocked ? '<span style="font-size:.75rem;color:var(--muted);background:var(--card);padding:3px 10px;border-radius:12px;border:1px solid var(--border)">🔒 Complete Phase ' + (phase.phase - 1) + ' first</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">`;

    for (const unit of units) {
      const unitUnlocked = Curriculum.isUnitUnlocked(unit.id, mastery);
      const progress = Curriculum.getUnitProgress(unit.id, mastery);
      const stage = Curriculum.getCurrentStage(unit.id, mastery);
      const stageInfo = Curriculum.STAGES.find(s => s.id === stage);
      const done = progress >= 95;

      html += `<div class="quick-card" style="--accent-c:${done ? 'var(--green)' : unitUnlocked ? 'var(--accent)' : 'var(--dim)'};padding:16px;cursor:${unitUnlocked ? 'pointer' : 'default'};opacity:${unitUnlocked ? 1 : 0.45}"
        ${unitUnlocked ? `onclick="startUnit(${unit.id})"` : ''}>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Unit ${unit.id}</span>
          ${done ? '<span style="font-size:.9rem">✅</span>' : !unitUnlocked ? '<span style="font-size:.8rem">🔒</span>' : ''}
        </div>
        <div style="font-weight:600;font-size:.9rem;margin-bottom:6px">${unit.title}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">${unit.words.length} words · ${stageInfo ? stageInfo.icon + ' ' + stageInfo.label : ''}</div>
        <div style="background:var(--dim);border-radius:3px;height:4px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:${done ? 'var(--green)' : 'var(--accent)'};border-radius:3px;transition:width .3s"></div>
        </div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:4px;text-align:right">${progress}%</div>
      </div>`;
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function renderScenarioCards() {
  const mastery = Mastery.getMasteryData();
  const scenarios = Curriculum.getScenarios();
  const container = document.getElementById('scenarioCards');
  container.innerHTML = scenarios.map(s => {
    const unlocked = Curriculum.isScenarioUnlocked(s.id, mastery);
    return `<div class="quick-card" style="--accent-c:${unlocked ? 'var(--purple)' : 'var(--dim)'};opacity:${unlocked ? 1 : 0.45};cursor:${unlocked ? 'pointer' : 'default'}"
      ${unlocked ? `onclick="openScenario('${s.id}')"` : ''}>
      <div class="qc-icon">${s.icon}</div>
      <div class="qc-title">${s.title} ${!unlocked ? '🔒' : ''}</div>
      <div class="qc-desc">${s.desc}</div>
      ${!unlocked ? `<div style="font-size:.7rem;color:var(--muted);margin-top:6px">Unlocks after Phase ${s.unlockPhase}</div>` : ''}
    </div>`;
  }).join('');
}

// ── CONTINUE LEARNING ────────────────────────────────────────────────────────
function continueLearning() {
  const mastery = Mastery.getMasteryData();
  const units = Curriculum.getUnits();
  // Find first unlocked unit that isn't complete
  for (const unit of units) {
    if (Curriculum.isUnitUnlocked(unit.id, mastery)) {
      const progress = Curriculum.getUnitProgress(unit.id, mastery);
      if (progress < 95) {
        startUnit(unit.id);
        return;
      }
    }
  }
  // All done — suggest review
  startReviewSession();
}

// ── UNIT LESSON ──────────────────────────────────────────────────────────────
function startUnit(unitId) {
  const info = LessonEngine.startLesson(unitId);
  if (!info) return;
  const stageInfo = Curriculum.STAGES.find(s => s.id === info.stage);
  document.getElementById('lessonTitle').textContent = `${info.unit.phaseIcon} ${info.unit.title}`;
  document.getElementById('lessonStage').textContent = `${stageInfo.icon} ${stageInfo.label} — ${stageInfo.desc}`;
  showScreen('lesson');
  renderExercise();
}

function startReviewSession() {
  const info = LessonEngine.startReview();
  if (!info || info.total === 0) {
    alert('No words due for review right now. Great job!');
    return;
  }
  document.getElementById('lessonTitle').textContent = '🔄 Spaced Review';
  document.getElementById('lessonStage').textContent = `${info.wordCount} words due — mixed exercises`;
  showScreen('lesson');
  renderExercise();
}

function exitLesson() {
  showScreen('dashboard');
}

function renderExercise() {
  if (LessonEngine.isComplete()) {
    showResults();
    return;
  }
  const ex = LessonEngine.getCurrentExercise();
  const prog = LessonEngine.getProgress();
  const pct = Math.round((prog.current / prog.total) * 100);
  document.getElementById('lessonProgress').style.width = pct + '%';
  document.getElementById('lessonCounter').textContent = `${prog.current + 1}/${prog.total}`;

  const content = document.getElementById('lessonContent');

  if (ex.type === 'learn') {
    renderLearnCard(content, ex);
  } else if (ex.type === 'mcq') {
    renderMCQCard(content, ex);
  } else if (ex.type === 'produce') {
    renderProduceCard(content, ex);
  } else if (ex.type === 'fill') {
    renderFillCard(content, ex);
  } else if (ex.type === 'translate') {
    renderTranslateCard(content, ex);
  }
}

// ── EXERCISE RENDERERS ───────────────────────────────────────────────────────
function renderLearnCard(container, ex) {
  const w = ex.wordObj;
  container.innerHTML = `
    <div class="question-card" style="text-align:center">
      <div class="q-type-badge">📖 New Word ${ex.index}/${ex.total}</div>
      <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:var(--accent);margin:16px 0">${w.spanish}</div>
      <div style="margin:4px 0">${speakBtn(w.spanish, 'tts-learn-' + ex.index, '🔊 Listen')}</div>
      <div style="font-size:1.2rem;margin:12px 0;color:var(--text)">${w.english}</div>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:8px">${w.pos}${w.notes ? ' · ' + w.notes : ''} · ${w.priority}</div>
      ${w.example_es ? `
        <div style="background:var(--surface);border-radius:10px;padding:14px;margin:12px 0;text-align:left;border:1px solid var(--border)">
          <div style="font-style:italic;margin-bottom:4px">${w.example_es} ${speakBtn(w.example_es, 'tts-learn-ex-' + ex.index, '🔊')}</div>
          <div style="color:var(--muted);font-size:.85rem">${w.example_en}</div>
        </div>` : ''}
      <div id="aiEnrich" style="margin:12px 0;text-align:left"></div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="submitLearn()">Got it — Next →</button>
    </div>`;
  setTimeout(() => speak(w.spanish, 'tts-learn-' + ex.index), 300);
  // AI enrichment: load mnemonic, cultural note, fun fact
  loadWordEnrichment(w);
}

function submitLearn() {
  LessonEngine.submitAnswer('');
  renderExercise();
}

function renderMCQCard(container, ex) {
  const letters = ['A', 'B', 'C', 'D'];
  const isEsToEn = ex.direction === 'es_to_en';
  const badge = isEsToEn ? '👁️ What does this mean?' : '🧠 What is the Spanish?';
  container.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">${badge}</div>
      <div class="q-text">
        <strong style="color:var(--accent);font-family:var(--font-display);font-size:1.4rem">${ex.prompt}</strong>
        ${isEsToEn ? `<span style="display:inline-block;margin-left:8px">${speakBtn(ex.prompt, 'tts-mcq-q')}</span>` : ''}
      </div>
      <div class="q-hint">${ex.hint || ''}</div>
      <div class="options-grid">
        ${ex.options.map((o, i) => `
          <button class="option" onclick="submitMCQ(this, '${o.replace(/'/g, "\\'")}')">
            <span class="opt-letter">${letters[i]}</span>${o}
          </button>`).join('')}
      </div>
      <div class="feedback-box" id="feedback"></div>
      <div id="grammarHelp"></div>
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  if (isEsToEn) setTimeout(() => speak(ex.prompt, 'tts-mcq-q'), 200);
}

function submitMCQ(btn, chosen) {
  document.querySelectorAll('.option').forEach(b => b.disabled = true);
  const result = LessonEngine.submitAnswer(chosen);
  if (result.word) track('word_attempt', { word: result.word.spanish, correct: result.correct, mode: 'mcq' });
  if (result.correct) {
    btn.classList.add('correct');
    showFeedback(true, `✅ Correct! ${result.explanation}
      ${result.word ? speakBtn(result.word.spanish, 'tts-mcq-fb', '🔊') : ''}`);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option').forEach(b => {
      if (b.textContent.trim().slice(1).trim() === result.answer) b.classList.add('correct');
    });
    showFeedback(false, `❌ Answer: <b>${result.answer}</b>. ${result.explanation}
      ${result.word ? speakBtn(result.word.spanish, 'tts-mcq-fb', '🔊') : ''}`);
    if (result.word) loadGrammarHelp(result.word, chosen, result.answer, 'mcq');
  }
}

function renderProduceCard(container, ex) {
  container.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">✏️ Type the Spanish word</div>
      <div class="q-text">How do you say: <strong style="color:var(--accent);font-size:1.2rem">${ex.prompt}</strong></div>
      <div class="q-hint">${ex.hint || ''}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input class="fill-input" id="produceAns" placeholder="Type in Spanish…" style="max-width:300px"
          onkeydown="if(event.key==='Enter') submitProduce()"/>
        <button class="submit-btn" onclick="submitProduce()">Check ✓</button>
      </div>
      <div class="feedback-box" id="feedback"></div>
      <div id="grammarHelp"></div>
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('produceAns')?.focus(), 50);
}

function submitProduce() {
  const inp = document.getElementById('produceAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
  if (result.word) track('word_attempt', { word: result.word.spanish, correct: result.correct, mode: 'produce' });
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (result.correct) {
    inp.classList.add('correct');
    showFeedback(true, `✅ Correct! <b>${result.answer}</b> ${result.explanation}
      ${speakBtn(result.answer, 'tts-prod-fb', '🔊')}`);
    setTimeout(() => speak(result.answer, 'tts-prod-fb'), 300);
  } else {
    inp.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${result.answer}</b>. ${result.explanation}
      ${speakBtn(result.answer, 'tts-prod-fb', '🔊')}`);
    setTimeout(() => speak(result.answer, 'tts-prod-fb'), 300);
    if (result.word) loadGrammarHelp(result.word, inp.value, result.answer, 'produce');
  }
}

function renderFillCard(container, ex) {
  container.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">💬 Complete the sentence</div>
      <div class="q-text" style="font-size:1.05rem;line-height:1.7">${ex.prompt}</div>
      <div class="q-hint">${ex.hint || ''}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input class="fill-input" id="fillAns" placeholder="Type the missing word…" style="max-width:300px"
          onkeydown="if(event.key==='Enter') submitFill()"/>
        <button class="submit-btn" onclick="submitFill()">Check ✓</button>
      </div>
      <div class="feedback-box" id="feedback"></div>
      <div id="grammarHelp"></div>
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('fillAns')?.focus(), 50);
}

function submitFill() {
  const inp = document.getElementById('fillAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
  if (result.word) track('word_attempt', { word: result.word.spanish, correct: result.correct, mode: 'fill' });
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (result.correct) {
    inp.classList.add('correct');
    showFeedback(true, `✅ Correct! ${result.explanation}
      ${speakBtn(result.word?.example_es || result.answer, 'tts-fill-fb', '🔊')}`);
  } else {
    inp.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${result.answer}</b>. ${result.explanation}
      ${speakBtn(result.word?.example_es || result.answer, 'tts-fill-fb', '🔊')}`);
    if (result.word) loadGrammarHelp(result.word, inp.value, result.answer, 'fill');
  }
}

function renderTranslateCard(container, ex) {
  container.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">🌐 Translate the key word</div>
      <div class="q-text"><em>"${ex.prompt}"</em></div>
      <div class="q-hint">${ex.hint || ''}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input class="fill-input" id="transAns" placeholder="Spanish word…" style="max-width:300px"
          onkeydown="if(event.key==='Enter') submitTranslate()"/>
        <button class="submit-btn" onclick="submitTranslate()">Check ✓</button>
      </div>
      <div class="feedback-box" id="feedback"></div>
      <div id="grammarHelp"></div>
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('transAns')?.focus(), 50);
}

function submitTranslate() {
  const inp = document.getElementById('transAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
  if (result.word) track('word_attempt', { word: result.word.spanish, correct: result.correct, mode: 'translate' });
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (result.correct) {
    inp.classList.add('correct');
    showFeedback(true, `✅ Correct! <b>${result.answer}</b> ${result.explanation}`);
  } else {
    inp.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${result.answer}</b>. ${result.explanation}`);
    if (result.word) loadGrammarHelp(result.word, inp.value, result.answer, 'translate');
  }
}

function showFeedback(ok, msg) {
  const fb = document.getElementById('feedback');
  if (!fb) return;
  fb.className = 'feedback-box show ' + (ok ? 'ok' : 'bad');
  fb.innerHTML = msg;
  const nb = document.getElementById('nextBtn');
  if (nb) nb.classList.add('show');
}

// ── RESULTS ──────────────────────────────────────────────────────────────────
function showResults() {
  const r = LessonEngine.getResults();
  track('session_complete', { correct: r.correct, total: r.total, percentage: r.percentage, unit: r.unit?.id, stage: r.stage });
  cloudSave();
  const emoji = r.percentage >= 90 ? '🌟' : r.percentage >= 70 ? '👍' : '📚';
  const msg = r.percentage >= 90 ? 'Outstanding!' : r.percentage >= 70 ? 'Good job! Stage cleared.' : 'Keep practising — you\'ll get there!';

  let actions = `<button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button>`;
  if (r.unit) {
    if (r.passed) {
      actions = `<button class="btn btn-primary" onclick="startUnit(${r.unit.id})">▶ Next Stage</button>` + actions;
    } else {
      actions = `<button class="btn btn-primary" onclick="startUnit(${r.unit.id})">🔄 Try Again</button>` + actions;
    }
  } else {
    actions = `<button class="btn btn-primary" onclick="startReviewSession()">🔄 More Review</button>` + actions;
  }

  document.getElementById('resultsContent').innerHTML = `
    <div class="result-card">
      <div style="font-size:3rem;margin-bottom:8px">${emoji}</div>
      <div class="result-score">${r.percentage}%</div>
      <div class="result-label">${r.correct} / ${r.total} correct · ${msg}</div>
      ${r.unit ? `<div style="font-size:.85rem;color:var(--muted);margin:12px 0">Unit: ${r.unit.title} · Stage: ${r.stage}</div>` : ''}
      <div class="result-actions" style="margin-top:20px">${actions}</div>
    </div>`;
  showScreen('results');
}

// ── SCENARIOS ────────────────────────────────────────────────────────────────
function openScenario(id) {
  const info = Scenarios.startScenario(id);
  if (!info) return;
  document.getElementById('scenarioTitle').textContent = `${info.scenario.icon} ${info.scenario.title}`;
  document.getElementById('scenarioDialogue').innerHTML = '';
  showScreen('scenario');
  advanceScenario();
}

function advanceScenario() {
  if (Scenarios.isComplete()) {
    document.getElementById('scenarioInput').innerHTML = `
      <div class="result-card" style="margin-top:16px">
        <div class="result-score">🎉</div>
        <div class="result-label">Conversation complete!</div>
        <div class="result-actions">
          <button class="btn btn-primary" onclick="openScenario('${Scenarios.getScenarioInfo().id}')">🔄 Replay</button>
          <button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button>
        </div>
      </div>`;
    return;
  }

  const step = Scenarios.getCurrentStep();
  const dlg = document.getElementById('scenarioDialogue');

  if (step.role === 'tutor') {
    const tid = 'tts-sc-' + Date.now();
    dlg.innerHTML += `
      <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">🧑‍🏫</div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:12px 16px">
          <div style="font-size:.95rem">${step.es} ${speakBtn(step.es, tid, '🔊')}</div>
          <div style="font-size:.8rem;color:var(--muted);margin-top:4px;font-style:italic">${step.en}</div>
        </div>
      </div>`;
    Scenarios.advanceTutor();
    setTimeout(advanceScenario, 100);
    return;
  }

  // Student prompt
  document.getElementById('scenarioInput').innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px">
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:8px">💡 ${step.prompt}</div>
      <div style="font-size:.8rem;color:var(--dim);margin-bottom:10px;font-style:italic">Hint: ${step.hint}</div>
      <div style="display:flex;gap:10px">
        <input class="fill-input" id="scenarioAns" placeholder="Type your response in Spanish…"
          onkeydown="if(event.key==='Enter') submitScenarioResponse()" style="flex:1"/>
        <button class="submit-btn" onclick="submitScenarioResponse()">Send →</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('scenarioAns')?.focus(), 50);
}

function submitScenarioResponse() {
  const inp = document.getElementById('scenarioAns');
  if (!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  const result = Scenarios.submitResponse(text);

  const dlg = document.getElementById('scenarioDialogue');
  dlg.innerHTML += `
    <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%;align-self:flex-end;margin-left:auto">
      <div style="background:rgba(255,107,53,.15);border:1px solid rgba(255,107,53,.25);border-radius:12px 12px 2px 12px;padding:12px 16px">
        <div style="font-size:.95rem">${text}</div>
        ${!result.passed ? `<div style="font-size:.8rem;color:var(--accent2);margin-top:4px">💡 Try: <i>${result.key}</i></div>` : ''}
      </div>
      <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">👤</div>
    </div>`;

  // Show tutor responses that were auto-added
  const dialogue = Scenarios.getDialogue();
  for (const d of dialogue.slice(-2)) {
    if (d.role === 'tutor') {
      dlg.innerHTML += `
        <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">🧑‍🏫</div>
          <div style="background:var(--card);border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:12px 16px">
            <div style="font-size:.95rem">${d.text} ${speakBtn(d.text, 'tts-sc-' + Date.now(), '🔊')}</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:4px;font-style:italic">${d.translation}</div>
          </div>
        </div>`;
    }
  }

  dlg.scrollTop = dlg.scrollHeight;
  setTimeout(advanceScenario, 200);
}

// ── FREE PRACTICE (legacy random modes) ──────────────────────────────────────
function startFreePractice(mode) {
  // Reuse the lesson screen for free practice with random words
  const cat = document.getElementById('fpCat')?.value || 'all';
  const pri = document.getElementById('fpPriority')?.value || 'all';
  let pool = VOCAB;
  if (cat !== 'all') pool = pool.filter(w => w.category === cat);
  if (pri !== 'all') pool = pool.filter(w => w.priority === pri);

  if (pool.length < 4) { alert('Not enough words with this filter. Try a broader selection.'); return; }

  // Build a temporary unit-like structure for LessonEngine
  const words = shuffle(pool).slice(0, 15);
  const stageMap = { mcq: 'recognise', fill: 'use', flashcard: 'learn', match: 'recognise', aiquiz: 'use' };

  // For match mode — use special free practice
  if (mode === 'match') { startFreeMatch(pool); return; }
  if (mode === 'flashcard') { startFreeFlashcards(pool); return; }

  // Create a mock unit in the curriculum
  const mockUnit = { id: 999, phase: 0, phaseTitle: 'Practice', phaseIcon: '🎮', title: 'Free Practice', category: 'mixed', words, stages: ['recognise'] };
  const info = LessonEngine.startLesson(999, stageMap[mode] || 'recognise');
  // Override with our custom words
  if (!info) return;
  document.getElementById('lessonTitle').textContent = '🎮 Free Practice';
  document.getElementById('lessonStage').textContent = `${mode.toUpperCase()} mode · ${pool.length} words available`;
  showScreen('lesson');
  renderExercise();
}

function startFreeMatch(pool) {
  const words = pick(pool, 8);
  const lefts = shuffle(words.map(w => ({ id: w.spanish, text: w.spanish, type: 'es' })));
  const rights = shuffle(words.map(w => ({ id: w.spanish, text: w.english, type: 'en' })));
  let matched = 0, firstSel = null, timer, start = Date.now();

  document.getElementById('lessonTitle').textContent = '🔗 Match the Words';
  document.getElementById('lessonStage').textContent = 'Pair Spanish with English';
  document.getElementById('lessonProgress').style.width = '0%';
  document.getElementById('lessonCounter').textContent = '0/8';
  showScreen('lesson');

  document.getElementById('lessonContent').innerHTML = `
    <div class="match-grid">
      <div class="match-col" id="ml">${lefts.map(w => `<div class="match-item" data-id="${w.id}" data-type="es">${w.text}</div>`).join('')}</div>
      <div class="match-col" id="mr">${rights.map(w => `<div class="match-item" data-id="${w.id}" data-type="en">${w.text}</div>`).join('')}</div>
    </div><div id="matchResult" style="margin-top:16px"></div>`;

  timer = setInterval(() => {
    const s = Math.round((Date.now() - start) / 1000);
    document.getElementById('lessonCounter').textContent = `${matched}/8 · ${s}s`;
  }, 500);

  document.querySelectorAll('.match-item').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('matched')) return;
      if (el.dataset.type === 'es') speak(el.dataset.id);
      if (!firstSel) {
        document.querySelectorAll('.match-item').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); firstSel = el;
      } else {
        if (firstSel === el) { el.classList.remove('selected'); firstSel = null; return; }
        if (firstSel.dataset.id === el.dataset.id && firstSel.dataset.type !== el.dataset.type) {
          firstSel.classList.remove('selected'); firstSel.classList.add('matched'); el.classList.add('matched');
          matched++; Mastery.recordAnswer(firstSel.dataset.id, true, 'match');
          document.getElementById('lessonProgress').style.width = (matched / 8 * 100) + '%';
          firstSel = null;
          if (matched === 8) {
            clearInterval(timer);
            const t = Math.round((Date.now() - start) / 1000);
            document.getElementById('matchResult').innerHTML = `
              <div class="result-card"><div class="result-score">⚡ ${t}s</div><div class="result-label">All matched!</div>
              <div class="result-actions"><button class="btn btn-primary" onclick="startFreeMatch(VOCAB)">🔄 Again</button>
              <button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button></div></div>`;
          }
        } else {
          firstSel.classList.add('wrong-flash'); el.classList.add('wrong-flash');
          setTimeout(() => { firstSel.classList.remove('wrong-flash', 'selected'); el.classList.remove('wrong-flash'); firstSel = null; }, 400);
        }
      }
    });
  });
}

function startFreeFlashcards(pool) {
  const deck = shuffle(pool).slice(0, 20);
  let idx = 0;
  document.getElementById('lessonTitle').textContent = '🃏 Flashcards';
  document.getElementById('lessonStage').textContent = 'Flip to reveal';
  showScreen('lesson');

  function render() {
    if (idx >= deck.length) {
      document.getElementById('lessonContent').innerHTML = `
        <div class="result-card"><div class="result-score">✅</div><div class="result-label">Deck complete!</div>
        <div class="result-actions"><button class="btn btn-primary" onclick="startFreeFlashcards(VOCAB)">🔄 Again</button>
        <button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button></div></div>`;
      return;
    }
    const w = deck[idx];
    const pct = Math.round(idx / deck.length * 100);
    document.getElementById('lessonProgress').style.width = pct + '%';
    document.getElementById('lessonCounter').textContent = `${idx + 1}/${deck.length}`;
    document.getElementById('lessonContent').innerHTML = `
      <div class="flashcard-wrap"><div class="flashcard" id="fc" onclick="this.classList.toggle('flipped')">
        <div class="fc-face fc-front"><div class="fc-word">${w.spanish}</div>
          <div class="fc-sub">${w.pos}${w.notes ? ' · ' + w.notes : ''}</div>
          <div style="margin-top:10px" onclick="event.stopPropagation()">${speakBtn(w.spanish, 'tts-fc-' + idx)}</div>
          <div class="fc-sub" style="margin-top:8px;color:var(--dim)">Click to reveal</div></div>
        <div class="fc-face fc-back"><div class="fc-word" style="font-size:1.6rem">${w.english}</div>
          ${w.example_es ? `<div class="fc-example"><i>${w.example_es}</i><br/><span style="color:var(--dim)">${w.example_en}</span></div>` : ''}</div>
      </div></div>
      <div class="fc-controls">
        <button class="fc-btn skip" onclick="window._fcNext(false)">👎 Still learning</button>
        <button class="fc-btn know" onclick="window._fcNext(true)">✓ I know this</button>
      </div>
      <div class="fc-counter">${idx + 1} / ${deck.length}</div>`;
    setTimeout(() => speak(w.spanish, 'tts-fc-' + idx), 200);
  }
  window._fcNext = function(know) {
    if (know) Mastery.advanceWord(deck[idx].spanish);
    else Mastery.introduceWord(deck[idx].spanish);
    idx++; render();
  };
  render();
}

// ── AI: WORD ENRICHMENT (mnemonics, cultural notes) ─────────────────────────
async function loadWordEnrichment(w) {
  const el = document.getElementById('aiEnrich');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.8rem"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div> AI generating memory tricks…</div>`;
  try {
    const data = await AI.enrichWord(w);
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:.85rem;line-height:1.6">
        <div style="margin-bottom:8px"><strong style="color:var(--accent)">💡 Memory trick:</strong> ${data.mnemonic}</div>
        <div style="margin-bottom:8px"><strong style="color:var(--purple)">🌎 Culture:</strong> ${data.cultural}</div>
        <div style="margin-bottom:8px"><strong style="color:var(--blue)">📚 Fun fact:</strong> ${data.funFact}</div>
        ${data.commonMistakes ? `<div style="margin-bottom:8px"><strong style="color:var(--accent2)">⚠️ Watch out:</strong> ${data.commonMistakes}</div>` : ''}
        ${data.extraExamples && data.extraExamples.length ? `<div style="color:var(--muted);font-style:italic">${data.extraExamples.map(e => `• ${e}`).join('<br/>')}</div>` : ''}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="font-size:.75rem;color:var(--dim)">AI tips unavailable</div>`;
  }
}

// ── AI: GRAMMAR COACH (on wrong answers) ─────────────────────────────────────
async function loadGrammarHelp(wordObj, studentAnswer, correctAnswer, exerciseType) {
  const el = document.getElementById('grammarHelp');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.8rem;margin-top:8px"><div class="spinner" style="width:14px;height:14px;border-width:2px"></div> AI explaining…</div>`;
  try {
    const explanation = await AI.explainError(wordObj, studentAnswer, correctAnswer, exerciseType);
    el.innerHTML = `<div style="background:rgba(74,158,255,.08);border:1px solid rgba(74,158,255,.2);border-radius:8px;padding:12px;font-size:.85rem;color:var(--text);line-height:1.6;margin-top:8px">
      <strong style="color:var(--blue)">🧑‍🏫 Grammar Coach:</strong> ${explanation}</div>`;
  } catch (e) {
    el.innerHTML = '';
  }
}

// ── AI: DYNAMIC SCENARIO CONVERSATIONS ───────────────────────────────────────
const AI_SCENARIOS = [
  { id: 'restaurant', title: 'At a Restaurant', desc: 'You are a customer at a Spanish restaurant. Order food, ask about the menu, and pay the bill.', icon: '🍽️' },
  { id: 'hotel', title: 'Checking into a Hotel', desc: 'You are checking into a hotel in Barcelona. Ask about your room, wifi, and local recommendations.', icon: '🏨' },
  { id: 'doctor', title: 'At the Doctor', desc: 'You are visiting a doctor in Spain. Describe your symptoms and understand the diagnosis.', icon: '🏥' },
  { id: 'shopping', title: 'Shopping for Clothes', desc: 'You are shopping for clothes in Madrid. Ask about sizes, colors, prices, and try things on.', icon: '🛍️' },
  { id: 'directions', title: 'Asking for Directions', desc: 'You are lost in a Spanish city. Ask a local for directions to the train station.', icon: '🗺️' },
  { id: 'party', title: 'At a Friend\'s Party', desc: 'You are at a party in Spain. Introduce yourself, talk about hobbies, and make plans.', icon: '🎉' },
  { id: 'airport', title: 'At the Airport', desc: 'You are at a Spanish airport. Check in, go through security, and find your gate.', icon: '✈️' },
  { id: 'school', title: 'First Day at School', desc: 'You are a new student at a Spanish school. Meet classmates, find your classroom, and talk about subjects.', icon: '🏫' },
];

function openAIScenario() {
  track('ai_usage', { feature: 'ai_scenario' });
  showScreen('ai-scenario');
  const chat = document.getElementById('aiScenarioChat');
  chat.innerHTML = '';
  const input = document.getElementById('aiScenarioInput');
  input.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px">
      <div style="font-size:.9rem;color:var(--muted);margin-bottom:12px">Choose a scenario to practice:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
        ${AI_SCENARIOS.map(s => `
          <button class="option" style="text-align:center;padding:14px;flex-direction:column;gap:4px" onclick="startAIConversation('${s.id}')">
            <div style="font-size:1.5rem">${s.icon}</div>
            <div style="font-weight:600;font-size:.85rem">${s.title}</div>
          </button>`).join('')}
      </div>
    </div>`;
}

async function startAIConversation(scenarioId) {
  const scenario = AI_SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return;
  document.getElementById('aiScenarioTitle').textContent = `${scenario.icon} ${scenario.title}`;
  const chat = document.getElementById('aiScenarioChat');
  chat.innerHTML = '';
  const input = document.getElementById('aiScenarioInput');
  input.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.85rem"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Profesora Luna is setting the scene…</div>`;

  try {
    const known = AI.getKnownWordObjects();
    const resp = await AI.startAIScenario(scenario.desc, known);
    appendAIBubble(chat, 'tutor', resp.es, resp.en);
    showAIScenarioInput(resp.nextPrompt || 'Respond in Spanish…');
  } catch (e) {
    input.innerHTML = `<div class="no-key-banner">❌ ${e.message}</div><button class="btn btn-primary" style="margin-top:12px" onclick="openAIScenario()">← Back</button>`;
  }
}

function appendAIBubble(chat, role, text, translation, correction) {
  const isTutor = role === 'tutor';
  const tid = 'tts-ai-sc-' + Date.now();
  chat.innerHTML += `
    <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%;${isTutor ? '' : 'align-self:flex-end;margin-left:auto'}">
      ${isTutor ? `<div style="width:36px;height:36px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">🧑‍🏫</div>` : ''}
      <div style="background:${isTutor ? 'var(--card)' : 'rgba(255,107,53,.12)'};border:1px solid ${isTutor ? 'var(--border)' : 'rgba(255,107,53,.25)'};border-radius:12px;padding:12px 16px">
        <div style="font-size:.95rem">${text} ${isTutor ? speakBtn(text, tid, '🔊') : ''}</div>
        ${translation ? `<div style="font-size:.8rem;color:var(--muted);margin-top:4px;font-style:italic">${translation}</div>` : ''}
        ${correction ? `<div style="font-size:.8rem;color:var(--accent2);margin-top:4px">📝 ${correction}</div>` : ''}
      </div>
      ${!isTutor ? `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">👤</div>` : ''}
    </div>`;
  chat.scrollTop = chat.scrollHeight;
}

function showAIScenarioInput(prompt) {
  document.getElementById('aiScenarioInput').innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px">
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">💡 ${prompt}</div>
      <div style="display:flex;gap:10px">
        <input class="fill-input" id="aiScInput" placeholder="Type in Spanish…" onkeydown="if(event.key==='Enter') sendAIScenarioMsg()" style="flex:1"/>
        <button class="submit-btn" onclick="sendAIScenarioMsg()">Send →</button>
        <button class="btn btn-secondary" onclick="openAIScenario()" style="padding:10px 14px">🔄</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('aiScInput')?.focus(), 50);
}

async function sendAIScenarioMsg() {
  const inp = document.getElementById('aiScInput');
  if (!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  inp.disabled = true;

  const chat = document.getElementById('aiScenarioChat');
  appendAIBubble(chat, 'student', text);
  document.getElementById('aiScenarioInput').innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.85rem"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Thinking…</div>`;

  try {
    const resp = await AI.continueScenario(text);
    appendAIBubble(chat, 'tutor', resp.es, resp.en, resp.correction);
    showAIScenarioInput(resp.nextPrompt || 'Continue the conversation…');
  } catch (e) {
    showAIScenarioInput('Try again…');
  }
}

// ── AI: WRITING LAB ──────────────────────────────────────────────────────────
const WRITING_PROMPTS = [
  { title: 'Describe your family', prompt: 'Escribe sobre tu familia. ¿Cuántas personas hay? ¿Cómo se llaman? ¿Qué les gusta hacer?', hint: 'Write 3-5 sentences about your family members.' },
  { title: 'My daily routine', prompt: 'Describe un día típico. ¿A qué hora te levantas? ¿Qué haces durante el día?', hint: 'Write 3-5 sentences about what you do each day.' },
  { title: 'My favourite food', prompt: 'Escribe sobre tu comida favorita. ¿Qué te gusta comer? ¿Sabes cocinar?', hint: 'Write 3-5 sentences about food you enjoy.' },
  { title: 'My school', prompt: 'Describe tu colegio. ¿Qué asignaturas estudias? ¿Cuál es tu favorita?', hint: 'Write 3-5 sentences about your school and subjects.' },
  { title: 'Weekend plans', prompt: '¿Qué vas a hacer este fin de semana? Describe tus planes.', hint: 'Write 3-5 sentences about your weekend plans (use "voy a...").' },
  { title: 'Describe your town', prompt: 'Describe tu ciudad o pueblo. ¿Qué hay? ¿Qué puedes hacer allí?', hint: 'Write 3-5 sentences about where you live.' },
  { title: 'My hobbies', prompt: 'Escribe sobre tus pasatiempos. ¿Qué te gusta hacer en tu tiempo libre?', hint: 'Write 3-5 sentences about your hobbies.' },
  { title: 'A memorable holiday', prompt: 'Describe unas vacaciones que recuerdas. ¿Adónde fuiste? ¿Qué hiciste?', hint: 'Write 3-5 sentences about a holiday (try past tense).' },
];

function openWritingLab() {
  track('ai_usage', { feature: 'writing_lab' });
  showScreen('writing');
  const c = document.getElementById('writingContent');
  const wp = WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)];
  c.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">📝 Writing Exercise</div>
      <div class="q-text" style="font-size:1.1rem;margin-bottom:4px"><strong>${wp.title}</strong></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin:12px 0">
        <div style="font-size:1rem;font-style:italic">${wp.prompt}</div>
        <div style="font-size:.82rem;color:var(--muted);margin-top:6px">${wp.hint}</div>
      </div>
      <textarea id="writingArea" rows="6" placeholder="Write your response in Spanish here…"
        style="width:100%;padding:14px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:.95rem;resize:vertical;outline:none;transition:border .2s"
        onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px;align-items:center">
        <button class="btn btn-primary" onclick="submitWriting('${wp.title.replace(/'/g, "\\'")}')">📤 Submit for AI Review</button>
        <button class="btn btn-secondary" onclick="openWritingLab()">🔄 New Prompt</button>
      </div>
      <div id="writingFeedback" style="margin-top:16px"></div>
    </div>`;
}

async function submitWriting(promptTitle) {
  const text = document.getElementById('writingArea')?.value.trim();
  if (!text) { alert('Write something first!'); return; }
  const fb = document.getElementById('writingFeedback');
  fb.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--muted)"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div> AI is reading and grading your writing…</div>`;

  try {
    const known = AI.getKnownWordObjects();
    const data = await AI.gradeWriting(text, promptTitle, known);
    const scoreColor = data.score >= 8 ? 'var(--green)' : data.score >= 5 ? 'var(--accent2)' : 'var(--red)';
    fb.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-top:8px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div style="font-family:var(--font-display);font-size:2.5rem;font-weight:900;color:${scoreColor}">${data.score}/10</div>
          <div style="font-size:.9rem;color:var(--muted)">${data.encouragement}</div>
        </div>
        ${data.correctedText ? `
          <div style="margin-bottom:16px">
            <div style="font-size:.75rem;text-transform:uppercase;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">Corrected version</div>
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;font-style:italic;line-height:1.7">${data.correctedText}</div>
          </div>` : ''}
        ${data.errors && data.errors.length ? `
          <div style="margin-bottom:16px">
            <div style="font-size:.75rem;text-transform:uppercase;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">Corrections</div>
            ${data.errors.map(e => `
              <div style="background:rgba(231,76,60,.06);border:1px solid rgba(231,76,60,.15);border-radius:8px;padding:10px;margin-bottom:6px;font-size:.85rem">
                <span style="text-decoration:line-through;color:var(--red)">${e.original}</span> → <strong style="color:var(--green)">${e.corrected}</strong>
                <div style="color:var(--muted);font-size:.8rem;margin-top:2px">${e.rule}</div>
              </div>`).join('')}
          </div>` : ''}
        ${data.strengths && data.strengths.length ? `
          <div style="margin-bottom:12px">
            <div style="font-size:.75rem;text-transform:uppercase;color:var(--green);letter-spacing:.08em;margin-bottom:4px">Strengths</div>
            ${data.strengths.map(s => `<div style="font-size:.85rem;color:var(--text)">✅ ${s}</div>`).join('')}
          </div>` : ''}
        ${data.suggestions && data.suggestions.length ? `
          <div>
            <div style="font-size:.75rem;text-transform:uppercase;color:var(--blue);letter-spacing:.08em;margin-bottom:4px">To improve</div>
            ${data.suggestions.map(s => `<div style="font-size:.85rem;color:var(--text)">💡 ${s}</div>`).join('')}
          </div>` : ''}
      </div>`;
  } catch (e) {
    fb.innerHTML = `<div class="no-key-banner">❌ ${e.message}</div>`;
  }
}

// ── AI: STORY MODE ───────────────────────────────────────────────────────────
const STORY_THEMES = ['daily life', 'adventure', 'school', 'family', 'travel', 'mystery', 'sports', 'food'];

function openStoryMode() {
  track('ai_usage', { feature: 'story_mode' });
  showScreen('story');
  const c = document.getElementById('storyContent');
  c.innerHTML = `
    <div class="question-card" style="text-align:center">
      <div class="q-type-badge">📖 AI Story Generator</div>
      <div style="font-size:1.1rem;margin:12px 0">Pick a theme and AI will write a story using your known vocabulary!</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:16px 0">
        ${STORY_THEMES.map(t => `<button class="option" style="padding:10px 18px" onclick="generateStory('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
    </div>`;
}

async function generateStory(theme) {
  const c = document.getElementById('storyContent');
  c.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><div class="loading-text">AI is writing a "${theme}" story with your vocabulary…</div></div>`;

  try {
    const known = AI.getKnownWordObjects();
    if (known.length < 5) {
      c.innerHTML = `<div class="no-key-banner">Learn at least 5 words first so the AI can write a story with your vocabulary!</div><button class="btn btn-secondary" style="margin-top:12px" onclick="showScreen('dashboard')">← Dashboard</button>`;
      return;
    }
    const story = await AI.generateStory(known, theme);
    let storyQIdx = 0;

    c.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px">
        <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;margin-bottom:4px">${story.title}</div>
        <div style="font-size:.82rem;color:var(--muted);margin-bottom:16px">${story.titleEn}</div>
        <div id="storyText" style="line-height:1.9;font-size:1rem">
          ${story.sentences.map((s, i) => `
            <div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);cursor:pointer" onclick="this.querySelector('.st-en').style.display=this.querySelector('.st-en').style.display==='none'?'block':'none'" title="Click to see translation">
              <div>${s.es} ${speakBtn(s.es, 'tts-story-' + i, '🔊')}</div>
              <div class="st-en" style="display:none;font-size:.82rem;color:var(--muted);margin-top:4px;font-style:italic">${s.en}</div>
            </div>`).join('')}
        </div>
        <div style="text-align:center;font-size:.8rem;color:var(--dim);margin:12px 0">Click any sentence to see its translation</div>
      </div>
      <div style="margin-top:20px">
        <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;margin-bottom:12px">📝 Comprehension Questions</div>
        <div id="storyQuestions"></div>
      </div>`;

    renderStoryQuestion(story.questions, 0);
  } catch (e) {
    c.innerHTML = `<div class="no-key-banner">❌ ${e.message}</div><button class="btn btn-primary" style="margin-top:12px" onclick="openStoryMode()">← Try Again</button>`;
  }
}

function renderStoryQuestion(questions, idx) {
  const qc = document.getElementById('storyQuestions');
  if (!qc || idx >= questions.length) {
    if (qc) qc.innerHTML += `
      <div class="result-card" style="margin-top:16px">
        <div class="result-score">🎉</div>
        <div class="result-label">Story complete!</div>
        <div class="result-actions">
          <button class="btn btn-primary" onclick="openStoryMode()">📖 New Story</button>
          <button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button>
        </div>
      </div>`;
    return;
  }
  const q = questions[idx];
  const letters = ['A', 'B', 'C', 'D'];
  qc.innerHTML = `
    <div class="question-card" style="margin-bottom:12px">
      <div class="q-text" style="font-size:.95rem">${idx + 1}. ${q.q}</div>
      <div class="options-grid" style="margin-top:10px">
        ${(q.options || []).map((o, i) => `
          <button class="option" onclick="checkStoryAnswer(this, '${letters[i]}', '${q.answer}', '${(q.explanation || '').replace(/'/g, "\\'")}', ${idx}, ${questions.length})">
            <span class="opt-letter">${letters[i]}</span>${o}
          </button>`).join('')}
      </div>
      <div class="feedback-box" id="storyFb"></div>
    </div>`;
  window._storyQs = questions;
}

function checkStoryAnswer(btn, chosen, correct, explanation, idx, total) {
  document.querySelectorAll('#storyQuestions .option').forEach(b => b.disabled = true);
  const fb = document.getElementById('storyFb');
  if (chosen === correct) {
    btn.classList.add('correct');
    fb.className = 'feedback-box show ok';
    fb.innerHTML = `✅ Correct! ${explanation}`;
  } else {
    btn.classList.add('wrong');
    fb.className = 'feedback-box show bad';
    fb.innerHTML = `❌ Answer: ${correct}. ${explanation}`;
  }
  setTimeout(() => renderStoryQuestion(window._storyQs, idx + 1), 1800);
}

// ── AI: SMART QUIZ ───────────────────────────────────────────────────────────
let _aiQs = [], _aiQIdx = 0, _aiQCorrect = 0;

function openAIQuiz() {
  track('ai_usage', { feature: 'ai_quiz' });
  showScreen('ai-quiz');
  const c = document.getElementById('aiQuizContent');
  c.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><div class="loading-text">AI is crafting a quiz targeting your weak spots…</div></div>`;
  document.getElementById('aiQuizProgress').style.width = '0%';
  document.getElementById('aiQuizCounter').textContent = '';
  launchAIQuiz();
}

async function launchAIQuiz() {
  const c = document.getElementById('aiQuizContent');
  try {
    let words = AI.getWeakWordObjects();
    if (words.length < 4) words = shuffle(VOCAB).slice(0, 8);
    else words = shuffle(words).slice(0, 8);

    const qs = await AI.generateQuiz(words, 'mixed', 6);
    _aiQs = qs; _aiQIdx = 0; _aiQCorrect = 0;
    renderAIQuizQ();
  } catch (e) {
    c.innerHTML = `<div class="no-key-banner">❌ ${e.message}</div><button class="btn btn-primary" style="margin-top:12px" onclick="openAIQuiz()">Retry</button>`;
  }
}

function renderAIQuizQ() {
  const c = document.getElementById('aiQuizContent');
  if (_aiQIdx >= _aiQs.length) {
    const pct = Math.round(_aiQCorrect / _aiQs.length * 100);
    const emoji = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚';
    c.innerHTML = `
      <div class="result-card">
        <div style="font-size:3rem;margin-bottom:8px">${emoji}</div>
        <div class="result-score">${pct}%</div>
        <div class="result-label">${_aiQCorrect} / ${_aiQs.length} correct</div>
        <div class="result-actions" style="margin-top:16px">
          <button class="btn btn-primary" onclick="openAIQuiz()">🧠 New Quiz</button>
          <button class="btn btn-secondary" onclick="showScreen('dashboard')">🏠 Dashboard</button>
        </div>
      </div>`;
    return;
  }
  const q = _aiQs[_aiQIdx];
  const pct = Math.round(_aiQIdx / _aiQs.length * 100);
  document.getElementById('aiQuizProgress').style.width = pct + '%';
  document.getElementById('aiQuizCounter').textContent = `${_aiQIdx + 1}/${_aiQs.length}`;

  const badge = q.type === 'mcq' ? '🎯 Multiple Choice' : q.type === 'fill_blank' ? '✏️ Fill in Blank' : '🌐 Translate';
  const qWithTTS = q.question + (q.word ? ` ${speakBtn(q.word, 'tts-aiq-w')}` : '');

  let body = '';
  if (q.type === 'mcq' && q.options) {
    const letters = ['A', 'B', 'C', 'D'];
    body = `<div class="options-grid">${(q.options || []).map((o, i) => `
      <button class="option" onclick="checkAIQuizMCQ(this, '${o.replace(/'/g, "\\'")}', '${(q.answer || '').replace(/'/g, "\\'")}')">
        <span class="opt-letter">${letters[i]}</span>${o}
      </button>`).join('')}</div>`;
  } else {
    body = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input class="fill-input" id="aiqAns" placeholder="Type your answer…" style="max-width:320px" onkeydown="if(event.key==='Enter') checkAIQuizFill()"/>
      <button class="submit-btn" onclick="checkAIQuizFill()">Check ✓</button>
    </div>`;
  }

  c.innerHTML = `
    <div class="question-card">
      <div class="q-type-badge">${badge}</div>
      <div class="q-text">${qWithTTS}</div>
      <div class="q-hint">${q.hint || ''}</div>
      ${body}
      <div class="feedback-box" id="feedback"></div>
      <div id="grammarHelp"></div>
      <button class="next-btn" id="nextBtn" onclick="_aiQIdx++;renderAIQuizQ()">Next →</button>
    </div>`;
  if (q.type !== 'mcq') setTimeout(() => document.getElementById('aiqAns')?.focus(), 50);
  if (q.word) setTimeout(() => speak(q.word, 'tts-aiq-w'), 200);
}

function checkAIQuizMCQ(btn, chosen, correct) {
  document.querySelectorAll('.option').forEach(b => b.disabled = true);
  const q = _aiQs[_aiQIdx];
  const norm = s => s.trim().toLowerCase();
  if (norm(chosen) === norm(correct)) {
    btn.classList.add('correct'); _aiQCorrect++;
    showFeedback(true, `✅ Correct! ${q.explanation || ''}`);
    if (q.word) Mastery.recordAnswer(q.word, true, 'ai_quiz');
  } else {
    btn.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${correct}</b>. ${q.explanation || ''}`);
    if (q.word) {
      Mastery.recordAnswer(q.word, false, 'ai_quiz');
      const wObj = VOCAB.find(w => w.spanish === q.word);
      if (wObj) loadGrammarHelp(wObj, chosen, correct, q.type);
    }
  }
}

function checkAIQuizFill() {
  const inp = document.getElementById('aiqAns');
  if (!inp || !inp.value.trim()) return;
  const q = _aiQs[_aiQIdx];
  const norm = s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (norm(inp.value) === norm(q.answer)) {
    inp.classList.add('correct'); _aiQCorrect++;
    showFeedback(true, `✅ Correct! ${q.explanation || ''}`);
    if (q.word) Mastery.recordAnswer(q.word, true, 'ai_quiz');
  } else {
    inp.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${q.answer}</b>. ${q.explanation || ''}`);
    if (q.word) {
      Mastery.recordAnswer(q.word, false, 'ai_quiz');
      const wObj = VOCAB.find(w => w.spanish === q.word);
      if (wObj) loadGrammarHelp(wObj, inp.value, q.answer, q.type);
    }
  }
}

// ── AI: STUDY COACH ──────────────────────────────────────────────────────────
async function openStudyCoach() {
  track('ai_usage', { feature: 'study_coach' });
  showScreen('coach');
  const c = document.getElementById('coachContent');
  const stats = Mastery.getOverallStats();
  c.innerHTML = `
    <div class="question-card" style="text-align:center">
      <div style="font-size:3rem;margin-bottom:12px">🎯</div>
      <div style="font-size:1.1rem;font-weight:600;margin-bottom:16px">Analyzing your progress…</div>
      <div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px">
        <div><div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;color:var(--green)">${stats.learned}</div><div style="font-size:.75rem;color:var(--muted)">Learned</div></div>
        <div><div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;color:var(--accent2)">${stats.learning}</div><div style="font-size:.75rem;color:var(--muted)">In Progress</div></div>
        <div><div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;color:var(--blue)">${stats.reviewDue}</div><div style="font-size:.75rem;color:var(--muted)">Due Review</div></div>
        <div><div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;color:var(--muted)">${stats.total - stats.learned - stats.learning}</div><div style="font-size:.75rem;color:var(--muted)">Not Started</div></div>
      </div>
      <div id="coachAdvice" style="text-align:left"><div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.85rem;justify-content:center"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div> AI is analyzing your learning patterns…</div></div>
    </div>`;

  try {
    const mastery = Mastery.getMasteryData();
    const advice = await AI.getStudyRecommendation(mastery);
    document.getElementById('coachAdvice').innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;line-height:1.7;font-size:.92rem">
        <div style="font-weight:600;color:var(--accent);margin-bottom:8px">🧑‍🏫 Profesora Luna says:</div>
        ${advice}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
        <button class="btn btn-primary" onclick="continueLearning()">▶ Continue Learning</button>
        <button class="btn btn-secondary" onclick="startReviewSession()">🔄 Review Weak Words</button>
        <button class="btn btn-secondary" onclick="openAIQuiz()">🧠 AI Quiz</button>
      </div>`;
  } catch (e) {
    document.getElementById('coachAdvice').innerHTML = `<div class="no-key-banner">❌ ${e.message}</div>`;
  }
}

// ── MY PROGRESS DASHBOARD ─────────────────────────────────────────────────
function openMyProgress() {
  track('ai_usage', { feature: 'my_progress' });
  showScreen('progress');
  renderProgressDashboard();
}

function renderProgressDashboard() {
  const c = document.getElementById('progressContent');
  const stats = Mastery.getOverallStats();
  const mastery = Mastery.getMasteryData();
  const streak = Mastery.getStreakDays();
  const todayCount = Mastery.getTodayWordCount();
  const phases = Curriculum.getPhases();
  const units = Curriculum.getUnits();

  // Compute category-level stats
  const catStats = {};
  for (const w of VOCAB) {
    const cat = w.category;
    if (!catStats[cat]) catStats[cat] = { total: 0, sum: 0, mastered: 0, weak: 0, words: [] };
    const level = mastery[w.spanish] || 0;
    catStats[cat].total++;
    catStats[cat].sum += level;
    if (level >= 4) catStats[cat].mastered++;
    if (level >= 1 && level <= 2) catStats[cat].weak++;
    catStats[cat].words.push({ word: w.spanish, english: w.english, level });
  }

  // Sort categories by avg mastery
  const catArr = Object.entries(catStats).map(([cat, s]) => ({
    cat, shortCat: cat.replace(/^\d+\.\s*/, ''), avg: s.total > 0 ? s.sum / (s.total * 5) * 100 : 0,
    mastered: s.mastered, total: s.total, weak: s.weak, words: s.words,
  }));
  const strengths = [...catArr].sort((a, b) => b.avg - a.avg).slice(0, 4);
  const weaknesses = [...catArr].sort((a, b) => a.avg - b.avg).slice(0, 4);

  // Weak words (level 1-2 with at least some exposure)
  const weakWords = [];
  for (const w of VOCAB) {
    const lvl = mastery[w.spanish] || 0;
    if (lvl >= 1 && lvl <= 2) weakWords.push({ spanish: w.spanish, english: w.english, level: lvl, cat: w.category.replace(/^\d+\.\s*/, '') });
  }
  weakWords.sort((a, b) => a.level - b.level);

  // Effort remaining
  const totalMasteryPoints = VOCAB.length * 5;
  const currentPoints = VOCAB.reduce((sum, w) => sum + Math.min(mastery[w.spanish] || 0, 5), 0);
  const overallPct = Math.round(currentPoints / totalMasteryPoints * 100);
  const wordsNotStarted = stats.total - stats.learned - stats.learning;
  const avgWordsPerDay = todayCount > 0 ? todayCount : 5;
  const estDaysRemaining = wordsNotStarted > 0 ? Math.ceil(wordsNotStarted / avgWordsPerDay) : 0;

  // Level distribution
  const lvlColors = ['var(--dim)', 'var(--accent2)', 'var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--green)'];
  const lvlLabels = ['Not Started', 'Introduced', 'Recognised', 'Familiar', 'Strong', 'Mastered'];
  const maxLvl = Math.max(...Object.values(stats.levels), 1);

  // Phase progress
  const phaseStats = phases.map(p => {
    const pUnits = units.filter(u => u.phase === p.phase);
    const pWords = pUnits.flatMap(u => u.words);
    const pTotal = pWords.length * 5;
    const pCurrent = pWords.reduce((sum, w) => sum + Math.min(mastery[w.spanish] || 0, 5), 0);
    const pPct = pTotal > 0 ? Math.round(pCurrent / pTotal * 100) : 0;
    const pLearned = pWords.filter(w => (mastery[w.spanish] || 0) >= 3).length;
    return { ...p, pct: pPct, learned: pLearned, total: pWords.length, units: pUnits.length };
  });

  // Ring chart dimensions
  const ringSize = 140;
  const ringStroke = 14;
  const ringR = (ringSize - ringStroke) / 2;
  const ringC = 2 * Math.PI * ringR;
  const masteredPct = stats.total > 0 ? stats.mastered / stats.total : 0;
  const learnedPct = stats.total > 0 ? stats.learned / stats.total : 0;
  const learningPct = stats.total > 0 ? stats.learning / stats.total : 0;

  c.innerHTML = `
    <!-- Row 1: Overview cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px">

      <!-- Overall ring -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px;display:flex;align-items:center;gap:24px">
        <div style="position:relative;width:${ringSize}px;height:${ringSize}px;flex-shrink:0">
          <svg width="${ringSize}" height="${ringSize}" style="transform:rotate(-90deg)">
            <circle cx="${ringSize/2}" cy="${ringSize/2}" r="${ringR}" fill="none" stroke="var(--dim)" stroke-width="${ringStroke}"/>
            <circle cx="${ringSize/2}" cy="${ringSize/2}" r="${ringR}" fill="none" stroke="var(--accent2)" stroke-width="${ringStroke}"
              stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - learningPct - learnedPct - masteredPct)}" stroke-linecap="round"/>
            <circle cx="${ringSize/2}" cy="${ringSize/2}" r="${ringR}" fill="none" stroke="var(--blue)" stroke-width="${ringStroke}"
              stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - learnedPct - masteredPct)}" stroke-linecap="round"/>
            <circle cx="${ringSize/2}" cy="${ringSize/2}" r="${ringR}" fill="none" stroke="var(--green)" stroke-width="${ringStroke}"
              stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - masteredPct)}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;color:var(--text)">${overallPct}%</div>
            <div style="font-size:.65rem;color:var(--muted)">Overall</div>
          </div>
        </div>
        <div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:10px">Word Mastery</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:.82rem">
            <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:var(--green);flex-shrink:0"></span> <b>${stats.mastered}</b> Mastered</div>
            <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:var(--blue);flex-shrink:0"></span> <b>${stats.learned - stats.mastered}</b> Learned</div>
            <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:var(--accent2);flex-shrink:0"></span> <b>${stats.learning}</b> In Progress</div>
            <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:var(--dim);flex-shrink:0"></span> <b>${wordsNotStarted}</b> Not Started</div>
          </div>
        </div>
      </div>

      <!-- Key metrics -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">Key Metrics</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="text-align:center;padding:12px;background:var(--surface);border-radius:10px">
            <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--accent2)">${streak}</div>
            <div style="font-size:.72rem;color:var(--muted)">Day Streak 🔥</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--surface);border-radius:10px">
            <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--blue)">${todayCount}</div>
            <div style="font-size:.72rem;color:var(--muted)">Words Today</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--surface);border-radius:10px">
            <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--purple)">${stats.reviewDue}</div>
            <div style="font-size:.72rem;color:var(--muted)">Due for Review</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--surface);border-radius:10px">
            <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--green)">${estDaysRemaining > 0 ? '~' + estDaysRemaining + 'd' : '✅'}</div>
            <div style="font-size:.72rem;color:var(--muted)">${estDaysRemaining > 0 ? 'Est. Days Left' : 'All Introduced!'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Phase Progress -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px;margin-bottom:24px">
      <div style="font-weight:700;font-size:1rem;margin-bottom:16px">📈 Phase Progress & Effort Remaining</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${phaseStats.map(p => `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:.85rem;font-weight:600">${p.icon} Phase ${p.phase}: ${p.title}</div>
              <div style="font-size:.78rem;color:var(--muted)">${p.learned}/${p.total} words · ${p.units} units · ${p.pct}%</div>
            </div>
            <div style="background:var(--dim);border-radius:6px;height:10px;overflow:hidden">
              <div style="height:100%;width:${p.pct}%;background:${p.pct >= 90 ? 'var(--green)' : p.pct >= 50 ? 'var(--blue)' : 'var(--accent)'};border-radius:6px;transition:width .5s"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Row 3: Mastery distribution + Strengths/Weaknesses -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px">

      <!-- Mastery Level Distribution -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:16px">🎚️ Mastery Level Distribution</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[0,1,2,3,4,5].map(lvl => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:.72rem;color:var(--muted);width:72px;text-align:right;flex-shrink:0">${lvlLabels[lvl]}</div>
              <div style="flex:1;background:var(--dim);border-radius:4px;height:18px;overflow:hidden;position:relative">
                <div style="height:100%;width:${(stats.levels[lvl] / maxLvl * 100)}%;background:${lvlColors[lvl]};border-radius:4px;transition:width .5s"></div>
              </div>
              <div style="font-size:.82rem;font-weight:600;width:32px;text-align:right">${stats.levels[lvl]}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Strengths & Weaknesses by category -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">💪 Strengths</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
          ${strengths.map(s => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.shortCat}</div>
              <div style="width:80px;background:var(--dim);border-radius:4px;height:8px;overflow:hidden;flex-shrink:0">
                <div style="height:100%;width:${s.avg}%;background:var(--green);border-radius:4px"></div>
              </div>
              <div style="font-size:.78rem;font-weight:600;width:36px;text-align:right;color:var(--green)">${Math.round(s.avg)}%</div>
            </div>
          `).join('')}
        </div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">⚠️ Needs Work</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${weaknesses.map(s => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.shortCat}</div>
              <div style="width:80px;background:var(--dim);border-radius:4px;height:8px;overflow:hidden;flex-shrink:0">
                <div style="height:100%;width:${s.avg}%;background:var(--accent2);border-radius:4px"></div>
              </div>
              <div style="font-size:.78rem;font-weight:600;width:36px;text-align:right;color:var(--accent2)">${Math.round(s.avg)}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Row 4: Weak words -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-weight:700;font-size:1rem">🔴 Words That Need Attention (${weakWords.length})</div>
        ${weakWords.length > 0 ? '<button class="btn btn-secondary" style="font-size:.78rem;padding:6px 14px" onclick="startReviewSession()">🔄 Review These</button>' : ''}
      </div>
      ${weakWords.length === 0 ? '<div style="font-size:.85rem;color:var(--muted);padding:12px 0">No weak words right now — great job! Keep learning new ones.</div>' : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:300px;overflow-y:auto">
          ${weakWords.slice(0, 40).map(w => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);border-radius:8px;font-size:.82rem">
              <div style="width:6px;height:6px;border-radius:50%;background:${w.level <= 1 ? 'var(--accent2)' : 'var(--accent)'};flex-shrink:0"></div>
              <div style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${w.spanish}">${w.spanish}</div>
              <div style="color:var(--muted);font-size:.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${w.english}">${w.english}</div>
            </div>
          `).join('')}
        </div>
        ${weakWords.length > 40 ? `<div style="font-size:.78rem;color:var(--muted);margin-top:8px;text-align:center">… and ${weakWords.length - 40} more</div>` : ''}
      `}
    </div>

    <!-- Row 5: Actions -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:12px 0">
      <button class="btn btn-primary" onclick="continueLearning()">▶ Continue Learning</button>
      <button class="btn btn-secondary" onclick="startReviewSession()">🔄 Review Weak Words</button>
      <button class="btn btn-secondary" onclick="openAIQuiz()">🧠 AI Quiz My Weak Spots</button>
      <button class="btn btn-secondary" onclick="openStudyCoach()">🎯 Get AI Study Plan</button>
    </div>
  `;
}

// ── AUTH UI ───────────────────────────────────────────────────────────────
function renderAuthUI() {
  const area = document.getElementById('auth-area');
  const user = Auth.getUser();
  if (user) {
    const initials = (user.name || 'U').substring(0, 2).toUpperCase();
    area.innerHTML = `
      <div class="user-pill"><div class="avatar">${initials}</div><span class="name">${user.name}</span></div>
      <button class="logout-btn" onclick="Auth.logout()">Sign Out</button>`;
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('app-main').style.display = 'block';
    document.getElementById('ai-dot').style.background = 'var(--green)';
    document.getElementById('ai-label').textContent = 'AI ready';
  } else {
    area.innerHTML = `<button class="btn btn-primary" onclick="Auth.login()" style="padding:8px 18px;font-size:.82rem">Sign In</button>`;
    document.getElementById('auth-gate').style.display = 'flex';
    document.getElementById('app-main').style.display = 'none';
    document.getElementById('ai-dot').style.background = 'var(--accent2)';
    document.getElementById('ai-label').textContent = 'Sign in for AI';
  }
}

// ── INIT PRACTICE FILTERS ────────────────────────────────────────────────────
function initPracticeFilters() {
  const sel = document.getElementById('fpCat');
  if (!sel) return;
  const cats = [...new Set(VOCAB.map(w => w.category))];
  for (const c of cats) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c.replace(/^\d+\.\s*/, '');
    sel.appendChild(opt);
  }
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
async function boot() {
  await Auth.handleCallback();
  if (Auth.getTokens() && !Auth.isLoggedIn()) await Auth.refreshToken();

  renderAuthUI();

  if (Auth.isLoggedIn()) {
    // Load curriculum from API (falls back to local vocab-data.js + curriculum.js)
    try {
      await DataService.loadCurriculum();
    } catch (e) {
      console.warn('Curriculum API unavailable, using local data');
    }

    // Load progress from cloud (mastery, SRS, history)
    try {
      await DataService.loadProgress();
    } catch (e) {
      console.warn('Progress sync unavailable, using local storage');
    }

    // Legacy progress load as fallback
    await Progress.loadFromCloud();

    initPracticeFilters();
    Chatbot.init();
    renderDashboard();

    // Start auto-sync (saves mastery to cloud every 30s + on page unload)
    try { DataService.startAutoSync(); } catch(e) {}
  }
}

boot();
