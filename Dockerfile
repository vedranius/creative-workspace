FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
RUN mkdir -p /app/data /app/workspaces && chown -R node:node /app/data /app/workspaces
USER node
ENV HOST=0.0.0.0 PORT=8788 DATA_DIR=/app/data WORKSPACE_ROOTS=/app/workspaces
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8788/api/health',{headers:{Authorization:'Basic '+Buffer.from(process.env.WORKSPACE_AUTH).toString('base64')}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
