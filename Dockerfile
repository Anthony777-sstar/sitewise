# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY backend/*.java ./
RUN javac *.java

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/*.class ./
COPY backend/prompts ./prompts/
COPY frontend ./frontend/
COPY websitecdnshaders ./websitecdnshaders/
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "java Main \"${PORT:-8080}\""]
