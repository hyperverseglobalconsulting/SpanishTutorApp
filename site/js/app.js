// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  mode:'home', cat:'all', priority:'all',
  learned: Progress.getLearned(),
  streak: Progress.getStreak(),
  lastScore: Progress.getLastScore(),
  quizQ:[], quizIdx:0, quizCorrect:0,
  fcIdx:0, fcDeck:[],
  matchSel:null, matchTimer:null, matchStart:0, matchMatched:0,
};

function save(){
  Progress.updateStreak(state.streak);
  if(state.lastScore) Progress.updateLastScore(state.lastScore);
}

// ── TTS ENGINE ───────────────────────────────────────────────────────────────
const ttsCache = {};
let ttsAudio = null;
let ttsActiveBtnId = null;

async function speak(text, btnId){
  if(!text) return;
  if(ttsAudio){ ttsAudio.pause(); ttsAudio=null; }
  if(ttsActiveBtnId){
    const old = document.getElementById(ttsActiveBtnId);
    if(old) old.classList.remove('playing');
  }
  const btn = btnId ? document.getElementById(btnId) : null;
  // Use browser SpeechSynthesis
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'es-ES';
  const voices = speechSynthesis.getVoices();
  const esVoice = voices.find(v=>v.lang.startsWith('es'));
  if(esVoice) utt.voice = esVoice;
  utt.rate = 0.9;
  if(btn){ btn.classList.add('playing'); utt.onend=()=>btn.classList.remove('playing'); }
  speechSynthesis.speak(utt);
}

function speakBtn(text, id, label='🔊'){
  const safeText = text.replace(/'/g,"\\'");
  return `<button class="speak-btn" id="${id}" onclick="speak('${safeText}','${id}')">${label}</button>`;
}

// ── FILTER VOCAB ─────────────────────────────────────────────────────────────
function filteredVocab(){
  return VOCAB.filter(w=>{
    if(state.cat!=='all' && w.category!==state.cat) return false;
    if(state.priority!=='all' && w.priority!==state.priority) return false;
    return true;
  });
}

function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function pick(arr,n){return shuffle(arr).slice(0,n)}

// ── SIDEBAR INIT ─────────────────────────────────────────────────────────────
function initSidebar(){
  const cats = [...new Set(VOCAB.map(w=>w.category))];
  const list = document.getElementById('catList');
  list.innerHTML = cats.map(c=>{
    const n = VOCAB.filter(w=>w.category===c).length;
    return `<button class="cat-btn" data-cat="${c}"><span>${c.replace(/^\d+\.\s*/,'')}</span><span class="cat-badge">${n}</span></button>`;
  }).join('');

  document.querySelectorAll('.cat-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.cat-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.cat = b.dataset.cat;
    });
  });
  document.querySelectorAll('.ppill').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.ppill').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.priority = b.dataset.p;
    });
  });
  document.querySelectorAll('.mode-btn').forEach(b=>{
    b.addEventListener('click',()=>startMode(b.dataset.mode));
  });
  updateStats();
}

function updateStats(){
  document.getElementById('statTotal').textContent = filteredVocab().length;
  document.getElementById('statLearned').textContent = state.learned.size;
  document.getElementById('statStreak').textContent = state.streak;
  document.getElementById('statScore').textContent = state.lastScore||'—';
}

// ── SCREEN ROUTING ────────────────────────────────────────────────────────────
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
  document.querySelectorAll('.mode-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.mode===id);
  });
  state.mode=id;
  updateStats();
}

function showHome(){showScreen('home')}

