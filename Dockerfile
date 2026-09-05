FROM node:20-alpine
WORKDIR /app

# Install all deps (including dev — needed for tsx seed script)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Ensure unix line endings and executable permission on entrypoint script
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Generate Prisma client & build Next.js
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0
ENV AUTH_TRUST_HOST=true

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
