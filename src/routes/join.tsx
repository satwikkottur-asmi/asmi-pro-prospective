import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/asmi/chrome";
import { SignupFlow } from "@/components/asmi/signup";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: pageMeta({
      title: "Join the Asmi for Pros waitlist",
      description:
        "Join the Asmi waitlist for paid jobs with no lead fees and office help by text or voice.",
    }),
  }),
  component: JoinPage,
});

function JoinPage() {
  return (
    <PageShell className="wrap join-main">
      <div className="obj join-card">
        <SignupFlow />
      </div>
    </PageShell>
  );
}
