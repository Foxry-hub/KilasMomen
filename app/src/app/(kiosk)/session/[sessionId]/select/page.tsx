"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { getSessionPhotos, saveSessionPhotos } from "@/lib/session-photo-storage";

function PhotoSelectionContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const sessionId = (params?.sessionId as string) || "";
  const frameSlug = searchParams.get("frame") || "classic-duo";

  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await getSessionPhotos(sessionId);
        if (stored?.photos) {
          setPhotos(stored.photos);
        }
      } catch (error) {
        console.error("Failed to load captured photos:", error);
      }
    })();
  }, [sessionId]);

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      if (selectedIndices.length < 2) {
        setSelectedIndices([...selectedIndices, index]);
      } else {
        // Replace second photo
        setSelectedIndices([selectedIndices[0], index]);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-yellow border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">LANGKAH 4 / 6</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            PILIH 2 FOTO TERBAIK
          </h1>
        </div>
        <div className="bg-brand-green border-4 border-ink px-4 py-2 shadow-brut">
          <span className="font-display text-base uppercase">
            TERPILIH: {selectedIndices.length} / 2
          </span>
        </div>
      </header>

      {/* Photos Grid */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl w-full">
          {photos.length > 0 ? (
            photos.map((photo, idx) => {
              const isSelected = selectedIndices.includes(idx);
              const orderIndex = selectedIndices.indexOf(idx);

              return (
                <div
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  className={[
                    "relative aspect-[10/7] bg-white border-4 border-ink shadow-brut cursor-pointer transition-transform duration-100 overflow-hidden",
                    isSelected ? "ring-8 ring-brand-yellow scale-105 shadow-brut-lg" : "hover:scale-102",
                  ].join(" ")}
                >
                  <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute top-2 left-2 bg-brand-yellow border-3 border-ink px-2 py-1 font-display text-base">
                      FOTO {orderIndex === 0 ? "ATAS" : "BAWAH"}
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-ink text-white font-mono text-xs px-2 py-0.5">
                    #{idx + 1}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-5 bg-white border-4 border-ink p-8 text-center shadow-brut-xl">
              <p className="font-display text-2xl uppercase mb-3">TIDAK ADA FOTO TERSEDIA</p>
              <p className="font-sans text-base text-ink/70 mb-4">
                Sesi foto belum selesai atau halaman dimuat ulang.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push(`/session/${sessionId}/capture?frame=${frameSlug}`)}
              >
                KEMBALI KE KAMERA
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-4 bg-white border-4 border-ink p-4 flex items-center justify-between shadow-brut-lg">
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/session/${sessionId}/capture?frame=${frameSlug}`)}
        >
          ← FOTO ULANG
        </Button>

        <Button
          variant="success"
          size="lg"
          className="px-12 text-2xl"
          disabled={selectedIndices.length !== 2}
          onClick={async () => {
            try {
              await saveSessionPhotos(sessionId, photos, selectedIndices);
              router.push(`/session/${sessionId}/filter?frame=${frameSlug}`);
            } catch (error) {
              console.error("Failed to save selected photos:", error);
            }
          }}
        >
          LANJUT KE PILIH FILTER (LANGKAH 5) ➔
        </Button>
      </div>

      {/* Stepper */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={4} />
      </footer>
    </div>
  );
}

export default function PhotoSelectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut p-8 font-display text-2xl uppercase">
            MEMUAT SELEKSI FOTO...
          </div>
        </div>
      }
    >
      <PhotoSelectionContent />
    </Suspense>
  );
}
