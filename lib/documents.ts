
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";

export type SourceChunk = {
  text: string;
  source: string;
  embedding: number[];
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

let cachedChunks: SourceChunk[] | null = null;

function splitIntoChunks(
  text: string,
  size = 180,
  overlap = 30
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ");
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

async function embed(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  const values = result.embeddings?.[0]?.values;

  if (!values?.length) {
    throw new Error("The embedding service returned no vector.");
  }

  return values;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function buildIndex(): Promise<SourceChunk[]> {
  const folder = path.join(process.cwd(), "knowledge");
  const files = await fs.readdir(folder);
  const textFiles = files.filter((file) => file.endsWith(".txt"));

  if (textFiles.length === 0) {
    throw new Error("No .txt documents found in the knowledge folder.");
  }

  const chunks: SourceChunk[] = [];

  for (const file of textFiles) {
    const content = await fs.readFile(
      path.join(folder, file),
      "utf8"
    );

    for (const text of splitIntoChunks(content)) {
      chunks.push({
        text,
        source: file,
        embedding: [],
      });
    }
  }

  for (const chunk of chunks) {
    chunk.embedding = await embed(chunk.text);
  }

  return chunks;
}

export async function retrieveDocuments(question: string) {
  if (!cachedChunks) {
    cachedChunks = await buildIndex();
  }

  const questionEmbedding = await embed(question);

  return cachedChunks
    .map((chunk) => ({
      text: chunk.text,
      source: chunk.source,
      score: cosineSimilarity(
        questionEmbedding,
        chunk.embedding
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
