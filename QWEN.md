# ycc

## Project Overview

**ycc** is a terminal-based AI chat application built with **Bun**, **React**, and **Ink** (React for CLI). It provides an interactive command-line interface where users can converse with an AI model (OpenAI-compatible) and execute built-in slash commands.

### Key Features
- **AI Chat Interface**: Stream responses from an OpenAI-compatible API directly in the terminal
- **Slash Commands**: Extensible command system (`/clear`, `/exit`, `/status`)
- **Conversation History**: Maintains full conversation context for multi-turn AI interactions
- **Component-based UI**: Built with Ink (React components for terminal)

### Tech Stack
- **Runtime**: Bun (v1.3.11+)
- **UI Framework**: React 19 + Ink 6 (terminal UI components)
- **AI Integration**: Vercel AI SDK (`ai`) + `@ai-sdk/openai`
- **CLI Framework**: Commander.js
- **Language**: TypeScript (ESNext, strict mode)
- **Package Manager**: pnpm (configured via `packageManager` field)

## Project Structure

```
src/
├── index.tsx          # Entry point - renders the App
├── App.tsx            # Main application component (state management, AI streaming)
├── types.ts           # Message type definition
├── components/        # React UI components
│   ├── ChatArea.tsx   # Displays conversation history
│   ├── CommandInput.tsx # Input field for user messages
│   └── Welcome.tsx    # Welcome screen
├── commands/          # Slash command implementations
│   ├── index.ts       # Command registry
│   ├── clear/         # /clear command
│   ├── exit/          # /exit command
│   └── status/        # /status command
├── stu/               # Build scripts and utilities
│   ├── build.ts       # Build entry point
│   ├── build2.ts
│   └── secret-tool.ts
├── types/             # TypeScript type definitions
│   └── command.ts     # Command interface
└── utils/             # Utility functions (currently empty)
```

## Building and Running

### Prerequisites
- Bun v1.3.11 or later
- Environment variables for AI:
  - `AI_API_KEY`: OpenAI-compatible API key
  - `AI_BASE_URL`: API base URL

### Commands

```bash
# Install dependencies
bun install

# Run the application
bun run src/index.tsx

# Build (outputs to ./out)
bun run build
```

## Development Conventions

- **TypeScript**: Strict mode enabled with ESNext target
- **JSX**: Uses `react-jsx` transform
- **Module System**: ESM with bundler-style resolution
- **Code Style**: Strict type checking, no unused locals/parameters enforcement disabled
- **Command Pattern**: New slash commands should be added to `src/commands/` following the `Command` interface in `src/types/command.ts`

## Architecture Notes

- The app uses **Ink** for rendering React components in the terminal
- AI streaming is handled via Vercel AI SDK's `streamText` function
- Conversation history is maintained in React state for context-aware AI responses
- Commands are registered via a Map-based registry system supporting aliases
- The `openspec/` directory contains configuration for an experimental spec-driven workflow
