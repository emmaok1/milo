import type { ChatTheme, ChatMode } from "@/lib/chat-themes";

export default function ChatBackdrop({ theme, mode = "night" }: { theme: ChatTheme; mode?: ChatMode }) {
  return <div className={`chat-backdrop theme-${theme} mode-${mode}`} aria-hidden="true">
    {theme === "cloud" ? <svg viewBox="0 0 480 700" preserveAspectRatio="xMidYMid slice" fill="none">
      <circle cx="383" cy="76" r="39" fill="#f9dfa6" opacity=".65" />
      <path d="M-28 664C-4 615 47 610 76 640C92 584 165 586 183 633C223 601 277 630 273 667C309 634 364 649 372 677C413 642 465 654 502 686V731H-28Z" fill="#fdf8ed" opacity=".92" />
      <path d="M-25 682Q33 664 89 680Q147 700 200 680Q259 664 317 691Q372 708 431 686Q461 675 493 686" stroke="#d5c4af" strokeWidth="2" opacity=".6" />
      <path d="M-60 147C-47 111-9 109 10 133C14 85 75 76 96 119C125 96 165 117 163 151C194 158 190 191 153 193H-60Z" fill="#fffdf7" opacity=".85" />
      <path d="M-47 174C-5 167 17 183 57 172C97 162 111 179 154 173" stroke="#e6dbca" strokeWidth="1.3" opacity=".65" />
      <path d="M333 532C326 502 355 481 381 495C385 448 447 445 461 483C492 461 525 488 518 515C552 522 543 558 509 559H347C321 558 312 541 333 532Z" fill="#e4eaf0" opacity=".6" />
      <path d="M348 549Q384 537 421 546Q452 556 490 543" stroke="#cdd8de" strokeWidth="1.3" opacity=".6" />
      <path d="M387 104L390 113L399 116L390 119L387 128L384 119L375 116L384 113Z" fill="#dec7a2" opacity=".6" />
      <circle cx="334" cy="174" r="2.5" fill="#d8c1a2" opacity=".45" /><circle cx="82" cy="418" r="2" fill="#bfcdd1" opacity=".55" />
      <path d="M60 551L62 557L68 559L62 561L60 567L58 561L52 559L58 557Z" fill="#dfc9a8" opacity=".5" />
    </svg> : theme === "night" ? <svg viewBox="0 0 480 700" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M30 344V89Q30 30 89 30H391Q450 30 450 89V344M240 32V343M31 187H449" stroke="#c6aa97" strokeWidth="5" opacity=".43" />
      {mode === "day" ? <circle cx="386" cy="98" r="32" fill="#f3ca78" /> : <path d="M394 67C362 96 382 132 415 127C375 154 340 98 394 67Z" fill="#ffe8a9" /> }
      <path d="M0 0H35Q11 146 47 279Q13 313 0 303Z" fill="#393850" opacity=".65" />
      <path d="M480 0H449Q468 161 438 280Q463 300 480 298Z" fill="#393850" opacity=".6" />
      <path d="M465 438V587H425L438 563H478" stroke="#c0a28e" strokeWidth="2" opacity=".4" />
      <path d="M436 436H489L480 402H445Z" fill="#f0ce8f" opacity=".9" />
      <circle cx="93" cy="133" r="2" fill="#e9d6bd" /><circle cx="285" cy="77" r="2" fill="#e9d6bd" /><path d="M333 210V220M328 215H338" stroke="#c8b7b8" strokeWidth="1.5" />
      <ellipse cx="462" cy="511" rx="81" ry="100" fill="#f9d88e" opacity=".23" />
    </svg> : <svg viewBox="0 0 480 700" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M-30 700Q40 646 19 569Q75 599 69 656Q93 590 140 612Q139 672 93 700Z" fill="#71916b" opacity=".55" />
      <path d="M480 700Q419 658 435 586Q383 608 389 662Q358 631 330 662L355 700Z" fill="#8aa77b" opacity=".6" />
      <path d="M-18 594Q45 547 35 455M25 514Q-14 503-15 469Q20 471 25 514M34 477Q67 460 65 430Q36 434 34 477" stroke="#819b70" strokeWidth="2" fill="#a1b98d" opacity=".9" />
      <path d="M498 185Q440 151 453 78M450 127Q414 123 412 94Q442 92 450 127M452 100Q482 91 486 64Q457 67 452 100" stroke="#80996d" strokeWidth="2" fill="#adc296" opacity=".85" />
      <path d="M421 632Q440 594 465 590M435 612Q407 600 414 578Q439 585 435 612M450 598Q455 570 479 573Q477 593 450 598" stroke="#c7cfb6" strokeWidth="2" fill="#dce4cf" />
      <g transform="translate(65 166) rotate(-15)"><path d="M0 0C-16-15-23 9-2 9C-16 22 11 28 4 8C24 11 24-12 5-3Z" fill="#d39673" opacity=".8" /><path d="M2 0V12" stroke="#baa48c" strokeWidth="1.3" /></g>
      <circle cx="95" cy="349" r="2" fill="#c1cdb0" /><circle cx="373" cy="396" r="2.5" fill="#dfc9ae" />
    </svg>}
  </div>;
}
