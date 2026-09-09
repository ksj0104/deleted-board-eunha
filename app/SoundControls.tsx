"use client";
import React, { useState, useSyncExternalStore } from "react";
import { DEFAULT_SOUND_SETTINGS } from "../lib/sound";
import { useSound } from "./sound-context";
import { Dialog } from "./components";

export default function SoundControls() {
  const sound = useSound()!;
  const settings = useSyncExternalStore(
    sound.subscribe,
    sound.getSettings,
    () => DEFAULT_SOUND_SETTINGS,
  );
  const [open, setOpen] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const audible = settings.enabled && settings.volume > 0;
  const enable = (enabled: boolean) => {
    sound.setEnabled(enabled);
    if (enabled) {
      sound.unlock();
      sound.play("select");
    }
  };
  return (
    <div className="sound-controls">
      <div className="sound-buttons" data-sound="silent">
        <button
          type="button"
          aria-label={audible ? "효과음 끄기" : "효과음 켜기"}
          aria-pressed={audible}
          onClick={() => {
            if (!audible && settings.volume === 0)
              sound.setVolume(DEFAULT_SOUND_SETTINGS.volume);
            enable(!audible);
          }}
        >
          <span aria-hidden="true">{audible ? "♪" : "♩"}</span> 효과음{" "}
          {audible ? "켜짐" : "꺼짐"}
        </button>
        <button
          type="button"
          aria-label="효과음 설정"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          음량
        </button>
      </div>
      {open && (
        <Dialog label="효과음 설정" onClose={() => setOpen(false)}>
          <h2 className="modal-title">책상 위의 소리</h2>
          <p className="sound-description">
            종이를 넘기고 증거를 모으는 작은 소리로 조사를 이어갑니다.
          </p>
          <div className="sound-settings" data-sound="silent">
            <label className="sound-enable">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => enable(event.target.checked)}
              />{" "}
              효과음 사용
            </label>
            <label className="sound-volume" htmlFor="sound-volume">
              <span id="sound-volume-label">효과음 음량</span>
              <output aria-hidden="true">
                {Math.round(settings.volume * 100)}%
              </output>
            </label>
            <input
              id="sound-volume"
              aria-labelledby="sound-volume-label"
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(settings.volume * 100)}
              aria-valuetext={`${Math.round(settings.volume * 100)}퍼센트`}
              onChange={(event) =>
                sound.setVolume(Number(event.target.value) / 100)
              }
            />
            <button
              className="secondary"
              disabled={!audible}
              onClick={() => {
                sound.unlock();
                sound.play("collect");
                setPreviewCount((count) => count + 1);
              }}
            >
              소리 미리 듣기
            </button>
            <p role="status" className="sound-preview-status">
              {previewCount > 0
                ? `미리 듣기 ${previewCount}회 요청 · 설정 음량 ${Math.round(settings.volume * 100)}%`
                : "미리 듣기를 누르면 작동 상태가 여기에 표시됩니다."}
            </p>
            <p>
              설정은 이 브라우저에 저장됩니다. 메모 입력과 자동 저장은 조용히
              진행됩니다.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
