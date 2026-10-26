"use client";

import { useEffect, useRef } from "react";

const DISCARD_ALL_EVENT = "piel-canela:discard-unsaved-admin-changes";

export function isSameDocumentNavigation(currentHref: string, destinationHref: string) {
  const current = new URL(currentHref);
  const destination = new URL(destinationHref, current);
  return destination.origin === current.origin
    && destination.pathname === current.pathname
    && destination.search === current.search;
}

export function useUnsavedChangesGuard(
  isDirty: boolean,
  message: string,
  onDiscard?: () => void,
) {
  const dirtyRef = useRef(isDirty);
  const discardRef = useRef(onDiscard);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    discardRef.current = onDiscard;
  }, [onDiscard]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const protectNavigation = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      if (isSameDocumentNavigation(window.location.href, target.href)) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      window.dispatchEvent(new Event(DISCARD_ALL_EVENT));
    };
    const discardAll = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      discardRef.current?.();
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(DISCARD_ALL_EVENT, discardAll);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(DISCARD_ALL_EVENT, discardAll);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [message]);
}
