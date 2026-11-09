/**
 * src/ui/selectors.ts — The few web-app selectors the ui-mocked tests rely on.
 * Source: ai-playwright-agent/application/o2-de/config.ts @ R_26.10.100. Update here only.
 */
export const ui = {
  /** Header avatar: present whenever the app shell rendered (logged in). */
  appShell: 'button[id*="header-dropdown-trigger-"]',
  /** Any content card linking to a detail page. */
  detailLink: 'a[href*="/details/"]',
  liveDetailLink: 'a[href*="/details/live"]',
  /** Places a content title can be rendered in (text, alt, aria-label, title). */
  titleCarrying: (marker: string) =>
    `:text("${marker}"), img[alt*="${marker}"], [aria-label*="${marker}"], [title*="${marker}"]`,
};
