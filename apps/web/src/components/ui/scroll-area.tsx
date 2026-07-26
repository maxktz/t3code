"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { useEffect, useRef } from "react";

import { cn } from "~/lib/utils";

const SCROLLBAR_HIDE_DELAY_MS = 500;
const MIN_THUMB_SIZE_PX = 24;
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);

type ScrollbarVisibility = "hover" | "scroll";

function ScrollArea({
  className,
  children,
  scrollFade = false,
  scrollbarGutter = false,
  scrollbarVisibility = "hover",
  hideScrollbars = false,
  chainVerticalScroll = false,
  viewportClassName,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
  scrollbarVisibility?: ScrollbarVisibility;
  hideScrollbars?: boolean;
  chainVerticalScroll?: boolean;
  viewportClassName?: string;
}) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative size-full min-h-0 overflow-hidden rounded-[inherit]", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "h-full max-h-[inherit] overflow-auto overscroll-contain rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-x:overscroll-x-contain",
          chainVerticalScroll && "overscroll-y-auto",
          scrollFade &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
          scrollbarGutter && "scrollbar-gutter-stable",
          hideScrollbars &&
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          viewportClassName,
        )}
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {!hideScrollbars && (
        <>
          <ScrollBar orientation="vertical" visibility={scrollbarVisibility} />
          <ScrollBar orientation="horizontal" visibility={scrollbarVisibility} />
          <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
        </>
      )}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  visibility = "hover",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props & {
  visibility?: ScrollbarVisibility;
}) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "app-scrollbar-fade flex opacity-0 data-[orientation=horizontal]:mx-1 data-[orientation=horizontal]:mb-px data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:my-1 data-[orientation=vertical]:mr-px data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col",
        visibility === "hover" && "data-hovering:opacity-100",
        visibility === "scroll" && "data-scrolling:opacity-100",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-[var(--app-scrollbar-thumb)] transition-colors hover:bg-[var(--app-scrollbar-thumb-hover)]"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

function isKeyboardScrollIntent(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || !SCROLL_KEYS.has(event.key)) {
    return false;
  }

  return !(
    event.target instanceof Element &&
    event.target.closest("input, textarea, select, button, [contenteditable]")
  );
}

function AutoHideScrollbar({
  className,
  scrollElement,
}: {
  className?: string;
  scrollElement: HTMLElement | null;
}) {
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;
    const thumb = thumbRef.current;
    if (!scrollElement || !scrollbar || !thumb) {
      return;
    }

    let frame: number | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let userScrollActive = false;

    const updateThumb = () => {
      frame = null;
      const trackHeight = scrollbar.clientHeight;
      const viewportHeight = scrollElement.clientHeight;
      const scrollableHeight = scrollElement.scrollHeight - viewportHeight;
      const hasOverflow = trackHeight > 0 && scrollableHeight > 0;

      scrollbar.dataset.overflow = hasOverflow ? "true" : "false";
      if (!hasOverflow) {
        scrollbar.removeAttribute("data-scrolling");
        return;
      }

      const thumbHeight = Math.min(
        trackHeight,
        Math.max(MIN_THUMB_SIZE_PX, (viewportHeight / scrollElement.scrollHeight) * trackHeight),
      );
      const thumbOffset =
        (scrollElement.scrollTop / scrollableHeight) * Math.max(0, trackHeight - thumbHeight);

      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${thumbOffset}px)`;
    };

    const scheduleUpdate = () => {
      if (frame === null) {
        frame = requestAnimationFrame(updateThumb);
      }
    };

    const scheduleHide = () => {
      if (hideTimeout !== null) {
        clearTimeout(hideTimeout);
      }
      hideTimeout = setTimeout(() => {
        userScrollActive = false;
        scrollbar.removeAttribute("data-scrolling");
        hideTimeout = null;
      }, SCROLLBAR_HIDE_DELAY_MS);
    };

    const revealForUserScroll = () => {
      userScrollActive = true;
      scrollbar.dataset.scrolling = "true";
      scheduleHide();
    };

    const handleScroll = () => {
      scheduleUpdate();
      if (userScrollActive) {
        scheduleHide();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyboardScrollIntent(event)) {
        revealForUserScroll();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = scrollElement.getBoundingClientRect();
      const scrollbarWidth = Math.max(6, scrollElement.offsetWidth - scrollElement.clientWidth);
      if (event.clientX >= rect.right - scrollbarWidth) {
        revealForUserScroll();
      }
    };

    scheduleUpdate();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    scrollElement.addEventListener("wheel", revealForUserScroll, { passive: true });
    scrollElement.addEventListener("touchmove", revealForUserScroll, { passive: true });
    scrollElement.addEventListener("keydown", handleKeyDown);
    scrollElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(scrollElement);
    for (const child of scrollElement.children) {
      resizeObserver.observe(child);
    }

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
      scrollElement.removeEventListener("wheel", revealForUserScroll);
      scrollElement.removeEventListener("touchmove", revealForUserScroll);
      scrollElement.removeEventListener("keydown", handleKeyDown);
      scrollElement.removeEventListener("pointerdown", handlePointerDown);
      resizeObserver.disconnect();
      scrollbar.removeAttribute("data-scrolling");
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      if (hideTimeout !== null) {
        clearTimeout(hideTimeout);
      }
    };
  }, [scrollElement]);

  return (
    <div
      ref={scrollbarRef}
      className={cn(
        "app-scrollbar-fade pointer-events-none invisible absolute inset-y-1 right-px z-30 w-1.5 opacity-0 data-[overflow=true]:visible data-[scrolling=true]:opacity-100",
        className,
      )}
      data-overflow="false"
    >
      <div ref={thumbRef} className="w-full rounded-full bg-[var(--app-scrollbar-thumb)]" />
    </div>
  );
}

export { AutoHideScrollbar, ScrollArea, ScrollBar };
