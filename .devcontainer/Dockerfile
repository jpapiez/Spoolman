FROM python:3.12-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for frontend development)
ENV NODE_VERSION=20.x
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install PDM for Python dependency management
RUN python -m pip install --upgrade pip && \
    pip install pdm

# Create non-root user for development
RUN useradd -m -s /bin/bash vscode

# Set working directory
WORKDIR /workspace

# Set PDM cache and config
ENV PDM_IGNORE_ACTIVE_VENV=1 \
    PDM_CHECK_UPDATE=false

# Copy workspace into container
COPY . .

# Change ownership to vscode user
RUN chown -R vscode:vscode /workspace

# Create PDM and npm cache directories with proper permissions
RUN mkdir -p /home/vscode/.cache/pdm/http /home/vscode/.local/share/pdm /home/vscode/.npm && \
    chown -R vscode:vscode /home/vscode/.cache /home/vscode/.local /home/vscode/.npm

# Switch to vscode user for remaining setup
USER vscode

# Create directories for virtual environment
RUN mkdir -p /home/vscode/.venv

# Set up Python virtual environment path
ENV VIRTUAL_ENV=/home/vscode/.venv \
    PATH="/home/vscode/.venv/bin:$PATH" \
    PDM_VENV_IN_PROJECT=false \
    PDM_INSTALL_ARGS="--dev"

EXPOSE 8000 5173

CMD ["/bin/bash"]
