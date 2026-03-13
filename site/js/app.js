// ── HELPERS ───────────────────────────────────────────────────────────────────
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function pick(arr, n) { return shuffle(arr).slice(0, n); }

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
      <button class="btn btn-primary" style="margin-top:16px" onclick="submitLearn()">Got it — Next →</button>
    </div>`;
  setTimeout(() => speak(w.spanish, 'tts-learn-' + ex.index), 300);
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
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  if (isEsToEn) setTimeout(() => speak(ex.prompt, 'tts-mcq-q'), 200);
}

function submitMCQ(btn, chosen) {
  document.querySelectorAll('.option').forEach(b => b.disabled = true);
  const result = LessonEngine.submitAnswer(chosen);
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
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('produceAns')?.focus(), 50);
}

function submitProduce() {
  const inp = document.getElementById('produceAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
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
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('fillAns')?.focus(), 50);
}

function submitFill() {
  const inp = document.getElementById('fillAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
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
      <button class="next-btn" id="nextBtn" onclick="renderExercise()">Next →</button>
    </div>`;
  setTimeout(() => document.getElementById('transAns')?.focus(), 50);
}

function submitTranslate() {
  const inp = document.getElementById('transAns');
  if (!inp || !inp.value.trim()) return;
  const result = LessonEngine.submitAnswer(inp.value);
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (result.correct) {
    inp.classList.add('correct');
    showFeedback(true, `✅ Correct! <b>${result.answer}</b> ${result.explanation}`);
  } else {
    inp.classList.add('wrong');
    showFeedback(false, `❌ Answer: <b>${result.answer}</b>. ${result.explanation}`);
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

// ── AUTH UI ───────────────────────────────────────────────────────────────────
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
    initPracticeFilters();
    Chatbot.init();
    await Progress.loadFromCloud();
    renderDashboard();
  }
}

boot();
