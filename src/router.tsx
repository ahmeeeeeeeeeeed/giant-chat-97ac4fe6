import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + data as soon as the link is visible — makes taps feel instant
    defaultPreload: "viewport",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 60_000,
    // Suppress the loading flash on fast navigations
    defaultPendingMs: 1200,
    defaultPendingMinMs: 0,
  });


  return router;
};
