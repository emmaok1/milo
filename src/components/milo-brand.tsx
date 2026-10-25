export default function MiloBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={"milo-brand" + (compact ? " compact" : "")}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="14" fill="currentColor" />
        <path d="M11 23V12l7 4h5l7-4v11c0 7-19 7-19 0Z" fill="#F8F6EE" />
        <path
          d="M16 22v1m9-1v1m-5 1 1 1 1-1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && <span>milo</span>}
    </span>
  );
}
