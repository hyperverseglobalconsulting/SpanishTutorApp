import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// ── Helpers ──
function res(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function getPath(event) {
  // Strip /api/curriculum/ prefix, return remaining path segments
  const raw = event.rawPath || "";
  const parts = raw.replace(/^\/api\/curriculum\/?/, "").split("/").filter(Boolean);
  return parts;
}

export const handler = async (event) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return res(401, { error: "Unauthorized" });

  const method = event.requestContext?.http?.method;
  const path = getPath(event);
  const resource = path[0]; // vocab | units | phases | scenarios
  const id = path[1];       // optional item id

  try {
    // ── GET /api/curriculum/vocab ──
    // Returns all vocab words
    if (method === "GET" && resource === "vocab") {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "VOCAB" },
      }));
      return res(200, { items: result.Items || [] });
    }

    // ── GET /api/curriculum/units ──
    // Returns all units with their metadata
    if (method === "GET" && resource === "units") {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "UNITS" },
      }));
      return res(200, { items: result.Items || [] });
    }

    // ── GET /api/curriculum/units/:id ──
    // Returns a specific unit with its word list
    if (method === "GET" && resource === "units" && id) {
      const meta = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: "UNITS", sk: `UNIT#${id}` },
      }));
      const words = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `UNIT#${id}` },
      }));
      return res(200, { unit: meta.Item, words: (words.Items || []).map(w => w.data) });
    }

    // ── GET /api/curriculum/phases ──
    if (method === "GET" && resource === "phases") {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "PHASES" },
      }));
      return res(200, { items: result.Items || [] });
    }

    // ── GET /api/curriculum/scenarios ──
    if (method === "GET" && resource === "scenarios") {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "SCENARIOS" },
      }));
      return res(200, { items: result.Items || [] });
    }

    // ── GET /api/curriculum/scenarios/:id ──
    // Returns a scenario with its dialogue steps
    if (method === "GET" && resource === "scenarios" && id) {
      const meta = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: "SCENARIOS", sk: `SCENARIO#${id}` },
      }));
      const steps = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `SCENARIO#${id}` },
      }));
      return res(200, { scenario: meta.Item, steps: (steps.Items || []).map(s => s.data) });
    }

    // ── GET /api/curriculum/all ──
    // Returns everything in one call (for initial page load)
    if (method === "GET" && resource === "all") {
      const [vocabRes, unitsRes, phasesRes, scenariosRes] = await Promise.all([
        ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "VOCAB" } })),
        ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "UNITS" } })),
        ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "PHASES" } })),
        ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": "SCENARIOS" } })),
      ]);
      return res(200, {
        vocab: (vocabRes.Items || []).map(i => i.data),
        units: (unitsRes.Items || []).map(i => i.data),
        phases: (phasesRes.Items || []).map(i => i.data),
        scenarios: (scenariosRes.Items || []).map(i => i.data),
      });
    }

    // ── POST /api/curriculum/vocab ──
    // Add or update a vocab word
    if (method === "POST" && resource === "vocab") {
      const body = JSON.parse(event.body || "{}");
      if (!body.spanish || !body.english) return res(400, { error: "spanish and english required" });
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "VOCAB",
          sk: `WORD#${body.spanish}`,
          gsi1pk: `CAT#${body.category || "uncategorized"}`,
          gsi1sk: `WORD#${body.spanish}`,
          data: body,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        },
      }));
      return res(200, { ok: true, word: body.spanish });
    }

    // ── PUT /api/curriculum/vocab/:word ──
    if (method === "PUT" && resource === "vocab" && id) {
      const body = JSON.parse(event.body || "{}");
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "VOCAB",
          sk: `WORD#${id}`,
          gsi1pk: `CAT#${body.category || "uncategorized"}`,
          gsi1sk: `WORD#${id}`,
          data: { ...body, spanish: id },
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        },
      }));
      return res(200, { ok: true });
    }

    // ── DELETE /api/curriculum/vocab/:word ──
    if (method === "DELETE" && resource === "vocab" && id) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { pk: "VOCAB", sk: `WORD#${id}` },
      }));
      return res(200, { ok: true });
    }

    // ── POST /api/curriculum/units ──
    // Create or update a unit
    if (method === "POST" && resource === "units") {
      const body = JSON.parse(event.body || "{}");
      if (!body.id || !body.title) return res(400, { error: "id and title required" });
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "UNITS",
          sk: `UNIT#${body.id}`,
          gsi1pk: `PHASE#${body.phase || 1}`,
          gsi1sk: `UNIT#${String(body.id).padStart(4, "0")}`,
          data: body,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        },
      }));
      return res(200, { ok: true, unitId: body.id });
    }

    // ── POST /api/curriculum/scenarios ──
    if (method === "POST" && resource === "scenarios") {
      const body = JSON.parse(event.body || "{}");
      if (!body.id || !body.title) return res(400, { error: "id and title required" });
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "SCENARIOS",
          sk: `SCENARIO#${body.id}`,
          data: body,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        },
      }));
      return res(200, { ok: true });
    }

    return res(404, { error: `Unknown route: ${method} ${resource || "/"}` });
  } catch (err) {
    console.error("Curriculum API error:", err);
    return res(500, { error: "Internal server error" });
  }
};
