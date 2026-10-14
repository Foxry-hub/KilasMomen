interface BadgeProps {
  status: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-brand-yellow",
  PAID: "bg-brand-cyan",
  COMPLETED: "bg-brand-green",
  CANCELLED: "bg-brand-red",
  EXPIRED: "bg-brand-pink",
  VOIDED: "bg-brand-violet",
};

export function Badge({ status, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-3 py-1",
        "border-3 border-ink font-mono uppercase text-sm",
        "shadow-brut-sm select-none",
        statusColors[status] ?? "bg-white",
        className,
      ].join(" ")}
    >
      {status}
    </span>
  );
}
