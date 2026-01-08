import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";

import { ddb } from "./aws.js";
import { GetCommand, PutCommand, ScanCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

const TABLE = process.env.DDB_TABLE;
const BUCKET = process.env.S3_BUCKET;

// Health
router.get("/health", (_req, res) => res.json({ ok: true }));

// List todos (simple: Scan; for production you'd Query on userId)
router.get("/todos", async (_req, res) => {
  try {
    const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
    res.json({ items: out.Items ?? [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to list todos", detail: e.message });
  }
});

// Create todo
router.post("/todos", async (req, res) => {
  console.log("Received create todo request:", req.body);
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "title is required" });

    const item = {
      id: nanoid(),
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    console.log("Creating todo:", item);

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: "Failed to create todo", detail: e.message });
  }
});

// Toggle completed
router.patch("/todos/:id/toggle", async (req, res) => {
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
router.delete("/todos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete todo", detail: e.message });
  }
});

app.use("/api", router);
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
