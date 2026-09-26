import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Billboard Birder",
  description:
    "A field guide to the wild billboards of San Francisco. Photograph a baffling tech billboard and find out, in plain English, what the company actually does.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#efe6cb",
};

/** Shared SVG filter that gives rubber stamps their uneven, inked edges. */
function InkFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <filter id="ink-stamp" x="-10%" y="-20%" width="120%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="11" result="blots" />
        <feColorMatrix in="blots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.6 0 0 0 1.55" result="mask" />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
      {/* A lighter touch for stamps with small lettering. */}
      <filter id="ink-stamp-light" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="3" result="blots" />
        <feColorMatrix in="blots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.1 0 0 0 1.45" result="mask" />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable}`}>
      <body>
        <InkFilters />
        {children}
      </body>
    </html>
  );
}
