export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-paper">
      {children}
    </div>
  );
}
