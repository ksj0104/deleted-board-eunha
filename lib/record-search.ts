import type { RecordFile } from "./cases";

export type SearchPart = { text: string; match: boolean };
export type RecordSearchContext = {
  source: "본문" | "댓글" | "첨부";
  parts: SearchPart[];
};
type TextMatch = { start: number; end: number; keyword: string };

const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" });
const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

export function searchKeywords(query: string): string[] {
  const normalized = normalize(query);
  return normalized ? [...new Set(normalized.split(" "))] : [];
}

function recordFields(record: RecordFile): string[] {
  return [
    record.id,
    record.title,
    record.author,
    record.board,
    ...record.paragraphs,
    ...(record.comments ?? []).flatMap((comment) => [
      comment.author,
      comment.text,
    ]),
    record.attachment?.title ?? "",
    ...(record.attachment?.columns ?? []),
    ...(record.attachment?.rows.flat() ?? []),
  ];
}

export function matchesRecordSearch(
  record: RecordFile,
  keywords: readonly string[],
): boolean {
  if (!keywords.length) return true;
  const fields = recordFields(record).map(normalize);
  return keywords.every((keyword) =>
    fields.some((field) => field.includes(keyword)),
  );
}

// Map normalized offsets back to original graphemes. A full-width character,
// ligature or decomposed syllable can normalize to a different number of units.
function indexedText(text: string) {
  const segments = [...graphemes.segment(text)];
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (const { segment, index } of segments) {
    const piece = segment.normalize("NFKC").toLowerCase();
    normalized += piece;
    for (let offset = 0; offset < piece.length; offset++) {
      starts.push(index);
      ends.push(index + segment.length);
    }
  }
  const whole = text.normalize("NFKC").toLowerCase();
  if (normalized !== whole) {
    // Compatibility Jamo and contextual case conversions can cross a grapheme
    // boundary. Rebuild only this uncommon case using normalized prefixes.
    normalized = "";
    starts.length = 0;
    ends.length = 0;
    for (const { segment, index } of segments) {
      const end = index + segment.length;
      const next = text.slice(0, end).normalize("NFKC").toLowerCase();
      let common = 0;
      while (common < normalized.length && normalized[common] === next[common])
        common++;
      const start = starts[common] ?? index;
      starts.length = common;
      ends.length = common;
      for (let offset = common; offset < next.length; offset++) {
        starts.push(start);
        ends.push(end);
      }
      normalized = next;
    }
  }
  return { normalized, starts, ends };
}

function textMatches(text: string, keywords: readonly string[]): TextMatch[] {
  if (!keywords.length) return [];
  const normalized = normalize(text);
  if (!keywords.some((keyword) => normalized.includes(keyword))) return [];
  const { normalized: indexed, starts, ends } = indexedText(text);
  const matches: TextMatch[] = [];
  for (const keyword of keywords) {
    if (!keyword) continue;
    let from = 0;
    while (from < indexed.length) {
      const index = indexed.indexOf(keyword, from);
      if (index < 0) break;
      matches.push({
        start: starts[index],
        end: ends[index + keyword.length - 1],
        keyword,
      });
      from = index + keyword.length;
    }
  }
  return matches.sort((a, b) => a.start - b.start || a.end - b.end);
}

function textParts(
  text: string,
  matches: TextMatch[],
  start = 0,
  end = text.length,
): SearchPart[] {
  const parts: SearchPart[] = [];
  let cursor = start;
  for (const match of matches) {
    if (match.end <= cursor || match.start >= end) continue;
    const matchStart = Math.max(cursor, match.start);
    const matchEnd = Math.min(end, match.end);
    if (cursor < matchStart)
      parts.push({ text: text.slice(cursor, matchStart), match: false });
    const previous = parts.at(-1);
    if (previous?.match) previous.text += text.slice(matchStart, matchEnd);
    else parts.push({ text: text.slice(matchStart, matchEnd), match: true });
    cursor = matchEnd;
  }
  if (cursor < end) parts.push({ text: text.slice(cursor, end), match: false });
  return parts;
}

export function highlightSearchText(
  text: string,
  keywords: readonly string[],
): SearchPart[] {
  return textParts(text, textMatches(text, keywords));
}

export function recordSearchContexts(
  record: RecordFile,
  keywords: readonly string[],
): RecordSearchContext[] {
  if (!keywords.length || !matchesRecordSearch(record, keywords)) return [];
  const fields: { source: RecordSearchContext["source"]; text: string }[] = [
    ...record.paragraphs.map((text) => ({ source: "본문" as const, text })),
    ...(record.comments ?? []).map((comment) => ({
      source: "댓글" as const,
      text: `${comment.author}: ${comment.text}`,
    })),
    ...(record.attachment
      ? [
          {
            source: "첨부" as const,
            text: [record.attachment.title, ...record.attachment.columns].join(
              " · ",
            ),
          },
          ...record.attachment.rows.map((row) => ({
            source: "첨부" as const,
            text: row
              .map(
                (cell, index) =>
                  `${record.attachment!.columns[index] ?? "항목"}: ${cell}`,
              )
              .join(" · "),
          })),
        ]
      : []),
  ];
  const candidates = fields
    .map((field) => ({ ...field, matches: textMatches(field.text, keywords) }))
    .filter((field) => field.matches.length);
  // Title, author and category are already highlighted in the result row.
  // Use the excerpts to reveal other searched words, without reordering posts.
  const visibleFields = [record.title, record.author, record.board].map(
    normalize,
  );
  const covered = new Set(
    keywords.filter((keyword) =>
      visibleFields.some((field) => field.includes(keyword)),
    ),
  );
  const contexts: RecordSearchContext[] = [];
  while (contexts.length < 2) {
    const missing = keywords.filter((keyword) => !covered.has(keyword));
    if (!missing.length && contexts.length) break;
    const candidate =
      candidates.find((field) =>
        field.matches.some((match) => missing.includes(match.keyword)),
      ) ?? (contexts.length === 0 ? candidates[0] : undefined);
    if (!candidate) break;
    const target =
      candidate.matches.find((match) => missing.includes(match.keyword)) ??
      candidate.matches[0];
    const boundaries = [...graphemes.segment(candidate.text)].map(
      (segment) => segment.index,
    );
    boundaries.push(candidate.text.length);
    const wantedStart = Math.max(
      0,
      Math.min(target.start - 28, candidate.text.length - 96),
    );
    const start =
      boundaries.findLast((boundary) => boundary <= wantedStart) ?? 0;
    const end =
      boundaries.find((boundary) => boundary >= start + 96) ??
      candidate.text.length;
    const parts = textParts(candidate.text, candidate.matches, start, end);
    if (start > 0) parts.unshift({ text: "…", match: false });
    if (end < candidate.text.length) parts.push({ text: "…", match: false });
    contexts.push({ source: candidate.source, parts });
    for (const match of candidate.matches)
      if (match.start < end && match.end > start) covered.add(match.keyword);
  }
  return contexts;
}
