// ─── Storage Schema ───

export interface SyncStorage {
  targetDocId?: string;
  targetDocTitle?: string;
  recentDocs?: RecentDoc[];
  usedTags?: string[];

  // Preferences
  includeUrl?: boolean; // default true
  includeTimestamp?: boolean; // default true
  promptForTag?: boolean; // default true
  showDiffColors?: boolean; // default true
}

export interface LocalStorage {
  saveHistory?: HistoryEntry[];
}

// ─── Sub-types ───

export interface RecentDoc {
  docId: string;
  title: string;
}

export interface HistoryEntry {
  text: string;
  url: string;
  tag: string;
  timestamp: string; // ISO string
}

// ─── Google API Types ───

export interface DocInfo {
  title: string;
  docId: string;
}

export interface DriveFile {
  id: string;
  name: string;
}

export interface DriveFilesResponse {
  files: DriveFile[];
}

// ─── Diff Types ───

export type DiffType = "same" | "added" | "removed";

export interface DiffSegment {
  type: DiffType;
  text: string;
}

// ─── Preferences (resolved with defaults) ───

export interface Preferences {
  includeUrl: boolean;
  includeTimestamp: boolean;
  showDiffColors: boolean;
}

// ─── Languages ───

export interface Language {
  code: string;
  name: string;
}
