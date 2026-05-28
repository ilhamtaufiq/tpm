# Stage 1: Build the Expo web application
FROM node:20-slim AS build

# Set working directory
WORKDIR /app

# Install dependencies
# Install dependencies with caching and faster registry (optional)
COPY package*.json ./
# Gunakan npm ci untuk instalasi lebih cepat dan konsisten (wajib ada package-lock.json)
# Opsional: Gunakan registry mirror, misal dari Cloudflare atau Taobao jika official lambat
RUN npm config set registry https://registry.npmjs.org/ && \
    npm ci --prefer-offline --no-audit

# Copy project files
COPY . .

# Build the web version
RUN npx expo export --platform web

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Copy the built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
