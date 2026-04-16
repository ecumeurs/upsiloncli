# Base image
FROM golang:1.25-alpine

# Install build dependencies and tools
RUN apk add --no-cache build-base curl nodejs npm

# Install wscat
RUN npm install -g wscat

# Set working directory to root to maintain workspace structure
WORKDIR /app

# Copy go.work and module files for caching
COPY go.work go.work.sum ./
COPY upsilonapi/go.mod upsilonapi/go.sum ./upsilonapi/
COPY upsilonbattle/go.mod upsilonbattle/go.sum ./upsilonbattle/
COPY upsiloncli/go.mod upsiloncli/go.sum ./upsiloncli/
COPY upsilonmapdata/go.mod upsilonmapdata/go.sum ./upsilonmapdata/
COPY upsilonmapmaker/go.mod upsilonmapmaker/go.sum ./upsilonmapmaker/
COPY upsilonserializer/go.mod upsilonserializer/go.sum ./upsilonserializer/
COPY upsilontools/go.mod upsilontools/go.sum ./upsilontools/

# Download dependencies
RUN go mod download

# Copy all source code
COPY . .

# Build the CLI tool
WORKDIR /app/upsiloncli
RUN go build -o /usr/local/bin/upsiloncli ./cmd/upsiloncli/main.go

# Stay alive for execution
CMD ["tail", "-f", "/dev/null"]
