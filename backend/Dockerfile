FROM golang:1.25-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -s' -o waveform-api ./cmd/api/main.go

FROM alpine:3.19
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/waveform-api .
COPY --from=builder /app/db ./db
EXPOSE 8080
CMD [ "./waveform-api" ]