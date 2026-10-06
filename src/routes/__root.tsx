import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { AppProvider } from "@/lib/app-context";
import appCss from "../styles.css?url";

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

function NotFoundComponent() {
  return (
    <StatusPage title="404" body="This page does not exist.">
      <Link to="/" className="btn-2 lime">
        Go home
      </Link>
    </StatusPage>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => console.error(error), [error]);
  return (
    <StatusPage title="This page did not load" body="Try refreshing, or head back home.">
      <button
        type="button"
        className="btn-2 lime"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
      <a href="/" className="btn-2">
        Go home
      </a>
    </StatusPage>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FFF9E8" },
      { name: "author", content: "Humint Labs, Inc." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Overpass+Mono:wght@500;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const search = useRouterState({ select: (s) => s.location.search }) as Record<
    string,
    string | undefined
  >;
  const norm = Object.fromEntries(
    Object.entries(search).map(([k, v]) => [k, v == null ? undefined : String(v)]),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider search={norm}>
        <Outlet />
      </AppProvider>
    </QueryClientProvider>
  );
}
