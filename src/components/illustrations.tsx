import { useId } from "react";

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
export function Companion({ type = "black_cat", large = false, pose = "idle" }: { type?: string; large?: boolean; pose?: "idle" | "greet" | "eating" | "portrait" | "call" | "noodles" }) {
  const eyeClipId = useId();
  const white = type === "white_cat" || type === "female";
  const head = <g className="companion-head">
        <path
          d="M62 91 58 36q5-13 22 1l28 23m26 1 34-27q17-10 17 7l-7 56"
          fill={white ? "#FFF9EE" : "#343633"} stroke={white ? "#D8CFBE" : "none"} strokeWidth="1.5"
        />
        <path d="m68 50 5 30 23-13m55 0 21-20-2 35" fill={white ? "#E6C7C5" : "#B88F88"} />
        <path
          d="M59 92q0-40 61-41 61 1 61 41l-3 36q-5 40-58 41-54-1-58-41z"
          fill={white ? "#FFF9EE" : "#343633"} stroke={white ? "#D8CFBE" : "none"} strokeWidth="1.5"
        />
        <g className="companion-eyes">
          {(pose === "eating" || pose === "call" || pose === "noodles") && <defs><clipPath id={eyeClipId} clipPathUnits="userSpaceOnUse"><ellipse cx="91" cy="108" rx="14" ry="19" /><ellipse cx="149" cy="108" rx="14" ry="19" /></clipPath></defs>}
          <ellipse cx="91" cy="108" rx="14" ry="19" fill="#FFFDF5" stroke={white ? "#A39482" : "none"} strokeWidth={white ? 1.8 : 0} />
          <ellipse cx="149" cy="108" rx="14" ry="19" fill="#FFFDF5" stroke={white ? "#A39482" : "none"} strokeWidth={white ? 1.8 : 0} />
          <g clipPath={pose === "eating" || pose === "call" || pose === "noodles" ? `url(#${eyeClipId})` : undefined}><g className="companion-gaze">
          <ellipse cx="94" cy="110" rx="10" ry="14" fill={white ? "#383733" : "#4E6045"} />
          <ellipse cx="146" cy="110" rx="10" ry="14" fill={white ? "#383733" : "#4E6045"} />
          <circle className="companion-eye-highlight" cx={pose === "eating" ? 93 : 95} cy={pose === "greet" ? 103 : 105} r="3" fill="white" />
          <circle className="companion-eye-highlight" cx={pose === "eating" ? 145 : 147} cy={pose === "greet" ? 103 : 105} r="3" fill="white" />
          </g></g>
        </g>
        {white && <g transform="translate(169 65) rotate(8) scale(.88)"><path d="M0 0C-20-17-22 17 0 8C20 23 23-13 0 0" fill="#E2BCC3" stroke="#CDA5AD" strokeWidth="1.5"/><circle cx="0" cy="4" r="4" fill="#CDA5AD"/></g>}
        <path d="m115 131 5 5 5-5z" fill="#D7ABA4" />
        <path
          className="companion-smile"
          d="M120 136v4m-13 0q5 10 13 3 8 7 13-3"
          fill="none"
          stroke={white ? "#8C7E70" : "#ECE8DA"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {pose === "eating" && <ellipse className="dining-bite-mouth" cx="120" cy="145" rx="7" ry="5" fill="#D7ABA4" />}
        <ellipse className="companion-voice-mouth" cx="120" cy="144" rx="7" ry="5" fill="#D7ABA4" />
        <path
          d="m69 132-28-5m28 13-29 4m131-12 28-5m-28 13 29 4"
          stroke={white ? "#B4AA9B" : "#777C6C"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <ellipse cx="77" cy="132" rx={white ? 14 : 11} ry={white ? 8 : 6} fill={white ? "#DEABA7" : "#d99c9c"} opacity=".6" />
        <ellipse cx="163" cy="132" rx={white ? 14 : 11} ry={white ? 8 : 6} fill={white ? "#DEABA7" : "#d99c9c"} opacity=".6" />
        </g>;
  if (pose === "noodles") {
    return <svg className={`companion-noodles ${white ? "noodles-white" : "noodles-black"}`} viewBox="0 0 480 360" role="img" aria-label="Your cat sitting cross-legged on a round cushion, eating noodles">
      <ellipse cx="246" cy="319" rx="132" ry="17" fill="#b9a48e" opacity=".18" />
      <ellipse cx="245" cy="298" rx="120" ry="31" fill="#b7c29b" /><ellipse cx="245" cy="291" rx="120" ry="29" fill="#ced7b8" /><ellipse cx="245" cy="289" rx="107" ry="23" fill="none" stroke="#abb78d" strokeWidth="2" />
      <g transform="translate(119 48)">
        <path className="noodle-tail" d="M169 193Q223 217 216 175" fill="none" stroke={white ? "#F2EADC" : "#343633"} strokeWidth="17" strokeLinecap="round" />
        <ellipse cx="121" cy="180" rx="49" ry="43" fill={white ? "#FFF9EE" : "#343633"} />
        <g className="noodle-head">{head}</g>
        <path d="M83 164Q120 179 160 164L153 181Q120 189 89 180Z" fill={white ? "#E2BCC3" : "#A9BC9B"} />
        <ellipse cx="119" cy="219" rx="52" ry="14" transform="rotate(-17 119 219)" fill={white ? "#F4EDDF" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
        <ellipse cx="123" cy="222" rx="51" ry="14" transform="rotate(17 123 222)" fill={white ? "#F4EDDF" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
        <path d="M84 177Q72 197 102 202" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="18" strokeLinecap="round" fill="none" />
        <path d="M90 191H155Q151 225 122 225Q96 225 90 191Z" fill="#c78d6b" /><ellipse cx="122" cy="191" rx="32" ry="8" fill="#fff4dc" /><path d="M100 192Q110 182 119 193Q128 182 139 192M106 195Q119 187 132 195" stroke="#ddb16d" strokeWidth="2.5" strokeLinecap="round" />
        <g className="noodle-eating-arm"><path d="M157 176Q180 172 171 151" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="17" strokeLinecap="round" fill="none" />
          <path d="M165 150L132 139M165 156L132 144" stroke="#aa7853" strokeWidth="3" strokeLinecap="round" />
          <path className="noodle-strands" d="M133 144Q126 157 129 174M138 146Q131 161 135 179M142 147Q136 160 140 171" stroke="#dfb36d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <ellipse cx="169" cy="151" rx="10" ry="11" fill={white ? "#FFF9EE" : "#454842"} />
        </g>
      </g>
    </svg>;
  }
  if (pose === "portrait") {
    return <svg className={`companion-portrait ${white ? "portrait-white" : "portrait-black"}`} viewBox="25 12 190 190" aria-hidden="true">{head}</svg>;
  }
  if (pose === "call") {
    return <svg className={`companion companion-call ${white ? "call-white" : "call-black"}`} viewBox="0 0 240 260" role="img" aria-label="A cat standing to invite you, then sitting down with a phone">
      <ellipse cx="122" cy="233" rx="63" ry="7" fill="#6e7356" opacity=".12" />
      <path className="call-tail" d="M157 203Q210 214 204 175" fill="none" stroke={white ? "#F2EADC" : "#343633"} strokeWidth="16" strokeLinecap="round" />
      <path className="call-legs" d="M104 180L103 220M139 180L142 220" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="22" strokeLinecap="round" />
      <ellipse className="call-body" cx="121" cy="171" rx="41" ry="33" fill={white ? "#FFF9EE" : "#343633"} stroke={white ? "#D8CFBE" : "none"} />
      <ellipse className="call-haunch-left" cx="89" cy="207" rx="18" ry="17" fill={white ? "#F4EDDF" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
      <ellipse className="call-haunch-right" cx="153" cy="207" rx="18" ry="17" fill={white ? "#F4EDDF" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
      <g className="call-head-position">{head}</g>
      <g className="call-collar"><path d="M83 164Q120 177 158 164L152 180Q120 189 89 179Z" fill={white ? "#E2BCC3" : "#A9BC9B"} /><path d="M125 177L144 185L133 203L117 178" fill={white ? "#CDA5AD" : "#91A984"} /><circle cx="119" cy="178" r="5" fill="#DFC586" /></g>
      <path className="call-free-arm" d="M88 177Q79 193 90 212" fill="none" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="16" strokeLinecap="round" />
      <g className="call-held-phone">
        <path className="call-receiver-arm" d="M155 175Q171 193 184 171" fill="none" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="17" strokeLinecap="round" />
        <g className="call-phone-device"><g className="call-phone-scale" transform="translate(185 153) scale(1.12) translate(-185 -153)"><g transform="rotate(13 185 153)"><rect x="174" y="126" width="27" height="49" rx="7" fill="#748c60" stroke="#526a41" strokeWidth="2" /><rect x="178" y="132" width="19" height="31" rx="3" fill="#e8efde" /><path d="M182 138Q179 151 192 156L195 151L190 148L187 150L185 145L187 142Z" fill="#7c9367" /><path d="M184 168H190" stroke="#dbe5ce" strokeWidth="2" strokeLinecap="round" /></g></g></g>
        <g className="call-gripping-paw"><ellipse cx="180" cy="170" rx="11" ry="10" fill={white ? "#FFF9EE" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
        <path d="M177 165L179 170M184 164L186 169" stroke={white ? "#D8CFBE" : "#63675d"} strokeWidth="1.5" strokeLinecap="round" /></g>
      </g>
      <ellipse className="call-foot-left" cx="100" cy="222" rx="18" ry="10" fill={white ? "#F4EDDF" : "#454842"} />
      <ellipse className="call-foot-right" cx="143" cy="222" rx="18" ry="10" fill={white ? "#F4EDDF" : "#454842"} />
    </svg>;
  }
  if (pose === "eating") {
    return <svg className={`companion companion-cat companion-dining ${white ? "companion-white-cat" : "companion-black-cat"}`} data-pose="eating" viewBox="0 0 420 340" role="img" aria-label="A cat sitting behind a table, holding a fish and looking up at you">
      <ellipse cx="213" cy="323" rx="179" ry="10" fill="#dce1d2" opacity=".5" />
      <g className="dining-cat" transform="translate(155 12)">
        <g transform={white ? "translate(240 0) scale(-1 1)" : undefined}><path className="dining-tail" d={white ? "M166 203C196 208 213 185 207 151" : "M166 203Q213 211 211 180"} fill="none" stroke={white ? "#F2EADC" : "#343633"} strokeWidth="16" strokeLinecap="round" /></g>
        <ellipse className="companion-body" cx="121" cy="187" rx="49" ry="36" fill={white ? "#FFF9EE" : "#343633"} stroke={white ? "#D8CFBE" : "none"} />
        {head}
        <path d="M79 164Q120 179 162 164L155 182Q120 192 87 181Z" fill={white ? "#E2BCC3" : "#A9BC9B"} />
        <path d="M125 179L143 188L132 207L117 179" fill={white ? "#CDA5AD" : "#91A984"} />
        <circle cx="119" cy="179" r="5" fill="#DFC586" />
        <path d="M155 184Q171 198 164 214" fill="none" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="18" strokeLinecap="round" />
      </g>
      <g className="dining-table">
        <path className="dining-table-legs" d="M49 236H62L59 320H46ZM351 236H364L369 320H356Z" fill="#af8c69" />
        <path d="M61 286H353" stroke="#c2a585" strokeWidth="7" />
        <path d="M44 208H368L392 232H22Z" fill="#ddcbb7" />
        <path d="M22 232H392V241H22Z" fill="#c8ae92" />
        <path d="M28 232H386" stroke="#e8d9c6" strokeWidth="2" />
        <ellipse cx="154" cy="222" rx="45" ry="11" fill="#fffefa" stroke="#b9c6a9" strokeWidth="1.5" />
        <ellipse cx="154" cy="221" rx="31" ry="6" fill="#e8eddf" />
        <path d="M66 181H91V209Q79 220 66 209Z" fill="#b9c8a7" />
        <path d="M91 186C112 184 108 205 91 203" stroke="#b9c8a7" strokeWidth="4" fill="none" />
        <path d="M78 171Q72 164 78 157" stroke="#cfcebd" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g transform="translate(155 12)">
        <ellipse cx="164" cy="215" rx="16" ry="9" fill={white ? "#FFF9EE" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
        <path d="M157 216V219M164 217V220" stroke={white ? "#D8CFBE" : "#62655c"} strokeWidth="1.5" strokeLinecap="round" />
        <g className="companion-paw dining-fish-hand">
          <path d="M86 185Q70 181 83 163" fill="none" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="19" strokeLinecap="round" />
          <g className="dining-fish" transform="rotate(-16 92 158)">
            <path d="M66 157L43 143L47 159L41 175L66 165" fill="#9aaeb1" stroke="#778f91" strokeWidth="1.5" strokeLinejoin="round" />
            <path className="dining-fish-whole" d="M62 161Q84 133 126 155Q104 183 62 161Z" fill="#b9cecb" stroke="#778f91" strokeWidth="1.5" />
            <path className="dining-fish-bitten" d="M62 161Q81 137 112 148Q109 151 112 154Q106 155 109 159Q104 161 107 165Q88 178 62 161Z" fill="#b9cecb" stroke="#778f91" strokeWidth="1.5" />
            <path d="M84 145L94 134L103 145M86 173L97 181L104 169" fill="#91adaa" stroke="#778f91" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M108 149Q100 158 107 169M75 155L80 159M85 152L90 157M83 164L88 168" stroke="#8ca8a4" strokeWidth="1.5" strokeLinecap="round" />
            <circle className="dining-fish-whole" cx="116" cy="155" r="2.5" fill="#465e59" /><circle className="dining-fish-whole" cx="117" cy="154" r=".8" fill="#fffefa" />
          </g>
          <ellipse cx="83" cy="172" rx="12" ry="10" fill={white ? "#FFF9EE" : "#454842"} stroke={white ? "#D8CFBE" : "none"} />
          <path d="M78 167L80 172M85 166L87 171" stroke={white ? "#D8CFBE" : "#62655c"} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>;
  }
    return (
      <svg
        className={"companion companion-cat " + (white ? "companion-white-cat" : "companion-black-cat") + (large ? " large" : "")}
        data-pose={pose}
        viewBox="0 0 240 240"
        role="img"
        aria-label={white ? "A white cat with pink accessories" : "A soft black cat"}
      >
        <circle cx="120" cy="124" r="105" fill={white ? "#CFDCC5" : "#E6EAD9"} />
        <ellipse cx="122" cy="211" rx="69" ry="9" fill="#40463B" opacity=".1" />
        <g transform={white ? "translate(240 0) scale(-1 1)" : undefined}><path
          className="companion-tail"
          d={white ? "M169 179C196 182 213 159 207 130" : "M167 173q50-29 40-1-8 15-35 16"}
          fill="none"
          stroke={white ? "#F2EADC" : "#343633"}
          strokeWidth="17"
          strokeLinecap="round"
        /></g>
        <ellipse className="companion-body" cx="121" cy="172" rx="52" ry="40" fill={white ? "#FFF9EE" : "#343633"} stroke={white ? "#D8CFBE" : "none"} strokeWidth="1.5" />
        {head}
        <path d="M77 164q43 15 86 0l-8 18q-35 9-70 0z" fill={white ? "#E2BCC3" : "#A9BC9B"} />
        <path d="m124 175 23 9-10 23-19-30" fill={white ? "#CDA5AD" : "#91A984"} />
        <circle cx="119" cy="179" r="6" fill="#DFC586" />
        <g className="companion-paw">
          <path d="M158 174Q176 178 169 192" fill="none" stroke={white ? "#F4EDDF" : "#454842"} strokeWidth="17" strokeLinecap="round"/>
          <ellipse cx="169" cy="190" rx="11" ry="13" fill={white ? "#FFF9EE" : "#454842"}/>
          <ellipse cx="170" cy="191" rx="5" ry="6" fill="#D7ABA4"/>
          <circle cx="164" cy="183" r="2.4" fill="#D7ABA4"/><circle cx="171" cy="181" r="2.4" fill="#D7ABA4"/><circle cx="176" cy="185" r="2.4" fill="#D7ABA4"/>
        </g>
        <ellipse cx="94" cy="204" rx="19" ry="10" fill={white ? "#F4EDDF" : "#454842"} />
        <ellipse cx="146" cy="204" rx="19" ry="10" fill={white ? "#F4EDDF" : "#454842"} />
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
