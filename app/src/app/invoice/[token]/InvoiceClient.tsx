"use client";

import { useEffect, useState } from "react";

interface InvoiceData {
  invoiceNumber: string;
  filter: string;
}

export default function InvoiceClient({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("Belum ada percobaan download ZIP.");

  useEffect(() => {
    if (!token) return;

    fetch(`/api/public/invoice/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Invoice tidak ditemukan.");
        }
        setInvoice(await response.json());
      })
      .catch((requestError: unknown) => {
        console.error("Failed to load invoice metadata:", requestError);
        setError("Invoice tidak ditemukan atau sudah kedaluwarsa.");
      });
  }, [token]);

  const invoiceNumber = invoice?.invoiceNumber || "PHOTOBOOTH";
  const framedDownloadUrl = `/api/public/invoice/${encodeURIComponent(token)}/image?download=1`;
  const rawPhotosDownloadUrl = `/api/public/invoice/${encodeURIComponent(token)}/raw-photos`;

  const logRawZipClick = () => {
    setDownloadError("");
    setDownloadStatus("Klik terdeteksi. Membuka endpoint ZIP...");
    console.warn("[Raw ZIP] Native download link clicked", {
      token,
      url: rawPhotosDownloadUrl,
      time: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-paper px-4 py-6 font-sans text-ink sm:px-6">
      <style jsx global>{`
        body {
          background-color: #fffbeb;
          background-image: radial-gradient(#00000020 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
      `}</style>

      <main className="mx-auto w-full max-w-lg overflow-hidden border-4 border-ink bg-white shadow-brut-xl">
        <header className="flex items-center justify-between border-b-4 border-ink bg-brand-yellow p-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-ink bg-ink px-2 py-1 font-display text-lg text-brand-yellow">
              PB
            </div>
            <div>
              <h1 className="font-display text-xl uppercase leading-none">PHOTOBOOTH KIOS</h1>
              <p className="font-mono text-[10px] uppercase">Hasil foto digital 4R</p>
            </div>
          </div>
          <span className="border-2 border-ink bg-white px-2 py-1 font-mono text-[10px] font-bold shadow-brut-sm">
            {invoiceNumber}
          </span>
        </header>

        <section className="p-5 sm:p-7">
          {error ? (
            <div className="mb-5 border-4 border-ink bg-brand-red p-4 text-center font-bold text-white">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-6 border-4 border-ink bg-brand-green p-4 shadow-brut">
                <h2 className="font-display text-2xl uppercase">Foto Kamu Siap Diunduh!</h2>
                <p className="mt-2 font-medium">
                  Silakan pilih opsi unduh di bawah ini.
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href={framedDownloadUrl}
                  download
                  className="block border-4 border-ink bg-brand-green px-4 py-5 text-center font-display text-lg uppercase shadow-brut transition-transform hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  📸 UNDUH FOTO BERFRAME (4R)
                  <span className="mt-1 block font-sans text-xs font-bold uppercase">
                    File final.jpg
                  </span>
                </a>

                <a
                  href={rawPhotosDownloadUrl}
                  download={`Mentahan-Foto-${token}.zip`}
                  onPointerDown={() => console.warn("[Raw ZIP] Pointer down detected")}
                  onClick={logRawZipClick}
                  className="block border-4 border-ink bg-brand-yellow px-4 py-5 text-center font-display text-lg uppercase shadow-brut transition-transform hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  📦 UNDUH 5 FOTO MENTAH (ZIP)
                  <span className="mt-1 block font-sans text-xs font-bold uppercase">
                    Foto sebelum dipasang frame
                  </span>
                </a>
              </div>
              {downloadError && (
                <div className="mt-4 border-4 border-ink bg-brand-red p-3 text-center text-sm font-bold text-white">
                  {downloadError}
                </div>
              )}
              <div className="mt-3 border-2 border-ink bg-paper p-2 font-mono text-[10px] text-ink/70">
                <strong>STATUS ZIP:</strong> {downloadStatus}
                <br />
                <span>Detail teknis tersedia di Console browser (F12).</span>
              </div>
            </>
          )}

          <div className="mt-6 border-t-4 border-ink pt-4 text-center font-mono text-[11px] uppercase text-ink/60">
            {invoice ? `Efek: ${invoice.filter}` : "Memuat informasi invoice..."}
          </div>
        </section>
      </main>
    </div>
  );
}
