import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

const rootElement = document;

startTransition(() => {
  hydrateRoot(
    rootElement,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
