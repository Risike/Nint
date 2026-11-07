.PHONY: dev build up down logs test lint db-migrate clean help

help:
	@echo "Nint - Modern Guideline Falling Block Game"
	@echo ""
	@echo "Available commands:"
	@echo "  make dev         Run backend and frontend concurrently in development mode"
	@echo "  make build       Build docker images"
	@echo "  make up          Start containers in production mode"
	@echo "  make down        Stop running containers"
	@echo "  make logs        View container logs"
	@echo "  make test        Run all tests (unit, engine, integration)"
	@echo "  make lint        Run linter"
	@echo "  make db-migrate  Run SQLite schema migration"
	@echo "  make clean       Clean up build artifacts and dependencies"

dev:
	npm run dev

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	npm run test

lint:
	npm run lint

db-migrate:
	npm --prefix backend run migrate

clean:
	rm -rf node_modules frontend/node_modules backend/node_modules frontend/dist
