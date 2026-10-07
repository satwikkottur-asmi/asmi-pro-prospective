import type { RouteObject } from "react-router";
import { Landing } from "@/components/hoys/landing";
import { JoinPage, NotFound, RootLayout, RouteError } from "@/components/hoys/pages";

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/join", element: <JoinPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
