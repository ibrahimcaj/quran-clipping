import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI must be set");
}

const options = {
  serverSelectionTimeoutMS: 5000,
};

declare global {
  var _mongoClient: MongoClient | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient() {
  return new MongoClient(uri, options);
}

async function connectClient(): Promise<MongoClient> {
  const client = global._mongoClient ?? createClient();
  global._mongoClient = client;

  try {
    await client.connect();
    return client;
  } catch (error) {
    // Clear the cached client/promise so a later request can retry cleanly.
    global._mongoClient = undefined;
    global._mongoClientPromise = undefined;
    throw error;
  }
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = connectClient();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db("clips");
}

export default getMongoClient;
