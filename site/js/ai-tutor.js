// ── AI TUTOR ──────────────────────────────────────────────────────────────────
// Central module for all LLM-powered features.
// Calls the /api/chat Lambda with different modes to get specialised AI responses.

const AI = (() => {

  // ── Core API call ──
  async function call(mode, messages) {
    if (!Auth.isLoggedIn()) throw new Error('Sign in to use AI features');
    const token = Auth.getIdToken();
    const res = await fetch(`${APP_CONFIG.API_ENDPOINT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ mode, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI error ${res.status}`);
    }
    const data = await res.json();
    return data.reply;
  }

  function parseJSON(text) {
    // Strip markdown code fences if present
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  }

  // ── 1. MNEMONIC & WORD ENRICHMENT ──────────────────────────────────────────
  // Get AI-generated memory tricks, cultural notes, fun facts for a word
  async function enrichWord(word) {
    const msg = `Word: "${word.spanish}" = "${word.english}" (${word.pos})
Example: "${word.example_es}" = "${word.example_en}"
Category: ${word.category}`;
    const reply = await call('mnemonic', [{ role: 'user', content: msg }]);
    return parseJSON(reply);
  }

  // ── 2. GRAMMAR COACH ──────────────────────────────────────────────────────
  // Explain grammar rule when student gets an answer wrong
  async function explainError(wordObj, studentAnswer, correctAnswer, exerciseType) {
    const msg = `The student was asked: ${exerciseType === 'produce' ? 'Type the Spanish for' : 'Choose the correct answer for'} "${wordObj.english}"
Student answered: "${studentAnswer}"
Correct answer: "${correctAnswer}"
Word: ${wordObj.spanish} = ${wordObj.english} (${wordObj.pos})
${wordObj.notes ? 'Notes: ' + wordObj.notes : ''}
${wordObj.example_es ? 'Example: ' + wordObj.example_es + ' = ' + wordObj.example_en : ''}`;
    return await call('grammar_coach', [{ role: 'user', content: msg }]);
  }

  // ── 3. AI SCENARIO CONVERSATION ───────────────────────────────────────────
  // Dynamic conversation with GPT playing a role
  let _scenarioHistory = [];

  function startAIScenario(scenarioDesc, knownWords) {
    const wordList = knownWords.slice(0, 30).map(w => `${w.spanish} (${w.english})`).join(', ');
    _scenarioHistory = [
      { role: 'user', content: `SCENARIO: ${scenarioDesc}\n\nThe student knows these words: ${wordList}\n\nStart the conversation. You go first — greet the student in character.` }
    ];
    return call('scenario', _scenarioHistory).then(reply => {
      _scenarioHistory.push({ role: 'assistant', content: reply });
      return parseJSON(reply);
    });
  }

  async function continueScenario(studentText) {
    _scenarioHistory.push({ role: 'user', content: studentText });
    const reply = await call('scenario', _scenarioHistory);
    _scenarioHistory.push({ role: 'assistant', content: reply });
    return parseJSON(reply);
  }

  // ── 4. WRITING LAB ────────────────────────────────────────────────────────
  // Grade and provide feedback on student's written Spanish
  async function gradeWriting(studentText, prompt, knownWords) {
    const wordList = knownWords.slice(0, 40).map(w => w.spanish).join(', ');
    const msg = `Writing prompt: "${prompt}"
Student's level: IGCSE beginner. Known vocabulary includes: ${wordList}

Student wrote:
"${studentText}"`;
    const reply = await call('writing_feedback', [{ role: 'user', content: msg }]);
    return parseJSON(reply);
  }

  // ── 5. AI STORY MODE ──────────────────────────────────────────────────────
  // Generate a story using known vocabulary words
  async function generateStory(knownWords, theme) {
    const wordSample = knownWords.slice(0, 20).map(w => `${w.spanish} (${w.english})`).join(', ');
    const msg = `Create a story for an IGCSE Spanish student.
Theme: ${theme || 'daily life'}
Use ONLY these vocabulary words (you may add basic connectors like y, pero, porque, etc.):
${wordSample}`;
    const reply = await call('story', [{ role: 'user', content: msg }]);
    return parseJSON(reply);
  }

  // ── 6. AI QUIZ GENERATOR ──────────────────────────────────────────────────
  // Generate custom quiz questions targeting weak areas
  async function generateQuiz(words, difficulty, count) {
    const wordList = words.map(w =>
      `${w.spanish} = ${w.english} (${w.pos}; example: "${w.example_es}")`
    ).join('\n');
    const msg = `Generate exactly ${count || 6} quiz questions using these words.
Difficulty: ${difficulty || 'mixed'}
Target: IGCSE Spanish student

Words:
${wordList}`;
    const reply = await call('quiz_gen', [{ role: 'user', content: msg }]);
    return parseJSON(reply);
  }

  // ── 7. SMART REVIEW ───────────────────────────────────────────────────────
  // Get AI to identify weak areas and generate targeted practice
  async function getStudyRecommendation(masteryData) {
    const weak = [];
    const strong = [];
    for (const w of VOCAB) {
      const level = masteryData[w.spanish] || 0;
      if (level > 0 && level <= 2) weak.push(`${w.spanish} (${w.english}) level:${level}`);
      if (level >= 4) strong.push(`${w.spanish} (${w.english})`);
    }
    const msg = `Student progress analysis:
- Total words seen: ${weak.length + strong.length}
- Struggling with (${weak.length}): ${weak.slice(0, 15).join(', ')}
- Strong on (${strong.length}): ${strong.slice(0, 10).join(', ')}

Give a brief, encouraging study recommendation (3-4 sentences). Suggest which words to focus on and what type of practice would help most.`;
    return await call('chat', [{ role: 'user', content: msg }]);
  }

  // ── 8. TRANSLATE CHECK ─────────────────────────────────────────────────────
  // AI-powered flexible translation checking (beyond exact match)
  async function checkTranslation(studentText, expectedSpanish, englishPrompt) {
    const msg = `English prompt: "${englishPrompt}"
Expected Spanish: "${expectedSpanish}"
Student wrote: "${studentText}"

Is this an acceptable translation? Consider synonyms, alternate phrasings, minor spelling variations.`;
    const reply = await call('translate_check', [{ role: 'user', content: msg }]);
    return parseJSON(reply);
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────
  // Get words the student knows (mastery >= 2) as word objects
  function getKnownWordObjects() {
    const mastery = Mastery.getMasteryData();
    return VOCAB.filter(w => (mastery[w.spanish] || 0) >= 2);
  }

  // Get words the student is weak on (mastery 1-2)
  function getWeakWordObjects() {
    const mastery = Mastery.getMasteryData();
    return VOCAB.filter(w => {
      const l = mastery[w.spanish] || 0;
      return l >= 1 && l <= 2;
    });
  }

  return {
    call, parseJSON,
    enrichWord, explainError,
    startAIScenario, continueScenario,
    gradeWriting, generateStory, generateQuiz,
    getStudyRecommendation, checkTranslation,
    getKnownWordObjects, getWeakWordObjects,
  };
})();
