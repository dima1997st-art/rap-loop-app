"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { guess } from "web-audio-beat-detector";
import {
  type DemoTake,
  type RecordMode,
  useDemoRecorder,
} from "./hooks/useDemoRecorder";

type GoogleDoc = { id: string; name: string; webViewLink: string };
type ThemeMode = "light" | "dark";
type LyricsFont = "system" | "serif" | "mono";
type GridDivision = "1/4" | "1/8" | "1/16";
type BeatGridLine = { time: number; left: number; isBar: boolean; isBeat: boolean; label: string };

const BEATS_PER_BAR = 4;
const MIN_GRID_LABEL_GAP_PX = 72;
const gridDivisionStepsPerBeat: Record<GridDivision, number> = {
  "1/4": 1,
  "1/8": 2,
  "1/16": 4,
};

const lyricsFontFamilies: Record<LyricsFont, string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
};

function buildWaveformBars(audioBuffer: AudioBuffer | null, start: number, end: number, count: number) {
  if (!audioBuffer || end <= start) return [];

  const sampleStart = Math.max(0, Math.floor(start * audioBuffer.sampleRate));
  const sampleEnd = Math.min(audioBuffer.length, Math.ceil(end * audioBuffer.sampleRate));
  const samplesPerBar = Math.max(1, Math.floor((sampleEnd - sampleStart) / count));

  return Array.from({ length: count }, (_, index) => {
    const from = sampleStart + index * samplesPerBar;
    const to = Math.min(sampleEnd, from + samplesPerBar);
    let peak = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      for (let sample = from; sample < to; sample += 1) {
        peak = Math.max(peak, Math.abs(data[sample] || 0));
      }
    }

    return Math.max(0.08, Math.min(1, peak));
  });
}

function snapTimeToBeatGrid(
  time: number,
  bpmValue: number | null,
  maxTime: number,
  division: GridDivision
) {
  if (!bpmValue || bpmValue <= 0) return Math.min(Math.max(time, 0), maxTime);

  const gridSeconds = 60 / bpmValue / gridDivisionStepsPerBeat[division];
  const snapped = Math.round(time / gridSeconds) * gridSeconds;

  return Math.min(Math.max(snapped, 0), maxTime);
}

