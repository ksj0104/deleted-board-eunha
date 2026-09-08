"use client";
import React from "react";
import type { RecordFile } from "../lib/cases";
import { artifactClues } from "../lib/fieldwork";

export default function RecordArtifact({ record }: { record: RecordFile }) {
  const clues = artifactClues(record.id);
  return (
    <section
      className="record-artifact"
      aria-label={`${record.title} 원본 뷰어`}
    >
      <header>
        <span>보관 원본 · {record.id}</span>
        <time>{record.date}</time>
      </header>
      {clues.length > 0 && (
        <div className="artifact-fields">
          {clues.map((clue) => (
            <details key={clue.id}>
              <summary>
                {clue.label}
                <span aria-hidden="true">＋</span>
              </summary>
              <strong>{clue.value}</strong>
              <p>{clue.detail}</p>
            </details>
          ))}
        </div>
      )}
      {record.attachment && (
        <div className="artifact-table table-scroll">
          <table>
            <caption>{record.attachment.title}</caption>
            <thead>
              <tr>
                {record.attachment.columns.map((column, i) => (
                  <th key={i}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.attachment.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details
        className="artifact-transcript"
        open={clues.length === 0 && !record.attachment}
      >
        <summary>동봉된 설명과 텍스트 원문</summary>
        {record.paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </details>
    </section>
  );
}
