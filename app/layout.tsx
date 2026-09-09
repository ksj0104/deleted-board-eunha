import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./community.css";
import "./investigation.css";
import "./curtain/curtain.css";
import "./collection.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"}://${host}`;
  const image = new URL("/og.png", origin).toString();
  return {
    title: "추리 게임 모음 · 삭제된 게시판 / 마지막 커튼콜",
    description:
      "삭제된 게시판과 마지막 커튼콜, 두 가지 추리 게임을 선택하세요. 게시판의 기록을 연결하거나 무대의 장면을 재현하며 사건을 해결합니다.",
    robots: { index: false, follow: false },
    openGraph: {
      title: "삭제된 게시판",
      description:
        "8개의 사건, 하나의 진실. 기록을 읽고 연결하는 웹 추리 게임.",
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: image,
          width: 1536,
          height: 1024,
          alt: "삭제된 게시판 — 8개의 사건, 하나의 진실",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "삭제된 게시판",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
