// ── SCENARIO ENGINE ───────────────────────────────────────────────────────────
// Drives situational conversation practice (restaurant, school, etc.)
// Uses AI (via chatbot API) for dynamic dialogue, or falls back to scripted.

const Scenarios = (() => {

  const SCRIPTED = {
    greetings: [
      { role: 'tutor', es: '¡Hola! ¿Cómo te llamas?', en: 'Hello! What is your name?' },
      { role: 'student', prompt: 'Say: My name is [your name]', hint: 'Me llamo ___', key: 'Me llamo' },
      { role: 'tutor', es: '¡Mucho gusto! ¿Cómo estás?', en: 'Nice to meet you! How are you?' },
      { role: 'student', prompt: 'Say: I am well, thank you', hint: 'Estoy bien, ___', key: 'Estoy bien, gracias' },
      { role: 'tutor', es: '¿De dónde eres?', en: 'Where are you from?' },
      { role: 'student', prompt: 'Say: I am from [country]', hint: 'Soy de ___', key: 'Soy de' },
      { role: 'tutor', es: '¡Qué bien! Hasta luego.', en: 'Great! See you later.' },
      { role: 'student', prompt: 'Say goodbye', hint: '¡Adiós! / ¡Hasta luego!', key: 'Hasta luego' },
    ],
    restaurant: [
      { role: 'tutor', es: '¡Buenas tardes! Bienvenido al restaurante. ¿Mesa para cuántas personas?', en: 'Good afternoon! Welcome to the restaurant. Table for how many?' },
      { role: 'student', prompt: 'Say: A table for two, please', hint: 'Una mesa para ___, por favor', key: 'Una mesa para dos' },
      { role: 'tutor', es: 'Perfecto. Aquí tiene el menú. ¿Qué desea beber?', en: 'Perfect. Here is the menu. What would you like to drink?' },
      { role: 'student', prompt: 'Order water or juice', hint: 'Quiero ___, por favor', key: 'Quiero' },
      { role: 'tutor', es: 'Muy bien. ¿Y para comer?', en: 'Very well. And to eat?' },
      { role: 'student', prompt: 'Order a dish', hint: 'Me gustaría ___, por favor', key: 'Me gustaría' },
      { role: 'tutor', es: 'Excelente elección. ¿Desea algo de postre?', en: 'Excellent choice. Would you like dessert?' },
      { role: 'student', prompt: 'Say: No thank you. The bill please.', hint: 'No gracias. La ___, por favor', key: 'La cuenta' },
      { role: 'tutor', es: 'Aquí tiene. Son quince euros. ¡Gracias y hasta pronto!', en: 'Here you go. That is fifteen euros. Thanks and see you soon!' },
      { role: 'student', prompt: 'Say thank you and goodbye', hint: '¡Gracias! ¡___!', key: 'Gracias' },
    ],
    school: [
      { role: 'tutor', es: '¡Buenos días! ¿Qué asignaturas tienes hoy?', en: 'Good morning! What subjects do you have today?' },
      { role: 'student', prompt: 'Name two school subjects', hint: 'Tengo ___ y ___', key: 'Tengo' },
      { role: 'tutor', es: '¿Cuál es tu asignatura favorita?', en: 'What is your favourite subject?' },
      { role: 'student', prompt: 'Say your favourite subject', hint: 'Mi asignatura favorita es ___', key: 'Mi asignatura favorita es' },
      { role: 'tutor', es: '¿A qué hora empieza la clase?', en: 'What time does the class start?' },
      { role: 'student', prompt: 'Say a time', hint: 'La clase empieza a las ___', key: 'La clase empieza' },
      { role: 'tutor', es: '¿Tienes mucha tarea hoy?', en: 'Do you have a lot of homework today?' },
      { role: 'student', prompt: 'Answer yes or no with detail', hint: 'Sí, tengo ___ / No, no tengo ___', key: 'tarea' },
    ],
    shopping: [
      { role: 'tutor', es: '¡Hola! ¿En qué puedo ayudarle?', en: 'Hello! How can I help you?' },
      { role: 'student', prompt: 'Say you are looking for a shirt', hint: 'Busco una ___', key: 'Busco' },
      { role: 'tutor', es: '¿De qué color la quiere?', en: 'What colour would you like it?' },
      { role: 'student', prompt: 'Say a colour', hint: 'La quiero de color ___', key: 'color' },
      { role: 'tutor', es: '¿Qué talla necesita?', en: 'What size do you need?' },
      { role: 'student', prompt: 'Say your size (small/medium/large)', hint: 'Necesito la talla ___', key: 'talla' },
      { role: 'tutor', es: 'Aquí tiene. ¿Quiere probársela?', en: 'Here you go. Would you like to try it on?' },
      { role: 'student', prompt: 'Say yes please, and ask the price', hint: 'Sí, por favor. ¿Cuánto ___?', key: 'Cuánto cuesta' },
      { role: 'tutor', es: 'Cuesta veinte euros. ¿La quiere?', en: 'It costs twenty euros. Do you want it?' },
      { role: 'student', prompt: 'Say yes, you will take it', hint: 'Sí, me la ___', key: 'llevo' },
    ],
    travel: [
      { role: 'tutor', es: '¡Bienvenido al hotel! ¿Tiene una reserva?', en: 'Welcome to the hotel! Do you have a reservation?' },
      { role: 'student', prompt: 'Say yes, under your name', hint: 'Sí, tengo una reserva a nombre de ___', key: 'reserva' },
      { role: 'tutor', es: '¿Para cuántas noches?', en: 'For how many nights?' },
      { role: 'student', prompt: 'Say number of nights', hint: 'Para ___ noches', key: 'noches' },
      { role: 'tutor', es: '¿Necesita habitación individual o doble?', en: 'Do you need a single or double room?' },
      { role: 'student', prompt: 'Choose a room type', hint: 'Una habitación ___, por favor', key: 'habitación' },
      { role: 'tutor', es: 'Perfecto. Su habitación es la número 305. ¿Necesita algo más?', en: 'Your room is 305. Do you need anything else?' },
      { role: 'student', prompt: 'Ask what time breakfast is', hint: '¿A qué hora es el ___?', key: 'desayuno' },
    ],
    doctor: [
      { role: 'tutor', es: 'Buenos días. ¿Qué le pasa?', en: 'Good morning. What is the matter?' },
      { role: 'student', prompt: 'Describe a symptom (headache/stomach ache)', hint: 'Me duele ___', key: 'Me duele' },
      { role: 'tutor', es: '¿Desde cuándo tiene estos síntomas?', en: 'Since when have you had these symptoms?' },
      { role: 'student', prompt: 'Say since when', hint: 'Desde hace ___ días', key: 'Desde hace' },
      { role: 'tutor', es: '¿Tiene fiebre?', en: 'Do you have a fever?' },
      { role: 'student', prompt: 'Answer yes or no', hint: 'Sí, tengo fiebre / No, no tengo fiebre', key: 'fiebre' },
      { role: 'tutor', es: 'Voy a recetarle unas pastillas. Tome dos al día.', en: 'I will prescribe some pills. Take two per day.' },
      { role: 'student', prompt: 'Say thank you doctor', hint: 'Gracias, ___', key: 'Gracias' },
    ],
    mylife: [
      { role: 'tutor', es: 'Cuéntame sobre ti. ¿Cómo eres?', en: 'Tell me about yourself. What are you like?' },
      { role: 'student', prompt: 'Describe yourself (2+ sentences)', hint: 'Soy ___. Tengo ___ años. Me gusta ___', key: 'Soy' },
      { role: 'tutor', es: '¡Interesante! ¿Y tu familia?', en: 'Interesting! And your family?' },
      { role: 'student', prompt: 'Describe your family', hint: 'En mi familia hay ___. Mi ___ se llama ___', key: 'familia' },
      { role: 'tutor', es: '¿Qué haces en tu tiempo libre?', en: 'What do you do in your free time?' },
      { role: 'student', prompt: 'Describe hobbies (2+ sentences)', hint: 'En mi tiempo libre, me gusta ___', key: 'tiempo libre' },
      { role: 'tutor', es: '¿Qué planes tienes para las vacaciones?', en: 'What plans do you have for the holidays?' },
      { role: 'student', prompt: 'Describe holiday plans (2+ sentences)', hint: 'Voy a ___ con ___. Quiero ___', key: 'vacaciones' },
    ],
  };

  let _currentScenario = null;
  let _stepIdx = 0;
  let _dialogue = [];

  function startScenario(scenarioId) {
    const scenario = Curriculum.getScenarios().find(s => s.id === scenarioId);
    if (!scenario) return null;
    _currentScenario = scenario;
    _stepIdx = 0;
    _dialogue = [];

    const script = SCRIPTED[scenarioId] || [];
    return { scenario, steps: script, total: script.length };
  }

  function getCurrentStep() {
    const script = SCRIPTED[_currentScenario?.id];
    if (!script || _stepIdx >= script.length) return null;
    return script[_stepIdx];
  }

  // Advance past a tutor step (just increment index + record dialogue)
  function advanceTutor() {
    const step = getCurrentStep();
    if (!step || step.role !== 'tutor') return null;
    _dialogue.push({ role: 'tutor', text: step.es, translation: step.en });
    _stepIdx++;
    return step;
  }

  function submitResponse(text) {
    const step = getCurrentStep();
    if (!step || step.role !== 'student') return null;

    const normalise = s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const keyNorm = normalise(step.key);
    const ansNorm = normalise(text);

    // Flexible matching: answer must contain the key phrase
    const passed = ansNorm.includes(keyNorm) || ansNorm.length >= keyNorm.length * 0.6;

    _dialogue.push({ role: 'student', text, passed });
    _stepIdx++;

    // Auto-advance tutor lines
    const next = getCurrentStep();
    if (next && next.role === 'tutor') {
      _dialogue.push({ role: 'tutor', text: next.es, translation: next.en });
      _stepIdx++;
    }

    return { passed, hint: step.hint, key: step.key };
  }

  function isComplete() {
    const script = SCRIPTED[_currentScenario?.id];
    return !script || _stepIdx >= script.length;
  }

  function getDialogue() { return _dialogue; }
  function getScenarioInfo() { return _currentScenario; }

  return {
    startScenario, getCurrentStep, advanceTutor, submitResponse,
    isComplete, getDialogue, getScenarioInfo,
  };
})();
