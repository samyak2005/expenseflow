# ExpenseFlow

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
| Tests | pytest (SQLite in-memory test database), ruff |
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
docker compose up --build
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

## Tests

```bash
cd backend
pytest -v
```

18 tests cover validation, filtering and search, the approval workflow, the stats endpoint,
health checks and the metrics output. Each test gets its own in-memory SQLite database through a
FastAPI dependency override (`tests/conftest.py`), so the suite never touches PostgreSQL.

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`:

1. **test**: ruff, pytest, then the frontend production build. A failing test stops the pipeline
   before any image is built.
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

The Helm chart in `helm/expenseflow` deploys:

- frontend and backend Deployments (2 replicas each) with ClusterIP Services
- PostgreSQL as a StatefulSet with a persistent volume; its password is generated on the first
  install and stored in a Secret, so no password is committed
- an Ingress that sends `/api` and `/docs` to the backend and everything else to the frontend
- an HPA that scales the backend between 2 and 5 pods at 60% CPU
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

## Cleaning up

```bash
helm uninstall expenseflow -n expenseflow
helm uninstall kube-prometheus-stack -n monitoring
helm uninstall ingress-nginx -n ingress-nginx    # removes the AWS load balancer
cd terraform && terraform destroy
```

Uninstall ingress-nginx before `terraform destroy`. The load balancer it created isn't managed
by Terraform, and if it's still there the VPC can't be deleted.

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
