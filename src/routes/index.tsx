import { createFileRoute } from "@tanstack/react-router";
import heroBase from "@/assets/scene-hero3-base.webp";
import { Landing } from "@/components/asmi/landing";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: pageMeta({
      title: "Asmi for Pros: same hours, more paid jobs",
      description:
        "Paid jobs with no lead fees, plus help with office work by text or voice in 30+ languages for home service pros.",
    }),
    links: [{ rel: "preload", as: "image", href: heroBase, fetchPriority: "high" }],
  }),
  component: Landing,
});
