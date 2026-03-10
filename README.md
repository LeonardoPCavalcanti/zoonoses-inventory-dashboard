# Zoonoses Inventory Dashboard

Frontend application for the zoonosis control center inventory management system. Built with React 18 and TypeScript, using Vite as the build tool and TailwindCSS with Radix UI primitives for the component layer.

---

## Tech Stack

| Category | Technology / Version |
|----------|---------------------|
| Language | TypeScript 5.5 |
| Framework | React 18.3 |
| Build Tool | Vite 5.4 + SWC (via `@vitejs/plugin-react-swc`) |
| Styling | TailwindCSS 3.4 + `tailwindcss-animate` |
| Component Library | Radix UI (headless, unstyled primitives) |
| Routing | React Router DOM 6.26 |
| Server State | TanStack Query (React Query) 5.56 |
| Forms | React Hook Form 7.53 + Zod 3.23 (schema validation) |
| Charts | Recharts 2.12 |
| HTTP Client | Axios (via services layer) |
| Linting | ESLint 9 + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` |
| Containerization | Docker + Nginx |

---

## Architecture

```
src/
├── components/     # Reusable UI components (Radix UI + Tailwind wrappers and custom components)
├── context/        # React Context providers (e.g., authentication state)
├── hooks/          # Custom React hooks (data fetching, form logic)
├── lib/            # Utility functions (cn() for class merging, date helpers)
├── pages/          # Route-level page components (one per route)
├── services/       # API client functions (Axios calls to the backend)
├── types/          # TypeScript type and interface definitions
├── App.tsx         # Root component, router setup
├── main.tsx        # Entry point, React DOM render
└── index.css       # Global styles, Tailwind directives
```

**State management pattern:**
- **Server state** (API data): TanStack Query handles caching, refetching, loading/error states.
- **Global client state** (auth session): React Context.
- **Form state**: React Hook Form with Zod schemas for validation.
- **UI state**: Local `useState` within components.

---

## Prerequisites

- Node.js 18+
- The backend API must be running (see `zoonoses-inventory-api` or `zoonoses-inventory-system`)

---

## Running Locally

```bash
npm install

# Start development server (Vite HMR)
npm run dev
```

Application available at `http://localhost:8080`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server with Hot Module Replacement |
| `npm run build` | Compile TypeScript and bundle for production |
| `npm run build:dev` | Production bundle in development mode (unminified) |
| `npm run lint` | Run ESLint across all source files |
| `npm run preview` | Serve the production build locally for verification |

---

## Production Build

```bash
npm run build
# Output: dist/
```

The `dist/` folder is a static bundle served by Nginx in the Docker container.

---

## Docker

```bash
docker build -t zoonoses-dashboard .
docker run -p 3000:80 zoonoses-dashboard
```

The Nginx configuration (`nginx.conf`) is included in the repository. For the full integrated stack, use the `zoonoses-inventory-system` project.
