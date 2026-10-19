// Hand-drawn-ish line icons, 24×24, stroked with currentColor.
import type { ReactElement, SVGProps } from "react";
import type { NoteKind } from "../lib/types";

const paths = {
  pencil: (
    <>
      <path d="M4.2 19.8l1.1-4.3L15.7 5.1a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.5 18.7z" />
      <path d="M13.6 7.2l3.2 3.2M5.3 15.5l3.2 3.2" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M15.6 15.7l4.6 4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 7.2h14.4M9.8 7V4.9h4.4V7M6.9 7.4l.9 12.1h8.4l.9-12.1M10.3 10.8v5.4M13.7 10.8v5.4" />
    </>
  ),
  pin: <path d="M9.2 3.8h5.6l-.9 5 3.1 3.3H7l3.1-3.3zM12 12.1v8.1" />,
  star: <path d="M12 4.3l2.3 4.7 5.1.7-3.7 3.6.9 5.1L12 16l-4.6 2.4.9-5.1-3.7-3.6 5.1-.7z" />,
  book: (
    <>
      <path d="M3.8 6.1c2.8-1.1 5.5-1 8.2.6 2.7-1.6 5.4-1.7 8.2-.6v12.1c-2.8-1-5.5-.9-8.2.6-2.7-1.5-5.4-1.6-8.2-.6z" />
      <path d="M12 6.7v12.1" />
    </>
  ),
  todo: (
    <>
      <rect x="4.4" y="4.6" width="15.2" height="15" rx="3.2" />
      <path d="M8.4 12.4l2.6 2.6 4.8-5.3" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .8-1 1.5v.5M12 16.7v.1" />
    </>
  ),
  formula: <path d="M15.2 4.8h-3.3a2 2 0 0 0-2 1.7L8.1 17.7a2 2 0 0 1-2 1.6H5M6.9 10.9h6.3M14.3 12.2l5 6.2M19.3 12.2l-5 6.2" />,
  dot: <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />,
  leaf: (
    <>
      <path d="M6.3 3.6h11.3a1 1 0 0 1 1 1v14.8a1 1 0 0 1-1 1H6.3a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z" />
      <path d="M10.8 8h5M10.8 12h5M10.8 16h3.2" />
      <circle cx="8" cy="7.4" r=".8" />
      <circle cx="8" cy="12" r=".8" />
      <circle cx="8" cy="16.6" r=".8" />
    </>
  ),
  notebook: (
    <>
      <path d="M6.6 3.6h10.6a1.6 1.6 0 0 1 1.6 1.6v13.6a1.6 1.6 0 0 1-1.6 1.6H6.6z" />
      <path d="M9.4 3.7v16.6M4.5 7.2h3.6M4.5 12h3.6M4.5 16.8h3.6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4.5 7h8.6M17.6 7h1.9M4.5 17h2.4M11.4 17h8.1M4.5 12h3.6M12.6 12h6.9" />
      <circle cx="15.3" cy="7" r="2.1" />
      <circle cx="9.1" cy="17" r="2.1" />
      <circle cx="10.3" cy="12" r="2.1" />
    </>
  ),
  download: <path d="M12 4.2v10.9M7.6 10.7l4.4 4.4 4.4-4.4M5 19.6h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.9" />
      <path d="M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8M5.9 5.9l1.3 1.3M16.8 16.8l1.3 1.3M5.9 18.1l1.3-1.3M16.8 7.2l1.3-1.3" />
    </>
  ),
  moon: <path d="M19.2 14.6a7.4 7.4 0 0 1-9.8-9.8 7.6 7.6 0 1 0 9.8 9.8z" />,
  menu: <path d="M4.2 7.2h15.6M4.2 12h15.6M4.2 16.8h9.8" />,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5.2 12.6l4.4 4.4 9.2-9.6" />,
  arrow: <path d="M4.8 12h14M13.4 6.4l5.6 5.6-5.6 5.6" />,
  enter: <path d="M18.8 5.8v5.1a3 3 0 0 1-3 3H5.6M9.2 10.3l-3.6 3.6 3.6 3.6" />,
  cloud: <path d="M7.4 18.6h9.7a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.3 4.7 4.7 0 0 0 .3 9.3z" />,
  cloudOff: (
    <>
      <path d="M9.6 6.5a5.5 5.5 0 0 1 8.1 4.1 4 4 0 0 1 2.2 6.6M16.5 18.6H7.4a4.7 4.7 0 0 1-1.1-9.2" />
      <path d="M4.2 4.2l15.6 15.6" />
    </>
  ),
  device: (
    <>
      <rect x="6.6" y="3.4" width="10.8" height="17.2" rx="2.2" />
      <path d="M10.8 17.4h2.4" />
    </>
  ),
  file: (
    <>
      <path d="M3.6 13.6l2.6-7h11.6l2.6 7v5.1a.9.9 0 0 1-.9.9H4.5a.9.9 0 0 1-.9-.9z" />
      <path d="M3.8 13.6h4.8l1.1 2.2h4.6l1.1-2.2h4.8" />
      <path d="M12 2.9v7.4M9.6 7.9l2.4 2.4 2.4-2.4" />
    </>
  ),
  nib: (
    <>
      <path d="M12 3.2l5.2 6.4L12 20.8 6.8 9.6z" />
      <path d="M12 11.6v9.2" />
      <circle cx="12" cy="10.1" r="1.2" />
    </>
  ),
  tab: <path d="M3.8 9h5l1.6-3.2h3.2L15.2 9h5v10H3.8z" />,
  merge: <path d="M6.6 4.2v3.7c0 3.4 5.4 4 5.4 8.2v3.7M17.4 4.2v3.7c0 3.4-5.4 4-5.4 8.2" />,
  copy: (
    <>
      <rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2" />
      <path d="M15.6 8.2V6.4a2 2 0 0 0-2-2H6.4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 2 2h1.8" />
    </>
  ),
  logout: <path d="M13.8 4.2h4.6a1 1 0 0 1 1 1v13.6a1 1 0 0 1-1 1h-4.6M9.8 8l-4 4 4 4M5.9 12h9.4" />,
  undo: <path d="M8.8 6.6L4.8 10.6l4 4M5 10.6h9.4a4.8 4.8 0 0 1 0 9.6h-2.2" />,
  eye: (
    <>
      <path d="M2.6 12S6.1 5.6 12 5.6 21.4 12 21.4 12 17.9 18.4 12 18.4 2.6 12 2.6 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  swatch: (
    <>
      <path d="M4.8 4h5v13.6a2.5 2.5 0 0 1-5 0z" />
      <path d="M9.9 8.6l4-4 3.5 3.5-7.4 7.4M9.6 14.2h9.6v5.4H7.4" />
    </>
  ),
  refile: (
    <>
      <path d="M18.8 8.2A7.4 7.4 0 0 0 5.4 9.6M5.2 15.8a7.4 7.4 0 0 0 13.4-1.4" />
      <path d="M19 4.2v4h-4M5 19.8v-4h4" />
    </>
  ),
  chevron: <path d="M9.2 5.8l6 6.2-6 6.2" />,
  back: <path d="M14.8 5.8l-6 6.2 6 6.2" />,
  key: (
    <>
      <circle cx="8" cy="15.6" r="3.6" />
      <path d="M10.6 13l8.6-8.6M16.4 7.2l2.4 2.4M14.2 9.4l1.8 1.8" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

export const KIND_ICON: Record<NoteKind, IconName> = {
  fact: "dot",
  definition: "book",
  exam: "star",
  todo: "todo",
  question: "question",
  formula: "formula",
};

export const KIND_LABEL: Record<NoteKind, string> = {
  fact: "Fact",
  definition: "Definition",
  exam: "On the test",
  todo: "To do",
  question: "Question",
  formula: "Formula",
};
