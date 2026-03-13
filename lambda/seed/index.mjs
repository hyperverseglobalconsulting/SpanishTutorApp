import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// ── Curriculum structure (same as site/js/curriculum.js) ──
const PHASE_MAP = [
  { phase: 1, title: "Foundation",    icon: "🧱", cats: ["1. Connectives & Function", "2. Numbers & Time"] },
  { phase: 2, title: "People & Home", icon: "🏠", cats: ["3. Family & People", "4. Home & Daily Life"] },
  { phase: 3, title: "School & Food", icon: "🍎", cats: ["5. School & Work", "6. Food & Health"] },
  { phase: 4, title: "Out & About",   icon: "🚌", cats: ["7. Free Time & Sport", "8. Town & Transport"] },
  { phase: 5, title: "World & Travel",icon: "✈️", cats: ["9. Holidays & Travel", "10. Environment & World"] },
  { phase: 6, title: "Fluency",       icon: "🌟", cats: ["11. Key Verbs", "12. Key Adjectives"] },
];

const STAGES = ["learn", "recognise", "recall", "produce", "use"];

const SCENARIOS = [
  { id: "greetings",  title: "Meeting Someone New",   icon: "👋", unlockPhase: 1, desc: "Introduce yourself, ask someone's name, say hello/goodbye", requiredCats: ["1. Connectives & Function"] },
  { id: "restaurant", title: "At the Restaurant",     icon: "🍽️", unlockPhase: 3, desc: "Order food, ask for the menu, request the bill", requiredCats: ["6. Food & Health", "2. Numbers & Time"] },
  { id: "school",     title: "A Day at School",       icon: "🏫", unlockPhase: 3, desc: "Talk about subjects, ask the teacher, describe your timetable", requiredCats: ["5. School & Work", "2. Numbers & Time"] },
  { id: "shopping",   title: "Going Shopping",        icon: "🛍️", unlockPhase: 4, desc: "Ask prices, describe what you want, buy clothes", requiredCats: ["8. Town & Transport", "2. Numbers & Time", "12. Key Adjectives"] },
  { id: "travel",     title: "Holiday Adventure",     icon: "🌍", unlockPhase: 5, desc: "Book a hotel, ask for directions, describe your trip", requiredCats: ["9. Holidays & Travel", "8. Town & Transport"] },
  { id: "doctor",     title: "At the Doctor",         icon: "🏥", unlockPhase: 3, desc: "Describe symptoms, understand instructions, talk about health", requiredCats: ["6. Food & Health", "3. Family & People"] },
  { id: "mylife",     title: "Tell Me About Yourself",icon: "📝", unlockPhase: 6, desc: "Write about your family, hobbies, daily routine, and plans", requiredCats: ["3. Family & People", "7. Free Time & Sport", "4. Home & Daily Life"] },
];

// ── Batch write helper (DynamoDB max 25 items per batch) ──
async function batchPut(items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map(item => ({
      PutRequest: { Item: item },
    }));
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: batch },
    }));
  }
}

export const handler = async (event) => {
  // Expect event.vocab = array of { spanish, english, pos, notes, example_es, example_en, priority, category }
  const vocab = event.vocab;
  if (!vocab || !Array.isArray(vocab) || vocab.length === 0) {
    return { statusCode: 400, body: "Provide vocab array in event payload" };
  }

  console.log(`Seeding ${vocab.length} words...`);
  let totalItems = 0;

  // ── 1. Write vocab words ──
  const vocabItems = vocab.map(w => ({
    pk: "VOCAB",
    sk: `WORD#${w.spanish}`,
    gsi1pk: `CAT#${w.category || "uncategorized"}`,
    gsi1sk: `WORD#${w.spanish}`,
    data: w,
  }));
  await batchPut(vocabItems);
  totalItems += vocabItems.length;
  console.log(`Wrote ${vocabItems.length} vocab words`);

  // ── 2. Write phases ──
  const phaseItems = PHASE_MAP.map(p => ({
    pk: "PHASES",
    sk: `PHASE#${String(p.phase).padStart(2, "0")}`,
    data: p,
  }));
  await batchPut(phaseItems);
  totalItems += phaseItems.length;
  console.log(`Wrote ${phaseItems.length} phases`);

  // ── 3. Build and write units ──
  const WORDS_PER_UNIT = 12;
  const unitItems = [];
  let unitId = 1;

  for (const pm of PHASE_MAP) {
    for (const catName of pm.cats) {
      const catWords = vocab
        .filter(w => w.category === catName)
        .sort((a, b) => {
          const pa = a.priority === "★★★" ? 0 : 1;
          const pb = b.priority === "★★★" ? 0 : 1;
          return pa - pb;
        });

      for (let i = 0; i < catWords.length; i += WORDS_PER_UNIT) {
        const chunk = catWords.slice(i, i + WORDS_PER_UNIT);
        const unitNum = Math.floor(i / WORDS_PER_UNIT) + 1;
        const shortCat = catName.replace(/^\d+\.\s*/, "");

        const unit = {
          id: unitId,
          phase: pm.phase,
          phaseTitle: pm.title,
          phaseIcon: pm.icon,
          title: `${shortCat} ${unitNum}`,
          category: catName,
          wordKeys: chunk.map(w => w.spanish),
          stages: STAGES,
        };

        unitItems.push({
          pk: "UNITS",
          sk: `UNIT#${String(unitId).padStart(4, "0")}`,
          gsi1pk: `PHASE#${pm.phase}`,
          gsi1sk: `UNIT#${String(unitId).padStart(4, "0")}`,
          data: unit,
        });
        unitId++;
      }
    }
  }
  await batchPut(unitItems);
  totalItems += unitItems.length;
  console.log(`Wrote ${unitItems.length} units`);

  // ── 4. Write scenarios ──
  const scenarioItems = SCENARIOS.map(s => ({
    pk: "SCENARIOS",
    sk: `SCENARIO#${s.id}`,
    data: s,
  }));
  await batchPut(scenarioItems);
  totalItems += scenarioItems.length;
  console.log(`Wrote ${scenarioItems.length} scenarios`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      totalItems,
      vocab: vocabItems.length,
      phases: phaseItems.length,
      units: unitItems.length,
      scenarios: scenarioItems.length,
    }),
  };
};
