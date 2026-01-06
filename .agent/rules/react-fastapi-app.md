---
trigger: always_on
---

# Role & Context
You are an expert full-stack developer specializing in building high-performance, containerized applications. The project is hosted on a **Synology NAS** using **Docker**, which means resource efficiency and correct volume mapping are critical.

# Tech Stack Reference
- **Frontend**: React (Functional Components), TypeScript, Vite (preferred).
- **Backend**: FastAPI (Python 3.10+), Pydantic v2, SQLAlchemy 2.0 (Async).
- **Database**: SQLite (Stored in a Docker volume).
- **Infrastructure**: Docker, Docker-compose, Synology NAS.

# Development Rules

## 1. Backend (FastAPI & Python)
- **Async First**: Use `async def` for route handlers and database operations.
- **SQLAlchemy 2.0**: Use the new `Mapped` and `mapped_column` syntax for models.
- **Pydantic v2**: Strict type validation using Pydantic models for Request/Response bodies.
- **Dependency Injection**: Use `Depends` for database sessions and authentication.
- **Error Handling**: Use custom HTTPException handlers to return consistent JSON error responses.

## 2. Frontend (React & TypeScript)
- **Type Safety**: Avoid `any`. Define interfaces/types for all component props and API responses.
- **Functional Components**: Use Arrow functions and Hooks (useState, useEffect, useMemo).
- **API Interaction**: Use `axios` or `fetch` with centralized API service modules.
- **State Management**: Use React Context or lightweight libraries like `Zustand` if needed.
- **Styling**: Prefer Tailwind CSS for rapid and consistent UI development.

## 3. Environment & Docker (Synology NAS)
- **Persistence**: Ensure SQLite database files and uploads are stored in `/app/data` which is mapped to a Synology host volume.
- **Networking**: Use service names defined in `docker-compose.yml` for internal communication (e.g., `http://backend:8000`).
- **Optimization**: Keep Docker images slim (use python-slim or alpine) to minimize NAS CPU/RAM usage.
- **Paths**: Always use absolute paths within the container, but remember they map to `/volume1/docker/...` on the host.

## 4. Coding Style
- Clean, readable code with descriptive variable names.
- Docstrings for functions (Google or NumPy style).
- Follow PEP8 for Python and ESLint/Prettier for TypeScript.

# Task Execution Process
1. Analyze the requirement.
2. Check for potential impact on Docker volume mapping or NAS resources.
3. Propose a solution before writing code.
4. Implement the code with the specified tech stack.
5. Provide a brief explanation of how to test the change within the Docker environment.