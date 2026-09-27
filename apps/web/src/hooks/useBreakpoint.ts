import { useEffect, useState } from "react";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type Orientation = "portrait" | "landscape";

export interface ViewportState {
  breakpoint: Breakpoint;
  isMobile: boolean; // < 768px
  isTablet: boolean; // 768px - 1023px
  isDesktop: boolean; // >= 1024px
  isTouchDevice: boolean;
  orientation: Orientation;
  width: number;
  height: number;
}

const BREAKPOINT_QUERIES = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
  portrait: "(orientation: portrait)",
} as const;

function getBreakpoint(width: number): Breakpoint {
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  if (width >= 640) return "sm";
  return "xs";
}

function getInitialState(): ViewportState {
  if (typeof window === "undefined") {
    return {
      breakpoint: "lg",
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      orientation: "landscape",
      width: 1280,
      height: 800,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const bp = getBreakpoint(width);
  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error msMaxTouchPoints is legacy IE/Edge
    Boolean(navigator.msMaxTouchPoints);

  return {
    breakpoint: bp,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isTouchDevice: isTouch,
    orientation: height >= width ? "portrait" : "landscape",
    width,
    height,
  };
}

/**
 * High-performance, zero-jitter viewport & resolution awareness hook.
 * Uses matchMedia listeners for breakpoint boundaries and debounced
 * dimension sync on window resize.
 */
export function useBreakpoint(): ViewportState {
  const [state, setState] = useState<ViewportState>(getInitialState);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number | null = null;

    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const bp = getBreakpoint(width);
      const isTouch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error msMaxTouchPoints is legacy IE/Edge
        Boolean(navigator.msMaxTouchPoints);

      setState((prev) => {
        // Prevent unnecessary re-renders if core values haven't changed
        if (
          prev.width === width &&
          prev.height === height &&
          prev.breakpoint === bp &&
          prev.orientation === (height >= width ? "portrait" : "landscape")
        ) {
          return prev;
        }

        return {
          breakpoint: bp,
          isMobile: width < 768,
          isTablet: width >= 768 && width < 1024,
          isDesktop: width >= 1024,
          isTouchDevice: isTouch,
          orientation: height >= width ? "portrait" : "landscape",
          width,
          height,
        };
      });
    };

    // Fast media query listeners for crisp breakpoint crossing
    const mediaQueries = Object.values(BREAKPOINT_QUERIES).map((q) =>
      window.matchMedia(q)
    );

    const handleMediaChange = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateState);
    };

    mediaQueries.forEach((mq) => {
      if (mq.addEventListener) {
        mq.addEventListener("change", handleMediaChange);
      } else {
        // Compatibility for older Safari
        mq.addListener(handleMediaChange);
      }
    });

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateState);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, { passive: true });

    // Initial check
    updateState();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      mediaQueries.forEach((mq) => {
        if (mq.removeEventListener) {
          mq.removeEventListener("change", handleMediaChange);
        } else {
          // Compatibility for older Safari
          mq.removeListener(handleMediaChange);
        }
      });
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return state;
}

export default useBreakpoint;
