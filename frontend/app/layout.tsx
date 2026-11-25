import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "綴り — 同じ時間に、違うページを。",
  description: "読んだ日も、ひと休みの日も。本とひとことを持ち寄る、小さな読書の場所。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
