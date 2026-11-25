export type ReadingStatus = "reading" | "paused" | "finished";
export type Member = { userId: string; displayName: string; color: string };
export type Book = { bookId: string; title: string; authors: string[]; addedBy: string; theme: number };
export type ReadingPost = { postId: string; bookId: string; userId: string; status: ReadingStatus; currentPage: number | null; comment: string; containsSpoiler: boolean; createdAt: string };
export const currentUserId = "sample-you";
export const statusLabels: Record<ReadingStatus, string> = { reading: "読書中", paused: "サボり中", finished: "読了" };
export const initialMembers: Member[] = [
  { userId: currentUserId, displayName: "はる", color: "#b87558" },
  { userId: "sample-aoi", displayName: "あおい", color: "#768a72" },
  { userId: "sample-riku", displayName: "りく", color: "#7886a0" },
];
export const initialBooks: Book[] = [
  { bookId: "book-night", title: "夜の余白", authors: ["遠野 灯"], addedBy: currentUserId, theme: 0 },
  { bookId: "book-rain", title: "喫茶と雨の日", authors: ["小川 こよみ"], addedBy: "sample-aoi", theme: 1 },
  { bookId: "book-plants", title: "植物のとなり", authors: ["森野 葉"], addedBy: "sample-riku", theme: 2 },
  { bookId: "book-map", title: "遠回りの地図", authors: ["岸 つむぎ"], addedBy: currentUserId, theme: 3 },
  { bookId: "book-soup", title: "月曜日のスープ", authors: ["井上 なぎ"], addedBy: "sample-aoi", theme: 1 },
  { bookId: "book-letter", title: "海辺の手紙", authors: ["青井 航"], addedBy: "sample-riku", theme: 0 },
];
export const initialPosts: ReadingPost[] = [
  { postId: "post-3", bookId: "book-night", userId: currentUserId, status: "reading", currentPage: 120, comment: "あと一章だけ、のつもりだった。", containsSpoiler: false, createdAt: "2026-11-22T12:30:00Z" },
  { postId: "post-2", bookId: "book-rain", userId: "sample-aoi", status: "paused", currentPage: 48, comment: "今日はひと休み。続きは明日の自分へ。", containsSpoiler: false, createdAt: "2026-11-22T11:10:00Z" },
  { postId: "post-1", bookId: "book-plants", userId: "sample-riku", status: "finished", currentPage: 216, comment: "最後の手紙が、最初の場面につながっていた。", containsSpoiler: true, createdAt: "2026-11-21T09:45:00Z" },
];
