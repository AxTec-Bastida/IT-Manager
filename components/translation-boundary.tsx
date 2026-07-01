"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { translateExactText } from "@/lib/ui-translations";

const ignoredParentSelector = "script,style,code,pre,textarea,svg,[data-no-translate],.notranslate";
const translatedAttribute = "data-ui-translated";

// Transitional bridge for pages that have not moved to server/page dictionaries yet.
// Prefer createTranslator/getLocaleFromCookies for new page work.
function shouldSkip(node: Node) {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest(ignoredParentSelector));
}

function translateTextNode(node: Text, locale: Locale) {
  if (shouldSkip(node)) return;
  const next = translateExactText(node.nodeValue ?? "", locale);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function translateAttributes(element: Element, locale: Locale) {
  if (element.closest(ignoredParentSelector)) return;
  for (const attribute of ["placeholder", "aria-label", "title", "value"]) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = translateExactText(current, locale);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function translateTree(root: ParentNode, locale: Locale) {
  if (locale === "en") return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach((node) => translateTextNode(node, locale));

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));
  elements.forEach((element) => translateAttributes(element, locale));
}

export function TranslationBoundary({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || locale === "en") return;
    translateTree(root, locale);
    root.setAttribute(translatedAttribute, locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale);
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node as Element, locale);
        });
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target as Text, locale);
        }
      }
    });
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div ref={ref} className="contents" lang={locale}>
      {children}
    </div>
  );
}