function startMode(mode){
  showScreen(mode);
  if(mode==='flashcard') startFlashcards();
  else if(mode==='mcq') startMCQ();
  else if(mode==='fill') startFill();
  else if(mode==='match') startMatch();
  else if(mode==='aiquiz') startAIQuiz();
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function questionCard(badge, qText, hint, bodyHTML){
  return `<div class="question-card">
    <div class="q-type-badge">${badge}</div>
    <div class="q-text">${qText}</div>
    ${hint?`<div class="q-hint">${hint}</div>`:''}
    ${bodyHTML}
    <div class="feedback-box" id="feedback"></div>
    <button class="next-btn" id="nextBtn" onclick="nextQuestion()">Next →</button>
  </div>`;
}

function showFeedback(ok, msg){
  const fb = document.getElementById('feedback');
  fb.className = 'feedback-box show ' + (ok?'ok':'bad');
  fb.innerHTML = msg;
  const nb = document.getElementById('nextBtn');
  if(nb) nb.classList.add('show');
}

function resultCard(correct, total, onRetry){
  const pct = Math.round(correct/total*100);
  state.lastScore = pct+'%';
  if(pct>=70) state.streak++;
  else state.streak=0;
  save(); updateStats();
  Progress.recordQuiz(state.mode, correct, total);
  return `<div class="result-card">
    <div class="result-score">${pct}%</div>
    <div class="result-label">${correct} / ${total} correct · ${pct>=80?'🌟 Excellent!':pct>=60?'👍 Good job!':'📚 Keep practising!'}</div>
    <div class="result-actions">
      <button class="btn btn-primary" onclick="${onRetry}">🔄 Try Again</button>
      <button class="btn btn-secondary" onclick="showHome()">🏠 Home</button>
    </div>
  </div>`;
}

// ── FLASHCARDS ────────────────────────────────────────────────────────────────
function startFlashcards(){
  state.fcDeck = shuffle(filteredVocab());
  state.fcIdx = 0;
  renderFlashcard();
}

function renderFlashcard(){
  const deck = state.fcDeck;
  if(state.fcIdx >= deck.length){
    document.getElementById('fc-content').innerHTML = resultCard(
      deck.filter(w=>state.learned.has(w.spanish)).length, deck.length, 'startFlashcards()');
    return;
  }
  const w = deck[state.fcIdx];
  const pct = Math.round(state.fcIdx/deck.length*100);
  document.getElementById('fc-progress').style.width = pct+'%';
  document.getElementById('fc-content').innerHTML = `
    <div class="flashcard-wrap">
      <div class="flashcard" id="fc" onclick="this.classList.toggle('flipped')">
        <div class="fc-face fc-front">
          <div class="fc-word">${w.spanish}</div>
          <div class="fc-sub">${w.pos}${w.notes?' · '+w.notes:''} · ${w.priority}</div>
          <div class="tts-row" style="justify-content:center;margin-top:10px" onclick="event.stopPropagation()">
            ${speakBtn(w.spanish,'tts-fc-word','🔊 Word')}
            ${w.example_es ? speakBtn(w.example_es,'tts-fc-ex','🔊 Sentence') : ''}
          </div>
          <div class="fc-sub" style="margin-top:8px;color:var(--dim)">Click card to reveal</div>
        </div>
        <div class="fc-face fc-back">
          <div class="fc-word" style="font-size:1.6rem">${w.english}</div>
          <div class="fc-sub">${w.category.replace(/^\d+\.\s*/,'')}</div>
          ${w.example_es?`<div class="fc-example"><i>${w.example_es}</i><br/><span style="color:var(--dim)">${w.example_en}</span></div>`:''}
        </div>
      </div>
    </div>
    <div class="fc-controls">
      <button class="fc-btn skip" onclick="fcNext(false)">👎 Still learning</button>
      <button class="fc-btn know" onclick="fcNext(true)">✓ I know this</button>
    </div>
    <div class="fc-counter">${state.fcIdx+1} / ${deck.length}</div>`;
  setTimeout(()=>speak(w.spanish,'tts-fc-word'), 300);
}

function fcNext(know){
  const w = state.fcDeck[state.fcIdx];
  if(know){ state.learned.add(w.spanish); Progress.markLearned(w.spanish); }
  state.fcIdx++;
  renderFlashcard();
}

// ── MCQ ───────────────────────────────────────────────────────────────────────
function startMCQ(){
  const pool = shuffle(filteredVocab()).slice(0,15);
  state.quizQ = pool; state.quizIdx=0; state.quizCorrect=0;
  renderMCQ();
}

function renderMCQ(){
  if(state.quizIdx >= state.quizQ.length){
    document.getElementById('mcq-content').innerHTML = resultCard(state.quizCorrect, state.quizQ.length, 'startMCQ()');
    return;
  }
  const w = state.quizQ[state.quizIdx];
  const pct = Math.round(state.quizIdx/state.quizQ.length*100);
  document.getElementById('mcq-progress').style.width = pct+'%';

  const others = shuffle(VOCAB.filter(x=>x.spanish!==w.spanish)).slice(0,3);
  const options = shuffle([w, ...others]);
  const letters = ['A','B','C','D'];

  document.getElementById('mcq-content').innerHTML = questionCard(
    '🎯 Multiple Choice',
    `What does <strong style="color:var(--accent);font-family:var(--font-display);font-size:1.3rem">${w.spanish}</strong> mean?
     <span style="display:inline-block;margin-left:8px;vertical-align:middle">${speakBtn(w.spanish,'tts-mcq-word')}</span>`,
    w.pos + (w.notes?' · '+w.notes:''),
    `<div class="options-grid">
      ${options.map((o,i)=>`
        <button class="option" onclick="checkMCQ(this,'${o.spanish}','${w.spanish}')">
          <span class="opt-letter">${letters[i]}</span>${o.english}
        </button>`).join('')}
    </div>`
  );
  window.nextQuestion = ()=>{state.quizIdx++; renderMCQ()};
  setTimeout(()=>speak(w.spanish,'tts-mcq-word'), 300);
}

function checkMCQ(btn, chosen, correct){
  document.querySelectorAll('.option').forEach(b=>b.disabled=true);
  const w = state.quizQ[state.quizIdx];
  if(chosen===correct){
    btn.classList.add('correct');
    state.quizCorrect++;
    state.learned.add(correct); Progress.markLearned(correct);
    const exHtml = w.example_es ? `<br/><i>${w.example_es}</i> — ${w.example_en} ${speakBtn(w.example_es,'tts-mcq-fb','🔊')}` : '';
    showFeedback(true,`✅ Correct! <b>${w.spanish}</b> = <b>${w.english}</b>${exHtml}`);
    if(w.example_es) setTimeout(()=>speak(w.example_es,'tts-mcq-fb'),400);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option').forEach(b=>{
      if(b.onclick.toString().includes(`'${correct}'`)) b.classList.add('correct');
    });
    const exHtml = w.example_es ? `<br/><i>${w.example_es}</i> — ${w.example_en} ${speakBtn(w.example_es,'tts-mcq-fb','🔊')}` : '';
    showFeedback(false,`❌ The answer was <b>${w.english}</b>${exHtml}`);
    if(w.example_es) setTimeout(()=>speak(w.example_es,'tts-mcq-fb'),400);
  }
}

