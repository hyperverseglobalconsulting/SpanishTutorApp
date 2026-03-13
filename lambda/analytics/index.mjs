import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE = process.env.EVENTS_TABLE;
const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

function res(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function getPath(event) {
  const raw = event.rawPath || "";
  return raw.replace(/^\/api\/analytics\/?/, "").split("/").filter(Boolean);
}

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return res(401, { error: "Unauthorized" });

  const method = event.requestContext?.http?.method;
  const path = getPath(event);
  const resource = path[0];

  try {
    // ── POST /api/analytics/events ──
    // Record one or more learning events
    if (method === "POST" && resource === "events") {
      const body = JSON.parse(event.body || "{}");
      const events = Array.isArray(body.events) ? body.events : [body];
      const now = Date.now();

      if (events.length <= 25) {
        // Single batch write
        const items = events.map((evt, i) => ({
          PutRequest: {
            Item: {
              pk: `USER#${userId}`,
              sk: `EVT#${now + i}`,
              type: evt.type || "unknown",
              word: evt.word || null,
              correct: evt.correct ?? null,
              mode: evt.mode || null,
              detail: evt.detail || null,
              ts: new Date().toISOString(),
              date: new Date().toISOString().slice(0, 10),
            },
          },
        }));

        await ddb.send(new BatchWriteCommand({
          RequestItems: { [EVENTS_TABLE]: items },
        }));
      } else {
        // Multiple batches for >25 items
        for (let i = 0; i < events.length; i += 25) {
          const batch = events.slice(i, i + 25).map((evt, j) => ({
            PutRequest: {
              Item: {
                pk: `USER#${userId}`,
                sk: `EVT#${now + i + j}`,
                type: evt.type || "unknown",
                word: evt.word || null,
                correct: evt.correct ?? null,
                mode: evt.mode || null,
                detail: evt.detail || null,
                ts: new Date().toISOString(),
                date: new Date().toISOString().slice(0, 10),
              },
            },
          }));
          await ddb.send(new BatchWriteCommand({
            RequestItems: { [EVENTS_TABLE]: batch },
          }));
        }
      }

      return res(200, { ok: true, count: events.length });
    }

    // ── GET /api/analytics/summary ──
    // Returns aggregated stats for the current user
    if (method === "GET" && resource === "summary") {
      const params = event.queryStringParameters || {};
      const days = parseInt(params.days) || 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const result = await ddb.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: "pk = :pk AND sk >= :since",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":since": `EVT#${Date.now() - days * 86400000}`,
        },
      }));

      const events = result.Items || [];
      const summary = {
        totalEvents: events.length,
        days,
        byType: {},
        byDate: {},
        accuracy: { correct: 0, total: 0 },
        wordsPracticed: new Set(),
      };

      for (const evt of events) {
        // By type
        summary.byType[evt.type] = (summary.byType[evt.type] || 0) + 1;

        // By date
        const d = evt.date || evt.ts?.slice(0, 10);
        if (d) summary.byDate[d] = (summary.byDate[d] || 0) + 1;

        // Accuracy
        if (evt.correct !== null && evt.correct !== undefined) {
          summary.accuracy.total++;
          if (evt.correct) summary.accuracy.correct++;
        }

        // Words practiced
        if (evt.word) summary.wordsPracticed.add(evt.word);
      }

      summary.wordsPracticed = summary.wordsPracticed.size;
      summary.accuracy.rate = summary.accuracy.total > 0
        ? Math.round(summary.accuracy.correct / summary.accuracy.total * 100)
        : null;

      return res(200, summary);
    }

    // ── GET /api/analytics/history ──
    // Returns raw events for the user (paginated)
    if (method === "GET" && resource === "history") {
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit) || 50, 200);

      const result = await ddb.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${userId}` },
        ScanIndexForward: false,
        Limit: limit,
      }));

      return res(200, { events: result.Items || [] });
    }

    // ── GET /api/analytics/streaks ──
    // Calculate practice streak from events
    if (method === "GET" && resource === "streaks") {
      const result = await ddb.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${userId}` },
        ScanIndexForward: false,
        Limit: 1000,
      }));

      const dates = new Set();
      for (const evt of (result.Items || [])) {
        const d = evt.date || evt.ts?.slice(0, 10);
        if (d) dates.add(d);
      }

      const sortedDates = [...dates].sort().reverse();
      let streak = 0;
      const today = new Date().toISOString().slice(0, 10);
      let check = new Date(today);

      for (let i = 0; i < 365; i++) {
        const d = check.toISOString().slice(0, 10);
        if (sortedDates.includes(d)) {
          streak++;
        } else if (i > 0) {
          break;
        }
        check.setDate(check.getDate() - 1);
      }

      return res(200, {
        currentStreak: streak,
        totalDays: dates.size,
        activeDates: [...dates].sort(),
      });
    }

    // ── GET /api/analytics/weakwords ──
    // Find words with lowest accuracy
    if (method === "GET" && resource === "weakwords") {
      const result = await ddb.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${userId}` },
        ScanIndexForward: false,
        Limit: 2000,
      }));

      const wordStats = {};
      for (const evt of (result.Items || [])) {
        if (!evt.word || evt.correct === null || evt.correct === undefined) continue;
        if (!wordStats[evt.word]) wordStats[evt.word] = { correct: 0, total: 0 };
        wordStats[evt.word].total++;
        if (evt.correct) wordStats[evt.word].correct++;
      }

      const weak = Object.entries(wordStats)
        .map(([word, s]) => ({ word, accuracy: Math.round(s.correct / s.total * 100), attempts: s.total }))
        .filter(w => w.attempts >= 2)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 20);

      return res(200, { weakWords: weak });
    }

    return res(404, { error: `Unknown route: ${method} ${resource || "/"}` });
  } catch (err) {
    console.error("Analytics API error:", err);
    return res(500, { error: "Internal server error" });
  }
};
