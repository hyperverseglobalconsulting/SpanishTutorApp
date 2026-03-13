import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;

function res(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return res(401, { error: "Unauthorized" });

  const method = event.requestContext?.http?.method;

  try {
    if (method === "GET") {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      }));

      const progress = {
        learned: [],
        streak: 0,
        lastScore: null,
        quizHistory: [],
        mastery: {},
        srs: {},
        history: [],
      };

      for (const item of result.Items || []) {
        if (item.sk === "PROFILE") {
          progress.streak = item.streak || 0;
          progress.lastScore = item.lastScore || null;
        } else if (item.sk === "LEARNED") {
          progress.learned = item.words || [];
        } else if (item.sk === "MASTERY") {
          progress.mastery = item.data || {};
        } else if (item.sk === "SRS") {
          progress.srs = item.data || {};
        } else if (item.sk === "HISTORY") {
          progress.history = item.data || [];
        } else if (item.sk.startsWith("QUIZ#")) {
          progress.quizHistory.push({
            date: item.date,
            mode: item.mode,
            score: item.score,
            total: item.total,
          });
        }
      }

      return res(200, progress);
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const writes = [];

      // Save learned words (legacy)
      if (body.learned) {
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: { userId, sk: "LEARNED", words: body.learned, updatedAt: new Date().toISOString() },
        })));
      }

      // Save profile (streak, lastScore)
      if (body.streak !== undefined || body.lastScore !== undefined) {
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: { userId, sk: "PROFILE", streak: body.streak || 0, lastScore: body.lastScore || null, updatedAt: new Date().toISOString() },
        })));
      }

      // Save full mastery state { word: level }
      if (body.mastery) {
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: { userId, sk: "MASTERY", data: body.mastery, updatedAt: new Date().toISOString() },
        })));
      }

      // Save SRS schedule data { word: { nextReview, interval, easeFactor } }
      if (body.srs) {
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: { userId, sk: "SRS", data: body.srs, updatedAt: new Date().toISOString() },
        })));
      }

      // Save learning history array (capped at last 500 entries)
      if (body.history) {
        const capped = Array.isArray(body.history) ? body.history.slice(-500) : [];
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: { userId, sk: "HISTORY", data: capped, updatedAt: new Date().toISOString() },
        })));
      }

      // Save quiz result
      if (body.quizResult) {
        const ts = Date.now();
        writes.push(ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            userId, sk: `QUIZ#${ts}`,
            date: new Date().toISOString(),
            mode: body.quizResult.mode,
            score: body.quizResult.score,
            total: body.quizResult.total,
          },
        })));
      }

      await Promise.all(writes);
      return res(200, { ok: true });
    }

    return res(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Progress API error:", err);
    return res(500, { error: "Internal server error" });
  }
};
