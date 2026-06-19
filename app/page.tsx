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
  const [projectName, setProjectName] = useState("Untitled Project");
  const [lyrics, setLyrics] = useState("");
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
    "Honor thy error as a hidden intention",
    "Repetition is a form of change",
    "Trust in the you of now",
    "Use fewer notes",
    "Listen to the quiet voice",
    "Work at a different speed",
    "What is the reality of the situation?",
    "You can only make one dot at a time",
    "Turn it upside down",
    "Into the impossible",
  ];

  useEffect(() => {
    setLyrics(localStorage.getItem("rap-loop-lyrics") || "");
    setProjectName(
      localStorage.getItem("rap-loop-project-name") || "Untitled Project"
    );
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
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

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#d1d5db",
      progressColor: "#111827",
      cursorColor: "#007aff",
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
        color: "rgba(0,122,255,0.18)",
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
      setBpmStatus("Detecting...");

      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const result = await guess(audioBuffer);

      setBpm(Math.round(result.bpm));
      setBpmStatus("Detected");

      await audioContext.close();
    } catch {
      setBpm(null);
      setBpmStatus("Could not detect");
    }
  }

  function chooseFile(file: File) {
    wsRef.current?.pause();
    wsRef.current?.destroy();

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

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
  }

  function downloadTxt() {
    const text = `${projectName}

Beat: ${fileName}
BPM: ${bpm || "Unknown"}

Loop:
${loopStart.toFixed(2)}s → ${loopEnd.toFixed(2)}s

${lyrics}`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${projectName || "project"}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function newProject() {
    const hasContent =
      lyrics.trim() !== "" || projectName.trim() !== "Untitled Project";

    if (hasContent) {
      const shouldDownload = window.confirm(
        "Download current project before starting a new one?"
      );

      if (shouldDownload) downloadTxt();
    }

    pause();

    setProjectName("Untitled Project");
    setLyrics("");
    setFileName("No beat selected");
    setAudioUrl(null);
    setBpm(null);
    setBpmStatus("No BPM");
    setCurrentTime(0);
    setDuration(0);
    setLoopStart(0);
    setLoopEnd(10);
    setPlayMode("full");

    wsRef.current?.destroy();
    regionRef.current = null;

    localStorage.removeItem("rap-loop-lyrics");
    localStorage.removeItem("rap-loop-project-name");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <header className="mb-10 flex items-center justify-between gap-6">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-transparent text-6xl font-semibold tracking-tight outline-none"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={newProject}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#1d1d1f] shadow-sm hover:bg-zinc-100"
            >
              New Project
            </button>

            <span className="rounded-full bg-white px-5 py-2 text-sm text-zinc-500 shadow-sm">
              {saved}
            </span>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Creative prompt
          </p>

          <p className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            “{quote}”
          </p>
        </section>

        <section className="mb-6 rounded-[2rem] bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Beat Player
              </p>

              <p className="mt-2 max-w-4xl truncate text-zinc-500">
                {fileName}
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-[#1d1d1f] px-6 py-3 font-semibold text-white transition hover:bg-black"
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

          <div className="rounded-[1.5rem] border border-zinc-200 bg-[#fbfbfd] p-5">
            <div ref={waveformRef} className="min-h-[230px] overflow-x-auto" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[auto_auto_auto_auto_1fr_auto_auto] lg:items-center">
            <button
              onClick={playFull}
              className="rounded-full bg-[#1d1d1f] px-6 py-4 font-semibold text-white"
            >
              ▶ Full
            </button>

            <button
              onClick={playLoop}
              className="rounded-full bg-[#007aff] px-6 py-4 font-semibold text-white"
            >
              ↻ Loop
            </button>

            <button
              onClick={pause}
              className="rounded-full bg-zinc-100 px-6 py-4 font-semibold"
            >
              Pause
            </button>

            <button
              onClick={stop}
              className="rounded-full bg-zinc-100 px-6 py-4 font-semibold"
            >
              Stop
            </button>

            <div className="rounded-full bg-[#f5f5f7] px-6 py-4 text-center font-mono text-lg">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="rounded-full bg-[#f5f5f7] px-6 py-4 text-sm text-zinc-500">
              {playMode} · {loopStart.toFixed(2)}s → {loopEnd.toFixed(2)}s
            </div>

            <div className="rounded-full bg-[#f5f5f7] px-6 py-4 text-sm text-zinc-500">
              BPM{" "}
              <span className="font-semibold text-[#1d1d1f]">{bpm || "--"}</span>
              <span className="ml-2 text-xs">{bpmStatus}</span>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] bg-[#f5f5f7] px-6 py-5">
            <div className="mb-2 flex justify-between text-sm text-zinc-500">
              <span>Waveform zoom</span>
              <span>{zoom}</span>
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
        </section>

        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Lyrics</h2>
              <p className="text-zinc-500">Autosave locally in your browser.</p>
            </div>

            <button
              onClick={downloadTxt}
              className="rounded-full bg-[#007aff] px-6 py-3 font-semibold text-white"
            >
              Download .txt
            </button>
          </div>

          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Write your verse..."
            className="h-[560px] w-full resize-none rounded-[1.5rem] border border-zinc-200 bg-[#fbfbfd] p-6 text-2xl leading-relaxed outline-none placeholder:text-zinc-400"
          />
        </section>
      </div>
    </main>
  );
}