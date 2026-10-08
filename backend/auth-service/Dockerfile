# Multi-stage build for the auth service.
# Build context is ./backend so the shared module (replace ../shared) is reachable.

FROM golang:1.27-alpine AS build

WORKDIR /src

# Cache module downloads: copy manifests first.
COPY shared/go.mod shared/go.sum shared/
COPY auth-service/go.mod auth-service/go.sum auth-service/

WORKDIR /src/auth-service
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# shared sources are needed because of the replace ../shared directive.
COPY shared/ /src/shared/
COPY auth-service/ /src/auth-service/

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/auth-service ./cmd/server

FROM alpine:3.21

# CA certificates for outbound TLS; tzdata keeps log timestamps sane.
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S app -G app

COPY --from=build /out/auth-service /usr/local/bin/auth-service

USER app

EXPOSE 8080

ENTRYPOINT ["auth-service"]