// ── CURRICULUM ENGINE ──────────────────────────────────────────────────────────
// Organises 705 words into a structured learning path:
//   Phases → Units → Lessons → Stages (learn → practise → quiz → review → scenario)

const Curriculum = (() => {

  // ── Phase / category ordering (easiest → hardest) ──
  const PHASE_MAP = [
    { phase: 1, title: 'Foundation',    icon: '🧱', cats: ['1. Connectives & Function', '2. Numbers & Time'] },
    { phase: 2, title: 'People & Home', icon: '🏠', cats: ['3. Family & People', '4. Home & Daily Life'] },
    { phase: 3, title: 'School & Food', icon: '🍎', cats: ['5. School & Work', '6. Food & Health'] },
    { phase: 4, title: 'Out & About',   icon: '🚌', cats: ['7. Free Time & Sport', '8. Town & Transport'] },
    { phase: 5, title: 'World & Travel', icon: '✈️', cats: ['9. Holidays & Travel', '10. Environment & World'] },
    { phase: 6, title: 'Fluency',       icon: '🌟', cats: ['11. Key Verbs', '12. Key Adjectives'] },
  ];

  // ── Lesson stages ──
  const STAGES = [
    { id: 'learn',    label: 'Learn',    icon: '📖', desc: 'See new words with meaning & pronunciation', 
      questionTypes: ['📖 Introduction'] },
    { id: 'recognise',label: 'Recognise', icon: '👁️', desc: 'Pick the correct English meaning', 
      questionTypes: ['🎯 Multiple Choice (ES→EN)'] },
    { id: 'recall',   label: 'Recall',   icon: '🧠', desc: 'Pick the correct Spanish word', 
      questionTypes: ['🎯 Multiple Choice (EN→ES)'] },
    { id: 'produce',  label: 'Produce',  icon: '✏️',  desc: 'Type the Spanish word from memory', 
      questionTypes: ['✏️ Type Answer', '🌐 Translate'] },
    { id: 'use',      label: 'Use',      icon: '💬', desc: 'Complete sentences and conversations', 
      questionTypes: ['✏️ Fill in Blank', '🌐 Translate', '🔤 Sentence Order'] },
  ];

  // ── Situational scenarios (unlock after specific phases) ──
  const SCENARIOS = [
    { id: 'greetings',   title: 'Meeting Someone New', icon: '👋', unlockPhase: 1,
      desc: 'Introduce yourself, ask someone\'s name, say hello/goodbye',
      requiredCats: ['1. Connectives & Function'] },
    { id: 'restaurant',  title: 'At the Restaurant',   icon: '🍽️', unlockPhase: 3,
      desc: 'Order food, ask for the menu, request the bill',
      requiredCats: ['6. Food & Health', '2. Numbers & Time'] },
    { id: 'school',      title: 'A Day at School',     icon: '🏫', unlockPhase: 3,
      desc: 'Talk about subjects, ask the teacher, describe your timetable',
      requiredCats: ['5. School & Work', '2. Numbers & Time'] },
    { id: 'shopping',    title: 'Going Shopping',      icon: '🛍️', unlockPhase: 4,
      desc: 'Ask prices, describe what you want, buy clothes',
      requiredCats: ['8. Town & Transport', '2. Numbers & Time', '12. Key Adjectives'] },
    { id: 'travel',      title: 'Holiday Adventure',   icon: '🌍', unlockPhase: 5,
      desc: 'Book a hotel, ask for directions, describe your trip',
      requiredCats: ['9. Holidays & Travel', '8. Town & Transport'] },
    { id: 'doctor',      title: 'At the Doctor',       icon: '🏥', unlockPhase: 3,
      desc: 'Describe symptoms, understand instructions, talk about health',
      requiredCats: ['6. Food & Health', '3. Family & People'] },
    { id: 'mylife',      title: 'Tell Me About Yourself', icon: '📝', unlockPhase: 6,
      desc: 'Write about your family, hobbies, daily routine, and plans',
      requiredCats: ['3. Family & People', '7. Free Time & Sport', '4. Home & Daily Life'] },
  ];

  // ── Build units from vocab data ──
  let _units = null;

  function buildUnits() {
    if (_units) return _units;
    _units = [];
    let unitId = 1;
    const WORDS_PER_UNIT = 12;

    for (const pm of PHASE_MAP) {
      for (const catName of pm.cats) {
        // Get words for this category, sorted by priority (★★★ first)
        const catWords = VOCAB
          .filter(w => w.category === catName)
          .sort((a, b) => {
            const pa = a.priority === '★★★' ? 0 : 1;
            const pb = b.priority === '★★★' ? 0 : 1;
            return pa - pb;
          });

        // Split into units of WORDS_PER_UNIT
        for (let i = 0; i < catWords.length; i += WORDS_PER_UNIT) {
          const chunk = catWords.slice(i, i + WORDS_PER_UNIT);
          const unitNum = Math.floor(i / WORDS_PER_UNIT) + 1;
          const shortCat = catName.replace(/^\d+\.\s*/, '');

          _units.push({
            id: unitId,
            phase: pm.phase,
            phaseTitle: pm.title,
            phaseIcon: pm.icon,
            title: `${shortCat} ${unitNum}`,
            category: catName,
            words: chunk,
            stages: STAGES.map(s => s.id),
          });
          unitId++;
        }
      }
    }
    return _units;
  }

  function getUnits()    { return buildUnits(); }
  function getUnit(id)   { return buildUnits().find(u => u.id === id); }
  function getStages()   { return STAGES; }
  function getPhases()   { return PHASE_MAP; }
  function getScenarios(){ return SCENARIOS; }

  function getPhaseUnits(phase) {
    return buildUnits().filter(u => u.phase === phase);
  }

  // Check if a phase is unlocked based on mastery data
  function isPhaseUnlocked(phase, masteryData) {
    if (phase <= 1) return true;
    // Require 70% of previous phase words to be at mastery >= 3 (familiar)
    const prevUnits = getPhaseUnits(phase - 1);
    const prevWords = prevUnits.flatMap(u => u.words);
    if (prevWords.length === 0) return true;
    const familiarCount = prevWords.filter(w =>
      (masteryData[w.spanish] || 0) >= 3
    ).length;
    return (familiarCount / prevWords.length) >= 0.7;
  }

  // Check if a unit is unlocked
  function isUnitUnlocked(unitId, masteryData) {
    const unit = getUnit(unitId);
    if (!unit) return false;
    if (unit.id === 1) return true;
    // Phase must be unlocked
    if (!isPhaseUnlocked(unit.phase, masteryData)) return false;
    // Previous unit in same phase must have >=60% at mastery >= 2
    const phaseUnits = getPhaseUnits(unit.phase);
    const idx = phaseUnits.findIndex(u => u.id === unit.id);
    if (idx <= 0) return true;
    const prev = phaseUnits[idx - 1];
    const learnedCount = prev.words.filter(w =>
      (masteryData[w.spanish] || 0) >= 2
    ).length;
    return (learnedCount / prev.words.length) >= 0.6;
  }

  // Check which stage is current for a unit
  function getCurrentStage(unitId, masteryData) {
    const unit = getUnit(unitId);
    if (!unit) return 'learn';
    const words = unit.words;
    const levels = words.map(w => masteryData[w.spanish] || 0);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;

    if (avg < 1) return 'learn';       // Haven't been introduced
    if (avg < 2) return 'recognise';   // Introduced but not recognising
    if (avg < 3) return 'recall';      // Recognising but not recalling
    if (avg < 4) return 'produce';     // Recalling but not producing
    return 'use';                       // Ready for contextual use
  }

  // Get unit completion percentage
  function getUnitProgress(unitId, masteryData) {
    const unit = getUnit(unitId);
    if (!unit) return 0;
    const maxPerWord = 5; // max mastery level
    const total = unit.words.length * maxPerWord;
    const current = unit.words.reduce((sum, w) =>
      sum + Math.min(masteryData[w.spanish] || 0, maxPerWord), 0
    );
    return Math.round((current / total) * 100);
  }

  // Get words due for SRS review across all units
  function getReviewWords(masteryData, srsData) {
    const now = Date.now();
    return VOCAB.filter(w => {
      const level = masteryData[w.spanish] || 0;
      if (level < 2) return false; // not learned enough to review
      const srs = srsData[w.spanish];
      if (!srs) return level >= 2; // never reviewed, due now
      return srs.nextReview <= now;
    });
  }

  // Check if a scenario is unlocked
  function isScenarioUnlocked(scenarioId, masteryData) {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return false;
    return isPhaseUnlocked(scenario.unlockPhase, masteryData);
  }

  return {
    getUnits, getUnit, getStages, getPhases, getScenarios,
    getPhaseUnits, isPhaseUnlocked, isUnitUnlocked,
    getCurrentStage, getUnitProgress, getReviewWords,
    isScenarioUnlocked, STAGES,
  };
})();
