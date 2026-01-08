interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Searching..." }: LoadingStateProps) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-6 flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />

        <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl bg-zinc-900/50 ring-1 ring-zinc-800/50 backdrop-blur-sm">
          <svg
            className="h-12 w-12 text-indigo-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" className="animate-pulse" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <div className="absolute -top-1 -right-1 animate-bounce delay-100">
            <svg
              className="h-4 w-4 text-purple-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>

          <div className="absolute -bottom-2 -left-2 animate-bounce delay-300">
            <svg
              className="h-3 w-3 text-pink-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
        {message}
      </h3>
    </div>
  );
}
