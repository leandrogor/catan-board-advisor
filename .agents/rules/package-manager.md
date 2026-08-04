# Package Manager & Testing Rules

## Package Manager

- **Always use `pnpm`** instead of `npm` for all package management commands, scripts, and package installations in this project.
  - Example: `pnpm install`, `pnpm run <script>`, `pnpm test:ci`.

## Running Unit Tests

- **Always run unit tests using `pnpm test:ci`** instead of `npm test -- --watch=false` or `ng test`.
- `pnpm test:ci` executes `ng test --watch=false` in single-run mode.
