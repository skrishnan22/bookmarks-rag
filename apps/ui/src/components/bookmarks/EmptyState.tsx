import { cn } from "~/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-zinc-900/50 ring-1 ring-zinc-800/50">
        <svg
          className="h-12 w-12 text-zinc-700"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          <path d="M12 10v6" strokeOpacity="0.5" />
          <path d="M9 13h6" strokeOpacity="0.5" />
        </svg>

        <div className="absolute -right-1 -top-1">
          <svg
            className="h-6 w-6 text-zinc-600"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
          </svg>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-zinc-200">{title}</h3>

      <p className="max-w-sm text-sm text-zinc-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
