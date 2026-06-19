"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordMode = "full" | "from-playhead" | "loop";

export type DemoTake = {
  id: string;
  name: string;
  blobUrl: string;
  startTime: number;
  duration: number;
  mode: RecordMode;
  loopStart?: number;
  loopEnd?: number;
  latencyOffsetMs: number;
  volume: number;
};

type StartRecordingOptions = {
  mode: RecordMode;
  startTime: number;
  loopStart?: number;
  loopEnd?: number;
  latencyOffsetMs?: number;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function useDemoRecorder() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const recordingOptionsRef = useRef<StartRecordingOptions | null>(null);
  const stopResolveRef = useRef<((take: DemoTake | null) => void) | null>(null);

  const inputGainNodeRef = useRef<GainNode | null>(null);
  const monitorGainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const levelAnimationRef = useRef<number | null>(null);

  const playingAudioRef = useRef<HTMLAudioElement | null>(null);

  const [takes, setTakes] = useState<DemoTake[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordMode | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState("");
  const [inputLevel, setInputLevel] = useState(0);

  const [beatVolume, setBeatVolume] = useState(1);
  const [micMonitorVolume, setMicMonitorVolume] = useState(0);
  const [micInputGain, setMicInputGain] = useState(1);
  const [vocalVolume, setVocalVolume] = useState(1);
  const [muteBeat, setMuteBeat] = useState(false);
  const [muteVocal, setMuteVocal] = useState(false);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    analyser.fftSize = 1024;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / data.length);
      setInputLevel(Math.min(1, rms * 3.5));

      levelAnimationRef.current = requestAnimationFrame(tick);
    };

    if (levelAnimationRef.current) cancelAnimationFrame(levelAnimationRef.current);
    levelAnimationRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureMicGraph = useCallback(async () => {
    if (audioContextRef.current && micStreamRef.current && recordDestinationRef.current) {
      return;
    }

    try {
      setMicError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      const inputGain = audioContext.createGain();
      const monitorGain = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      const recordDestination = audioContext.createMediaStreamDestination();

      inputGain.gain.value = micInputGain;
      monitorGain.gain.value = micMonitorVolume;

      source.connect(inputGain);

      inputGain.connect(recordDestination);
      inputGain.connect(analyser);

      inputGain.connect(monitorGain);
      monitorGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      micStreamRef.current = stream;
      inputGainNodeRef.current = inputGain;
      monitorGainNodeRef.current = monitorGain;
      analyserRef.current = analyser;
      recordDestinationRef.current = recordDestination;

      setMicReady(true);
      startMeter();
    } catch {
      setMicReady(false);
      setMicError("Microphone permission failed");
    }
  }, [micInputGain, micMonitorVolume, startMeter]);

  useEffect(() => {
    if (inputGainNodeRef.current) {
      inputGainNodeRef.current.gain.value = micInputGain;
    }
  }, [micInputGain]);

  useEffect(() => {
    if (monitorGainNodeRef.current) {
      monitorGainNodeRef.current.gain.value = micMonitorVolume;
    }
  }, [micMonitorVolume]);

  useEffect(() => {
    if (playingAudioRef.current) {
      playingAudioRef.current.volume = muteVocal ? 0 : vocalVolume;
    }
  }, [muteVocal, vocalVolume]);

  async function startRecording(options: StartRecordingOptions) {
    if (isRecording) return;

    await ensureMicGraph();

    const destination = recordDestinationRef.current;
    const audioContext = audioContextRef.current;

    if (!destination || !audioContext) return;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    chunksRef.current = [];
    recordingOptionsRef.current = options;
    startedAtRef.current = performance.now();

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(
      destination.stream,
      mimeType ? { mimeType } : undefined
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const meta = recordingOptionsRef.current;
      if (!meta) {
        stopResolveRef.current?.(null);
        stopResolveRef.current = null;
        return;
      }

      const duration = Math.max(0, (performance.now() - startedAtRef.current) / 1000);
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });

      const blobUrl = URL.createObjectURL(blob);
      const index = takes.length + 1;

      const take: DemoTake = {
        id: createId(),
        name: `Take ${index}`,
        blobUrl,
        startTime: meta.startTime,
        duration,
        mode: meta.mode,
        loopStart: meta.loopStart,
        loopEnd: meta.loopEnd,
        latencyOffsetMs: meta.latencyOffsetMs ?? 0,
        volume: 1,
      };

      setTakes((prev) => [...prev, take]);
      setIsRecording(false);
      setRecordingMode(null);

      stopResolveRef.current?.(take);
      stopResolveRef.current = null;
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);

    setIsRecording(true);
    setRecordingMode(options.mode);
  }

  function stopRecording() {
    return new Promise<DemoTake | null>((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }

  function playTake(take: DemoTake, offsetSeconds = 0) {
    stopTakePlayback();

    const audio = new Audio(take.blobUrl);
    audio.volume = muteVocal ? 0 : vocalVolume * take.volume;
    audio.currentTime = Math.max(0, offsetSeconds);

    audio.onended = () => {
      setPlayingTakeId(null);
      playingAudioRef.current = null;
    };

    playingAudioRef.current = audio;
    setPlayingTakeId(take.id);

    void audio.play();
  }

  function stopTakePlayback() {
    const audio = playingAudioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    playingAudioRef.current = null;
    setPlayingTakeId(null);
  }

  function deleteTake(id: string) {
    setTakes((prev) => {
      const target = prev.find((take) => take.id === id);
      if (target) URL.revokeObjectURL(target.blobUrl);
      return prev.filter((take) => take.id !== id);
    });

    if (playingTakeId === id) {
      stopTakePlayback();
    }
  }

  function updateTakeVolume(id: string, volume: number) {
    setTakes((prev) =>
      prev.map((take) =>
        take.id === id ? { ...take, volume } : take
      )
    );

    const playing = playingAudioRef.current;
    if (playing && playingTakeId === id) {
      playing.volume = muteVocal ? 0 : volume * vocalVolume;
    }
  }

  useEffect(() => {
    return () => {
      if (levelAnimationRef.current) cancelAnimationFrame(levelAnimationRef.current);

      mediaRecorderRef.current?.stop();
      playingAudioRef.current?.pause();

      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();

      takes.forEach((take) => URL.revokeObjectURL(take.blobUrl));
    };
  }, [takes]);

  return {
    takes,
    isRecording,
    recordingMode,
    micReady,
    micError,
    inputLevel,

    beatVolume,
    setBeatVolume,
    micMonitorVolume,
    setMicMonitorVolume,
    micInputGain,
    setMicInputGain,
    vocalVolume,
    setVocalVolume,
    muteBeat,
    setMuteBeat,
    muteVocal,
    setMuteVocal,

    playingTakeId,

    startRecording,
    stopRecording,
    playTake,
    stopTakePlayback,
    deleteTake,
    updateTakeVolume,
    ensureMicGraph,
  };
}