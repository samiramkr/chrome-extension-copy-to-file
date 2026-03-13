import type { DiffSegment } from "@/types";

/**
 * Compute a word-level diff between old and new text.
 * Returns segments marked as "same", "added", or "removed".
 */
export function computeWordDiff(
  oldText: string,
  newText: string
): DiffSegment[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);
  const lcs = longestCommonSubsequence(oldWords, newWords);

  const segments: DiffSegment[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldWords.length || ni < newWords.length) {
    if (li < lcs.length) {
      while (oi < oldWords.length && oldWords[oi] !== lcs[li]) {
        segments.push({ type: "removed", text: oldWords[oi] });
        oi++;
      }
      while (ni < newWords.length && newWords[ni] !== lcs[li]) {
        segments.push({ type: "added", text: newWords[ni] });
        ni++;
      }
      if (li < lcs.length) {
        segments.push({ type: "same", text: lcs[li] });
        oi++;
        ni++;
        li++;
      }
    } else {
      while (oi < oldWords.length) {
        segments.push({ type: "removed", text: oldWords[oi] });
        oi++;
      }
      while (ni < newWords.length) {
        segments.push({ type: "added", text: newWords[ni] });
        ni++;
      }
    }
  }

  // Merge consecutive segments of the same type
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}