// ── FILL IN THE BLANK ─────────────────────────────────────────────────────────
function startFill(){
  const pool = shuffle(filteredVocab().filter(w=>w.example_es && w.example_es.length>5)).slice(0,12);
  state.quizQ = pool; state.quizIdx=0; state.quizCorrect=0;
  renderFill();
}

function renderFill(){
  if(state.quizIdx >= state.quizQ.length){
    document.getElementById('fill-content').innerHTML = resultCard(state.quizCorrect, state.quizQ.length, 'startFill()');
    return;
  }
  const w = state.quizQ[state.quizIdx];
  const pct = Math.round(state.quizIdx/state.quizQ.length*100);
  document.getElementById('fill-progress').style.width = pct+'%';

  const re = new RegExp(w.spanish.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  const blanked = w.example_es.replace(re,'<span style="color:var(--accent);font-weight:700">______</span>');

  window.nextQuestion = ()=>{state.quizIdx++; renderFill()};

  document.getElementById('fill-content').innerHTML = questionCard(
    '✏️ Fill in the Blank',
    `Complete the sentence: <br/><span style="font-size:1.05rem;margin-top:6px;display:block">${blanked}</span>
     <span style="display:inline-block;margin-top:6px">${speakBtn(w.example_es,'tts-fill-sent','🔊 Hear sentence')}</span>`,
    `Hint: ${w.english} (${w.pos})`,
    `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input class="fill-input" id="fillAns" placeholder="Type the Spanish word…" style="max-width:280px"
        onkeydown="if(event.key==='Enter') checkFill()"/>
      <button class="submit-btn" onclick="checkFill()">Check ✓</button>
    </div>`
  );
  setTimeout(()=>document.getElementById('fillAns')?.focus(),50);
}

function checkFill(){
  const inp = document.getElementById('fillAns');
  if(!inp) return;
  const ans = inp.value.trim().toLowerCase();
  const w = state.quizQ[state.quizIdx];
  const correct = w.spanish.toLowerCase();
  const norm = s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(norm(ans)===norm(correct) || ans===correct){
    inp.classList.add('correct');
    state.quizCorrect++;
    state.learned.add(w.spanish); Progress.markLearned(w.spanish);
    showFeedback(true,`✅ Correct! <b>${w.spanish}</b> — ${w.english}<br/><i>${w.example_es}</i> ${speakBtn(w.example_es,'tts-fill-fb','🔊')}`);
    setTimeout(()=>speak(w.example_es,'tts-fill-fb'),400);
  } else {
    inp.classList.add('wrong');
    inp.disabled=true;
    showFeedback(false,`❌ Answer: <b>${w.spanish}</b> — ${w.english}<br/><i>${w.example_es}</i> ${speakBtn(w.example_es,'tts-fill-fb','🔊')}`);
    setTimeout(()=>speak(w.example_es,'tts-fill-fb'),400);
  }
  inp.disabled=true;
  document.querySelector('.submit-btn').disabled=true;
}

// ── MATCH THE WORDS ───────────────────────────────────────────────────────────
function startMatch(){
  clearInterval(state.matchTimer);
  const pool = pick(filteredVocab(), 8);
  state.matchSel = null; state.matchMatched = 0;
  state.matchStart = Date.now();

  const lefts = shuffle(pool.map(w=>({id:w.spanish, text:w.spanish, type:'es'})));
  const rights = shuffle(pool.map(w=>({id:w.spanish, text:w.english, type:'en'})));

  document.getElementById('match-content').innerHTML = `
    <div class="match-grid">
      <div class="match-col" id="match-left">
        ${lefts.map(w=>`<div class="match-item" data-id="${w.id}" data-type="es" onclick="matchClick(this)">${w.text}</div>`).join('')}
      </div>
      <div class="match-col" id="match-right">
        ${rights.map(w=>`<div class="match-item" data-id="${w.id}" data-type="en" onclick="matchClick(this)">${w.text}</div>`).join('')}
      </div>
    </div>
    <div id="match-result" style="margin-top:16px"></div>`;

  state.matchTimer = setInterval(()=>{
    const s = Math.round((Date.now()-state.matchStart)/1000);
    document.getElementById('match-timer').textContent = `⏱ ${s}s`;
  },500);
}

let matchFirstSel = null;
function matchClick(el){
  if(el.classList.contains('matched')) return;
  if(el.dataset.type==='es') speak(el.dataset.id, null);
  if(!matchFirstSel){
    document.querySelectorAll('.match-item').forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    matchFirstSel = el;
  } else {
    if(matchFirstSel===el){ el.classList.remove('selected'); matchFirstSel=null; return; }
    const a = matchFirstSel, b = el;
    if(a.dataset.id===b.dataset.id && a.dataset.type!==b.dataset.type){
      a.classList.remove('selected'); a.classList.add('matched');
      b.classList.add('matched');
      state.matchMatched++;
      state.learned.add(a.dataset.id); Progress.markLearned(a.dataset.id);
      matchFirstSel = null;
      if(state.matchMatched===8){
        clearInterval(state.matchTimer);
        const t = Math.round((Date.now()-state.matchStart)/1000);
        state.streak++; save(); updateStats();
        Progress.recordQuiz('match', 8, 8);
        document.getElementById('match-result').innerHTML = `
          <div class="result-card" style="max-width:400px">
            <div class="result-score">⚡ ${t}s</div>
            <div class="result-label">All 8 pairs matched! 🎉</div>
            <div class="result-actions">
              <button class="btn btn-primary" onclick="startMatch()">🔄 New Round</button>
              <button class="btn btn-secondary" onclick="showHome()">🏠 Home</button>
            </div>
          </div>`;
      }
    } else {
      a.classList.add('wrong-flash'); b.classList.add('wrong-flash');
      setTimeout(()=>{a.classList.remove('wrong-flash','selected'); b.classList.remove('wrong-flash');}, 400);
      matchFirstSel = null;
    }
  }
}

// ── AI QUIZ ───────────────────────────────────────────────────────────────────
let aiQuestions = [], aiIdx=0, aiCorrect=0;

async function startAIQuiz(){
  if(!Auth.isLoggedIn()){
    document.getElementById('aiquiz-content').innerHTML = `
      <div class="no-key-banner">⚠️ Please sign in to use the AI Quiz feature.</div>`;
    return;
  }

  document.getElementById('aiquiz-content').innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <div class="loading-text">GPT-4o mini is crafting your quiz…</div>
    </div>`;

  const pool = pick(filteredVocab(), 6);
  const wordList = pool.map(w=>`${w.spanish} = ${w.english} (${w.pos}; example: "${w.example_es}")`).join('\n');

  const prompt = `You are a Spanish teacher creating an IGCSE-level quiz for a 9th-grade student.

Given these Spanish words:
${wordList}

Generate exactly 6 quiz questions as a JSON array. Mix these types: "fill_blank" (complete a Spanish sentence), "mcq" (4 options, test English meaning or Spanish usage), "translate" (translate English to Spanish).

Each question object must have:
- "type": "fill_blank" | "mcq" | "translate"
- "question": the question text (for fill_blank: show the sentence with ___ where the word goes)
- "word": the Spanish word being tested
- "hint": a brief hint (pos or category)
- "options": array of 4 strings (for mcq only)
- "answer": the correct answer string
- "explanation": 1-sentence explanation

Return ONLY valid JSON array, no markdown.`;

  try {
    const token = Auth.getIdToken();
    const res = await fetch(`${APP_CONFIG.API_ENDPOINT}/api/chat`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({
        messages:[{role:'user', content:prompt}],
      })
    });
    if(!res.ok) throw new Error('API error '+res.status);
    const data = await res.json();
    aiQuestions = JSON.parse(data.reply);
    aiIdx=0; aiCorrect=0;
    renderAIQuestion();
  } catch(e){
    document.getElementById('aiquiz-content').innerHTML = `
      <div class="no-key-banner">❌ Error: ${e.message}</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="startAIQuiz()">Retry</button>`;
  }
}

function renderAIQuestion(){
  if(aiIdx >= aiQuestions.length){
    document.getElementById('aiquiz-content').innerHTML = resultCard(aiCorrect, aiQuestions.length, 'startAIQuiz()');
    return;
  }
  const q = aiQuestions[aiIdx];
  const pct = Math.round(aiIdx/aiQuestions.length*100);
  document.getElementById('ai-progress').style.width=pct+'%';
  window.nextQuestion = ()=>{aiIdx++; renderAIQuestion()};

  let body='';
  if(q.type==='mcq' && q.options){
    const letters=['A','B','C','D'];
    body=`<div class="options-grid">${q.options.map((o,i)=>`
      <button class="option" onclick="checkAIOption(this,'${escQ(o)}','${escQ(q.answer)}','${escQ(q.explanation)}')">
        <span class="opt-letter">${letters[i]}</span>${o}
      </button>`).join('')}</div>`;
  } else {
    body=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input class="fill-input" id="aiAns" placeholder="Type your answer…" style="max-width:320px"
        onkeydown="if(event.key==='Enter') checkAIFill()"/>
      <button class="submit-btn" onclick="checkAIFill()">Check ✓</button>
    </div>`;
  }
  const badge = q.type==='mcq'?'🎯 Multiple Choice':q.type==='fill_blank'?'✏️ Fill in Blank':'🌐 Translate';
  const qWithTTS = q.question + (q.word ? ` <span style="display:inline-block;margin-left:6px;vertical-align:middle">${speakBtn(q.word,'tts-ai-word')}</span>` : '');
  document.getElementById('aiquiz-content').innerHTML = questionCard(badge, qWithTTS, `Hint: ${q.hint}`, body);
  if(q.type!=='mcq') setTimeout(()=>document.getElementById('aiAns')?.focus(),50);
  if(q.word) setTimeout(()=>speak(q.word,'tts-ai-word'),300);
}

