"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";

/* ================================================================
   SYNTHETIC AUDIO SOUNDS (Web Audio API - Offline-safe)
   ================================================================ */
function playTone(freq: number, duration: number, type: OscillatorType = "sine") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio context may require user gesture on first interaction
  }
}

function playShutterSound() {
  playTone(1200, 0.08, "square");
  setTimeout(() => playTone(600, 0.12, "sine"), 60);
}

function playCountdownBeep(isFinal = false) {
  playTone(isFinal ? 1200 : 750, isFinal ? 0.3 : 0.15, "triangle");
}

/* ================================================================
   CAPTURE CONTENT COMPONENT
   ================================================================ */
function CaptureContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const sessionId = (params?.sessionId as string) || "";
  const frameSlug = searchParams.get("frame") || "classic-duo";

  // Camera devices
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraResolution, setCameraResolution] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Photo session states (5 shots)
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isShooting, setIsShooting] = useState<boolean>(false);
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(0); // 0 to 4
  const [countdown, setCountdown] = useState<number | null>(null); // 3, 2, 1
  const [showFlash, setShowFlash] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // User manual selection tracker (persists across devicechange events)
  const userSelectedDeviceRef = useRef<string | null>(null);

  /* ---- Enumerate Camera Devices ---- */
  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setCameraError("Browser tidak mendukung deteksi kamera.");
        return;
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevs);

      if (videoDevs.length === 0) {
        setCameraError("Tidak ada kamera terdeteksi di laptop ini.");
        setIsCameraActive(false);
        return;
      }

      setCameraError(null);

      // Preserve user choice if already set and device still exists
      setSelectedDeviceId((current) => {
        if (
          userSelectedDeviceRef.current &&
          videoDevs.some((d) => d.deviceId === userSelectedDeviceRef.current)
        ) {
          return userSelectedDeviceRef.current;
        }
        if (current && videoDevs.some((d) => d.deviceId === current)) {
          return current;
        }
        // Auto-select DroidCam only on first load
        const droidCam = videoDevs.find(
          (d) =>
            d.label.toLowerCase().includes("droidcam") ||
            d.label.toLowerCase().includes("droid")
        );
        return droidCam ? droidCam.deviceId : videoDevs[0].deviceId;
      });
    } catch (err) {
      console.error(err);
      setCameraError("Gagal mendeteksi perangkat kamera. Pastikan izin kamera aktif.");
    }
  }, []);

  /* ---- Start Camera Stream ---- */
  const startCamera = useCallback(async (deviceId?: string) => {
    // 1. Fully release previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    try {
      setCameraError(null);

      // Strategy 1: Target exact deviceId with ideal resolution
      let stream: MediaStream | null = null;
      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn("Exact constraint failed, trying basic deviceId:", err1);
        try {
          // Strategy 2: Simple deviceId without exact
          const fallbackConstraints: MediaStreamConstraints = {
            video: deviceId ? { deviceId: { ideal: deviceId } } : true,
            audio: false,
          };
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (err2) {
          console.warn("Fallback failed, trying generic video: true:", err2);
          // Strategy 3: Any camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (!stream) {
        throw new Error("Gagal memulai stream video");
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
            setCameraResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
            setIsCameraActive(true);
          }
        };
      }

      // Handle stream disconnect / cable unplugged
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setIsCameraActive(false);
          setCameraError("Koneksi kamera terputus. Silakan periksa kabel USB atau aplikasi DroidCam.");
        };
      }
    } catch (err) {
      console.error("Camera start error:", err);
      setIsCameraActive(false);
      setCameraError(
        "Kamera tidak dapat diakses. Pastikan aplikasi DroidCam Client di Windows sudah di-Start atau pilih kamera lain."
      );
    }
  }, []);

  // Request initial camera permission once on mount, then enumerate
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tempStream.getTracks().forEach((t) => t.stop());
      } catch {
        // Ignore
      }
      if (mounted) {
        enumerateCameras();
      }
    }

    init();

    const handleDeviceChange = () => {
      if (mounted) enumerateCameras();
    };

    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mounted = false;
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [enumerateCameras]);

  // Connect whenever selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId, startCamera]);

  /* ---- Capture Single Photo Frame ---- */
  const takeSingleShot = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror image horizontally to match kiosk viewfinder
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Audio & Flash effect
    playShutterSound();
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  /* ---- Automated 5-Shot Photo Session ---- */
  const startPhotoSession = async () => {
    if (isShooting || !isCameraActive) return;

    setIsShooting(true);
    setCapturedPhotos([]);
    const photos: string[] = [];

    for (let shot = 0; shot < 5; shot++) {
      setCurrentShotIndex(shot);

      // Countdown 3 - 2 - 1
      for (let sec = 3; sec >= 1; sec--) {
        setCountdown(sec);
        playCountdownBeep(sec === 1);
        await new Promise((r) => setTimeout(r, 1000));
      }

      setCountdown(0);
      const photoDataUrl = takeSingleShot();
      if (photoDataUrl) {
        photos.push(photoDataUrl);
        setCapturedPhotos([...photos]);
      }

      // Brief pause between shots (1.5 seconds)
      await new Promise((r) => setTimeout(r, 1500));
    }

    setCountdown(null);
    setIsShooting(false);

    // Store captured photos in sessionStorage for selection step
    try {
      sessionStorage.setItem(`photos_${sessionId}`, JSON.stringify(photos));
    } catch {
      // Storage quota fallback
    }

    // Navigate to step 4: Photo Selection
    setTimeout(() => {
      router.push(`/session/${sessionId}/select?frame=${frameSlug}`);
    }, 1200);
  };

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const isDroidCam = selectedDevice?.label.toLowerCase().includes("droidcam");

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-8">
      {/* Flash Overlay */}
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none animate-flash" />
      )}

      {/* ============ HEADER ============ */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-cyan border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">LANGKAH 3 / 6</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            VIEWFINDER KAMERA
          </h1>
        </div>

        {/* Camera Selector & Status */}
        <div className="flex items-center gap-3">
          {devices.length > 0 && (
            <div className="flex items-center bg-white border-4 border-ink px-3 py-1.5 shadow-brut">
              <label htmlFor="camera-select" className="font-display text-xs uppercase text-ink/60 mr-2">
                KAMERA:
              </label>
              <select
                id="camera-select"
                value={selectedDeviceId}
                disabled={isShooting}
                onChange={(e) => {
                  const newId = e.target.value;
                  userSelectedDeviceRef.current = newId;
                  setSelectedDeviceId(newId);
                }}
                className="bg-transparent font-sans font-bold text-sm text-ink outline-none cursor-pointer max-w-[200px] truncate"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className={[
              "border-4 border-ink px-4 py-2 shadow-brut flex items-center gap-2",
              isCameraActive
                ? isDroidCam
                  ? "bg-brand-green"
                  : "bg-brand-yellow"
                : "bg-brand-red",
            ].join(" ")}
          >
            <span className="w-3 h-3 rounded-full bg-ink animate-pulse" />
            <span className="font-display text-sm uppercase">
              {isCameraActive
                ? isDroidCam
                  ? "DROIDCAM AKTIF"
                  : "WEBCAM AKTIF"
                : "KAMERA OFF"}
            </span>
          </div>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* ---------- LEFT: VIEWFINDER (MIRROR) ---------- */}
        <div className="flex-[3] bg-ink border-4 border-ink shadow-brut-xl flex flex-col relative overflow-hidden">
          {/* Video Stream Element */}
          <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* 10:7 Crop Framing Guide Overlay */}
            <div className="absolute inset-8 border-4 border-white/60 border-dashed pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between items-start">
                <span className="bg-ink/80 text-white font-mono text-xs px-2 py-1 border border-white/30">
                  PANDUAN POSISI WAJAH (10:7)
                </span>
                {cameraResolution.width > 0 && (
                  <span className="bg-ink/80 text-brand-green font-mono text-xs px-2 py-1 border border-white/30">
                    {cameraResolution.width} × {cameraResolution.height}
                  </span>
                )}
              </div>

              {/* Center Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 border border-white/40 border-dashed rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-brand-yellow/80 rounded-full" />
                </div>
              </div>

              <span className="self-end bg-ink/80 text-white/70 font-mono text-xs px-2 py-1">
                4R CROP GUIDE
              </span>
            </div>

            {/* Big Countdown Overlay */}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 bg-ink/40 flex items-center justify-center pointer-events-none">
                <div className="bg-brand-yellow border-8 border-ink p-12 shadow-brut-xl animate-pop text-center">
                  <p className="font-display text-2xl uppercase tracking-wider mb-2">
                    SIAP-SIAP! FOTO #{currentShotIndex + 1}
                  </p>
                  <p className="font-display text-8xl lg:text-9xl font-black text-ink leading-none">
                    {countdown}
                  </p>
                </div>
              </div>
            )}

            {/* Camera Disconnected / Error Card */}
            {(!isCameraActive || cameraError) && (
              <div className="absolute inset-0 bg-paper/95 p-8 flex flex-col items-center justify-center text-center z-20">
                <div className="max-w-xl bg-white border-4 border-ink shadow-brut-xl p-8">
                  <div className="bg-brand-red border-4 border-ink p-3 mb-4 shadow-brut">
                    <p className="font-display text-2xl uppercase text-white">
                      ⚠️ KAMERA BELUM TERHUBUNG
                    </p>
                  </div>

                  <p className="font-sans text-base text-ink mb-6 leading-relaxed">
                    Kabel USB dari HP ke laptop sudah terhubung, tetapi <strong>aplikasi DroidCam Client</strong> di laptop belum mengalirkan feed video ke browser.
                  </p>

                  <div className="bg-paper border-4 border-ink p-4 text-left mb-6 space-y-2">
                    <p className="font-display text-sm uppercase text-ink">
                      LANGKAH MENGAKTIFKAN DROIDCAM USB:
                    </p>
                    <ol className="list-decimal list-inside text-sm font-sans space-y-1 text-ink/80">
                      <li>Buka <strong>Aplikasi DroidCam</strong> di HP Android.</li>
                      <li>Pastikan <strong>USB Debugging</strong> di HP sudah aktif.</li>
                      <li>Buka software <strong>DroidCam Client</strong> di laptop Windows.</li>
                      <li>Pilih icon <strong>USB</strong> (tengah), lalu klik tombol <strong>Start</strong>.</li>
                      <li>Jika browser meminta izin kamera, klik <strong>Izinkan (Allow)</strong>.</li>
                    </ol>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      onClick={() => {
                        enumerateCameras();
                        if (selectedDeviceId) startCamera(selectedDeviceId);
                      }}
                    >
                      🔄 PINDAI ULANG KAMERA
                    </Button>
                    {devices.length > 1 && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          const nextIdx = (devices.findIndex((d) => d.deviceId === selectedDeviceId) + 1) % devices.length;
                          const nextId = devices[nextIdx].deviceId;
                          userSelectedDeviceRef.current = nextId;
                          setSelectedDeviceId(nextId);
                        }}
                      >
                        GANTI KAMERA
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Viewfinder Info Bar */}
          <div className="bg-white border-t-4 border-ink p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-display text-sm uppercase text-ink/70">
                PANDUAN:
              </span>
              <span className="font-sans text-sm font-semibold">
                Posisikan wajah di dalam garis putus-putus. Gambar akan dicrop rapi untuk 2 slot foto 4R.
              </span>
            </div>

            <span className="font-mono text-xs bg-brand-yellow px-2 py-1 border-2 border-ink">
              AUTO 5× SHOTS
            </span>
          </div>
        </div>

        {/* ---------- RIGHT: SHOTS PREVIEW & CONTROLS ---------- */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          {/* Progress / Status Box */}
          <div className="bg-white border-4 border-ink shadow-brut-lg p-5">
            <h2 className="font-display text-xl uppercase mb-2">
              STATUS SESI FOTO
            </h2>
            <div className="flex items-center justify-between mb-4">
              <span className="font-sans text-sm text-ink/60">Foto Terambil:</span>
              <span className="font-display text-2xl text-brand-green">
                {capturedPhotos.length} / 5 FOTO
              </span>
            </div>

            {/* Shots Grid (5 Slots) */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[0, 1, 2, 3, 4].map((idx) => {
                const photo = capturedPhotos[idx];
                const isCurrent = isShooting && currentShotIndex === idx;

                return (
                  <div
                    key={idx}
                    className={[
                      "aspect-[10/7] border-3 border-ink relative overflow-hidden bg-paper flex items-center justify-center",
                      isCurrent ? "border-brand-pink ring-4 ring-brand-yellow animate-pulse" : "",
                    ].join(" ")}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={`Shot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-xs text-ink/40">
                        #{idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="font-sans text-xs text-ink/60 leading-normal">
              Setelah 5 foto berhasil diambil, kamu akan diarahkan ke tahap pemilihan <strong>2 foto favorit</strong>.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex-1 bg-white border-4 border-ink shadow-brut-lg p-6 flex flex-col justify-between">
            <div>
              <p className="font-display text-sm uppercase text-ink/50 mb-3">
                KONTROL UTAMA
              </p>
              <p className="font-sans text-sm text-ink/70 mb-4">
                Tekan tombol di bawah saat semua orang sudah siap di depan kamera.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                id="btn-mulai-foto"
                variant="success"
                size="xl"
                className="h-24 text-2xl shadow-brut-lg"
                disabled={!isCameraActive || isShooting}
                onClick={startPhotoSession}
              >
                {isShooting ? (
                  <>
                    <span className="inline-block w-6 h-6 border-4 border-ink border-t-transparent animate-spin mr-2" />
                    MENGAMBIL FOTO #{currentShotIndex + 1}...
                  </>
                ) : (
                  "📸 MULAI FOTO (5X)"
                )}
              </Button>

              <Button
                variant="secondary"
                size="md"
                className="w-full"
                disabled={isShooting}
                onClick={() => router.push(`/session/${sessionId}/frame`)}
              >
                ← GANTI BINGKAI
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ FOOTER STEPPER ============ */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={3} />
      </footer>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut p-8 font-display text-2xl uppercase">
            MEMUAT KAMERA...
          </div>
        </div>
      }
    >
      <CaptureContent />
    </Suspense>
  );
}
