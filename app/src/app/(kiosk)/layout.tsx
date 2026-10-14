export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      {children}
    </main>
  );
}
