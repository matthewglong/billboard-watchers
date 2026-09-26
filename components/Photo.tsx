"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/* eslint-disable @next/next/no-img-element -- user photos are blob: URLs */

// Two overlapping lenses. Their shared outline is traced with two arcs that
// meet where the circles intersect (x = 150, y = 100 ± 74.9).
const LENS_R = 84;
const UNION_OUTLINE = "M150 25.1 A84 84 0 1 0 150 174.9 A84 84 0 1 0 150 25.1 Z";

/** The photo seen through binoculars: sharp inside two lenses, blurred outside. */
export function Viewfinder({ src }: { src: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="viewfinder" aria-hidden="true">
      {src && <img src={src} alt="" className="viewfinder-blur" />}
      <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`${id}-soft`}>
            <stop offset="0.9" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-vignette`}>
            <stop offset="0.8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.28" />
          </radialGradient>
          <mask id={`${id}-lenses`}>
            <rect width="300" height="200" fill="#000" />
            <g className="lens-drift">
              <circle cx="112" cy="100" r={LENS_R} fill={`url(#${id}-soft)`} />
              <circle cx="188" cy="100" r={LENS_R} fill={`url(#${id}-soft)`} />
            </g>
          </mask>
        </defs>
        {src ? (
          <image href={src} width="300" height="200" preserveAspectRatio="xMidYMid slice" mask={`url(#${id}-lenses)`} />
        ) : (
          <rect width="300" height="200" fill="#2a332d" mask={`url(#${id}-lenses)`} />
        )}
        <g className="lens-drift">
          <circle cx="112" cy="100" r={LENS_R} fill={`url(#${id}-vignette)`} />
          <circle cx="188" cy="100" r={LENS_R} fill={`url(#${id}-vignette)`} />
          <path d={UNION_OUTLINE} fill="none" stroke="rgb(8 12 10 / 0.7)" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
}

/** A field photo mounted in the notebook with two strips of tape. */
export function MountedPhoto({
  src,
  alt,
  tilt = -1.2,
  children,
}: {
  src: string;
  alt: string;
  tilt?: number;
  children?: ReactNode;
}) {
  return (
    <figure className="mount mx-auto w-[calc(100%-1rem)]" style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="tape tape-tl" aria-hidden="true" />
      <span className="tape tape-tr" aria-hidden="true" />
      {src ? (
        <img src={src} alt={alt} className="block max-h-[17rem] w-full object-cover" />
      ) : (
        <div className="grid h-40 place-items-center bg-paper-deep/60 text-pencil italic">No photograph</div>
      )}
      {children}
    </figure>
  );
}

/** Rotates through narrator lines every 2.5 seconds while the agents work. */
export function NarratorTicker({ lines }: { lines: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(timer);
  }, []);
  const line = lines[tick % lines.length];
  return (
    <p
      key={tick}
      className="fade-in font-display min-h-[3.2em] px-2 text-center text-[1.08rem] italic leading-snug text-ink-soft"
      aria-hidden="true"
    >
      {line}
    </p>
  );
}

/** An image that quietly removes itself if it fails to load. */
export function SafeImage({
  src,
  alt,
  className,
  onFail,
}: {
  src: string;
  alt: string;
  className?: string;
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
    />
  );
}
