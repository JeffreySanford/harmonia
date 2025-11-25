# Harmonia Coding Standards

## General Principles
- Write clean, readable, and maintainable code.
- Prefer composition over inheritance.
- Use consistent naming conventions and file structures.

## Backend (Node.js/NestJS)
- Use RxJS hot observables for async operations; avoid using async/Promise unless absolutely necessary.
- Always handle errors and edge cases gracefully.
- Use dependency injection for services and modules.
- Organize code by feature modules.

## Frontend (Angular)
- Do **not** use Angular standalone components; set `standalone: false` for all components and modules.
- Use RxJS hot observables for all asynchronous operations and API calls.
- Avoid using async/Promise in Angular services and components.
- Use Angular modules for feature organization and lazy loading.
- Use strict typing and interfaces for all data models.
- Prefer OnPush change detection for performance.

## Python Services
- Follow PEP8 style guidelines.
- Use type hints where possible.
- Organize code into logical modules and packages.
- Document all public functions and classes.

## Documentation & Comments
- Write clear docstrings and comments for complex logic.
- Document API endpoints and data contracts.
- Keep documentation up to date with code changes.

## Testing
- Write unit and integration tests for all features.
- Use mocks and stubs for external dependencies.
- Ensure tests are fast, reliable, and repeatable.

---
**Note:** These standards are mandatory for all Harmonia contributors. Please review and follow them for every commit and pull request.