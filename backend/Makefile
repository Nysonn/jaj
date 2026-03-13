.PHONY: build run dev docker-build docker-up docker-down tidy

build:
	go build -o bin/jaj-server ./cmd/jaj-server

run: build
	./bin/jaj-server

dev:
	air

tidy:
	go mod tidy

docker-build:
	docker build -t jaj-server .

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

logs:
	docker compose logs -f
