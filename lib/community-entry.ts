import type { RecordFile } from "./cases";

export type CommunityPhoto =
  | "courtyard"
  | "cat"
  | "pancakes"
  | "pancakesFollowup"
  | "chair"
  | "flowers"
  | "flowersPhone"
  | "flowersWalkway"
  | "flowersArchive"
  | "flowersWallpaper"
  | "books";

export type CommunityEntry = Omit<RecordFile, "comments" | "photo"> & {
  replies?: [author: string, text: string, date?: string][];
  photo?: CommunityPhoto;
};

function replyTime(date: string, minutes: number) {
  const [month, day, hour, minute] = date.split(/[. :]/).map(Number);
  return new Date(Date.UTC(2026, month - 1, day, hour, minute + minutes))
    .toISOString()
    .slice(5, 16)
    .replace("-", ".")
    .replace("T", " ");
}

export function createCommunityPost(
  { replies = [], photo, ...record }: CommunityEntry,
  images: Record<CommunityPhoto, NonNullable<RecordFile["photo"]>>,
): RecordFile {
  return {
    ...record,
    comments: replies.map(([author, text, date], index) => ({
      author,
      text,
      date: date ?? replyTime(record.date, (index + 1) * 7),
    })),
    ...(photo ? { photo: images[photo] } : {}),
  };
}
