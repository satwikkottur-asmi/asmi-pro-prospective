// Shared <head> meta for routes: title, description, Open Graph and Twitter card.
const OG_IMAGE = "/og-image.png";

export function pageMeta({ title, description }: { title: string; description: string }) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:image", content: OG_IMAGE },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: OG_IMAGE },
  ];
}
