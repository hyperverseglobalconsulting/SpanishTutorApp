import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const method = event.requestContext?.http?.method;

  try {
    if (method === "GET") {
      // Get all progress for user
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
      };

      for (const item of result.Items || []) {
        if (item.sk === "PROFILE") {
          progress.streak = item.streak || 0;
          progress.lastScore = item.lastScore || null;
        } else if (item.sk === "LEARNED") {
          progress.learned = item.words || [];
        } else if (item.sk.startsWith("QUIZ#")) {
          progress.quizHistory.push({
            date: item.date,
            mode: item.mode,
            score: item.score,
            total: item.total,
          });
        }
      }

      return { statusCode: 200, body: JSON.stringify(progress) };
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");

      // Save learned words
      if (body.learned) {
        await ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            userId,
            sk: "LEARNED",
            words: body.learned,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

      // Save profile (streak, lastScore)
      if (body.streak !== undefined || body.lastScore !== undefined) {
        await ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            userId,
            sk: "PROFILE",
            streak: body.streak || 0,
            lastScore: body.lastScore || null,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

      // Save quiz result
      if (body.quizResult) {
        const ts = Date.now();
        await ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            userId,
            sk: `QUIZ#${ts}`,
            date: new Date().toISOString(),
            mode: body.quizResult.mode,
            score: body.quizResult.score,
            total: body.quizResult.total,
          },
        }));
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Progress API error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
