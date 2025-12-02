# Harmonia — Setup & Workflow

This file contains step-by-step instructions to close VS Code, move into the repository directory, and run the initial setup. Keep this file if Copilot or VS Code restarts.

## Quick overview

- Close VS Code (so you can reopen the folder cleanly).
- Open a Bash terminal (WSL or Git Bash depending on your setup).
- Change directory into the repository (`c:\repos\harmonia`).
- Make helper scripts executable and perform initial install/build steps.
- Optional: initialize git and create the initial commit.
- Optional: build and run the Docker environment.

---

## 1) Close VS Code

- Use the UI: `File` → `Exit` (or close the window).
- Or press `Alt+F4` on the VS Code window.

When VS Code is closed you can run commands in a separate terminal without file locks.

---

## 2) Open a Bash terminal and move into the repo

Depending on which Bash you use on Windows 11, choose one of the following commands.

- WSL (recommended when using Docker Desktop WSL backend):

```bash
# inside WSL
cd /mnt/c/repos/harmonia
```

- Git for Windows / Git Bash (msys):

```bash
# inside Git Bash
cd /c/repos/harmonia
```

- If you're running `bash.exe` from Windows directly (Git Bash or other), the same `/c/` path usually works:

```bash
cd /c/repos/harmonia
```

If you want to use PowerShell instead, run:

```powershell
cd C:\repos\harmonia
```

---

## 3) Make scripts executable (if using Bash/WSL)

```bash
chmod +x scripts/*.sh
```

(This step is not required on Windows if you run scripts via `bash scripts/...`.)

---

## 4) Initialize git (recommended)

```bash
git init
git add .
git commit -m "chore: initial scaffold for harmonia"
```

If you intend to push to a remote repository, add the remote and push.

---

## 5) Install dependencies and run TypeScript build

If you're using Node in the container or locally, run:

```bash
npm install
npm run build
npm start    # runs the compiled dist/index.js
```

For development with TypeScript runtime:

```bash
npm run dev
```

---

## 6) Docker (build and run dev container)

Use the scripts included in `scripts/` for convenience or run Docker Compose.

- Build image via npm script:

```bash
npm run docker:build
```

- Run interactive dev container:

```bash
npm run docker:run
```

- Or use Docker Compose:

```bash
docker compose up --build
```

Notes for Docker on Windows:

- Use Docker Desktop with WSL2 backend enabled for best filesystem performance.
- If you need GPU access, install the NVIDIA Container Toolkit on the host and run containers with GPU support. I can add a GPU example if needed.

---

## 7) Reopen the repo in VS Code

- From WSL terminal (if using WSL):

```bash
# opens VS Code connected to WSL (requires 'Remote - WSL' extension)
code .
```

- From Git Bash or CMD (opens normal VS Code window):

```bash
code .
```

If VS Code prompts to "Install recommended extensions" for the workspace, you can accept or skip.

---

## 8) Model files guidance

- Model artifacts should be placed in `models/`. Do not commit large weights into Git—use cloud storage or `git-lfs` if required.
- Use `models/README.md` for model layout and fetch scripts.

---

## Troubleshooting & tips

- If `code .` fails inside WSL, ensure VS Code is installed on Windows and the Remote - WSL extension is installed.
- If Docker cannot access the filesystem properly, ensure Docker Desktop integration for WSL is enabled and that your distro is listed under Docker settings.
- For long-running downloads, run them from inside the container or WSL for best stability.

---

If you'd like, I can:

- Initialize the git repo and commit these files for you.
- Add a `scripts/download_model_facebook.sh` that will download Facebook Research model packages into `models/` (without committing weights).
- Add a GPU-enabled compose example and docs for NVIDIA setup.

This file is intentionally comprehensive so you can reopen it after Copilot/VS Code restarts.
