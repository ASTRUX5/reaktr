// ─── REAKTR · SVG Icon Library ────────────────────────────────────────────────
// All icons are inline SVG — no emojis, no external deps

const Icon = ({ d, size=18, color='currentColor', stroke=false, strokeW=1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke?'none':color}
    stroke={stroke?color:'none'} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const IconMulti = ({ paths, size=18, color='currentColor', stroke=false, strokeW=1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke?'none':color}
    stroke={stroke?color:'none'} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d,i) => <path key={i} d={d}/>)}
  </svg>
);

export const IcHome = ({size,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z",
  "M9 21V12h6v9"
]}/>;

export const IcTrigger = ({size,color}) => <Icon size={size} color={color} stroke strokeW={1.8}
  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>;

export const IcFlow = ({size,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M22 12h-4l-3 9L9 3l-3 9H2"
]}/>;

export const IcAnalytics = ({size,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M18 20V10", "M12 20V4", "M6 20v-6"
]}/>;

export const IcLeads = ({size,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
  "M9 11a4 4 0 100-8 4 4 0 000 8z",
  "M23 21v-2a4 4 0 00-3-3.87",
  "M16 3.13a4 4 0 010 7.75"
]}/>;

export const IcAccount = ({size,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
  "M12 11a4 4 0 100-8 4 4 0 000 8z"
]}/>;

export const IcPlus = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M12 5v14M5 12h14"/>;

export const IcTrash = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M3 6h18", "M19 6l-1 14H6L5 6", "M8 6V4h8v2"
]}/>;

export const IcPause = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={2} paths={[
  "M6 4h4v16H6z", "M14 4h4v16h-4z"
]}/>;

export const IcPlay = ({size=16,color}) => <Icon size={size} color={color}
  d="M5 3l14 9-14 9V3z"/>;

export const IcCheck = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2.5}
  d="M20 6L9 17l-5-5"/>;

export const IcChevronDown = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M6 9l6 6 6-6"/>;

export const IcChevronUp = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M18 15l-6-6-6 6"/>;

export const IcReel = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14",
  "M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
]}/>;

export const IcLink = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71",
  "M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
]}/>;

export const IcMail = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
  "M22 6l-10 7L2 6"
]}/>;

export const IcSignOut = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4",
  "M16 17l5-5-5-5",
  "M21 12H9"
]}/>;

export const IcRefresh = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M23 4v6h-6",
  "M1 20v-6h6",
  "M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
]}/>;

export const IcBroadcast = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
]}/>;

export const IcX = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M18 6L6 18M6 6l12 12"/>;

export const IcArrowUp = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M12 19V5M5 12l7-7 7 7"/>;

export const IcArrowDown = ({size=16,color}) => <Icon size={size} color={color} stroke strokeW={2}
  d="M12 5v14M5 12l7 7 7-7"/>;

export const IcImage = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M21 15a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v8z",
  "M8.5 9.5a1 1 0 100-2 1 1 0 000 2z",
  "M21 15l-5-5L5 21"
]}/>;

export const IcKey = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
]}/>;

export const IcClock = ({size=16,color}) => <IconMulti size={size} color={color} stroke strokeW={1.8} paths={[
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M12 6v6l4 2"
]}/>;
