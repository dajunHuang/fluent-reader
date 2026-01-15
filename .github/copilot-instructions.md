# Fluent Reader Copilot Instructions

## Architecture Overview
- **Type**: Electron application with React (Renderer) and TypeScript.
- **Process Separation**:
  - **Main Process** (`src/electron.ts`, `src/main/`): Handles window management, native menus, updates, and *configuration persistence* (using `electron-store`).
  - **Renderer Process** (`src/index.tsx`, `src/components/`, `src/containers/`): Handles UI, RSS fetching, parsing, and *content storage*.
- **Data Persistence**:
  - **User Settings**: Stored in JSON via `electron-store` (Main process). Accessed in Renderer via `window.settings` bridge.
  - **Content (Feeds/Articles)**: Stored in IndexedDB using **Lovefield** (Relational DB) inside the Renderer (`src/scripts/db.ts`).
  - **Application State**: Redux with Thunk middleware (`src/scripts/reducer.ts`).

## Code Standards & Patterns

### 1. State Management (Redux)
- **Pattern**: "Ducks-like" modular approach.
- **Location**: Define structure, actions, action creators, and reducers in `src/scripts/models/{modelName}.ts`.
- **Normalization**: State is often normalized `{[id: string]: Entity}` (e.g., `src/scripts/models/item.ts`).
- **Async Logic**: Use Redux Thunks (`AppThunk` type).

### 2. Components
- **Framework**: React (Mix of Class and Functional components).
- **Library**: **Fluent UI** (`@fluentui/react`) is the primary primitive library.
- **Structure**:
  - `src/components/`: Presentational components (dumb).
  - `src/containers/`: Connected components (Redux-aware).
- **Styling**: Uses global CSS / class names constructed in JS (e.g., `src/components/cards/default-card.tsx`). Avoid inline styles where possible; prefer class composition.

### 3. IPC & Bridges
- **Security**: `contextBridge` is used (`src/preload.ts`).
- **APIs**:
  - `window.settings`: For app configuration (proxied to Main).
  - `window.utils`: For OS-level interactions (open external, show errors).
- **Definition**: Bridges are implemented in `src/bridges/` and exposed in `src/preload.ts`.

### 4. Internationalization
- **Library**: `react-intl-universal`.
- **Usage**: Use `intl.get('key')`. Definitions are in `src/scripts/i18n`.

### 5. Database (Lovefield)
- **Schemas**: Defined in `src/scripts/db.ts` (`sourcesDB`, `itemsDB`).
- **Usage**: Direct usage of `lf` queries in models/thunks (e.g., `src/scripts/models/item.ts`).

## Developer Guidelines
- **Build**: `npm run build` (Webpack).
- **Run**: `npm run electron` or `npm start` (Build + Run).
- **Packaging**: `npm run package-win` (uses `electron-builder`).
- **Testing**: No automated test suite present. Verify changes manually.
- **Debugging**: Standard Electron debugging. Set `devtool: "source-map"` in `webpack.config.js` is active for `index.tsx`.
