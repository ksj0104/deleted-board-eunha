import type { Episode, Question } from "./cases";
import { solutions } from "./solutions";

// Find a complete, bounded proof within the collection. Unrelated collected posts
// never count, and alternative source combinations remain valid.
export function automaticEvidence(
  episode: Episode,
  question: Question,
  collected: string[],
): string[] | null {
  const expected = solutions[episode.id]?.[question.id];
  if (!expected) return null;
  const allowed = new Set([
    ...expected.proof.flatMap((fact) => fact.sources.flat()),
    ...(expected.supportingEvidence ?? []),
  ]);
  const candidates = [...new Set(collected)]
    .filter((id) => allowed.has(id))
    .reverse();
  const proves = (ids: string[]) =>
    expected.proof.every((fact) =>
      fact.sources.some((alternative) =>
        alternative.every((id) => ids.includes(id)),
      ),
    );
  for (
    let count = question.evidenceCount;
    count <=
    Math.min(question.evidenceMax ?? question.evidenceCount, candidates.length);
    count++
  ) {
    const find = (start: number, selected: string[]): string[] | null => {
      if (selected.length === count) return proves(selected) ? selected : null;
      for (
        let index = start;
        index <= candidates.length - (count - selected.length);
        index++
      ) {
        const result = find(index + 1, [...selected, candidates[index]]);
        if (result) return result;
      }
      return null;
    };
    const result = find(0, []);
    if (result) return result;
  }
  return null;
}
