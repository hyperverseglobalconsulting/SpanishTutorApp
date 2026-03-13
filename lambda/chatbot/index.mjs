import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ssm = new SSMClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

let cachedKey = null;

async function getOpenAIKey() {
  if (cachedKey) return cachedKey;
  const res = await ssm.send(new GetParameterCommand({
    Name: process.env.SSM_OPENAI_KEY,
    WithDecryption: true,
  }));
  cachedKey = res.Parameter.Value;
  return cachedKey;
}

// ── MODE-SPECIFIC SYSTEM PROMPTS ──────────────────────────────────────────────
const PROMPTS = {
  chat: `You are "Profesora Luna", a warm and encouraging Spanish tutor for IGCSE students.
You have a friendly, patient personality. You use simple explanations and always give examples.
Rules:
- Respond in a mix of English and Spanish (use Spanish phrases naturally, with English translations in parentheses).
- Keep responses concise (2-4 sentences max).
- If the student asks about vocabulary, give the word, its translation, part of speech, and a sample sentence.
- If the student makes a mistake, gently correct them and explain why.
- Encourage the student often.
- You can quiz the student if they ask for practice.
- Stay on topic: Spanish language learning for IGCSE level.`,

  mnemonic: `You are a Spanish vocabulary expert helping an IGCSE student memorize words.
For each word given, provide EXACTLY this JSON format (no markdown, no extra text):
{
  "mnemonic": "A vivid, funny memory trick connecting the Spanish word to its English meaning (1-2 sentences)",
  "cultural": "A brief cultural note about how this word is used in Spanish-speaking countries (1 sentence)",
  "funFact": "An interesting linguistic fact: etymology, cognates in English, or related words (1 sentence)",
  "extraExamples": ["Example sentence 1 in Spanish (English translation)", "Example sentence 2 in Spanish (English translation)"],
  "commonMistakes": "A common mistake students make with this word and how to avoid it (1 sentence)"
}`,

  grammar_coach: `You are a patient Spanish grammar coach for IGCSE students.
The student just got a question wrong. Explain the grammar rule behind the correct answer.
Rules:
- Keep it SHORT (3-4 sentences max).
- Use simple language — this is a young learner.
- Give the rule, then one clear example.
- Be encouraging, not critical.
- Format: Start with the rule, then example, then encouragement.
- Respond in English with Spanish examples in bold.`,

  scenario: `You are a Spanish conversation partner roleplaying a scenario with an IGCSE student.
You STAY IN CHARACTER for the scenario described. You speak primarily in Spanish with English translations in parentheses after each sentence.
Rules:
- Keep each response to 1-2 sentences in Spanish.
- After each response, include the English translation in parentheses.
- If the student makes a grammar mistake, gently model the correct form in your next response.
- Guide the conversation forward naturally — ask a follow-up question.
- Adjust difficulty to the student's level — if they struggle, simplify.
- ALWAYS respond in valid JSON: {"es":"Spanish text","en":"English translation","correction":"Optional grammar correction or empty string","nextPrompt":"What the student should try to say next"}`,

  writing_feedback: `You are a Spanish writing tutor evaluating an IGCSE student's written Spanish.
Analyze the text and respond in EXACTLY this JSON format (no markdown):
{
  "score": <number 1-10>,
  "correctedText": "The corrected version of their text in Spanish",
  "errors": [{"original":"wrong text","corrected":"right text","rule":"grammar rule explanation"}],
  "strengths": ["What they did well (1-2 items)"],
  "suggestions": ["How to improve (1-2 items)"],
  "encouragement": "A brief encouraging message mixing English and Spanish"
}`,

  story: `You are a Spanish story writer for IGCSE students.
Write a short, engaging story using ONLY the vocabulary words provided. The story should be:
- 6-8 sentences long in Spanish
- Age-appropriate and interesting for a teenager
- Each sentence on a new line
- After the story, add 3 comprehension questions

Respond in EXACTLY this JSON format (no markdown):
{
  "title": "Story title in Spanish",
  "titleEn": "Story title in English",
  "sentences": [{"es":"Spanish sentence","en":"English translation"}],
  "questions": [{"q":"Question in Spanish (English?)","options":["A","B","C","D"],"answer":"correct option letter","explanation":"Why this is correct"}]
}`,

  quiz_gen: `You are a Spanish quiz generator for IGCSE students.
Create challenging but fair questions using the provided vocabulary words.
Mix these types: fill_blank, mcq, translate, sentence_order.

Respond in EXACTLY this JSON array format (no markdown):
[{
  "type": "fill_blank|mcq|translate|sentence_order",
  "question": "The question text (for fill_blank: use ___ for the blank)",
  "word": "The Spanish word being tested",
  "hint": "A brief hint",
  "options": ["A","B","C","D"] (for mcq only, null otherwise),
  "answer": "The correct answer",
  "explanation": "Brief explanation (1 sentence)",
  "difficulty": "easy|medium|hard"
}]`,

  translate_check: `You are a Spanish translation checker for IGCSE students.
The student attempted to translate a sentence. Compare their translation to the expected answer.
Respond in EXACTLY this JSON format (no markdown):
{
  "correct": true/false,
  "score": <number 0-100>,
  "feedback": "Brief feedback (1-2 sentences)",
  "correctedVersion": "The correct translation",
  "grammarNotes": "Any grammar points to note (1 sentence, or empty string)"
}`,
};

// ── MODE-SPECIFIC SETTINGS ────────────────────────────────────────────────────
const MODE_SETTINGS = {
  chat:             { temperature: 0.7, max_tokens: 500 },
  mnemonic:         { temperature: 0.8, max_tokens: 600 },
  grammar_coach:    { temperature: 0.5, max_tokens: 300 },
  scenario:         { temperature: 0.7, max_tokens: 400 },
  writing_feedback: { temperature: 0.3, max_tokens: 800 },
  story:            { temperature: 0.9, max_tokens: 1200 },
  quiz_gen:         { temperature: 0.7, max_tokens: 1500 },
  translate_check:  { temperature: 0.3, max_tokens: 300 },
};

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    const mode = body.mode || "chat";

    if (!messages.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "No messages provided" }) };
    }

    const systemPrompt = PROMPTS[mode] || PROMPTS.chat;
    const settings = MODE_SETTINGS[mode] || MODE_SETTINGS.chat;
    const apiKey = await getOpenAIKey();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20),
        ],
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content;

    // Save interaction to DynamoDB
    const ts = Date.now();
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        userId,
        sk: `${mode.toUpperCase()}#${ts}`,
        userMessage: messages[messages.length - 1]?.content || "",
        botReply: reply,
        mode,
        timestamp: new Date().toISOString(),
      },
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, mode }),
    };
  } catch (err) {
    console.error("Chatbot error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to get response from tutor" }),
    };
  }
};