function escQ(s){ return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;') }

function checkAIOption(btn, chosen, correct, expl){
  document.querySelectorAll('.option').forEach(b=>b.disabled=true);
  const norm=s=>s.trim().toLowerCase();
  if(norm(chosen)===norm(correct)){
    btn.classList.add('correct'); aiCorrect++;
    showFeedback(true,`✅ Correct! ${expl} ${speakBtn(aiQuestions[aiIdx].word,'tts-ai-fb','🔊')}`);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option').forEach(b=>{
      if(b.textContent.trim().slice(1).trim()===correct.trim()) b.classList.add('correct');
    });
    showFeedback(false,`❌ Answer: <b>${correct}</b>. ${expl} ${speakBtn(aiQuestions[aiIdx].word,'tts-ai-fb','🔊')}`);
  }
  const w = aiQuestions[aiIdx].word;
  if(w) setTimeout(()=>speak(w,'tts-ai-fb'),400);
}

function checkAIFill(){
  const inp = document.getElementById('aiAns');
  const q = aiQuestions[aiIdx];
  const norm=s=>s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(norm(inp.value)===norm(q.answer)){
    inp.classList.add('correct'); aiCorrect++;
    showFeedback(true,`✅ Correct! ${q.explanation} ${speakBtn(q.answer,'tts-aif-fb','🔊')}`);
    setTimeout(()=>speak(q.answer,'tts-aif-fb'),400);
  } else {
    inp.classList.add('wrong');
    showFeedback(false,`❌ Answer: <b>${q.answer}</b>. ${q.explanation} ${speakBtn(q.answer,'tts-aif-fb','🔊')}`);
    setTimeout(()=>speak(q.answer,'tts-aif-fb'),400);
  }
  inp.disabled=true;
  document.querySelector('.submit-btn').disabled=true;
}

// ── AUTH UI ───────────────────────────────────────────────────────────────────
function renderAuthUI(){
  const area = document.getElementById('auth-area');
  const user = Auth.getUser();
  if(user){
    const initials = (user.name||'U').substring(0,2).toUpperCase();
    area.innerHTML = `
      <div class="user-pill">
        <div class="avatar">${initials}</div>
        <span class="name">${user.name}</span>
      </div>
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

// ── BOOT ─────────────────────────────────────────────────────────────────────
async function boot(){
  // Handle OAuth callback
  await Auth.handleCallback();

  // If token expired, try refresh
  if(Auth.getTokens() && !Auth.isLoggedIn()){
    await Auth.refreshToken();
  }

  renderAuthUI();

  if(Auth.isLoggedIn()){
    initSidebar();
    Chatbot.init();
    // Load progress from cloud and merge
    await Progress.loadFromCloud();
    state.learned = Progress.getLearned();
    state.streak = Progress.getStreak();
    state.lastScore = Progress.getLastScore();
    updateStats();
  }
}

boot();
