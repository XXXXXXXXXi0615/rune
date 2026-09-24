/** Purely decorative storybook scene. It never participates in Home layout. */
export function HomeStorybookDecor() {
  return (
    <div className="home-storybook-decor" aria-hidden="true">
      <svg className="hs-scene hs-scene--sky" viewBox="0 0 1200 430" preserveAspectRatio="none" focusable="false">
        <defs>
          <filter id="hs-wobble"><feTurbulence baseFrequency=".018" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>
          <linearGradient id="hs-moon" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff2bd"/><stop offset="1" stopColor="#dfb96f"/></linearGradient>
        </defs>
        <g filter="url(#hs-wobble)" strokeLinecap="round" strokeLinejoin="round">
          <path className="hs-cloud hs-cloud--far" d="M640 95c35-52 92-45 111-5 36-25 84-8 91 28 39-10 72 11 76 42H594c-2-32 17-57 46-65Z"/>
          <path className="hs-cloud" d="M806 55c20-32 57-33 78-8 25-19 64-5 68 27 31-7 58 11 61 37H765c0-29 16-50 41-56Z"/>
          <circle className="hs-moon-disc" cx="1010" cy="95" r="67"/>
          <path className="hs-moon-crater" d="M985 55c22 8 36 28 34 50M1031 68c12 15 14 34 5 50M973 126c22 12 50 9 69-8"/>
          <path className="hs-coast" d="M0 338c105-47 181-24 263-58 83-35 153-18 232 10 91 32 167 10 257-12 96-24 184-8 246 22 66 33 121 22 202-1v131H0Z"/>
          <path className="hs-wave" d="M28 365c90-24 142 18 229-4s144 17 226-3 145 18 235-4 164 15 268-5 151 12 202-2"/>
          <path className="hs-wave hs-wave--two" d="M4 392c79-20 141 13 222-5s148 15 235-2 150 13 234-5 166 15 249-3 163 10 250-5"/>
          <g className="hs-lighthouse" transform="translate(1120 228)"><path d="M-29 104h58l-9-82h-40Z"/><path d="M-23 20h46l-8-17h-30Z"/><path d="M-12 48h24M-9 76H9"/><path className="hs-light" d="M0 12-76-18M0 12 62-25"/></g>
          <g className="hs-boat" transform="translate(730 326) rotate(-3)"><path d="M-36 0h72L22 17h-44Z"/><path d="M0-57V0M2-53l32 39H2Z"/></g>
          <g className="hs-stars"><path d="m886 31 4 9 10 2-8 6 2 10-8-5-9 5 2-10-7-6 10-2Z"/><path d="m1090 40 3 7 7 1-5 5 1 7-6-4-6 4 2-7-6-5 7-1Z"/><circle cx="947" cy="28" r="3"/><circle cx="1062" cy="146" r="2"/></g>
        </g>
      </svg>
      <svg className="hs-scene hs-scene--garden" viewBox="0 0 330 520" focusable="false">
        <g strokeLinecap="round" strokeLinejoin="round">
          <path className="hs-cottage" d="M55 422h142V302L126 235l-71 67Z"/><path className="hs-cottage-roof" d="m34 306 92-89 95 89-22 10-73-67-72 67Z"/><path className="hs-door" d="M105 422v-69c0-19 29-19 29 0v69M157 330h24v29h-24Z"/>
          <path className="hs-path" d="M119 423c-44 22-69 56-76 96h143c-11-45-31-75-67-96Z"/>
          <path className="hs-stem" d="M30 450c10-38 19-66 38-93M210 468c-4-45 3-83 25-116M267 483c-9-43-4-72 17-103"/>
          <g className="hs-leaves"><path d="M48 407c-26-14-28-32-5-36 19 4 18 21 5 36ZM61 381c-7-28 5-41 23-25 9 19-6 27-23 25ZM224 405c-24-15-20-34 3-34 19 8 12 25-3 34ZM238 379c-2-28 14-36 28-16 4 20-12 24-28 16Z"/></g>
          <g className="hs-flowers"><circle cx="27" cy="452" r="7"/><circle cx="72" cy="431" r="6"/><circle cx="211" cy="454" r="7"/><circle cx="281" cy="451" r="6"/></g>
        </g>
      </svg>
    </div>
  );
}
