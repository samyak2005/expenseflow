.DEFAULT_GOAL := help

BACKEND  := backend
FRONTEND := frontend
CHART    := helm/expenseflow
TAG      ?= $(shell git rev-parse --short HEAD)

.PHONY: help install lint format test up down logs build tf-init tf-plan tf-apply tf-destroy helm-lint addons deploy load-test local-up local-deploy local-down

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	cd $(BACKEND) && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	cd $(FRONTEND) && npm ci

lint: ## Lint backend, frontend formatting, Terraform and Helm
	cd $(BACKEND) && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd $(FRONTEND) && npx --yes prettier@3 --check "src/**/*.{js,jsx,css}"
	terraform -chdir=terraform fmt -check -recursive
	$(MAKE) helm-lint

format: ## Auto-format backend and frontend code
	cd $(BACKEND) && .venv/bin/ruff check --fix . && .venv/bin/ruff format .
	cd $(FRONTEND) && npx --yes prettier@3 --write "src/**/*.{js,jsx,css}"
	terraform -chdir=terraform fmt -recursive

test: ## Run backend and frontend tests
	cd $(BACKEND) && .venv/bin/pytest -v
	cd $(FRONTEND) && npm test

up: ## Start the full stack with Docker Compose
	docker compose up --build -d
	@echo "App: http://localhost:3000  API docs: http://localhost:8000/docs"

down: ## Stop the stack
	docker compose down

logs: ## Follow logs from the stack
	docker compose logs -f

build: ## Build both images tagged with the current commit
	docker build -t expenseflow-backend:$(TAG) --build-arg APP_VERSION=$(TAG) $(BACKEND)
	docker build -t expenseflow-frontend:$(TAG) --build-arg VITE_APP_VERSION=$(TAG) $(FRONTEND)

tf-init: ## terraform init
	terraform -chdir=terraform init

tf-plan: ## terraform plan
	terraform -chdir=terraform plan

tf-apply: ## terraform apply (creates billable AWS resources)
	terraform -chdir=terraform apply

tf-destroy: ## terraform destroy
	terraform -chdir=terraform destroy

helm-lint: ## Lint and render the Helm chart
	helm lint $(CHART) -f $(CHART)/values-prod.yaml --set backend.image.tag=lint --set frontend.image.tag=lint
	helm template expenseflow $(CHART) -f $(CHART)/values-prod.yaml --set backend.image.tag=lint --set frontend.image.tag=lint > /dev/null

addons: ## Install ingress-nginx, metrics-server and kube-prometheus-stack
	./scripts/install-cluster-addons.sh

deploy: ## Deploy a commit to the current cluster: make deploy OWNER=<github-user> TAG=<full-sha>
	@test -n "$(OWNER)" || (echo "OWNER is required" && exit 1)
	helm upgrade --install expenseflow $(CHART) -n expenseflow --create-namespace \
		-f $(CHART)/values-prod.yaml \
		--set backend.image.repository=ghcr.io/$(OWNER)/expenseflow-backend \
		--set backend.image.tag=$(TAG) \
		--set frontend.image.repository=ghcr.io/$(OWNER)/expenseflow-frontend \
		--set frontend.image.tag=$(TAG) \
		--wait

load-test: ## Generate load so the HPA scales the backend
	./scripts/load-test.sh

local-up: ## Create a local kind cluster with add-ons and deploy the latest CI image
	./scripts/local-cluster.sh up

local-deploy: ## Deploy the newest image CI has pushed to the local cluster
	./scripts/local-cluster.sh deploy

local-down: ## Delete the local kind cluster
	./scripts/local-cluster.sh down
