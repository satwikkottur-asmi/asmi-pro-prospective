import { type ReactNode, useEffect } from "react";
import { Link, Outlet, ScrollRestoration, useRouteError, useSearchParams } from "react-router";
import { AppProvider } from "@/lib/app-context";
import { PageShell } from "./chrome";
import { SignupFlow } from "./signup";

// App shell: URL params (v, src, lang, city) feed the app context for every page.
export function RootLayout() {
  const [params] = useSearchParams();
  return (
    <AppProvider search={Object.fromEntries(params)}>
      <Outlet />
      <ScrollRestoration />
    </AppProvider>
  );
}

export function JoinPage() {
  return (
    <PageShell className="wrap join-main">
      <div className="obj join-card">
        <SignupFlow />
      </div>
    </PageShell>
  );
}

// Centered full-screen message used by the 404 and error boundaries.
function StatusPage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="status-page">
      <div>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="status-actions">{children}</div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <StatusPage title="404" body="This page does not exist.">
      <Link to="/" className="btn-2 lime">
        Go home
      </Link>
    </StatusPage>
  );
}

// Rendered outside RootLayout, so it must not depend on the app context.
export function RouteError() {
  const error = useRouteError();
  useEffect(() => console.error(error), [error]);
  return (
    <StatusPage title="This page did not load" body="Try refreshing, or head back home.">
      <button type="button" className="btn-2 lime" onClick={() => window.location.reload()}>
        Try again
      </button>
      <a href="/" className="btn-2">
        Go home
      </a>
    </StatusPage>
  );
}
