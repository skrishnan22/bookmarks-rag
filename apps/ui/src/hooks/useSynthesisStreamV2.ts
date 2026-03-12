import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentSpec, ThemeName, SynthesisRunPhase } from "@rag-bookmarks/shared";

interface UseSynthesisStreamOptions {
  runId: string | null;
  enabled?: boolean;
  initialComponents?: ComponentSpec[];
  apiBaseUrl?: string;
}

interface SynthesisStreamState {
  components: ComponentSpec[];
  phase: SynthesisRunPhase;
  progress: number;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
}

interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Hook to consume SSE stream of synthesis components.
 * Automatically reconnects with fromIndex to resume.
 */
export function useSynthesisStreamV2(options: UseSynthesisStreamOptions) {
  const { runId, enabled = true, initialComponents = [], apiBaseUrl = "" } = options;

  const [state, setState] = useState<SynthesisStreamState>({
    components: initialComponents,
    phase: "queued",
    progress: 0,
    isStreaming: false,
    isComplete: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const componentIndexRef = useRef(initialComponents.length);

  // Close existing connection
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Start streaming
  const startStream = useCallback(() => {
    if (!runId || !enabled) {
      return;
    }

    closeConnection();

    const fromIndex = componentIndexRef.current;
    const url = `${apiBaseUrl}/api/v1/synthesis/${runId}/stream?fromIndex=${fromIndex}`;

    setState((prev) => ({ ...prev, isStreaming: true, error: null }));

    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("component", (event) => {
      try {
        const data = JSON.parse(event.data) as { index: number; component: ComponentSpec };
        setState((prev) => ({
          ...prev,
          components: [...prev.components, data.component],
        }));
        componentIndexRef.current = data.index + 1;
      } catch (error) {
        console.error("Failed to parse component event:", error);
      }
    });

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data) as { phase: SynthesisRunPhase; progress: number };
        setState((prev) => ({
          ...prev,
          phase: data.phase,
          progress: data.progress,
        }));
      } catch (error) {
        console.error("Failed to parse progress event:", error);
      }
    });

    eventSource.addEventListener("complete", (event) => {
      try {
        const data = JSON.parse(event.data) as { totalComponents: number };
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
          phase: "complete",
          progress: 100,
        }));
        closeConnection();
      } catch (error) {
        console.error("Failed to parse complete event:", error);
      }
    });

    eventSource.addEventListener("error", (event) => {
      // Check if it's an SSE error event with data
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data) as { code: string; message: string };
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: data.message,
          }));
        } catch {
          // Not a parseable error
        }
      }
      closeConnection();
    });

    eventSource.addEventListener("timeout", () => {
      // Reconnect after timeout
      closeConnection();
      if (!state.isComplete) {
        setTimeout(startStream, 1000);
      }
    });

    eventSource.onerror = () => {
      // Generic error handling - might be network issue
      closeConnection();
      setState((prev) => ({
        ...prev,
        isStreaming: false,
      }));
    };
  }, [runId, enabled, apiBaseUrl, closeConnection, state.isComplete]);

  // Effect to manage stream lifecycle
  useEffect(() => {
    if (runId && enabled && !state.isComplete) {
      startStream();
    }

    return () => {
      closeConnection();
    };
  }, [runId, enabled, state.isComplete, startStream, closeConnection]);

  // Reset state when runId changes
  useEffect(() => {
    if (runId) {
      componentIndexRef.current = 0;
      setState({
        components: [],
        phase: "queued",
        progress: 0,
        isStreaming: false,
        isComplete: false,
        error: null,
      });
    }
  }, [runId]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
    startStream();
  }, [startStream]);

  return {
    ...state,
    retry,
  };
}
