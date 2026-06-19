"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { guess } from "web-audio-beat-detector";

export default function Home() {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wsRef = useRef<any>(null);
  const regionRef = useRef<any>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playModeRef = useRef<"full" | "loop">("full");

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("No beat selected");
  const [projectName, setProjectName] = useState("Untitled Rap");
  const [lyrics, setLyrics] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"full" | "loop">("full");
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(10);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState("Saved");
  const [zoom, setZoom] = useState(45);
  const [bpm, setBpm] = useState<number | null>(null);
  const [bpmStatus, setBpmStatus] = useState("No BPM");
  const [quote, setQuote] = useState("");

  const quotes = [
    "Abandon normal instruments",
    "Accept advice",
    "Accretion",
    "A line has two sides",
    "Allow an easement",
    "Ask your body",
    "Be dirty",
    "Breathe more deeply",
    "Bridges - build - burn",
    "Courage!",
    "Cut a vital connection",
    "Decorate, decorate",
    "Destroy the most important thing",
    "Disconnect from desire",
    "Distorting time",
    "Do something boring",
    "Don't break the silence",
    "Emphasize differences",
    "Emphasize repetitions",
    "Emphasize the flaws",
    "Faced with a choice, do both",
    "Ghost echoes",
    "Give way to your worst impulse",
    "Go slowly all the way round the outside",
    "Honor thy error as a hidden intention",
    "Humanize something free of error",
    "Into the impossible",
    "Is it finished?",
    "Just carry on",
    "Listen to the quiet voice",
    "Look at the order in which you do things",
    "Make a sudden, destructive, unpredictable action",
    "Mute and continue",
    "Only one element of each kind",
    "Overtly resist change",
    "Repetition is a form of change",
    "Reverse",
    "Simple subtraction",
    "Take a break",
    "The tape is now the music",
    "Think of the radio",
    "Trust in the you of now",
    "Turn it upside down",
    "Use an old idea",
    "Use fewer notes",
    "Use filters",
    "Water",
    "What is the reality of the situation?",
    "What mistakes did you make last time?",
    "What wouldn't you do?",
    "Work at a different speed",
    "You are an engineer",
    "You can only make one dot at a time",
    "You don't have to be ashamed of using your own ideas",
  ];

  useEffect(() => {
    setLyrics(localStorage.getItem("rap-loop-lyrics") || "");
    setProjectName(
      localStorage.getItem("rap-loop-project-name") || "Untitled Rap"
    );

    const randomQuote =
      quotes[Math.floor(Math.random() * quotes.length)];

    setQuote(randomQuote);
  }, []);

  useEffect(() => {
    setSaved("Saving...");

    const timer = setTimeout(() => {
      localStorage.setItem("rap-loop-lyrics", lyrics);
      localStorage.setItem("rap-loop-project-name", projectName);
      setSaved("Saved");
    }, 300);

    return () => clearTimeout(timer);
  }, [lyrics, projectName]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    wsRef.current?.zoom(zoom);
  }, [zoom]);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    wsRef.current?.destroy();
    regionRef.current = null;
    setIsPlaying(false);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#4b5563",
      progressColor: "#ffffff",
      cursorColor: "#22c55e",
      height: 220,
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      minPxPerSec: zoom,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    wsRef.current = ws;

    ws.load(audioUrl);

    ws.on("decode", () => {
      const dur = ws.getDuration();

      setDuration(dur);

      const end = Math.min(10, dur);

      const region = regions.addRegion({
        start: 0,
        end,
        color: "rgba(34, 197, 94, 0.25)",
        drag: true,
        resize: true,
      });

      regionRef.current = region;

      setLoopStart(region.start);
      setLoopEnd(region.end);
    });

    regions.on("region-updated", (region: any) => {
      regionRef.current = region;

      setLoopStart(region.start);
      setLoopEnd(region.end);
    });

    ws.on("interaction", () => {
      setPlayMode("full");
      playModeRef.current = "full";
    });

    ws.on("timeupdate", (time: number) => {
      setCurrentTime(time);

      const region = regionRef.current;

      if (
        region &&
        playModeRef.current === "loop" &&
        ws.isPlaying() &&
        time >= region.end
      ) {
        ws.setTime(region.start);
        ws.play();
      }
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    return () => ws.destroy();
  }, [audioUrl]);

  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds)) return "0:00";

    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function detectBpm(file: File) {
    try {
      setBpm(null);
      setBpmStatus("Detecting BPM...");

      const arrayBuffer = await file.arrayBuffer();

      const audioContext = new AudioContext();

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const result = await guess(audioBuffer);

      const detectedBpm = Math.round(result.bpm);

      setBpm(detectedBpm);
      setBpmStatus("Detected");

      await audioContext.close();
    } catch (error) {
      console.error(error);

      setBpm(null);
      setBpmStatus("Could not detect BPM");
    }
  }

  function chooseFile(file: File) {
    wsRef.current?.pause();
    wsRef.current?.destroy();

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const url = URL.createObjectURL(file);

    objectUrlRef.current = url;

    setAudioUrl(url);
    setFileName(file.name);
    setCurrentTime(0);
    setDuration(0);
    setLoopStart(0);
    setLoopEnd(10);
    setPlayMode("full");

    detectBpm(file);
  }

  function playFull() {
    const ws = wsRef.current;

    if (!ws) return;

    setPlayMode("full");
    playModeRef.current = "full";

    ws.play();
  }

  function playLoop() {
    const ws = wsRef.current;
    const region = regionRef.current;

    if (!ws || !region) return;

    setPlayMode("loop");
    playModeRef.current = "loop";

    ws.setTime(region.start);
    ws.play();
  }

  function pause() {
    wsRef.current?.pause();
  }

  function stop() {
    const ws = wsRef.current;

    if (!ws) return;

    ws.pause();
    ws.setTime(0);

    setCurrentTime(0);
    setIsPlaying(false);
  }

  function downloadTxt() {
    const text = `${projectName}

Beat: ${fileName}
BPM: ${bpm || "Unknown"}

Loop: ${loopStart.toFixed(2)}s → ${loopEnd.toFixed(2)}s

${lyrics}`;

    const blob = new Blob([text], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = `${projectName || "lyrics"}.txt`;

    a.click();

    URL.revokeObjectURL(url);
  }

  function clearLyrics() {
    pause();

    setLyrics("");
    setProjectName("Untitled Rap");
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-[1800px] p-5">
        <header className="mb-5 flex items-center justify-between gap-4">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-transparent text-5xl font-black outline-none"
          />

          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
            {saved}
          </span>
        </header>

        <div className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
            Oblique Strategy
          </p>

          <p className="text-2xl font-bold italic text-green-400">
            "{quote}"
          </p>
        </div>

        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-green-400">
                Beat Player
              </p>

              <p className="mt-1 max-w-4xl truncate text-zinc-400">
                {fileName}
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl bg-white px-5 py-3 font-black text-black hover:bg-zinc-200"
            >
              Choose / Replace Beat
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) chooseFile(file);

                e.target.value = "";
              }}
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4 overflow-x-auto">
            <div ref={waveformRef} className="min-h-[230px]" />
          </div>

          <div className="mt-4 rounded-2xl bg-black px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                Zoom waveform
              </span>

              <span className="font-mono text-sm text-zinc-500">
                {zoom}
              </span>
            </div>

            <input
              type="range"
              min="20"
              max="250"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[auto_auto_auto_auto_1fr_auto_auto] lg:items-center">
            <button
              onClick={playFull}
              className="rounded-2xl bg-white px-6 py-4 font-black text-black hover:bg-zinc-200"
            >
              ▶ Full
            </button>

            <button
              onClick={playLoop}
              className="rounded-2xl bg-green-500 px-6 py-4 font-black text-black hover:bg-green-400"
            >
              🔁 Loop
            </button>

            <button
              onClick={pause}
              className="rounded-2xl bg-zinc-800 px-6 py-4 font-black hover:bg-zinc-700"
            >
              Pause
            </button>

            <button
              onClick={stop}
              className="rounded-2xl bg-zinc-800 px-6 py-4 font-black hover:bg-zinc-700"
            >
              Stop
            </button>

            <div className="rounded-2xl bg-black px-5 py-4 text-center font-mono text-xl">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              <span className="text-white">
                {playMode === "loop" ? "Loop" : "Full"}
              </span>{" "}
              · {loopStart.toFixed(2)}s → {loopEnd.toFixed(2)}s
            </div>

            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              BPM:{" "}
              <span className="text-xl font-black text-green-400">
                {bpm || "--"}
              </span>

              <div className="text-xs text-zinc-500">
                {bpmStatus}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Lyrics</h2>

              <p className="text-sm text-zinc-500">
                Autosave локально в браузері
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadTxt}
                className="rounded-xl bg-blue-500 px-4 py-3 font-bold hover:bg-blue-400"
              >
                Download .txt
              </button>

              <button
                onClick={clearLyrics}
                className="rounded-xl bg-red-500 px-4 py-3 font-bold hover:bg-red-400"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Пиши реп тут..."
            className="h-[520px] w-full resize-none rounded-2xl border border-zinc-800 bg-black p-6 text-xl leading-relaxed text-white outline-none placeholder:text-zinc-700"
          />
        </section>
      </div>
    </main>
  );
}