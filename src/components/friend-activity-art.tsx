export default function FriendActivityArt({ kind }: { kind: "chat" | "meal" }) {
  return <svg className="f-activity-art" viewBox="0 0 160 130" fill="none" aria-hidden="true">
    {kind === "chat" ? <>
      <ellipse cx="80" cy="108" rx="56" ry="9" fill="#7d638c" opacity=".1" />
      <rect x="20" y="24" width="85" height="57" rx="22" fill="#b8a2cc" />
      <path d="M37 74L31 92L58 79" fill="#b8a2cc" />
      <path d="M39 45H77M39 57H65" stroke="#f9f4fd" strokeWidth="5" strokeLinecap="round" />
      <rect x="63" y="55" width="78" height="49" rx="20" fill="#fff9f0" stroke="#d1bbd9" strokeWidth="2" />
      <path d="M122 96L131 111L109 103" fill="#fff9f0" stroke="#d1bbd9" strokeWidth="2" strokeLinejoin="round" />
      <path d="M89 78V73C89 62 105 62 105 73V78" stroke="#94759f" strokeWidth="3" strokeLinecap="round" />
      <rect x="85" y="76" width="24" height="18" rx="6" fill="#c3aed0" /><circle cx="97" cy="84" r="2" fill="#fff9f0" />
      <path d="M127 19V31M121 25H133" stroke="#bd9c73" strokeWidth="2" strokeLinecap="round" />
    </> : <>
      <ellipse cx="82" cy="108" rx="62" ry="10" fill="#ad774c" opacity=".12" />
      <ellipse cx="54" cy="89" rx="37" ry="10" fill="#ead0ad" />
      <path d="M23 61H88Q83 97 56 97Q29 97 23 61Z" fill="#c48a61" />
      <ellipse cx="55" cy="61" rx="33" ry="9" fill="#fff6e8" stroke="#b87e57" strokeWidth="2" />
      <ellipse cx="55" cy="61" rx="24" ry="5" fill="#e9bd88" />
      <path d="M83 80H140Q136 108 112 108Q88 108 83 80Z" fill="#f9f2e5" stroke="#d5af86" strokeWidth="2" />
      <ellipse cx="111" cy="80" rx="28" ry="7" fill="#e5b982" />
      <path d="M43 44Q34 35 43 25M62 43Q53 34 62 24M108 61Q100 53 109 44" stroke="#c49e79" strokeWidth="3" strokeLinecap="round" />
      <path d="M98 21L128 56M110 17L139 50" stroke="#a66d48" strokeWidth="3" strokeLinecap="round" />
      <path d="M21 26V37M16 31H26" stroke="#c7a367" strokeWidth="2" strokeLinecap="round" />
    </>}
  </svg>;
}
