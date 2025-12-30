import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";

const isLocal = process.env.USE_LOCALSTACK === "true";

export const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region,
    endpoint: isLocal ? "http://localhost:8000" : undefined,
    credentials: isLocal
      ? { accessKeyId: "test", secretAccessKey: "test" }
      : undefined
  })
);

export const s3 = new S3Client({
  region,
  endpoint: isLocal ? "http://localhost:4566" : undefined,
  forcePathStyle: isLocal, // IMPORTANT for localstack
  credentials: isLocal ? { accessKeyId: "test", secretAccessKey: "test" } : undefined
});
