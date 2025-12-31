# Agent Rules

## Coding Standards

- Follow proper coding standards for the language/framework being used
- Use best practices for the chosen stack (Hono, TypeScript, PostgreSQL, Cloudflare Workers)
- Code should be modular, testable, and well-structured
- Follow design patterns where applicable (Repository pattern for DB, Service layer for business logic, etc.)
- Avoid premature abstraction - start simple, refactor when patterns emerge

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
