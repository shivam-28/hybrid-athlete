"use client";

import { useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpeechRecognition } from "./use-speech-recognition";

/** Speak or type a set. Both paths submit the same transcript to the server parser. */
export function VoiceBar(props: { pending: boolean; onSubmit: (transcript: string, source: "voice" | "text") => void }) {
  const [text, setText] = useState("");
  const speech = useSpeechRecognition((transcript) => props.onSubmit(transcript, "voice"));

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          props.onSubmit(text.trim(), "text");
          setText("");
        }}
      >
        {speech.supported && (
          <Button
            type="button"
            size="icon"
            variant={speech.listening ? "destructive" : "secondary"}
            className="size-11 shrink-0"
            aria-label={speech.listening ? "Stop listening" : "Speak a set"}
            onClick={speech.listening ? speech.stop : speech.start}
          >
            {speech.listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        <Input
          aria-label="Say or type a set"
          placeholder="e.g. squat 60 kg 8 reps"
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          className="h-11 text-base"
          autoComplete="off"
          enterKeyHint="send"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" aria-label="Log it" disabled={props.pending || speech.listening}>
          <Send />
        </Button>
      </form>
      {speech.error && <p className="text-destructive text-sm">{speech.error}</p>}
      {!speech.supported && (
        <p className="text-muted-foreground text-xs">Voice isn&apos;t available here — tap the box and use your keyboard&apos;s microphone to dictate.</p>
      )}
    </div>
  );
}
