import { LINK_TAGS } from "@/config";

let entryPath = ""; // path the visitor landed on, before any short-link rewrite

// Short links (LINK_TAGS): /pros → "/" in place (no reload; query + hash kept).
// - Call before the router starts, so it renders the home page
// - The landing path is kept for page_view + attribution, normalized for tags ("/PROS/" → "/pros")
export function applyShortLink() {
  entryPath = window.location.pathname;
  const tag = entryPath.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (LINK_TAGS.includes(tag)) {
    entryPath = `/${tag}`;
    const { search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `/${search}${hash}`);
  }
}

// Landing path; falls back to the current path when applyShortLink() never ran (tests, HMR).
export function getEntryPath() {
  return entryPath || window.location.pathname;
}
