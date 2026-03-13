import type { HistoryEntry } from "@/types";

interface HistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
}

export function History({ entries, onClear }: HistoryProps) {
  return (
    <div className="mt-1">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
          Recent Saves
        </label>
        <button
          onClick={onClear}
          className="bg-transparent border-none text-gray-400 text-[11px] cursor-pointer px-1 hover:text-red-600 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="max-h-[200px] overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">
            No saved snippets yet.
          </p>
        ) : (
          entries.map((entry, i) => (
            <HistoryItem key={`${entry.timestamp}-${i}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const time = formatTimeAgo(new Date(entry.timestamp));
  const hostname = getHostname(entry.url);

  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0">
      <div className="text-xs text-gray-800 leading-relaxed mb-1 break-words">
        {entry.tag && (
          <span className="inline-block bg-blue-50 text-blue-600 text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1.5 align-middle tracking-wide">
            {entry.tag}
          </span>
        )}
        {entry.text}
      </div>
      <div className="flex justify-between items-center">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-500 no-underline max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap hover:underline"
          title={entry.url}
        >
          {hostname}
        </a>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">
          {time}
        </span>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