export default function Home() {
  const { data: session } = useSession();
  const recorder = useDemoRecorder();

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const docsDrawerRef = useRef<HTMLDivElement | null>(null);
  const recorderDrawerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<any>(null);
  const regionRef = useRef<any>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playModeRef = useRef<"full" | "loop">("full");
  const lastPlaybackStartRef = useRef(0);
  const lastSyncedRef = useRef("");
  const selectionRef = useRef({ start: 0, end: 0 });
  const bpmRef = useRef<number | null>(null);
  const gridDivisionRef = useRef<GridDivision>("1/4");

  const [theme, setTheme] = useState<ThemeMode>("light");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("No beat selected");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [lyrics, setLyrics] = useState("");
  const [docs, setDocs] = useState<GoogleDoc[]>([]);
  const [currentDocId, setCurrentDocId] = useState("");
  const [docsStatus, setDocsStatus] = useState("");
  const [playMode, setPlayMode] = useState<"full" | "loop">("full");
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(10);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [decodedAudioBuffer, setDecodedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [saved, setSaved] = useState("Saved");
  const [zoom, setZoom] = useState(45);
  const [bpm, setBpm] = useState<number | null>(null);
  const [bpmStatus, setBpmStatus] = useState("No BPM");
  const [quote, setQuote] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [lyricsFont, setLyricsFont] = useState<LyricsFont>("system");
  const [lyricsFontSize, setLyricsFontSize] = useState(28);
  const [gridDivision, setGridDivision] = useState<GridDivision>("1/4");

  const [rhymeWord, setRhymeWord] = useState("");
  const [rhymes, setRhymes] = useState<string[]>([]);
  const [rhymeLoading, setRhymeLoading] = useState(false);
  const [rhymeMenu, setRhymeMenu] = useState({ open: false, x: 0, y: 0 });

  const isDark = theme === "dark";

  const shellClass = isDark
    ? "min-h-screen bg-[#0b0b0f] text-white"
    : "min-h-screen bg-[#f5f5f7] text-[#1d1d1f]";

  const cardClass = isDark
    ? "rounded-[2rem] bg-[#15151a] p-8 shadow-sm ring-1 ring-white/10"
    : "rounded-[2rem] bg-white p-8 shadow-sm";

  const softClass = isDark ? "bg-white/10 text-zinc-300" : "bg-[#f5f5f7] text-zinc-500";

  const fieldClass = isDark
    ? "border-white/10 bg-[#101014] placeholder:text-zinc-600"
    : "border-zinc-200 bg-[#fbfbfd] placeholder:text-zinc-400";

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
    const storedTheme = localStorage.getItem("writer-theme");
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);

    setLyrics(localStorage.getItem("rap-loop-lyrics") || "");
    setProjectName(localStorage.getItem("rap-loop-project-name") || "Untitled Project");
    const storedLyricsFont = localStorage.getItem("writer-lyrics-font");
    const storedLyricsFontSize = Number(localStorage.getItem("writer-lyrics-font-size"));

    if (
      storedLyricsFont === "system" ||
      storedLyricsFont === "serif" ||
      storedLyricsFont === "mono"
    ) {
      setLyricsFont(storedLyricsFont);
    }

    if (Number.isFinite(storedLyricsFontSize)) {
      setLyricsFontSize(Math.min(40, Math.max(18, storedLyricsFontSize)));
    }

    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  useEffect(() => {
    localStorage.setItem("writer-lyrics-font", lyricsFont);
    localStorage.setItem("writer-lyrics-font-size", String(lyricsFontSize));
  }, [lyricsFont, lyricsFontSize]);

  useEffect(() => {
    setSaved("Saving...");
    const timer = setTimeout(() => {
      saveLocal();
    }, 300);
    return () => clearTimeout(timer);
  }, [lyrics, projectName]);

  useEffect(() => {
    if (!currentDocId) return;

    const signature = JSON.stringify({ documentId: currentDocId, title: projectName, text: lyrics });
    if (signature === lastSyncedRef.current) return;

    const timer = setTimeout(async () => {
      try {
        setDocsStatus("Syncing to Google Docs...");
        const res = await fetch("/api/docs/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: currentDocId, text: lyrics, title: projectName }),
        });

        const data = await res.json();

        if (!res.ok) {
          setDocsStatus(data?.error || "Google Docs sync failed");
          return;
        }

        lastSyncedRef.current = signature;
        setDocsStatus("Synced to Google Docs");
      } catch {
        setDocsStatus("Sync failed");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [lyrics, projectName, currentDocId]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    wsRef.current?.zoom(zoom);
  }, [zoom]);

  useEffect(() => {
    wsRef.current?.setVolume(recorder.muteBeat ? 0 : recorder.beatVolume);
  }, [recorder.beatVolume, recorder.muteBeat]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    gridDivisionRef.current = gridDivision;
  }, [gridDivision]);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    wsRef.current?.destroy();
    regionRef.current = null;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: isDark ? "#3f3f46" : "#d1d5db",
      progressColor: isDark ? "#ffffff" : "#111827",
      cursorColor: "#007aff",
      height: 120,
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      minPxPerSec: zoom,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    ws.setVolume(recorder.muteBeat ? 0 : recorder.beatVolume);
    ws.load(audioUrl);

    ws.on("decode", () => {
      const dur = ws.getDuration();
      setDuration(dur);
      setDecodedAudioBuffer(ws.getDecodedData());

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
      const activeBpm = bpmRef.current;
      const activeGridDivision = gridDivisionRef.current;

      if (activeBpm && typeof region.setOptions === "function") {
        const gridSeconds = 60 / activeBpm / gridDivisionStepsPerBeat[activeGridDivision];
        const snappedStart = snapTimeToBeatGrid(
          region.start,
          activeBpm,
          ws.getDuration(),
          activeGridDivision
        );
        const snappedEnd = Math.max(
          snappedStart + gridSeconds,
          snapTimeToBeatGrid(region.end, activeBpm, ws.getDuration(), activeGridDivision)
        );

        if (
          Math.abs(snappedStart - region.start) > 0.001 ||
          Math.abs(snappedEnd - region.end) > 0.001
        ) {
          region.setOptions({
            start: snappedStart,
            end: Math.min(snappedEnd, ws.getDuration()),
          });
        }
      }

      regionRef.current = region;
      setLoopStart(region.start);
      setLoopEnd(region.end);
    });

    ws.on("interaction", () => {
      setPlayMode("full");
      playModeRef.current = "full";
      lastPlaybackStartRef.current = ws.getCurrentTime();
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    ws.on("timeupdate", (time: number) => {
      setCurrentTime(time);
      const region = regionRef.current;

      if (region && playModeRef.current === "loop" && ws.isPlaying() && time >= region.end) {
        ws.setTime(region.start);
        ws.play();
      }
    });

    return () => ws.destroy();
  }, [audioUrl, isDark]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        active &&
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable);

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }

      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveLocal();
        setSaved("Saved");
        setDocsStatus(currentDocId ? "Saved locally · Google sync queued" : "Saved locally");
        return;
      }

      if (isTyping || commandOpen) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLoopMode();
        return;
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        restartPlayback();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setZoom((prev) => Math.min(250, prev + 10));
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setZoom((prev) => Math.max(20, prev - 10));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandOpen, currentDocId, lyrics, projectName]);

  function saveLocal() {
    localStorage.setItem("rap-loop-lyrics", lyrics);
    localStorage.setItem("rap-loop-project-name", projectName);
    setSaved("Saved");
  }

  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function togglePlayPause() {
    const ws = wsRef.current;
    if (!ws) return;

    if (ws.isPlaying()) {
      ws.pause();
      return;
    }

    if (playModeRef.current === "loop") {
      const region = regionRef.current;
      if (region) ws.setTime(region.start);
    } else {
      ws.setTime(lastPlaybackStartRef.current);
    }

    ws.play();
  }

  function toggleLoopMode() {
    const ws = wsRef.current;
    const region = regionRef.current;

    if (playModeRef.current === "loop") {
      setPlayMode("full");
      playModeRef.current = "full";
      return;
    }

    setPlayMode("loop");
    playModeRef.current = "loop";

    if (ws && region) {
      lastPlaybackStartRef.current = region.start;
      ws.setTime(region.start);
    }
  }

  function restartPlayback() {
    const ws = wsRef.current;
    if (!ws) return;

    if (playModeRef.current === "loop" && regionRef.current) {
      ws.setTime(regionRef.current.start);
    } else {
      ws.setTime(lastPlaybackStartRef.current);
    }

    ws.play();
  }

  async function startDemoRecording(mode: RecordMode) {
    const ws = wsRef.current;
    if (!ws) {
      alert("Choose a beat first.");
      return;
    }

    await recorder.ensureMicGraph();

    const region = regionRef.current;
    let startTime = 0;
    let recordLoopStart: number | undefined;
    let recordLoopEnd: number | undefined;

    if (mode === "full") {
      startTime = 0;
      setPlayMode("full");
      playModeRef.current = "full";
      lastPlaybackStartRef.current = 0;
      ws.setTime(0);
    }

    if (mode === "from-playhead") {
      startTime = ws.getCurrentTime();
      setPlayMode("full");
      playModeRef.current = "full";
      lastPlaybackStartRef.current = startTime;
      ws.setTime(startTime);
    }

    if (mode === "loop") {
      if (!region) {
        alert("No loop region found.");
        return;
      }

      startTime = region.start;
      recordLoopStart = region.start;
      recordLoopEnd = region.end;

      setPlayMode("loop");
      playModeRef.current = "loop";
      lastPlaybackStartRef.current = region.start;
      ws.setTime(region.start);
    }

    ws.setVolume(recorder.muteBeat ? 0 : recorder.beatVolume);
    ws.play();

    await recorder.startRecording({
      mode,
      startTime,
      loopStart: recordLoopStart,
      loopEnd: recordLoopEnd,
      latencyOffsetMs: 0,
    });
  }

  async function stopDemoRecording() {
    await recorder.stopRecording();
    wsRef.current?.pause();
  }

  function playTakeSynced(take: DemoTake) {
    const ws = wsRef.current;
    if (!ws) return;

    recorder.stopTakePlayback();

    if (take.mode === "loop" && typeof take.loopStart === "number") {
      setPlayMode("loop");
      playModeRef.current = "loop";
      ws.setTime(take.loopStart);
      ws.play();
      recorder.playTake(take, 0);
      return;
    }

    setPlayMode("full");
    playModeRef.current = "full";
    ws.setTime(take.startTime);
    ws.play();
    recorder.playTake(take, 0);
  }

  async function getRhymes(word = rhymeWord) {
    if (!word.trim()) return;

    setRhymeLoading(true);

    try {
      const res = await fetch("/api/ai/rhymes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, context: lyrics }),
      });

      const data = await res.json();
      setRhymes(data.rhymes || []);
    } catch {
      setRhymes(["Could not load rhymes"]);
    } finally {
      setRhymeLoading(false);
    }
  }

  function handleTextareaRightClick(e: React.MouseEvent<HTMLTextAreaElement>) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = lyrics.slice(start, end).trim();

    if (!selected) return;

    e.preventDefault();

    selectionRef.current = { start, end };
    setRhymeWord(selected);
    setRhymeMenu({ open: true, x: e.clientX, y: e.clientY });
    setRhymes([]);
    getRhymes(selected);
  }

  function insertRhyme(rhyme: string) {
    const { start, end } = selectionRef.current;
    const next = lyrics.slice(0, start) + rhyme + lyrics.slice(end);

    setLyrics(next);
    setRhymeMenu({ open: false, x: 0, y: 0 });

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + rhyme.length, start + rhyme.length);
    }, 0);
  }

  async function loadDocs() {
    setDocsStatus("Loading Google Docs...");
    const res = await fetch("/api/drive/list");
    const data = await res.json();
    if (!res.ok) return setDocsStatus(data?.error || "Could not load docs");
    setDocs(data || []);
    setDocsStatus(data?.length ? "Loaded" : "No docs found");
  }

  async function openDocInApp(documentId: string) {
    setDocsStatus("Opening doc...");

    const res = await fetch("/api/docs/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Could not open document");
      return setDocsStatus("Could not open document");
    }

    setCurrentDocId(documentId);
    setProjectName(data.title || "Untitled Project");
    setLyrics(data.text || "");
    lastSyncedRef.current = JSON.stringify({
      documentId,
      title: data.title || "Untitled Project",
      text: data.text || "",
    });

    setDocsStatus("Opened in app · Live sync connected");
  }

  async function createGoogleDoc() {
    setDocsStatus("Creating Google Doc...");

    const res = await fetch("/api/docs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: projectName, text: lyrics }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Could not create Google Doc");
      return setDocsStatus("Could not create Google Doc");
    }

    setCurrentDocId(data.documentId);
    lastSyncedRef.current = JSON.stringify({
      documentId: data.documentId,
      title: projectName,
      text: lyrics,
    });

    setDocsStatus("Google Doc created · Live sync connected");
    await loadDocs();
  }

  async function deleteGoogleDoc(fileId: string) {
    const ok = window.confirm("Move this Google Doc to trash?");
    if (!ok) return;

    setDocsStatus("Deleting Google Doc...");

    const res = await fetch("/api/drive/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Could not delete file");
      return setDocsStatus("Could not delete file");
    }

    if (currentDocId === fileId) {
      setCurrentDocId("");
      lastSyncedRef.current = "";
      setDocsStatus("Deleted linked doc · Project is local now");
    } else {
      setDocsStatus("Google Doc moved to trash");
    }

    setDocs((prev) => prev.filter((doc) => doc.id !== fileId));
    await loadDocs();
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

    lastPlaybackStartRef.current = 0;

    setAudioUrl(url);
    setFileName(file.name);
    setCurrentTime(0);
    setDuration(0);
    setDecodedAudioBuffer(null);
    setLoopStart(0);
    setLoopEnd(10);
    setPlayMode("full");
    setIsPlaying(false);

    detectBpm(file);
  }

  function playFull() {
    const ws = wsRef.current;
    if (!ws) return;

    setPlayMode("full");
    playModeRef.current = "full";
    lastPlaybackStartRef.current = ws.getCurrentTime();

    ws.play();
    setIsPlaying(true);
  }

  function playLoop() {
    const ws = wsRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;

    setPlayMode("loop");
    playModeRef.current = "loop";
    lastPlaybackStartRef.current = region.start;

    ws.setTime(region.start);
    ws.play();
    setIsPlaying(true);
  }

  function pause() {
    wsRef.current?.pause();
    setIsPlaying(false);
  }

  function stop() {
    const ws = wsRef.current;
    if (!ws) return;

    ws.pause();
    ws.setTime(0);
    recorder.stopTakePlayback();
    lastPlaybackStartRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
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
    const hasContent = lyrics.trim() !== "" || projectName.trim() !== "Untitled Project";

    if (hasContent) {
      const shouldDownload = window.confirm("Download current project before starting a new one?");
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
    setCurrentDocId("");
    lastPlaybackStartRef.current = 0;
    lastSyncedRef.current = "";

    wsRef.current?.destroy();
    regionRef.current = null;

    localStorage.removeItem("rap-loop-lyrics");
    localStorage.removeItem("rap-loop-project-name");

    setDocsStatus("New local project");
  }

  const commandItems = [
    { label: "Play / Pause", shortcut: "Space", action: togglePlayPause },
    { label: "Toggle Loop", shortcut: "L", action: toggleLoopMode },
    { label: "Restart From Start Point", shortcut: "R", action: restartPlayback },
    { label: "Save Local", shortcut: "⌘S", action: saveLocal },
    { label: "Focus Lyrics", shortcut: "Enter", action: () => textareaRef.current?.focus() },
    { label: "Download .txt", shortcut: "", action: downloadTxt },
  ];

  function toggleRecorderDrawer() {
    const nextOpen = !recorderOpen;
    setRecorderOpen(nextOpen);

    if (nextOpen) {
      window.setTimeout(() => {
        recorderDrawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }

  function toggleDocsDrawer() {
    const nextOpen = !docsOpen;
    setDocsOpen(nextOpen);

    if (nextOpen) {
      void loadDocs();
      window.setTimeout(() => {
        docsDrawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }

  const trackProgress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const loopLength = Math.max(0, loopEnd - loopStart);
  const loopElapsed = Math.min(Math.max(currentTime - loopStart, 0), loopLength);
  const monitorStart = playMode === "loop" ? loopStart : 0;
  const monitorEnd = playMode === "loop" ? loopEnd : duration;
  const monitorElapsed =
    playMode === "loop" ? loopElapsed : Math.min(Math.max(currentTime, 0), duration);
  const monitorLength = Math.max(0, monitorEnd - monitorStart);
  const monitorProgress =
    monitorLength > 0 ? Math.min(100, Math.max(0, (monitorElapsed / monitorLength) * 100)) : trackProgress;
  const monitorBars = useMemo(
    () => buildWaveformBars(decodedAudioBuffer, monitorStart, monitorEnd, 72),
    [decodedAudioBuffer, monitorEnd, monitorStart]
  );
  const waveformTimelineWidth = duration > 0 ? Math.max(900, duration * zoom) : 900;
  const beatGridLines = useMemo<BeatGridLine[]>(() => {
    if (!bpm || bpm <= 0 || duration <= 0) return [];

    const beatSeconds = 60 / bpm;
    const stepsPerBeat = gridDivisionStepsPerBeat[gridDivision];
    const gridSeconds = beatSeconds / stepsPerBeat;
    const totalSteps = Math.floor(duration / gridSeconds);

    const labelEveryBeats = Math.max(1, Math.ceil(MIN_GRID_LABEL_GAP_PX / zoom));

    return Array.from({ length: totalSteps + 1 }, (_, stepIndex) => {
      const time = stepIndex * gridSeconds;
      const beatIndex = Math.floor(stepIndex / stepsPerBeat);
      const barIndex = Math.floor(beatIndex / BEATS_PER_BAR);
      const beatInBar = beatIndex % BEATS_PER_BAR;
      const isBeat = stepIndex % stepsPerBeat === 0;
      const isBar = isBeat && beatInBar === 0;
      const showLabel = isBar || (isBeat && beatIndex % labelEveryBeats === 0);

      return {
        time,
        left: time * zoom,
        isBar,
        isBeat,
        label: showLabel ? (isBar ? `${barIndex + 1}` : `${barIndex + 1}.${beatInBar + 1}`) : "",
      };
    });
  }, [bpm, duration, gridDivision, zoom]);

  return (
    <main className={shellClass} onClick={() => setRhymeMenu({ open: false, x: 0, y: 0 })}>
      {commandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-28 backdrop-blur-sm"
          onClick={() => setCommandOpen(false)}
        >
          <div
            className={`w-full max-w-xl rounded-[2rem] p-4 shadow-2xl ring-1 ${
              isDark ? "bg-[#15151a] ring-white/10" : "bg-white ring-black/5"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Command Palette
              </p>
              <p className="mt-1 text-2xl font-semibold">Writer controls</p>
            </div>

            <div className="mt-2 grid gap-2">
              {commandItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.action();
                    setCommandOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left font-semibold transition ${
                    isDark ? "hover:bg-white/10" : "hover:bg-[#f5f5f7]"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className={`rounded-full px-3 py-1 text-xs ${softClass}`}>
                      {item.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rhymeMenu.open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed z-50 w-72 rounded-3xl p-4 shadow-2xl ring-1 ${
            isDark ? "bg-[#15151a] ring-white/10" : "bg-white ring-black/5"
          }`}
          style={{ left: rhymeMenu.x, top: rhymeMenu.y }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Rhymes for
          </p>
          <p className="mb-3 text-xl font-semibold">{rhymeWord}</p>

          {rhymeLoading ? (
            <p className="text-sm text-zinc-500">Thinking...</p>
          ) : (
            <div className="grid gap-2">
              {rhymes.map((rhyme, index) => (
                <button
                  key={`${rhyme}-${index}`}
                  onClick={() => insertRhyme(rhyme)}
                  className={`rounded-2xl px-4 py-2 text-left text-sm font-semibold ${
                    isDark ? "bg-white/10 hover:bg-white/15" : "bg-[#f5f5f7] hover:bg-zinc-200"
                  }`}
                >
                  {rhyme}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => getRhymes()}
            className="mt-3 w-full rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white"
          >
            More 10
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <header
          className={`sticky top-3 z-40 mb-5 flex flex-col gap-4 rounded-3xl px-4 py-3 shadow-sm ring-1 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between ${
            isDark ? "bg-[#0b0b0f]/85 ring-white/10" : "bg-[#f5f5f7]/85 ring-black/5"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Writer
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="max-w-[22rem] truncate text-xl font-semibold tracking-tight">
                {projectName}
              </h1>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${softClass}`}>
                {saved}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              onClick={toggleRecorderDrawer}
              aria-expanded={recorderOpen}
              className={`rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 ${
                recorderOpen
                  ? "bg-[#007aff] text-white shadow-[#007aff]/20"
                  : isDark
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-white text-[#1d1d1f] hover:bg-zinc-50"
              }`}
            >
              {recorderOpen ? "Hide Recorder" : "Recorder"}
            </button>

            {session && (
              <>
                <button
                  onClick={toggleDocsDrawer}
                  aria-expanded={docsOpen}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    docsOpen
                      ? "bg-[#007aff] text-white shadow-sm shadow-[#007aff]/20"
                      : isDark
                        ? "bg-white/10 hover:bg-white/15"
                        : "bg-white hover:bg-zinc-50"
                  }`}
                >
                  {docsOpen ? "Hide Docs" : "Docs"}
                </button>

                <button
                  onClick={createGoogleDoc}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    isDark ? "bg-white/10 hover:bg-white/15" : "bg-white hover:bg-zinc-50"
                  }`}
                >
                  Link Doc
                </button>
              </>
            )}

            <Link
              href="/settings"
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isDark ? "bg-white/10 hover:bg-white/15" : "bg-white hover:bg-zinc-50"
              }`}
            >
              Settings
            </Link>

            <button
              onClick={() => setCommandOpen(true)}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isDark ? "bg-white/10 hover:bg-white/15" : "bg-white hover:bg-zinc-50"
              }`}
            >
              ⌘K
            </button>

            <button
              onClick={newProject}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isDark ? "bg-white/10 hover:bg-white/15" : "bg-white hover:bg-zinc-50"
              }`}
            >
              New
            </button>

            {session ? (
              <button
                onClick={() => signOut()}
                className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="rounded-full bg-[#007aff] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {session && (
          <div
            ref={docsDrawerRef}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              docsOpen ? "mb-4 grid-rows-[1fr] opacity-100" : "mb-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <section
                className={`rounded-3xl px-4 py-3 ring-1 transition duration-300 ease-out ${
                  docsOpen ? "translate-y-0 scale-100" : "-translate-y-2 scale-[0.99]"
                } ${isDark ? "bg-white/5 ring-white/10" : "bg-white/70 ring-black/5"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{session.user?.email}</p>
                    <p className="text-xs text-zinc-500">
                      {currentDocId ? "Google Docs live sync active" : "Google connected"}
                      {docsStatus && ` · ${docsStatus}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#007aff]/10 px-3 py-1 text-xs font-semibold text-[#007aff]">
                    {currentDocId ? "Synced" : "Local"}
                  </span>
                </div>

                {docs.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 ${softClass}`}
                      >
                        <div className="min-w-0 truncate text-sm font-semibold">{doc.name}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openDocInApp(doc.id)}
                            className="rounded-full bg-[#007aff] px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Open in app
                          </button>
                          <a
                            href={doc.webViewLink}
                            target="_blank"
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              isDark ? "bg-white/10" : "bg-white"
                            }`}
                          >
                            Google Docs
                          </a>
                          <button
                            onClick={() => deleteGoogleDoc(doc.id)}
                            className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <section className={`mb-6 ${cardClass}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Creative prompt
          </p>
          <p className="text-3xl font-semibold tracking-tight">“{quote}”</p>
        </section>

        <div
          ref={recorderDrawerRef}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            recorderOpen ? "mb-6 grid-rows-[1fr] opacity-100" : "mb-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <section
              className={`rounded-3xl p-8 shadow-xl ring-1 transition duration-300 ease-out ${
                recorderOpen ? "translate-y-0 scale-100" : "-translate-y-3 scale-[0.99]"
              } ${
                isDark
                  ? "bg-[#15151a] ring-white/10 shadow-black/30"
                  : "bg-white ring-black/5 shadow-zinc-200/80"
              }`}
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-400">
                    Recorder
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">Vocal takes</h2>
                  <p className="mt-1 text-zinc-500">
                    Records microphone only. Beat stays separate and plays for monitoring.
                  </p>
                </div>

                <div className={`rounded-full px-5 py-3 text-sm font-semibold ${softClass}`}>
                  {recorder.isRecording
                    ? `Recording ${recorder.recordingMode}`
                    : recorder.micReady
                      ? "Mic ready"
                      : "Mic not armed"}
                </div>
              </div>

              {recorder.micError && (
                <div className="mb-5 rounded-2xl bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-500">
                  {recorder.micError}
                </div>
              )}

              <div className="mb-6 grid gap-3 lg:grid-cols-4">
                <button
                  onClick={() => startDemoRecording("full")}
                  disabled={recorder.isRecording}
                  className="rounded-full bg-red-500 px-6 py-4 font-semibold text-white disabled:opacity-40"
                >
                  ● Record Full
                </button>

                <button
                  onClick={() => startDemoRecording("from-playhead")}
                  disabled={recorder.isRecording}
                  className="rounded-full bg-[#1d1d1f] px-6 py-4 font-semibold text-white disabled:opacity-40"
                >
                  Record From Here
                </button>

                <button
                  onClick={() => startDemoRecording("loop")}
                  disabled={recorder.isRecording}
                  className="rounded-full bg-[#007aff] px-6 py-4 font-semibold text-white disabled:opacity-40"
                >
                  Record Loop
                </button>

                <button
                  onClick={stopDemoRecording}
                  disabled={!recorder.isRecording}
                  className={`rounded-full px-6 py-4 font-semibold disabled:opacity-40 ${softClass}`}
                >
                  Stop
                </button>
              </div>

              <div className={`mb-8 rounded-[1.5rem] p-5 ${softClass}`}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Mic input meter</span>
                  <span>{Math.round(recorder.inputLevel * 100)}%</span>
                </div>
                <div className={isDark ? "h-3 rounded-full bg-black/30" : "h-3 rounded-full bg-white"}>
                  <div
                    className="h-3 rounded-full bg-[#007aff] transition-all"
                    style={{ width: `${Math.min(100, recorder.inputLevel * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mb-8 grid gap-4 lg:grid-cols-3">
                <MixerSlider
                  label="Beat volume"
                  value={recorder.beatVolume}
                  onChange={recorder.setBeatVolume}
                />
                <MixerSlider
                  label="Mic monitor volume"
                  value={recorder.micMonitorVolume}
                  onChange={recorder.setMicMonitorVolume}
                />
                <MixerSlider
                  label="Mic input gain"
                  value={recorder.micInputGain}
                  min={0}
                  max={2}
                  step={0.01}
                  onChange={recorder.setMicInputGain}
                />
                <MixerSlider
                  label="Vocal take volume"
                  value={recorder.vocalVolume}
                  onChange={recorder.setVocalVolume}
                />

                <button
                  onClick={() => recorder.setMuteBeat((prev) => !prev)}
                  className={`rounded-[1.5rem] px-5 py-4 text-left font-semibold ${softClass}`}
                >
                  {recorder.muteBeat ? "Unmute beat" : "Mute beat"}
                </button>

                <button
                  onClick={() => recorder.setMuteVocal((prev) => !prev)}
                  className={`rounded-[1.5rem] px-5 py-4 text-left font-semibold ${softClass}`}
                >
                  {recorder.muteVocal ? "Unmute vocal" : "Mute vocal"}
                </button>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-2xl font-semibold tracking-tight">Takes list</h3>
                  <span className="text-sm text-zinc-500">{recorder.takes.length} takes</span>
                </div>

                {recorder.takes.length === 0 ? (
                  <div className={`rounded-[1.5rem] px-6 py-8 text-center ${softClass}`}>
                    No vocal takes yet.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {recorder.takes.map((take) => (
                      <div
                        key={take.id}
                        className={`rounded-[1.5rem] p-5 ${isDark ? "bg-white/10" : "bg-[#f5f5f7]"}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{take.name}</p>
                            <p className="text-sm text-zinc-500">
                              {take.mode} · starts {formatTime(take.startTime)} · {take.duration.toFixed(1)}s
                              {take.mode === "loop" &&
                                typeof take.loopStart === "number" &&
                                typeof take.loopEnd === "number" &&
                                ` · loop ${take.loopStart.toFixed(2)}s → ${take.loopEnd.toFixed(2)}s`}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => playTakeSynced(take)}
                              className="rounded-full bg-[#007aff] px-4 py-2 text-sm font-semibold text-white"
                            >
                              {recorder.playingTakeId === take.id ? "Playing" : "Play take"}
                            </button>

                            <button
                              onClick={() => recorder.deleteTake(take.id)}
                              className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex justify-between text-xs text-zinc-500">
                            <span>Take volume</span>
                            <span>{Math.round(take.volume * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={take.volume}
                            onChange={(e) => recorder.updateTakeVolume(take.id, Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className={cardClass}>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            className="mb-8 w-full bg-transparent text-5xl font-semibold tracking-tight outline-none placeholder:text-zinc-400"
          />

          <div className={`mb-6 rounded-[1.5rem] border p-4 ${fieldClass}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  Beat Player
                </p>
                <p className="mt-1 max-w-4xl truncate text-sm text-zinc-500">
                  {fileName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`rounded-full px-4 py-2 text-xs font-bold ${
                    playMode === "loop"
                      ? "bg-[#007aff] text-white"
                      : isDark
                        ? "bg-white/10 text-zinc-300"
                        : "bg-[#f5f5f7] text-zinc-500"
                  }`}
                >
                  {playMode === "loop" ? "Loop active" : "Full playback"}
                </div>

                <div
                  className={`rounded-full px-4 py-2 text-xs font-bold ${
                    bpm
                      ? "bg-[#007aff]/10 text-[#007aff]"
                      : isDark
                        ? "bg-white/10 text-zinc-400"
                        : "bg-[#f5f5f7] text-zinc-500"
                  }`}
                >
                  {bpm ? `Grid ${gridDivision} snap` : "Grid waits for BPM"}
                </div>

                <div className={`flex rounded-full p-1 ${isDark ? "bg-white/10" : "bg-[#f5f5f7]"}`}>
                  {(["1/4", "1/8", "1/16"] as GridDivision[]).map((division) => (
                    <button
                      key={division}
                      onClick={() => setGridDivision(division)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        gridDivision === division
                          ? "bg-[#007aff] text-white"
                          : isDark
                            ? "text-zinc-300"
                            : "text-zinc-500"
                      }`}
                    >
                      {division}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Choose / Replace Beat
                </button>
              </div>

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

            <div className={`rounded-[1.25rem] border p-3 ${fieldClass}`}>
              <div className="overflow-x-auto">
                <div
                  className="relative min-h-[156px]"
                  style={{ width: `${waveformTimelineWidth}px` }}
                >
                  <div className="pointer-events-none absolute inset-0 z-0">
                    <div
                      className={`absolute inset-x-0 top-0 h-7 border-b ${
                        isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-100/60"
                      }`}
                    />

                    {beatGridLines.length === 0 && (
                      <div className="absolute left-4 top-1 text-xs font-semibold text-zinc-400">
                        BPM grid appears after detection
                      </div>
                    )}

                    {beatGridLines.map((line) => (
                      <div
                        key={`${line.time}-${line.label}`}
                        className={`absolute bottom-0 top-0 ${
                          line.isBar
                            ? isDark
                              ? "border-l border-white/25"
                              : "border-l border-zinc-500/45"
                            : line.isBeat
                              ? isDark
                                ? "border-l border-white/15"
                                : "border-l border-zinc-400/45"
                            : isDark
                              ? "border-l border-white/5"
                              : "border-l border-zinc-300/45"
                        }`}
                        style={{ left: `${line.left}px` }}
                      >
                        {line.label && (
                          <div
                            className={`absolute left-1 top-1 whitespace-nowrap rounded px-1 text-[10px] font-semibold ${
                              line.isBar
                                ? isDark
                                  ? "bg-[#101014] text-zinc-300"
                                  : "bg-white/80 text-zinc-600"
                                : "text-zinc-400"
                            }`}
                          >
                            {line.label}
                            {line.isBar && (
                              <span className="ml-1 font-mono font-normal">
                                {formatTime(line.time)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div ref={waveformRef} className="relative z-10 min-h-[128px] pt-7" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[auto_auto_auto_auto_1fr_auto_auto] lg:items-center">
              <button
                onClick={playFull}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  playMode === "full" ? "bg-[#1d1d1f] text-white" : softClass
                }`}
              >
                ▶ Full
              </button>
              <button
                onClick={playLoop}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  playMode === "loop" ? "bg-[#007aff] text-white" : softClass
                }`}
              >
                ↻ Loop
              </button>
              <button onClick={pause} className={`rounded-full px-5 py-3 text-sm font-semibold ${softClass}`}>
                Pause
              </button>
              <button onClick={stop} className={`rounded-full px-5 py-3 text-sm font-semibold ${softClass}`}>
                Stop
              </button>

              <div className={`rounded-full px-5 py-3 text-center font-mono text-sm ${softClass}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div
                className={`rounded-full px-5 py-3 text-sm font-semibold ${
                  playMode === "loop"
                    ? "bg-[#007aff]/10 text-[#007aff]"
                    : softClass
                }`}
              >
                Loop region · {loopStart.toFixed(2)}s → {loopEnd.toFixed(2)}s
              </div>

              <div className={`rounded-full px-5 py-3 text-sm ${softClass}`}>
                BPM <span className="font-semibold">{bpm || "--"}</span>
                <span className="ml-2 text-xs">{bpmStatus}</span>
              </div>
            </div>

            <div className={`mt-4 rounded-[1.25rem] px-5 py-3 ${softClass}`}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span>Waveform zoom</span>
                <span>{zoom}</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[#007aff] outline-none focus:outline-none focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Lyrics</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Right click selected word for AI rhymes.
                {currentDocId && " Live sync to Google Docs."}
              </p>
            </div>

            <button
              onClick={downloadTxt}
              className="rounded-full bg-[#007aff] px-6 py-3 font-semibold text-white"
            >
              Download .txt
            </button>
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(300px,0.9fr)_minmax(420px,1.1fr)]">
            <div className={`rounded-[1.5rem] px-4 py-3 ${softClass}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Now playing
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {isPlaying ? "Playing" : "Paused"} · {playMode === "loop" ? "Loop" : "Full"}
                  </p>
                </div>
                <div className="rounded-full bg-[#007aff]/10 px-4 py-2 text-sm font-semibold text-[#007aff]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div
                className={`relative flex h-16 items-center gap-[3px] overflow-hidden rounded-[1rem] px-3 ${
                  isDark ? "bg-black/20" : "bg-white"
                }`}
              >
                {monitorBars.length > 0 ? (
                  monitorBars.map((bar, index) => {
                    const barProgress = (index / Math.max(1, monitorBars.length - 1)) * 100;
                    const isPast = barProgress <= monitorProgress;

                    return (
                      <div
                        key={`${index}-${bar.toFixed(3)}`}
                        className={`flex-1 rounded-full transition-colors ${
                          isPast ? "bg-[#007aff]" : isDark ? "bg-white/20" : "bg-zinc-300"
                        }`}
                        style={{ height: `${Math.max(12, bar * 54)}px` }}
                      />
                    );
                  })
                ) : (
                  <div className="w-full text-center text-xs font-semibold text-zinc-400">
                    Choose a beat to see waveform
                  </div>
                )}

                {monitorBars.length > 0 && (
                  <div
                    className={`absolute bottom-2 top-2 w-0.5 rounded-full shadow-sm transition-[left] duration-100 ${
                      isDark ? "bg-white" : "bg-[#1d1d1f]"
                    }`}
                    style={{ left: `calc(${monitorProgress}% - 1px)` }}
                  />
                )}
              </div>

              <div className="mt-3 grid gap-2 text-xs font-semibold text-zinc-500 sm:grid-cols-2">
                <div className={`rounded-full px-3 py-2 ${isDark ? "bg-[#15151a]" : "bg-white"}`}>
                  {playMode === "loop" ? "Showing loop" : "Showing full track"} · {formatTime(monitorElapsed)}
                </div>
                <div
                  className={`rounded-full px-3 py-2 ${
                    playMode === "loop"
                      ? "bg-[#007aff]/10 text-[#007aff]"
                      : isDark
                        ? "bg-[#15151a]"
                        : "bg-white"
                  }`}
                >
                  Loop · {loopStart.toFixed(2)}s → {loopEnd.toFixed(2)}s · {formatTime(loopElapsed)}
                </div>
              </div>
            </div>

            <div className={`flex flex-wrap items-center gap-3 rounded-[1.5rem] px-4 py-3 ${softClass}`}>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-zinc-500">Font</span>
                <select
                  value={lyricsFont}
                  onChange={(e) => setLyricsFont(e.target.value as LyricsFont)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold outline-none ${
                    isDark ? "bg-[#15151a] text-white" : "bg-white text-[#1d1d1f]"
                  }`}
                >
                  <option value="system">System</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Mono</option>
                </select>
              </label>

              <button
                onClick={() => setLyricsFontSize((prev) => Math.max(18, prev - 1))}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  isDark ? "bg-[#15151a]" : "bg-white"
                }`}
              >
                A-
              </button>

              <div className="flex min-w-48 flex-1 items-center gap-3">
                <span className="text-sm font-semibold text-zinc-500">Size</span>
                <input
                  type="range"
                  min="18"
                  max="40"
                  value={lyricsFontSize}
                  onChange={(e) => setLyricsFontSize(Number(e.target.value))}
                  className="w-full"
                />
                <span className="w-12 text-right text-sm font-semibold text-zinc-500">
                  {lyricsFontSize}px
                </span>
              </div>

              <button
                onClick={() => setLyricsFontSize((prev) => Math.min(40, prev + 1))}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  isDark ? "bg-[#15151a]" : "bg-white"
                }`}
              >
                A+
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            onContextMenu={handleTextareaRightClick}
            placeholder="Write your verse..."
            className={`h-[560px] w-full resize-none rounded-[1.5rem] border p-6 outline-none ${fieldClass}`}
            style={{
              fontFamily: lyricsFontFamilies[lyricsFont],
              fontSize: `${lyricsFontSize}px`,
              lineHeight: 1.55,
            }}
          />
        </section>
      </div>

    </main>
  );
}

function MixerSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-[1.5rem] bg-black/5 px-5 py-4 dark:bg-white/10">
      <div className="mb-2 flex justify-between text-sm text-zinc-500">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
