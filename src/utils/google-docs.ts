import type { DocInfo } from "@/types";

const DOCS_API_BASE = "https://docs.googleapis.com/v1/documents";

/**
 * Get the title and metadata of a Google Doc.
 */
export async function getDocInfo(
  token: string,
  docId: string
): Promise<DocInfo> {
  const response = await fetch(`${DOCS_API_BASE}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch document info");
  }

  const doc = await response.json();
  return { title: doc.title, docId: doc.documentId };
}

/**
 * Create a new Google Doc with a given title.
 */
export async function createDoc(
  token: string,
  title: string
): Promise<DocInfo> {
  const response = await fetch(DOCS_API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create document");
  }

  const doc = await response.json();
  return { title: doc.title, docId: doc.documentId };
}

/**
 * Validate that a document ID is accessible.
 */
export async function validateDocAccess(
  token: string,
  docId: string
): Promise<boolean> {
  try {
    await getDocInfo(token, docId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a Google Doc ID from a URL or return the ID as-is.
 */
export function extractDocId(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Try to extract from Google Docs URL
  const urlPattern = /\/document\/d\/([a-zA-Z0-9_-]+)/;
  const match = trimmed.match(urlPattern);
  if (match) return match[1];

  // If it looks like a plain doc ID
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  return null;
}
