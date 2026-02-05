# Stage 1: Build the React Native web app
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies
COPY myroutine/package.json myroutine/package-lock.json ./
RUN npm install

# Copy source code
COPY myroutine/ ./

# Build for web (outputs to dist/)
RUN npx expo export -p web

# Stage 2: Serve with Python FastAPI
FROM python:3.10-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend assets from the builder stage
COPY --from=frontend-builder /app/dist ./static

# Expose port (Render sets PORT env var)
EXPOSE 10001

# Run the application
CMD ["python", "main.py"]
