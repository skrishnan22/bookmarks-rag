import { useState, useEffect, useMemo, Component, type ReactNode } from "react";

class ExcalidrawErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
          <p className="text-sm font-medium text-red-600">
            Failed to load diagram
          </p>
          <p className="text-xs text-zinc-500 text-center max-w-md">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ExcalidrawViewerProps {
  initialData: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInitialData(initialData: Record<string, unknown>) {
  const elements = Array.isArray(initialData.elements)
    ? initialData.elements
    : [];
  const appState = isRecord(initialData.appState) ? initialData.appState : {};
  const files = isRecord(initialData.files) ? initialData.files : {};

  return {
    elements,
    appState,
    files,
    scrollToContent: true,
  };
}

function ExcalidrawInner({ initialData }: ExcalidrawViewerProps) {
  const [ExcalidrawComp, setExcalidrawComp] =
    useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const normalizedInitialData = useMemo(
    () => normalizeInitialData(initialData),
    [initialData]
  );

  useEffect(() => {
    import("@excalidraw/excalidraw")
      .then((mod) => {
        setExcalidrawComp(() => mod.Excalidraw);
      })
      .catch((err) => {
        console.error("Failed to load Excalidraw:", err);
        setLoadError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <p className="text-sm font-medium text-red-600">
          Failed to load diagram
        </p>
        <p className="text-xs text-zinc-500 text-center max-w-md">
          {loadError}
        </p>
      </div>
    );
  }

  if (!ExcalidrawComp) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-mono text-zinc-400 uppercase tracking-widest">
        Loading diagram...
      </div>
    );
  }

  return (
    <ExcalidrawComp
      initialData={normalizedInitialData}
      viewModeEnabled={true}
      theme="light"
      name="Synthesis Diagram"
      UIOptions={{
        canvasActions: {
          changeViewBackgroundColor: false,
          export: false,
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: false,
        },
      }}
    />
  );
}

export function ExcalidrawViewer({ initialData }: ExcalidrawViewerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-[500px] w-full rounded-xl border border-zinc-200 overflow-hidden bg-white">
      {mounted ? (
        <ExcalidrawErrorBoundary>
          <ExcalidrawInner initialData={initialData} />
        </ExcalidrawErrorBoundary>
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-mono text-zinc-400 uppercase tracking-widest">
          Loading diagram...
        </div>
      )}
    </div>
  );
}
