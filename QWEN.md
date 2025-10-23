# Vue SFC Loader - Project Context

## Project Overview

This is a Vue Single File Component (SFC) loader that enables loading .vue files directly in the browser without any build step. The project allows for dynamic loading and compilation of Vue 3 Single File Components during application runtime in the browser.

**Project Name:** @vuebro/loader-sfc
**Version:** 2.3.10
**License:** AGPL-3.0-only

### Key Features:
- Load .vue files directly in the browser
- Dynamic compilation of SFCs at runtime
- Works with Vue 3
- No build step required
- Supports TypeScript and JSX

### Core Files:
- `src/loader-sfc.ts` - Main implementation file with the loadModule function
- `vite.config.ts` - Build configuration using Vite
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and build scripts

## Technologies Used

- Vue.js 3.5.22 (runtime dependency)
- TypeScript
- Vite (build tool)
- Sucrase (for TypeScript/JSX transpilation)
- Consola (for logging)
- Hash-sum (for generating unique identifiers)

## Building and Running

### Build Commands:
- `npm run build` - Compiles TypeScript and bundles the library using Vite
- `npm run lint` - Runs ESLint for code quality checking

### Project Structure:
- `src/loader-sfc.ts` - Main source file with the core loading and compilation logic
- `dist/` - Output directory for built files
- `node_modules/` - Project dependencies

## Core Functionality

The main functionality is in `src/loader-sfc.ts`, which exports a default async function (`loadModule`) that:
1. Fetches a .vue file by URL
2. Parses the SFC using Vue's compiler-sfc
3. Compiles the script, template, and style sections
4. Transforms TypeScript/JSX using Sucrase
5. Injects styles into the document
6. Returns the compiled component that can be used with Vue's defineAsyncComponent

## Development Conventions

- Uses TypeScript strict typing
- Follows ES Module syntax (package.json "type": "module")
- Uses Prettier formatting as defined in @vuebro/configs/prettierrc
- Imports external libraries via ES modules
- Uses a functional approach without classes
- Uses consola for logging errors, warnings, and info messages

## Key Dependencies

### Production Dependencies:
- vue: ^3.5.22 - Vue.js framework
- consola: ^3.4.2 - Console logging utility
- hash-sum: ^2.0.0 - For generating unique identifiers
- sucrase: ^3.35.0 - JavaScript/TypeScript transpiler

### Development Dependencies:
- @rollup/plugin-terser: ^0.4.4 - For code minification
- @types/hash-sum: ^1.0.2 - TypeScript definitions for hash-sum
- @types/node: ^24.9.1 - TypeScript definitions for Node.js
- @vuebro/configs: ^1.1.34 - Shared configurations

The library is compiled as an ES module with filename "loader-sfc.esm-browser.prod" and is externalized from the build (meaning Vue is not bundled with it).