// =============================================================
// utils/google-docs.js — Google Docs API Helpers
// =============================================================
// Reusable functions for interacting with the Google Docs API.
// These can be imported by background.js or popup.js.
// =============================================================

const DOCS_API_BASE = "https://docs.googleapis.com/v1/documents";

/**
 * Get the title and metadata of a Google Doc.
 * @param {string} token - OAuth access token
 * @param {string} docId - Google Doc ID
 * @returns {Promise<{title: string, docId: string}>}
 */
async function getDocInfo(token, docId) {
  const response = await fetch(`${DOCS_API_BASE}/${docId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch document info");
  }

  const doc = await response.json();
  return {
    title: doc.title,
    docId: doc.documentId,
  };
}

/**
 * Create a new Google Doc with a given title.
 * @param {string} token - OAuth access token
 * @param {string} title - Title for the new document
 * @returns {Promise<{title: string, docId: string}>}
 */
async function createDoc(token, title) {
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
  return {
    title: doc.title,
    docId: doc.documentId,
  };
}

/**
 * Append text to the end of a Google Doc.
 * @param {string} token - OAuth access token
 * @param {string} docId - Google Doc ID
 * @param {string} text - Text content to append
 * @param {string} sourceUrl - URL where the text was captured
 * @returns {Promise<object>} - API response
 */
async function appendTextToDoc(token, docId, text, sourceUrl) {
  // First, get the document to find the end index
  const docResponse = await fetch(`${DOCS_API_BASE}/${docId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!docResponse.ok) {
    const error = await docResponse.json();
    throw new Error(error.error?.message || "Failed to read document");
  }

  const doc = await docResponse.json();
  const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;

  // Build the text block
  const timestamp = new Date().toLocaleString();
  const separator = "\n———————————————————————————\n";
  const header = `📌 Saved on ${timestamp}\n🔗 ${sourceUrl}\n\n`;
  const content = `${separator}${header}${text}\n`;

  const requests = [
    {
      insertText: {
        location: { index: endIndex },
        text: content,
      },
    },
  ];

  const response = await fetch(`${DOCS_API_BASE}/${docId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Docs API error");
  }

  return response.json();
}

/**
 * Validate that a document ID is accessible.
 * @param {string} token - OAuth access token
 * @param {string} docId - Google Doc ID to validate
 * @returns {Promise<boolean>}
 */
async function validateDocAccess(token, docId) {
  try {
    await getDocInfo(token, docId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a Google Doc ID from a URL or return the ID as-is.
 * Supports formats:
 *   - https://docs.google.com/document/d/DOC_ID/edit
 *   - DOC_ID (plain string)
 * @param {string} input - URL or doc ID
 * @returns {string|null} - Extracted doc ID or null
 */
function extractDocId(input) {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // Try to extract from Google Docs URL
  const urlPattern = /\/document\/d\/([a-zA-Z0-9_-]+)/;
  const match = trimmed.match(urlPattern);
  if (match) return match[1];

  // If it looks like a plain doc ID (alphanumeric, hyphens, underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  return null;
}
