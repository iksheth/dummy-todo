import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";

import { ddb, s3 } from "./aws.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { GetCommand, PutCommand, ScanCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const app = express();
app.use(cors());
app.use(express.json());

const TABLE = process.env.DDB_TABLE;
const BUCKET = process.env.S3_BUCKET;

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// List todos (simple: Scan; for production you'd Query on userId)
app.get("/todos", async (_req, res) => {
  try {
    const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
    res.json({ items: out.Items ?? [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to list todos", detail: e.message });
  }
});

// Create todo
app.post("/todos", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    const item = {
      id: nanoid(),
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      attachment: null // { key, fileName, contentType }
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: "Failed to create todo", detail: e.message });
  }
});

// Toggle completed
app.patch("/todos/:id/toggle", async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    if (!existing.Item) return res.status(404).json({ error: "Not found" });

    const updated = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: "SET completed = :c",
        ExpressionAttributeValues: { ":c": !existing.Item.completed },
        ReturnValues: "ALL_NEW"
      })
    );
    res.json(updated.Attributes);
  } catch (e) {
    res.status(500).json({ error: "Failed to toggle", detail: e.message });
  }
});

// Delete todo
app.delete("/todos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete todo", detail: e.message });
  }
});

// Get pre-signed URL for uploading an attachment
app.post("/todos/:id/attachment-url", async (req, res) => {
  const { id } = req.params;
  const { fileName, contentType } = req.body;

  if (!fileName || !contentType) {
    return res.status(400).json({ error: "fileName and contentType required" });
  }

  try {
    // Ensure todo exists
    const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    if (!existing.Item) return res.status(404).json({ error: "Not found" });

    const safeName = fileName.replace(/[^\w.\-()+ ]/g, "_");
    const key = `attachments/${id}/${Date.now()}-${safeName}`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });

    // Save attachment metadata in DynamoDB
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: "SET attachment = :a",
        ExpressionAttributeValues: {
          ":a": { key, fileName: safeName, contentType }
        }
      })
    );

    res.json({ uploadUrl, key });
  } catch (e) {
    res.status(500).json({ error: "Failed to create upload url", detail: e.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
