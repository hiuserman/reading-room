import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "私の本棚 | 開発環境",
  description: "2D仮想本棚と読書管理アプリの接続確認画面",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
