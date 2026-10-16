# Demo walkthrough

About 10 minutes. Have these open before starting: the app, Grafana, the GitHub repo, and a
terminal in the project folder.

## 1. The application (1 min)

Open http://expenseflow.localtest.me.

- Submit a claim with **New claim**, approve it, then **Mark paid**. The totals update.
- Try to reject without a reason: the API refuses (a rejection needs a comment).
- Open http://expenseflow.localtest.me/docs to show the REST API.

## 2. Code and tests (1 min)

- `backend/app/services/claims.py`: `ALLOWED_TRANSITIONS` is the whole approval workflow.
- `make test`: 29 backend and 27 frontend tests. The backend tests use an in-memory SQLite
  database, so they never touch the real one.

## 3. Commit to deployment (3 min)

1. Change something visible, e.g. the subtitle text in `frontend/src/components/Header.jsx`.
2. `git commit -am "Update dashboard subtitle" && git push`
3. On GitHub > Actions, the pipeline runs: backend, frontend and infra checks in parallel,
   then the image build, the Trivy scan, and the push to GHCR tagged with the commit SHA.
4. When it's green: `make local-deploy`. Helm rolls out the new SHA with zero downtime.
5. Refresh the app: the change is live, and the footer shows the new build SHA.

## 4. Kubernetes (2 min)

```bash
kubectl get pods,svc,ingress,hpa -n expenseflow
helm list -n expenseflow
helm history expenseflow -n expenseflow
```

- Two replicas each for frontend and backend, PostgreSQL as a StatefulSet with a volume.
- Ingress: `/api` and `/docs` go to FastAPI, everything else to the React app.
- Autoscaling: run `make load-test` and watch `kubectl get hpa -n expenseflow -w`. The backend
  goes from 2 pods to more as CPU passes 60%, and scales back a minute after the load stops.

## 5. Monitoring (1 min)

- http://prometheus.localtest.me/targets: the backend ServiceMonitor target is UP.
- http://grafana.localtest.me: dashboard **ExpenseFlow - Application Overview**. Requests per
  second, error rate and latency move while the load test runs.

## 6. Troubleshooting (2 min)

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get endpoints -n expenseflow expenseflow-broken-service     # <none>
kubectl describe svc -n expenseflow expenseflow-broken-service | grep Selector
kubectl get pods -n expenseflow --show-labels | grep backend
```

The selector says `component=api`, the pods are labelled `component=backend`, so the Service
has no endpoints. Fix the selector, the endpoints appear. Details for all three labs are in
`troubleshooting/README.md`.

## 7. Infrastructure as code (1 min)

Walk through `terraform/main.tf`: a VPC with public and private subnets in two availability
zones, a single NAT gateway, and an EKS cluster with a managed node group. The pipeline's deploy
job targets that cluster when `DEPLOY_ENABLED` is set.

## Questions you might get

- **Why tests before the image build?** A failing test stops the pipeline, so a broken image is
  never pushed or deployed.
- **Why `/health` and `/ready` separately?** Liveness only checks the process; readiness checks
  the database too, so Kubernetes stops sending traffic to a pod that can't reach Postgres
  without restarting it.
- **Why tag images with the commit SHA?** Every running pod traces back to an exact commit, and
  rolling back means deploying an older SHA.
- **Why a StatefulSet for Postgres?** The pod keeps its own volume across restarts, and an
  upgrade never runs two copies on the same disk.
- **What does Trivy check?** Known CVEs in the OS packages and libraries inside each image; the
  build fails on any HIGH or CRITICAL issue that has a fix available.
