import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";

// Only local if explicitly turned on
const isLocal = process.env.USE_LOCALSTACK === "true";
console.log(`AWS SDK using ${isLocal ? "localstack" : "real AWS"} services`);

const ddbClient = new DynamoDBClient({
  region,
  ...(isLocal
    ? {
        endpoint: process.env.DDB_ENDPOINT || "http://localhost:8000",
        credentials: { accessKeyId: "test", secretAccessKey: "test" }
      }
    : {})
});

export const ddb = DynamoDBDocumentClient.from(ddbClient);
