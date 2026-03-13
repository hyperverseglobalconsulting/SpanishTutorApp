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

const SYSTEM_PROMPT = `You are "Profesora Luna", a warm and encouraging Spanish tutor for IGCSE students.
You have a friendly, patient personality. You use simple explanations and always give examples.
Rules:
- Respond in a mix of English and Spanish (use Spanish phrases naturally, with English translations in parentheses).
- Keep responses concise (2-4 sentences max).
- If the student asks about vocabulary, give the word, its translation, part of speech, and a sample sentence.
- If the student makes a mistake, gently correct them and explain why.
- Encourage the student often.
- You can quiz the student if they ask for practice.
- Stay on topic: Spanish language learning for IGCSE level.`;

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];

    if (!messages.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "No messages provided" }) };
    }

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
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-20), // keep last 20 messages for context
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content;

    // Save chat interaction to DynamoDB for tracking
    const ts = Date.now();
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        userId,
        sk: `CHAT#${ts}`,
        userMessage: messages[messages.length - 1]?.content || "",
        botReply: reply,
        timestamp: new Date().toISOString(),
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("Chatbot error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to get response from tutor" }),
    };
  }
};
