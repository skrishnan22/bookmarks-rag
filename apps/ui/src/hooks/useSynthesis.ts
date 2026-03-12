import { useMutation } from "@tanstack/react-query";
import { createSynthesisRun } from "~/lib/api";

interface SynthesisMutationParams {
  query: string;
  version?: number;
}

export function useSynthesis() {
  return useMutation({
    mutationFn: ({ query, version = 2 }: SynthesisMutationParams) =>
      createSynthesisRun(query, version),
  });
}
