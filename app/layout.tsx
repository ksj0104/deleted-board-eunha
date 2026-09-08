import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./community.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"}://${host}`;
  const image = new URL("/og.png", origin).toString();
  return {
    title: "삭제된 게시판 — 은하아파트 기록",
    description:
      "연락이 끊긴 이웃과 지워진 기록을 추적한다. 주민 게시판과 받은 자료 속 212개 기록을 검색하고 연결해 8개의 사건을 해결하는 웹 추리 게임.",
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
