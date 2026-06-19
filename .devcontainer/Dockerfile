FROM node:24-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends tmux && rm -rf /var/lib/apt/lists/*

COPY scripts/devcontainer-entrypoint.sh /usr/local/bin/devcontainer-entrypoint.sh
RUN chmod +x /usr/local/bin/devcontainer-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/devcontainer-entrypoint.sh"]
CMD ["sleep", "infinity"]
