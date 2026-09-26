"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A bottom sheet dialog: tap the backdrop, press Escape, or swipe down to close.

export function BottomSheet({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheet.current) return;
      // Keep focus inside the sheet.
      const focusable = sheet.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((sheet.current?.scrollTop ?? 0) > 0) return;
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    if (!drag.current || !sheet.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 90) onClose();
    else sheet.current.style.transform = "";
  };

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="sheet focus:outline-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-pencil/30" aria-hidden="true" />
        {children}
      </div>
    </>,
    document.body,
  );
}
