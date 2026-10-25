export default function FriendActivityIcon({ kind }: { kind: "chat" | "meal" | "cat" | "video" }) {
  return <span className={`f-activity-icon f-icon-${kind}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      {kind === "chat" ? <>
        <path d="M6 8H27C32 8 35 12 35 17V22C35 27 32 30 27 30H17L9 36V29C5 28 3 25 3 21V17C3 12 4 8 6 8Z" fill="white" />
        <path d="M30 21H36C42 21 45 25 45 30V33C45 37 43 39 39 40V45L32 40H27C23 40 20 38 19 35H27C34 35 39 30 39 23C37 22 34 21 30 21Z" fill="white" />
        <circle cx="11" cy="19" r="2" fill="currentColor" /><circle cx="19" cy="19" r="2" fill="currentColor" /><circle cx="27" cy="19" r="2" fill="currentColor" />
      </> : kind === "meal" ? <>
        <path d="M6 25H42C40 36 34 41 24 41C14 41 8 36 6 25Z" fill="white" />
        <path d="M19 43H29M7 22H41" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M15 17C9 12 18 10 14 5M24 17C18 12 27 10 23 5" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 5L42 16M37 3L46 13" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      </> : kind === "cat" ? <>
        <path d="M7 22V7L19 14H29L41 7V25C41 36 34 42 24 42C14 42 7 36 7 25Z" fill="white" />
        <ellipse cx="17" cy="26" rx="2.5" ry="4" fill="currentColor" /><ellipse cx="31" cy="26" rx="2.5" ry="4" fill="currentColor" />
        <path d="M21 33L24 36L27 33Z" fill="currentColor" />
      </> : <>
        <rect x="4" y="12" width="28" height="25" rx="6" fill="white" />
        <path d="M35 21L45 14V35L35 28Z" fill="white" />
      </>}
    </svg>
  </span>;
}
