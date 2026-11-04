import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { loadPublishedCalendarFeed } from "./lib/campaigns";
import "./index.css";

const rootElement = document.getElementById("root")!;

// The calendar feed is read before first render so every page sees the same campaigns.
void loadPublishedCalendarFeed().finally(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
