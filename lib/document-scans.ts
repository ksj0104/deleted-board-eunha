export type DocumentScan = { src: string; title: string; alt: string };

export const documentScans: Record<string, DocumentScan[]> = {
  "3-2": [
    {
      src: "documents/e318-tax-invoice.webp",
      title: "세금계산서",
      alt: "한결설비 E-318 세금계산서 보관용 사본",
    },
    {
      src: "documents/e318-supplier-reply.webp",
      title: "업체 회신 공문",
      alt: "한결설비 공사비 및 수금 계좌 확인 회신 공문",
    },
  ],
  "3-3": [
    {
      src: "documents/e318-transfer-confirmation.webp",
      title: "은행 이체 확인서",
      alt: "공동관리비 이체 두 건의 은행 확인서 보관 사본",
    },
  ],
};

export const settlementScan: DocumentScan = {
  src: "documents/settlement-memo.webp",
  title: "복원한 결산 수정 쪽지",
  alt: "이어 붙인 결산 수정 요청과 회신의 종이 원본",
};

export const settlementPieceSrc = (id: string) =>
  `documents/settlement-10-${id}.webp`;
