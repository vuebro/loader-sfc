# Vue SFC Loader Project

## Project Overview

The Vue SFC Loader (`@vuebro/loader-sfc`) is a lightweight library that enables loading Vue 3 Single File Components (.vue files) directly in the browser at runtime without requiring a build step. This allows for dynamic component loading and compilation in browser environments, making it useful for scenarios where you need to load components dynamically.

**Key Features:**
- Load Vue 3 SFCs directly in the browser at runtime
- No build step required - perfect for dynamic component loading
- Supports TypeScript and JSX
- Lightweight and efficient
- Compatible with Vue's `defineAsyncComponent`

**Project Structure:**
- `src/loader-sfc.ts` - Main implementation file containing the core functionality
- `dist/` - Output directory for compiled code
- Configuration files: `tsconfig.json`, `vite.config.ts`, `eslint.config.ts`
- `package.json` - Defines dependencies and build scripts

## Building and Running

**Prerequisites:**
- Node.js and npm/yarn/pnpm
- Vue 3.x
- Modern browser that supports ES modules and dynamic imports

**Commands:**
- `npm run build` - Compiles TypeScript and bundles the library using Vite
- `npm run lint` - Lints the code using ESLint

**Build Process:**
- The project uses Vite for building and Rollup for bundling
- Output is an ES module in the `dist/` directory
- The build process includes terser for minification
- Vue is marked as an external dependency

## Core Functionality

The main export is an async function `loadModule(filename, options)` that:
1. Fetches the .vue file content via HTTP request
2. Parses the SFC using Vue's compiler-sfc
3. Compiles the script, template, and style sections
4. Handles TypeScript and JSX transformations using sucrase
5. Injects styles into the document head
6. Returns a compiled Vue component object

## Development Conventions

- Written in TypeScript with strict typing
- Uses ESM (ES modules) format
- Follows Vue 3 composition API patterns
- Leverages Vue's compiler-sfc for parsing and compilation
- Uses sucrase for TypeScript/JSX transformations
- Includes error handling with consola for logging
- Uses ofetch for HTTP requests
- Uses hash-sum for generating unique style IDs

## Key Dependencies

- `vue` - Vue 3 runtime and compiler-sfc
- `sucrase` - Fast JavaScript/TypeScript transpiler
- `ofetch` - HTTP client for fetching files
- `hash-sum` - For generating unique identifiers
- `consola` - Console logging utility
- `@babel/parser` - For expression parsing (via compiler options)

## Architecture

1. **Fetching**: Uses `ofetch` to retrieve .vue file content
2. **Parsing**: Uses Vue's `parse` function to break down the SFC
3. **Compilation**: Uses Vue's `compileScript`, `compileTemplate`, and `compileStyleAsync`
4. **Transformation**: Uses `sucrase` for TypeScript/JSX transformations
5. **Injection**: Creates object URLs for dynamic imports and injects styles into the document head

## API

### `loadModule(filename: string, options?: LoadModuleOptions)`
Loads and compiles a Vue SFC file at runtime.

**Parameters:**
- `filename` (string): Path to the .vue file to load
- `options` (LoadModuleOptions, optional): Configuration options for compilation

**Options:**
- `scriptOptions`: Options for script compilation
- `parseOptions`: Options for SFC parsing
- `styleOptions`: Options for style compilation

**Performance Considerations:**
- First load of a component will be slower as it needs to fetch and compile the SFC
- Subsequent loads of the same component will be faster due to browser caching
- Styles are injected into the document once per component and cached by a hash of the filename