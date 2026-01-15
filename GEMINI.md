# GEMINI.md

This file provides a comprehensive overview of the Fluent Reader project, its structure, and how to work with the codebase.

## Project Overview

Fluent Reader is a modern, cross-platform desktop RSS reader built with Electron, React, and TypeScript. It offers a clean user interface inspired by the Fluent Design System and supports various RSS syncing services.

**Key Technologies:**

*   **Framework:** Electron
*   **UI:** React, Fluent UI
*   **State Management:** Redux
*   **Language:** TypeScript
*   **Build Tool:** Webpack
*   **Database:** NeDB and Lovefield (a relational database for web apps)
*   **Packaging:** electron-builder

**Architecture:**

The application follows a standard Electron architecture with a main process and a renderer process.

*   **Main Process (`src/electron.ts`):** Handles application lifecycle, window creation, native OS integration (like menus and notifications), and background tasks.
*   **Renderer Process (`src/index.tsx`):** The user interface of the application, built with React and Redux. It runs in a Chromium window.
*   **Preload Script (`src/preload.ts`):** A script that runs in a privileged context before the renderer process. It is used to expose a limited set of Node.js and Electron APIs to the renderer process in a secure way.
*   **Build Process:** Webpack is used to bundle the TypeScript code for both the main and renderer processes into JavaScript that can be executed by Electron.

## Building and Running

### Prerequisites

*   Node.js and npm

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

To run the application in development mode:

1.  Build the application:
    ```bash
    npm run build
    ```
2.  Start the Electron application:
    ```bash
    npm run electron
    ```

Alternatively, you can use the `start` script to perform both steps:

```bash
npm start
```

### Packaging

To package the application for your current platform, use the scripts defined in `package.json`. For example:

*   **Windows:**
    ```bash
    npm run package-win
    ```
*   **macOS:**
    ```bash
    npm run package-mac
    ```
*   **Linux:**
    ```bash
    npm run package-linux
    ```

The packaging configuration is managed in `electron-builder.yml`.

## Development Conventions

*   **Code Style:** The project uses Prettier for automated code formatting. To format your code, run:
    ```bash
    npm run format
    ```
*   **Typing:** The project is written in TypeScript, and type safety is enforced.
*   **Internationalization (i18n):** Text strings are managed in JSON files located in `src/scripts/i18n`. The project uses `react-intl-universal` for handling translations.
*   **State Management:** The UI state is managed by Redux. Reducers, actions, and the store are defined in `src/scripts/`.
*   **Component Structure:** React components are organized into `src/components/` and `src/containers/`. Container components are connected to the Redux store and handle data flow, while presentational components are responsible for rendering the UI.
