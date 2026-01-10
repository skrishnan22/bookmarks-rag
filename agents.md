# Agent Rules

## Mindset & Process

- THINK A LOT PLEASE
- **No breadcrumbs**. If you delete or move code, do not leave a comment in the old place. No "// moved to X", no "relocated". Just remove it.
- **Think hard, do not lose the plot**.
- Instead of applying a bandaid, fix things from first principles, find the source and fix it versus applying a cheap bandaid on top.
- When taking on new work, follow this order:
  1. Think about the architecture.
  2. Research official docs, blogs, or papers on the best architecture.
  3. Review the existing codebase.
  4. Compare the research with the codebase to choose the best fit.
  5. Implement the fix or ask about the tradeoffs the user is willing to make.

- **Search before pivoting**. If you are stuck or uncertain, do a quick web search for official docs or specs, then continue with the current approach. Do not change direction unless asked.
- If code is very confusing or hard to understand:
  1. Try to simplify it.
  1. Add an ASCII art diagram in a code comment if it would help.

## Coding Standards

- Write idiomatic, simple, maintainable code. Always ask yourself if this is the most simple intuitive solution to the problem.
- Follow proper coding standards for the language/framework being used
- Use best practices for the chosen stack (Hono, TypeScript, PostgreSQL, Cloudflare Workers)
- Code should be modular, testable, and well-structured
- Follow design patterns where applicable (Repository pattern for DB, Service layer for business logic, etc.)
- Avoid premature abstraction - start simple, refactor when patterns emerge
- Do not overuse comments. add comments to explain why or how a function works. dont add line level comments unless absolutely necessary. Do not add format or section comments
- Abstractions: Consciously constrained, pragmatically parameterised, doggedly documented.
- Leave each repo better than how you found it. If something is giving a code smell, fix it for the next person.
- Clean up unused code ruthlessly. If a function no longer needs a parameter or a helper is dead, delete it and update the callers instead of letting the junk linger.

## TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer explicit types over `any` - use `unknown` when type is truly unknown
- Use type inference where it improves readability
- Define interfaces for data structures, types for unions/primitives
- Use Zod or similar for runtime validation at API boundaries

## Code Organization

- Keep functions small and focused (single responsibility)
- Co-locate related code (tests next to source, types with implementations)
- Use barrel exports (`index.ts`) sparingly - prefer direct imports for tree-shaking
- Separate concerns: routes, services, repositories, utils

## Error Handling

- Use typed errors with error codes for API responses
- Never swallow errors silently - log or propagate
- Prefer Result types or explicit error returns over thrown exceptions in business logic
- Validate inputs at boundaries, trust data internally

## Testing

- Write tests for business logic and critical paths
- Use descriptive test names that explain the expected behavior
- Prefer integration tests over unit tests for API endpoints
- Mock external services (OpenRouter, Cohere, etc.) in tests

## Performance

- Be mindful of Cloudflare Workers limits (CPU time, memory)
- Use streaming responses where appropriate
- Batch database operations when possible
- Cache expensive computations (embeddings, etc.)

## Security

- Never log sensitive data (API keys, tokens, PII)
- Validate and sanitize all user inputs
- Use parameterized queries exclusively
- Scope all data access by user_id

## Git & Commits

- Write clear, concise commit messages
- One logical change per commit
- Reference issue numbers when applicable
