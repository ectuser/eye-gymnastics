import { useEffect, useRef } from 'react';

const BREAK_DUE_BASE_PATH = '/eye-gymnastics/break-due/';
const BREAK_DUE_ICON_MAP: Record<string, string> = {
  'favicon.ico': `${BREAK_DUE_BASE_PATH}favicon.ico`,
  'favicon-16x16.png': `${BREAK_DUE_BASE_PATH}favicon-16x16.png`,
  'favicon-32x32.png': `${BREAK_DUE_BASE_PATH}favicon-32x32.png`,
  'icon-192x192.png': `${BREAK_DUE_BASE_PATH}icon-192x192.png`,
  'icon-512x512.png': `${BREAK_DUE_BASE_PATH}icon-512x512.png`,
  'android-chrome-192x192.png': `${BREAK_DUE_BASE_PATH}android-chrome-192x192.png`,
  'android-chrome-512x512.png': `${BREAK_DUE_BASE_PATH}android-chrome-512x512.png`,
  'apple-touch-icon.png': `${BREAK_DUE_BASE_PATH}apple-touch-icon.png`,
};
const BREAK_DUE_TITLE_SUFFIX = 'Break due';

type FaviconEntry = {
  element: HTMLLinkElement;
  originalHref: string;
  breakHref: string | null;
};

export const useBreakDueFavicon = (breakDue: boolean): void => {
  const iconsRef = useRef<FaviconEntry[] | null>(null);
  const originalTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel*="icon" i]')
    );

    const entries: FaviconEntry[] = links.map((link) => {
      const absoluteUrl = new URL(link.href, document.baseURI);
      const segments = absoluteUrl.pathname.split('/');
      const fileName = segments.pop() ?? '';
      const mappedPath = fileName ? BREAK_DUE_ICON_MAP[fileName] : undefined;
      const breakHref = mappedPath ? new URL(mappedPath, document.baseURI).href : null;

      return {
        element: link,
        originalHref: link.href,
        breakHref,
      } satisfies FaviconEntry;
    });

    iconsRef.current = entries;

    return () => {
      entries.forEach((entry) => {
        entry.element.href = entry.originalHref;
        entry.element.setAttribute('href', entry.originalHref);
      });
      iconsRef.current = null;

      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const entries = iconsRef.current;

    if (!entries || entries.length === 0) {
      return;
    }

    if (!breakDue) {
      entries.forEach((entry) => {
        if (entry.element.href !== entry.originalHref) {
          entry.element.href = entry.originalHref;
          entry.element.setAttribute('href', entry.originalHref);
        }
      });
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      return;
    }

    entries.forEach((entry) => {
      if (!entry.breakHref) {
        return;
      }

      if (entry.element.href !== entry.breakHref) {
        entry.element.href = entry.breakHref;
        entry.element.setAttribute('href', entry.breakHref);
      }
    });

    const baseTitle = originalTitleRef.current ?? document.title;
    document.title = `${BREAK_DUE_TITLE_SUFFIX} — ${baseTitle}`;
  }, [breakDue]);
};
