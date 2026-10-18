"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

// Minimal typing: lib.dom does not ship the (prefixed) SpeechRecognition constructor.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noSubscribe = () => () => {};

/** Browser speech-to-text. Audio stays with the browser/OS; only the transcript reaches the app. */
export function useSpeechRecognition(onFinal: (transcript: string) => void) {
  const supported = useSyncExternalStore(noSubscribe, () => !!getCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      const parts = Array.from(e.results);
      finalText = parts.map((r) => r[0]?.transcript ?? "").join(" ");
      setInterim(finalText);
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in Settings, or use the keyboard's dictation mic in the text box."
          : e.error === "no-speech"
            ? "Didn't catch that. Try again."
            : "Speech recognition isn't available right now. Type or dictate instead.",
      );
    };
    rec.onend = () => {
      setListening(false);
      recognition.current = null;
      if (finalText.trim()) onFinal(finalText.trim());
      setInterim("");
    };
    setError(null);
    setListening(true);
    recognition.current = rec;
    rec.start();
  }, [onFinal]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, interim, error, start, stop };
}
