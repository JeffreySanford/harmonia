# Base image for running/experimenting with models
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip git curl build-essential ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Keep a lightweight default: upgrade pip and create a venv if users want.
RUN python3 -m pip install --upgrade pip setuptools wheel

# Copy project files (useful for building if repo contains requirements.txt)
COPY . /workspace

# If project has requirements.txt, install them at build time.
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi

# Default to an interactive shell so users can attach and explore.
CMD ["bash"]
