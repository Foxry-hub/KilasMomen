"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KioskDevice } from "./types";

interface UseCameraOptions {
  /** Sumber kamera yang dipilih operator ("REAL_CAMERA" | "DROIDCAM_USB") (§6.3). */
  source?: string | null;
  /** Label perangkat yang disarankan operator (§6.3). */
  deviceLabel?: string | null;
  /** "FULL_HD" | "4K" — menentukan resolusi ideal. */
  maxResolution?: string;
  enabled?: boolean;
}

interface UseCameraResult {
  /** Callback ref: aman dipakai elemen `<video>` yang baru dipasang (mis. overlay retake). */
  videoRef: (el: HTMLVideoElement | null) => void;
  devices: KioskDevice[];
  selectedDeviceId: string;
  selectDevice: (deviceId: string) => void;
  active: boolean;
  error: string | null;
  resolution: { width: number; height: number };
  /** Mirror capture → JPEG Blob (kualitas 0,92). */
  capture: () => Promise<Blob | null>;
  restart: () => void;
}

const FULL_HD = { width: { ideal: 1920 }, height: { ideal: 1080 } };
const UHD = { width: { ideal: 3840 }, height: { ideal: 2160 } };

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { source, deviceLabel, maxResolution = "FULL_HD", enabled = true } = options;

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const userChoiceRef = useRef<string | null>(null);
  const lastDeviceLabelRef = useRef<string | null>(null);
  const lastSourceRef = useRef<string | null>(null);

  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });

  /** Pasang stream ke elemen video (dipanggil setiap elemen `<video>` ter-mount). */
  const attach = useCallback((el: HTMLVideoElement) => {
    const stream = streamRef.current;
    if (!stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;

    const onReady = () => {
      el.play().catch(() => undefined);
      setResolution({ width: el.videoWidth, height: el.videoHeight });
      setActive(true);
      setError(null);
    };
    if (el.readyState >= 1 && el.videoWidth > 0) onReady();
    else el.onloadedmetadata = onReady;
  }, []);

  const videoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoElRef.current = el;
      if (el) attach(el);
    },
    [attach]
  );

  const enumerate = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setError("Browser tidak mendukung deteksi kamera.");
        return;
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = all
        .filter((d) => d.kind === "videoinput")
        .map<KioskDevice>((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Kamera ${i + 1}`,
          kind: d.kind,
        }));
      setDevices(videoDevs);

      if (videoDevs.length === 0) {
        setError("Tidak ada kamera terdeteksi.");
        setActive(false);
        return;
      }
      setError(null);

      setSelectedDeviceId((current) => {
        // Pilihan manual user selalu menang.
        if (userChoiceRef.current && videoDevs.some((d) => d.deviceId === userChoiceRef.current)) {
          return userChoiceRef.current;
        }

        // Bila ada perubahan setting dari operator, paksa pindah ke preferred device (§6.3).
        const settingChanged = 
          (deviceLabel !== lastDeviceLabelRef.current) || 
          (source !== lastSourceRef.current);
        
        lastDeviceLabelRef.current = deviceLabel ?? null;
        lastSourceRef.current = source ?? null;

        if (!settingChanged && current && videoDevs.some((d) => d.deviceId === current)) {
          return current;
        }

        // Prioritas pemilihan:
        // 1. Label spesifik yang dipilih operator.
        // 2. DroidCam bila source=DROIDCAM_USB (fallback ke droid label).
        // 3. Built-in/Webcam bila source=REAL_CAMERA (hindari droid label).
        const byLabel = deviceLabel ? videoDevs.find((d) => d.label === deviceLabel) : null;
        if (byLabel) return byLabel.deviceId;

        if (source === "DROIDCAM_USB") {
          const droid = videoDevs.find((d) => /droid/i.test(d.label));
          if (droid) return droid.deviceId;
        }

        if (source === "REAL_CAMERA") {
          const nonDroid = videoDevs.find((d) => !/droid/i.test(d.label));
          if (nonDroid) return nonDroid.deviceId;
        }

        return videoDevs[0].deviceId;
      });
    } catch {
      setError("Gagal mendeteksi perangkat kamera. Pastikan izin kamera aktif.");
    }
  }, [deviceLabel, source]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const existing = videoElRef.current;
      if (existing) {
        existing.pause();
        existing.srcObject = null;
      }

      const resolutionConstraint = maxResolution === "4K" ? UHD : FULL_HD;

      try {
        setError(null);
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId
              ? { deviceId: { exact: deviceId }, ...resolutionConstraint }
              : resolutionConstraint,
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { ideal: deviceId } } : true,
            audio: false,
          });
        }

        streamRef.current = stream;
        setActive(true);
        setError(null);

        const el = videoElRef.current;
        if (el) attach(el);

        const track = stream.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            setActive(false);
            setError("Koneksi kamera terputus. Periksa kabel USB atau aplikasi kamera.");
          };
        }
      } catch {
        setActive(false);
        setError("Kamera tidak dapat diakses. Periksa perangkat kamera lalu coba lagi.");
      }
    },
    [maxResolution, attach]
  );

  // Izin awal → enumerasi (label baru terisi setelah izin diberikan).
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    (async () => {
      try {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        temp.getTracks().forEach((t) => t.stop());
      } catch {
        /* diabaikan */
      }
      if (mounted) enumerate();
    })();

    const onChange = () => {
      if (mounted) enumerate();
    };
    navigator.mediaDevices?.addEventListener("devicechange", onChange);

    return () => {
      mounted = false;
      navigator.mediaDevices?.removeEventListener("devicechange", onChange);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, enumerate]);

  useEffect(() => {
    if (!enabled) return;
    if (selectedDeviceId) startCamera(selectedDeviceId);
  }, [selectedDeviceId, enabled, startCamera]);

  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoElRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror agar sesuai viewfinder.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    userChoiceRef.current = deviceId;
    setSelectedDeviceId(deviceId);
  }, []);

  const restart = useCallback(() => {
    enumerate();
    if (selectedDeviceId) startCamera(selectedDeviceId);
  }, [enumerate, selectedDeviceId, startCamera]);

  return {
    videoRef,
    devices,
    selectedDeviceId,
    selectDevice,
    active,
    error,
    resolution,
    capture,
    restart,
  };
}
