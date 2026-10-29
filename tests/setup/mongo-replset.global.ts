import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * يشغّل MongoDB في الذاكرة بوضع replica set (عقدة واحدة) حتى تعمل المعاملات
 * كما في Atlas. راجع docs/decisions/0006-inventory-concurrency.md.
 */
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await replSet.waitUntilRunning();
  project.provide("mongoUri", replSet.getUri("abak-elkhalig-test"));

  return async () => {
    await replSet.stop();
  };
}
