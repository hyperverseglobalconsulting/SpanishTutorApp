// ── LESSON ENGINE ─────────────────────────────────────────────────────────────
// Drives progressive lesson flow for a unit based on the current stage.
// Each stage type generates appropriate exercises from the unit's words.

const LessonEngine = (() => {

  let _currentUnit = null;
  let _currentStage = null;
  let _exercises = [];
  let _exIdx = 0;
  let _correct = 0;
  let _total = 0;

  function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
  function pick(arr, n) { return shuffle(arr).slice(0, n); }

  // ── Start a lesson for a unit at its current stage ──
  function startLesson(unitId, stageOverride) {
    _currentUnit = Curriculum.getUnit(unitId);
    if (!_currentUnit) return null;

    const mastery = Mastery.getMasteryData();
    _currentStage = stageOverride || Curriculum.getCurrentStage(unitId, mastery);
    _exIdx = 0;
    _correct = 0;

    switch (_currentStage) {
      case 'learn':     _exercises = buildLearnExercises(_currentUnit.words); break;
      case 'recognise': _exercises = buildRecogniseExercises(_currentUnit.words); break;
      case 'recall':    _exercises = buildRecallExercises(_currentUnit.words); break;
      case 'produce':   _exercises = buildProduceExercises(_currentUnit.words); break;
      case 'use':       _exercises = buildUseExercises(_currentUnit.words); break;
      default:          _exercises = buildLearnExercises(_currentUnit.words);
    }

    _total = _exercises.length;
    return { unit: _currentUnit, stage: _currentStage, total: _total };
  }

  // ── Start a review session for SRS due words ──
  function startReview() {
    const dueWords = Mastery.getWordsDueForReview();
    if (dueWords.length === 0) return null;

    _currentUnit = null;
    _currentStage = 'review';
    _exIdx = 0;
    _correct = 0;

    const vocabMap = {};
    VOCAB.forEach(w => vocabMap[w.spanish] = w);

    const words = dueWords.slice(0, 20).map(w => vocabMap[w]).filter(Boolean);
    _exercises = buildMixedExercises(words);
    _total = _exercises.length;

    return { unit: null, stage: 'review', total: _total, wordCount: dueWords.length };
  }

  function getCurrentExercise() {
    if (_exIdx >= _exercises.length) return null;
    return _exercises[_exIdx];
  }

  function getProgress() {
    return { current: _exIdx, total: _total, correct: _correct, stage: _currentStage };
  }

  function submitAnswer(answer) {
    const ex = _exercises[_exIdx];
    if (!ex) return null;

    const normalise = s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let isCorrect = false;

    if (ex.type === 'learn') {
      isCorrect = true; // Learn stage always "passes"
    } else if (ex.type === 'mcq') {
      isCorrect = normalise(answer) === normalise(ex.answer);
    } else if (ex.type === 'fill' || ex.type === 'translate' || ex.type === 'produce') {
      isCorrect = normalise(answer) === normalise(ex.answer);
    } else if (ex.type === 'sentence_order') {
      isCorrect = normalise(answer) === normalise(ex.answer);
    }

    if (isCorrect) _correct++;

    // Update mastery
    if (ex.word && ex.type !== 'learn') {
      Mastery.recordAnswer(ex.word, isCorrect, _currentStage);
    } else if (ex.word && ex.type === 'learn') {
      Mastery.introduceWord(ex.word);
    }

    const result = {
      correct: isCorrect,
      answer: ex.answer,
      explanation: ex.explanation || '',
      word: ex.wordObj,
    };

    _exIdx++;
    return result;
  }

  function isComplete() { return _exIdx >= _exercises.length; }

  function getResults() {
    const pct = _total > 0 ? Math.round((_correct / _total) * 100) : 0;
    const passed = pct >= 70;
    return {
      correct: _correct,
      total: _total,
      percentage: pct,
      passed,
      stage: _currentStage,
      unit: _currentUnit,
    };
  }

  // ── LEARN exercises: show word + meaning + example, one by one ──
  function buildLearnExercises(words) {
    return words.map((w, i) => ({
      type: 'learn',
      word: w.spanish,
      wordObj: w,
      prompt: w.spanish,
      answer: w.english,
      explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
      index: i + 1,
      total: words.length,
    }));
  }

  // ── RECOGNISE: see Spanish → pick English (MCQ) ──
  function buildRecogniseExercises(words) {
    return shuffle(words).map(w => {
      const distractors = pick(VOCAB.filter(v => v.spanish !== w.spanish && v.category === w.category), 3);
      if (distractors.length < 3) {
        distractors.push(...pick(VOCAB.filter(v => v.spanish !== w.spanish), 3 - distractors.length));
      }
      const options = shuffle([w, ...distractors.slice(0, 3)]);
      return {
        type: 'mcq',
        direction: 'es_to_en',
        word: w.spanish,
        wordObj: w,
        prompt: w.spanish,
        hint: `${w.pos}${w.notes ? ' · ' + w.notes : ''}`,
        options: options.map(o => o.english),
        answer: w.english,
        explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
      };
    });
  }

  // ── RECALL: see English → pick Spanish (MCQ) ──
  function buildRecallExercises(words) {
    return shuffle(words).map(w => {
      const distractors = pick(VOCAB.filter(v => v.spanish !== w.spanish && v.category === w.category), 3);
      if (distractors.length < 3) {
        distractors.push(...pick(VOCAB.filter(v => v.spanish !== w.spanish), 3 - distractors.length));
      }
      const options = shuffle([w, ...distractors.slice(0, 3)]);
      return {
        type: 'mcq',
        direction: 'en_to_es',
        word: w.spanish,
        wordObj: w,
        prompt: w.english,
        hint: `${w.pos}${w.notes ? ' · ' + w.notes : ''}`,
        options: options.map(o => o.spanish),
        answer: w.spanish,
        explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
      };
    });
  }

  // ── PRODUCE: type Spanish from English prompt ──
  function buildProduceExercises(words) {
    return shuffle(words).map(w => ({
      type: 'produce',
      word: w.spanish,
      wordObj: w,
      prompt: w.english,
      hint: `${w.pos} · starts with "${w.spanish.charAt(0)}"`,
      answer: w.spanish,
      explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
    }));
  }

  // ── USE: sentence completion + contextual exercises ──
  function buildUseExercises(words) {
    const exercises = [];
    const wordsWithExamples = words.filter(w => w.example_es && w.example_es.length > 5);

    // Fill in the blank with sentences
    for (const w of shuffle(wordsWithExamples).slice(0, 8)) {
      const re = new RegExp(w.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (re.test(w.example_es)) {
        exercises.push({
          type: 'fill',
          word: w.spanish,
          wordObj: w,
          prompt: w.example_es.replace(re, '______'),
          hint: `${w.english} (${w.pos})`,
          answer: w.spanish,
          fullSentence: w.example_es,
          explanation: `${w.example_es} — ${w.example_en}`,
        });
      }
    }

    // Translate English sentence to fill Spanish word
    for (const w of shuffle(wordsWithExamples).slice(0, 4)) {
      exercises.push({
        type: 'translate',
        word: w.spanish,
        wordObj: w,
        prompt: w.example_en,
        hint: `Translate the key word: ${w.english} → ???`,
        answer: w.spanish,
        explanation: `${w.spanish} = ${w.english}`,
      });
    }

    return shuffle(exercises);
  }

  // ── MIXED: for review sessions ──
  function buildMixedExercises(words) {
    const exercises = [];
    for (const w of words) {
      const level = Mastery.getWordLevel(w.spanish);
      if (level <= 2) {
        // recognise level
        const distractors = pick(VOCAB.filter(v => v.spanish !== w.spanish), 3);
        exercises.push({
          type: 'mcq', direction: 'es_to_en', word: w.spanish, wordObj: w,
          prompt: w.spanish, options: shuffle([w, ...distractors]).map(o => o.english),
          answer: w.english, hint: w.pos,
          explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
        });
      } else if (level <= 3) {
        // recall level
        const distractors = pick(VOCAB.filter(v => v.spanish !== w.spanish), 3);
        exercises.push({
          type: 'mcq', direction: 'en_to_es', word: w.spanish, wordObj: w,
          prompt: w.english, options: shuffle([w, ...distractors]).map(o => o.spanish),
          answer: w.spanish, hint: w.pos,
          explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
        });
      } else {
        // produce level
        exercises.push({
          type: 'produce', word: w.spanish, wordObj: w,
          prompt: w.english, hint: `starts with "${w.spanish.charAt(0)}"`,
          answer: w.spanish,
          explanation: w.example_es ? `${w.example_es} — ${w.example_en}` : '',
        });
      }
    }
    return shuffle(exercises);
  }

  return {
    startLesson, startReview,
    getCurrentExercise, getProgress, submitAnswer,
    isComplete, getResults,
  };
})();
