# ExpenseFlow

[![CI/CD](https://github.com/samyak2005/expenseflow/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/samyak2005/expenseflow/actions/workflows/ci-cd.yml)
![Python](https://img.shields.io/badge/python-3.13-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)
![Terraform](https://img.shields.io/badge/terraform-EKS-7B42BC?logo=terraform&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

ExpenseFlow is a small internal tool for handling office expense claims. An employee submits a
claim (a client dinner, a cab to the airport, a software licence), a manager approves or
rejects it, and finance marks approved claims as reimbursed. The dashboard shows how much money
is waiting at each step and where the company is spending.

I built it as my DevOps capstone, so the application is deliberately small and most of the work
is in how it gets from a commit to a monitored Kubernetes cluster on AWS.

![Dashboard](docs/screenshots/dashboard.png)

## Stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, plain CSS, served by unprivileged nginx |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| Database | PostgreSQL 16 |
| Quality | pytest, Vitest, ruff, Prettier, pre-commit |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions, Trivy, GitHub Container Registry |
| Infrastructure | Terraform, AWS VPC, Amazon EKS |
| Deployment | Helm, ingress-nginx, Horizontal Pod Autoscaler |
| Monitoring | Prometheus, Grafana (kube-prometheus-stack) |

## Architecture

```
 git push ──► GitHub Actions ──► test ──► build ──► Trivy scan ──► push to GHCR ──► helm upgrade
                                                                                        │
 ┌──────────────────────────── AWS (ap-south-1) ────────────────────────────────────────▼──────┐
 │  VPC 10.30.0.0/16                                                                            │
 │   public subnets:  load balancer ──► ingress-nginx                                           │
 │   private subnets: EKS worker nodes                                                          │
 │                                                                                              │
 │      /        ──► frontend (2 pods, nginx + React)                                           │
 │      /api     ──► backend  (2-5 pods, FastAPI, scaled by the HPA) ──► PostgreSQL (EBS gp3)   │
 │                                                                                              │
 │      Prometheus scrapes backend /metrics ──► Grafana dashboard                               │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Running it locally

You need Docker.

```bash
docker compose up --build      # or: make up
```

- App: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs
- Metrics: http://localhost:8000/metrics

The first start runs the database migrations and loads a handful of demo claims.
`docker compose down -v` stops everything and deletes the database volume.

### Backend without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql+psycopg://expenseflow:expenseflow@localhost:5432/expenseflow
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend without Docker

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to localhost:8000
```

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Liveness check, no database call |
| GET | `/ready` | Readiness check, runs `SELECT 1` |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/claims` | List claims. Filters: `status`, `category`, `department`, `q` |
| GET | `/api/claims/stats` | Totals per status and spend per category |
| GET | `/api/claims/{id}` | One claim |
| POST | `/api/claims` | Submit a claim (starts as `PENDING`) |
| PUT | `/api/claims/{id}` | Edit a claim, only while it is pending |
| PATCH | `/api/claims/{id}/status` | Approve, reject (needs a comment) or mark as reimbursed |
| DELETE | `/api/claims/{id}` | Delete a pending or rejected claim |

The status rules live in one place (`ALLOWED_TRANSITIONS` in `backend/app/claims.py`):

```
PENDING ──► APPROVED ──► REIMBURSED
   └──────► REJECTED
```

Anything else returns `409 Conflict`. Approved and reimbursed claims can't be edited or deleted,
since they are part of the audit trail.

## Backend design

```
app/
  api/routes/   thin FastAPI handlers: parse the request, call a service, return a schema
  services/     business rules (status transitions, edit/delete locks, stats); no HTTP here
  models/       SQLAlchemy models and the status/category/department enums
  schemas/      Pydantic request and response models with validation
  core/         settings, JSON logging, request-id middleware, error handlers, metrics
  db/           engine and session dependency
```

Services raise domain errors (`ClaimNotFoundError`, `ClaimStateError`) and `core/errors.py`
maps them to 404 and 409, so the business logic never deals with HTTP status codes.
Every response carries an `X-Request-ID` header (passed through if the caller sent one), and
each request is logged as one JSON line with its id, status and duration. The list endpoint is
paginated with `limit`/`offset` and returns the total in `X-Total-Count`.

## Tests

```bash
make test
```

- **Backend (29 tests)**: service-layer unit tests for every status transition, plus API tests
  for validation, filtering, search, pagination, the stats endpoint, health checks, request ids
  and the metrics output. Each test gets a fresh in-memory SQLite database through a FastAPI
  dependency override (`tests/conftest.py`), so the suite never touches PostgreSQL.
- **Frontend (27 tests)**: Vitest tests for money/date formatting and the API client's
  error handling.

`make lint` runs ruff, Prettier, `terraform fmt` and `helm lint`. The same checks run as
pre-commit hooks (`pre-commit install`).

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`:

1. **backend**, **frontend** and **infra** run in parallel: ruff and pytest; Vitest and the
   production build; `terraform fmt`/`validate` and `helm lint`. Any failure stops the pipeline
   before an image is built.
2. **build-scan-push**: builds both images, scans them with Trivy, and pushes them to GHCR
   tagged with the commit SHA (`ghcr.io/<owner>/expenseflow-backend:<sha>`). Pull requests are
   built and scanned but not pushed.
3. **deploy**: `helm upgrade --install` on EKS with the new SHA. It only runs when the repository
   variable `DEPLOY_ENABLED` is `true`, so the pipeline stays green when the cluster is torn down.

Deploy needs two repository secrets, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### Security scanning

Trivy scans the OS packages and the Python/Node dependencies inside both images and fails the
build on any HIGH or CRITICAL vulnerability that has a fix available. To keep the scan clean, the
backend image upgrades its Debian packages at build time, the frontend runs on a small Alpine
nginx image, and both containers run as non-root users (UID 10001 and 101). The Trivy action is
pinned to a commit SHA rather than a tag.

## Infrastructure

Terraform in `terraform/` creates:

- a VPC with two public and two private subnets across two availability zones
- one NAT gateway (one instead of one per zone, to keep the cost down)
- an EKS 1.35 cluster with a managed node group of three `t3.medium` nodes in the private subnets
- the EBS CSI driver add-on, so PostgreSQL gets a persistent gp3 volume

```bash
cd terraform
terraform init
terraform plan
terraform apply          # ~15 minutes
aws eks update-kubeconfig --region ap-south-1 --name expenseflow-eks
```

The full walkthrough, from an empty AWS account to the app running behind the load balancer,
is in [docs/deployment.md](docs/deployment.md).

## Kubernetes

The same Helm chart runs in two places:

- **Local (kind)**: `make local-up` creates a three-node kind cluster, installs ingress-nginx,
  metrics-server and kube-prometheus-stack, and deploys the images CI pushed to GHCR. The app is
  served through the Ingress at http://expenseflow.localtest.me, Grafana at
  http://grafana.localtest.me and Prometheus at http://prometheus.localtest.me (`localtest.me`
  resolves to 127.0.0.1). After a green pipeline, `make local-deploy` rolls out the new commit.
- **AWS (EKS)**: the cluster from `terraform/`, deployed by the pipeline's deploy job.

The chart deploys:

- frontend and backend Deployments (2 replicas each) with ClusterIP Services
- PostgreSQL as a StatefulSet with a persistent volume; its password is generated on the first
  install and stored in a Secret, so no password is committed
- an Ingress that sends `/api` and `/docs` to the backend and everything else to the frontend
- an HPA that scales the backend between 2 and 5 pods at 60% CPU
- PodDisruptionBudgets so node maintenance never takes every pod of a service down at once
- a ServiceMonitor and a Grafana dashboard ConfigMap (prod values)

The backend has separate probes: `/health` for liveness, `/ready` for readiness (checks the
database), plus a startup probe because migrations run before uvicorn starts. When several
backend pods start at once, a Postgres advisory lock in `alembic/env.py` makes them migrate one
at a time.

## Monitoring

`scripts/install-cluster-addons.sh` installs kube-prometheus-stack. Prometheus picks up the
ServiceMonitor and scrapes `/metrics` every 15 seconds. Grafana loads the
**ExpenseFlow - Application Overview** dashboard automatically: requests per second, error rate,
p95 latency, backend pod count, CPU per pod, and claims submitted per category. See
[monitoring/README.md](monitoring/README.md).

## Troubleshooting

[troubleshooting/](troubleshooting/README.md) has three broken manifests (wrong image tag,
Service selecting no pods, wrong database URL), each with the symptom, the commands that find
the cause, and the fix.

## Evidence

Screenshots from the running system, in `docs/screenshots/`, plus a recording of a commit going
from `git push` through the pipeline to the cluster.

| Rubric area | Screenshot |
|---|---|
| Tests | [pytest: 29 passed](docs/screenshots/01-pytest.png) |
| Docker | [docker compose up --build](docs/screenshots/02-compose-up.png), [app on localhost:3000](docs/screenshots/03-app-localhost.png), [Swagger](docs/screenshots/04-swagger.png) |
| Git | [commit history](docs/screenshots/05-commits.png) |
| CI/CD | [green pipeline](docs/screenshots/06-pipeline-green.png), [GHCR packages](docs/screenshots/08-ghcr-packages.png), [SHA-tagged images](docs/screenshots/09-ghcr-sha-tags.png) |
| Security | [Trivy scans](docs/screenshots/07-trivy.png) |
| Terraform | [init, validate, fmt](docs/screenshots/16-terraform-validate.png) |
| Kubernetes + Helm | [pods, services, helm list](docs/screenshots/13-kubectl-pods-svc-helm.png), [app through the Ingress](docs/screenshots/14-app-ingress.png), [HPA scaling 2 to 5 pods](docs/screenshots/10-hpa-scaling.png) |
| Monitoring | [/metrics](docs/screenshots/15-metrics.png), [Prometheus targets UP](docs/screenshots/12-prometheus-targets.png), [Grafana dashboard](docs/screenshots/11-grafana.png) |
| Troubleshooting | [Service with no endpoints, then fixed](docs/screenshots/17-troubleshooting.png) |

**Demo video**: [commit to deployment, 4 minutes](docs/video/demo-commit-to-deploy.mp4). A
one-line UI change is committed and pushed, the pipeline tests, builds, scans and pushes the
images, and `make local-deploy` rolls the new SHA out to the cluster.

## Cleaning up

```bash
helm uninstall expenseflow -n expenseflow
helm uninstall kube-prometheus-stack -n monitoring
helm uninstall ingress-nginx -n ingress-nginx    # removes the AWS load balancer
cd terraform && terraform destroy
```

Uninstall ingress-nginx before `terraform destroy`. The load balancer it created isn't managed
by Terraform, and if it's still there the VPC can't be deleted.

## Common commands

```bash
make help        # list everything
make up          # docker compose stack
make test        # backend + frontend tests
make lint        # all linters
make tf-plan     # terraform plan
make addons      # ingress, metrics-server, Prometheus/Grafana
make deploy OWNER=<github-user> TAG=<sha>
```

## Project layout

```
backend/          FastAPI app, Alembic migrations, tests
frontend/         React app and nginx config
helm/expenseflow/ Helm chart and Grafana dashboard
terraform/        VPC and EKS
k8s/              namespace and storage class
monitoring/       kube-prometheus-stack values
scripts/          cluster add-ons and load test
troubleshooting/  broken manifests for the troubleshooting lab
docs/             deployment guide and screenshots
```
