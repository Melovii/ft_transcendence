# ft_transcendence — single entry point for the containerized stack.
# `make up` is the one command the whole project runs with.

COMPOSE := docker compose

.PHONY: up down restart build logs psql ps cert restore clean help

up: cert ## Build and start the whole stack (detached)
	$(COMPOSE) up -d --build
	@echo "app:   https://localhost"
	@echo "first run takes a few minutes to build images"

down: ## Stop the stack (keeps data)
	$(COMPOSE) down

restart: ## Recreate changed services
	$(COMPOSE) up -d --build --force-recreate

build: ## Build images without starting anything
	$(COMPOSE) build

logs: ## Tail all service logs (follow)
	$(COMPOSE) logs -f

psql: ## Open a psql shell inside the postgres container
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-auth} -d $${POSTGRES_DB:-auth}

ps: ## Show service status
	$(COMPOSE) ps

cert: ## Generate the self-signed TLS cert if missing
	@sh scripts/make-cert.sh

restore: ## Restore the latest backup into a FRESH database (destructive) — Phase 1
	@echo "restore: not implemented yet (Phase 1 of the roadmap)"

clean: cert-clean ## Stop the stack and DELETE the database volume
	$(COMPOSE) down -v
	@echo "clean: database volume removed; run 'make up' for a fresh start"

cert-clean: ## Remove generated TLS certificates
	@rm -rf certs

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

.DEFAULT_GOAL := help