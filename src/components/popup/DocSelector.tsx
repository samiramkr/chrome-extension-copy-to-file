import { useState, useEffect } from "react";
import { getDocInfo, createDoc, extractDocId } from "@/utils/google-docs";
import { fetchRecentDriveDocs } from "@/utils/google-drive";
import type { RecentDoc } from "@/types";

interface DocSelectorProps {
  token: string;
  showMessage: (type: "success" | "error" | "info", text: string) => void;
}

export function DocSelector({ token, showMessage }: DocSelectorProps) {
  const [docs, setDocs] = useState<RecentDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDocs = async () => {
    try {
      const driveDocs = await fetchRecentDriveDocs(token);
      const stored = await getRecentDocs();
      const merged = mergeDocs(driveDocs, stored);
      setDocs(merged);

      // Select saved target doc
      chrome.storage.sync.get(["targetDocId"], (result) => {
        if (result.targetDocId) {
          setSelectedDocId(result.targetDocId);
        }
      });
    } catch (error) {
      console.warn("Could not load recent docs:", error);
      const stored = await getRecentDocs();
      setDocs(stored);
    }
  };

  const handleSelectChange = async (value: string) => {
    if (value === "__connect__") {
      setShowManualConnect(true);
      setShowCreateDoc(false);
      return;
    }
    if (value === "__create__") {
      setShowCreateDoc(true);
      setShowManualConnect(false);
      return;
    }

    setSelectedDocId(value);
    setShowManualConnect(false);
    setShowCreateDoc(false);

    const doc = docs.find((d) => d.docId === value);
    const title = doc?.title || "Document";

    await saveTargetDoc(value, title);
    await addToRecentDocs(value, title);
    showMessage("success", `Now saving to "${title}"`);
  };

  const handleConnect = async () => {
    const id = extractDocId(docUrl);
    if (!id) {
      showMessage("error", "Invalid Google Doc URL or ID.");
      return;
    }

    setConnecting(true);
    try {
      const info = await getDocInfo(token, id);
      await saveTargetDoc(info.docId, info.title);
      await addToRecentDocs(info.docId, info.title);
      setSelectedDocId(info.docId);
      setShowManualConnect(false);
      setDocUrl("");
      await loadDocs();
      showMessage("success", `Connected to "${info.title}"`);
    } catch (error) {
      showMessage(
        "error",
        `Could not connect: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleCreate = async () => {
    const title = newDocTitle.trim() || "My Saved Snippets";
    setCreating(true);
    try {
      const info = await createDoc(token, title);
      await saveTargetDoc(info.docId, info.title);
      await addToRecentDocs(info.docId, info.title);
      setSelectedDocId(info.docId);
      setShowCreateDoc(false);
      setNewDocTitle("");
      await loadDocs();
      showMessage("success", `Created and connected "${info.title}"`);
    } catch (error) {
      showMessage(
        "error",
        `Could not create doc: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setCreating(false);
    }
  };

  const docLinkUrl =
    selectedDocId &&
    selectedDocId !== "__connect__" &&
    selectedDocId !== "__create__"
      ? `https://docs.google.com/document/d/${selectedDocId}/edit`
      : null;

  return (
    <div className="mb-1">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        Save to:
      </label>
      <select
        value={selectedDocId}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 outline-none cursor-pointer transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
      >
        {docs.length === 0 && (
          <option value="" disabled>
            No docs yet — create or connect one
          </option>
        )}
        {docs.map((doc) => (
          <option key={doc.docId} value={doc.docId}>
            {doc.title}
          </option>
        ))}
        <option disabled>────────────</option>
        <option value="__connect__" className="text-blue-500 italic">
          📎 Connect by URL…
        </option>
        <option value="__create__" className="text-blue-500 italic">
          ✚ Create new doc…
        </option>
      </select>

      {docLinkUrl && (
        <a
          href={docLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-500 mt-1.5 hover:underline"
        >
          Open in Google Docs ↗
        </a>
      )}

      {/* Connect by URL */}
      {showManualConnect && (
        <div className="mt-2.5">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Google Doc URL or ID:
          </label>
          <input
            type="text"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="Paste Google Doc URL or document ID"
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg outline-none placeholder-gray-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full mt-2 py-2.5 px-4 text-sm font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect Doc"}
          </button>
        </div>
      )}

      {/* Create New Doc */}
      {showCreateDoc && (
        <div className="mt-2.5">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            New document title:
          </label>
          <input
            type="text"
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="My Saved Snippets"
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg outline-none placeholder-gray-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full mt-2 py-2.5 px-4 text-sm font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Doc"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Storage Helpers ───

function saveTargetDoc(docId: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { targetDocId: docId, targetDocTitle: title },
      resolve
    );
  });
}

function addToRecentDocs(docId: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["recentDocs"], (result) => {
      let docs: RecentDoc[] = result.recentDocs || [];
      docs = docs.filter((d) => d.docId !== docId);
      docs.unshift({ docId, title });
      if (docs.length > 5) docs.length = 5;
      chrome.storage.sync.set({ recentDocs: docs }, resolve);
    });
  });
}

function getRecentDocs(): Promise<RecentDoc[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["recentDocs"], (result) => {
      resolve(result.recentDocs || []);
    });
  });
}

function mergeDocs(
  driveDocs: RecentDoc[],
  storedDocs: RecentDoc[]
): RecentDoc[] {
  const seen = new Set<string>();
  const result: RecentDoc[] = [];
  for (const doc of [...driveDocs, ...storedDocs]) {
    if (!seen.has(doc.docId)) {
      seen.add(doc.docId);
      result.push(doc);
    }
  }
  return result.slice(0, 7);
}
