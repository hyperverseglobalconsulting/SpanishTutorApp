#!/usr/bin/env node
// ── Seed Curriculum ──────────────────────────────────────────────────────────
// Reads the vocab data from site/js/vocab-data.js, extracts the RAW JSON,
// and invokes the seed Lambda to populate the curriculum DynamoDB table.
//
// Usage:
//   node scripts/seed-curriculum.mjs [--function-name <name>] [--region <region>]
//
// Requires: AWS CLI credentials configured, @aws-sdk/client-lambda installed.
// Or simply: aws lambda invoke --function-name spanish-tutor-seed --payload file://data/vocab.json /dev/stdout

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse the RAW array from vocab-data.js
const vocabJs = readFileSync(join(__dirname, "..", "site", "js", "vocab-data.js"), "utf-8");
const rawMatch = vocabJs.match(/const RAW = (\[[\s\S]*?\]);/);
if (!rawMatch) {
  console.error("Could not parse RAW array from vocab-data.js");
  process.exit(1);
}

const RAW = JSON.parse(rawMatch[1]);
const vocab = RAW.map(w => ({
  spanish: w.s, english: w.e, pos: w.p, notes: w.n,
  example_es: w.xs, example_en: w.xe, priority: w.r, category: w.c,
}));

console.log(`Parsed ${vocab.length} vocab words`);

// Build the Lambda payload
const payload = JSON.stringify({ vocab });

// Try to invoke via AWS SDK
const args = process.argv.slice(2);
const fnIdx = args.indexOf("--function-name");
const regionIdx = args.indexOf("--region");
const functionName = fnIdx >= 0 ? args[fnIdx + 1] : "spanish-tutor-seed";
const region = regionIdx >= 0 ? args[regionIdx + 1] : "ap-south-1";

try {
  const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
  const lambda = new LambdaClient({ region });

  console.log(`Invoking Lambda: ${functionName} in ${region}...`);
  const response = await lambda.send(new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(payload),
    InvocationType: "RequestResponse",
  }));

  const result = JSON.parse(Buffer.from(response.Payload).toString());
  console.log("Result:", JSON.stringify(result, null, 2));

  if (response.FunctionError) {
    console.error("Lambda error:", response.FunctionError);
    process.exit(1);
  }
  console.log("Seed complete!");
} catch (e) {
  if (e.code === "ERR_MODULE_NOT_FOUND" || e.message?.includes("Cannot find")) {
    // SDK not installed — write payload to file for manual invocation
    const outPath = join(__dirname, "..", "data", "seed-payload.json");
    const { mkdirSync, writeFileSync } = await import("fs");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, payload);
    console.log(`\nAWS SDK not available. Payload written to: ${outPath}`);
    console.log(`\nInvoke manually with:`);
    console.log(`  aws lambda invoke --function-name ${functionName} --region ${region} --payload fileb://${outPath} /dev/stdout`);
  } else {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
