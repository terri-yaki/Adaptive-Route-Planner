# Stage 1: Build backend
FROM node:18-alpine AS backend-builder

WORKDIR /usr/src/app

# Install backend dependencies
COPY package*.json ./
RUN npm install --production --ignore-scripts

# Copy backend source code
COPY . .

# Note: Frontend assets are expected to be built separately and copied here.
# This Dockerfile assumes the build context is 'modern-arp-app' root.
# The 'public/frontend' directory will be created by this COPY instruction.
COPY ../frontend/dist ./public/frontend

# Expose port - use environment variable PORT, default to 5000
ARG PORT=5000
EXPOSE ${PORT}

# Environment variable for the port the server should listen on
ENV PORT=${PORT}
ENV NODE_ENV=production

# Command to run the backend server
CMD ["node", "server.js"]
