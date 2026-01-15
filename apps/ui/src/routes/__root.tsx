/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles/globals.css?url";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TabNavigation } from "~/components/layout/TabNavigation";

const ONE_MINUTE_MS = 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_MINUTE_MS,
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "RAG Bookmarks Search",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <TabNavigation />
        </div>
        <div className="pt-20">
          <Outlet />
        </div>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fragment+Mono&family=Nunito:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-zinc-50/50 text-zinc-900 antialiased selection:bg-amber-100 selection:text-amber-900"
        suppressHydrationWarning
      >
        {children}
        <Scripts />
      </body>
    </html>
  );
}
