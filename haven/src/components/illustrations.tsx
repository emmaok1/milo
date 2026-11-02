export function Plant({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 330"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="208" cy="296" rx="128" ry="18" fill="#DCDDD1" opacity=".4" />
      <path
        d="M112 185Q200 220 295 182L271 284Q205 314 138 282Z"
        fill="#DAC4AE"
      />
      <ellipse cx="204" cy="185" rx="92" ry="25" fill="#BAA18A" />
      <path
        d="M202 189Q183 109 151 60M204 188Q231 108 280 58M203 191Q200 114 212 30"
        stroke="#6B785B"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M180 122Q107 133 109 74Q154 70 180 122Z" fill="#899C74" />
      <path d="M157 76Q108 68 129 28Q165 32 157 76Z" fill="#ACB797" />
      <path d="M199 100Q156 78 181 45Q216 56 199 100Z" fill="#778B66" />
      <path d="M211 66Q198 16 245 16Q260 53 211 66Z" fill="#A5B48E" />
      <path d="M230 126Q232 75 280 85Q284 124 230 126Z" fill="#71865F" />
      <path d="M264 80Q255 34 303 37Q313 75 264 80Z" fill="#9CAC83" />
      <path d="M202 174Q143 173 146 134Q189 124 202 174Z" fill="#B4BE9E" />
      <path d="M215 169Q231 123 263 144Q260 178 215 169Z" fill="#91A17A" />
    </svg>
  );
}
export function Companion({ type = "black_cat", large = false, pose = "idle" }: { type?: string; large?: boolean; pose?: "idle" | "greet" }) {
  const white = type === "white_cat" || type === "female";
  const head = <g className="companion-head">
        <path
          d="M62 91 58 36q5-13 22 1l28 23m26 1 34-27q17-10 17 7l-7 56"
          fill={white ? "#FFFDF8" : "#343633"} stroke={white ? "#DCCED1" : "none"} strokeWidth="1.5"
        />
        <path d="m68 50 5 30 23-13m55 0 21-20-2 35" fill="#B88F88" />
        <path
          d="M59 92q0-40 61-41 61 1 61 41l-3 36q-5 40-58 41-54-1-58-41z"
          fill={white ? "#FFFDF8" : "#343633"} stroke={white ? "#DCCED1" : "none"} strokeWidth="1.5"
        />
        <g className="companion-eyes">
          <ellipse cx="91" cy="108" rx="14" ry="19" fill="#FFFDF5" />
          <ellipse cx="149" cy="108" rx="14" ry="19" fill="#FFFDF5" />
          <g className="companion-gaze">
          <ellipse cx="94" cy="110" rx="6" ry="11" fill={white ? "#887DAA" : "#57684D"} />
          <ellipse cx="146" cy="110" rx="6" ry="11" fill={white ? "#887DAA" : "#57684D"} />
          <circle cx="95" cy="105" r="3" fill="white" />
          <circle cx="147" cy="105" r="3" fill="white" />
          </g>
        </g>
        {white && <g transform="translate(168 64) rotate(12)"><path d="M0 0C-20-17-22 17 0 8C20 23 23-13 0 0" fill="#E8A5BC" stroke="#D88DA8" strokeWidth="1.5"/><circle cx="0" cy="4" r="4" fill="#D88DA8"/></g>}
        <path d="m115 131 5 5 5-5z" fill="#D7ABA4" />
        <path
          className="companion-smile"
          d="M120 137v5m-10 1q5 6 10-1 5 7 10 1"
          fill="none"
          stroke={white ? "#9A687C" : "#ECE8DA"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <ellipse className="companion-voice-mouth" cx="120" cy="144" rx="7" ry="5" fill="#D7ABA4" />
        <path
          d="m69 132-28-5m28 13-29 4m131-12 28-5m-28 13 29 4"
          stroke={white ? "#BC9EAA" : "#777C6C"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <ellipse cx="77" cy="132" rx="9" ry="5" fill="#B98C83" opacity=".6" />
        <ellipse cx="163" cy="132" rx="9" ry="5" fill="#B98C83" opacity=".6" />
        </g>;
    return (
      <svg
        className={"companion companion-cat " + (white ? "companion-white-cat" : "companion-black-cat") + (large ? " large" : "")}
        data-pose={pose}
        viewBox="0 0 240 240"
        role="img"
        aria-label={white ? "A white cat with pink accessories" : "A soft black cat"}
      >
        <circle cx="120" cy="124" r="105" fill={white ? "#F6E7ED" : "#E6EAD9"} />
        <ellipse cx="122" cy="211" rx="69" ry="9" fill="#40463B" opacity=".1" />
        <path
          className="companion-tail"
          d="M167 173q50-29 40-1-8 15-35 16"
          fill="none"
          stroke={white ? "#F1E8ED" : "#343633"}
          strokeWidth="17"
          strokeLinecap="round"
        />
        <ellipse className="companion-body" cx="121" cy="172" rx="52" ry="40" fill={white ? "#FFFDF8" : "#343633"} stroke={white ? "#DCCED1" : "none"} strokeWidth="1.5" />
        {head}
        <path d="M77 164q43 15 86 0l-8 18q-35 9-70 0z" fill={white ? "#E8B6C6" : "#A9BC9B"} />
        <path d="m124 175 23 9-10 23-19-30" fill={white ? "#D99BB0" : "#91A984"} />
        <circle cx="119" cy="179" r="6" fill="#DFC586" />
        <g className="companion-paw">
          <path d="M158 174Q176 178 169 192" fill="none" stroke={white ? "#F0E5EA" : "#454842"} strokeWidth="17" strokeLinecap="round"/>
          <ellipse cx="169" cy="190" rx="11" ry="13" fill={white ? "#FFFDF8" : "#454842"}/>
          <ellipse cx="170" cy="191" rx="5" ry="6" fill="#D7ABA4"/>
          <circle cx="164" cy="183" r="2.4" fill="#D7ABA4"/><circle cx="171" cy="181" r="2.4" fill="#D7ABA4"/><circle cx="176" cy="185" r="2.4" fill="#D7ABA4"/>
        </g>
        <ellipse cx="94" cy="204" rx="19" ry="10" fill={white ? "#F0E5EA" : "#454842"} />
        <ellipse cx="146" cy="204" rx="19" ry="10" fill={white ? "#F0E5EA" : "#454842"} />
        <path d="m199 49 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#B7C4A3" />
      </svg>
    );
}

export function CardArt({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 300 160" aria-hidden="true">
      <ellipse cx="150" cy="141" rx="80" ry="8" fill="#6E7852" opacity=".08" />
      {kind === "talk" ? (
        <>
          <path
            d="M76 36Q76 20 93 20H204Q220 20 220 37V94Q220 110 204 110H132L101 132V110H93Q76 110 76 94Z"
            fill="#C4D0B7"
          />
          <path
            d="M106 48H185M106 66H177M106 84H150"
            stroke="#6E805C"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="215" cy="106" r="25" fill="#F4E9D5" />
          <path
            d="M204 106h22M215 95v22"
            stroke="#9F987C"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : kind === "plan" ? (
        <>
          <rect
            x="95"
            y="20"
            width="111"
            height="123"
            rx="12"
            transform="rotate(7 95 20)"
            fill="#E5CEB4"
          />
          <rect
            x="86"
            y="17"
            width="111"
            height="123"
            rx="12"
            transform="rotate(-5 86 17)"
            fill="#F5E9D9"
          />
          <path
            d="M118 51l6 6 10-13M118 81l6 6 10-13M148 49h29M148 79h24M118 111h53"
            stroke="#A08768"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path d="M65 49Q111 24 150 49V136Q108 113 65 136Z" fill="#C7CFAF" />
          <path d="M150 49Q190 25 235 49V136Q190 113 150 136Z" fill="#DDE2C9" />
          <path
            d="M150 50v84M85 67q23-9 43 0M85 86q23-9 43 0M173 67q23-9 43 0M173 86q23-9 43 0"
            stroke="#8B9876"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M198 32v43l10-7 10 7V32Z" fill="#C99A7C" />
        </>
      )}
    </svg>
  );
}
