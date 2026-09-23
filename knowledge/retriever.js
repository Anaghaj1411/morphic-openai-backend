import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = __dirname;

/**
 * Loads all Markdown knowledge files.
 */
async function loadKnowledgeFiles() {
  const files = await fs.readdir(KNOWLEDGE_DIR);

  const markdownFiles = files.filter(
    (file) => file.endsWith(".md")
  );

  const documents = [];

  for (const file of markdownFiles) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const content = await fs.readFile(filePath, "utf8");

    documents.push({
      file,
      content
    });
  }

  return documents;
}

/**
 * Splits a Markdown file into sections.
 */
function splitIntoSections(document) {
  const parts = document.content.split(/\n(?=# )/);

  return parts
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content) => ({
      file: document.file,
      content
    }));
}

/**
 * Simple keyword-based retrieval.
 *
 * This is our first RAG implementation.
 * It can later be replaced with embeddings/vector search
 * without changing the rest of the backend architecture.
 */
export async function retrieveKnowledge(query, maxResults = 4) {
  const documents = await loadKnowledgeFiles();

  const sections = documents.flatMap(splitIntoSections);

  const keywords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  const scored = sections.map((section) => {
    const text = section.content.toLowerCase();

    let score = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
    }

    return {
      ...section,
      score
    };
  });

  return scored
    .filter((section) => section.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}