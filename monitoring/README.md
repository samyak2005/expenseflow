# Monitoring

| Piece | What it does |
|---|---|
| `/metrics` on the backend | `prometheus-fastapi-instrumentator` publishes request count, latency histogram and sizes per endpoint, plus two business counters: `expenseflow_claims_submitted_total{category}` and `expenseflow_claim_status_changes_total{status}` |
| `ServiceMonitor` (Helm chart) | tells the Prometheus Operator to scrape the backend Service's `http` port every 15 s |
| Prometheus | stores the time series (2-day retention) |
| Grafana | shows the **ExpenseFlow - Application Overview** dashboard, shipped as a ConfigMap from `helm/expenseflow/dashboards/expenseflow.json` |

## Install

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f monitoring/kube-prometheus-stack-values.yaml
```

## Open the UIs

```bash
# Prometheus -> http://localhost:9090/targets  (look for serviceMonitor/expenseflow/... = UP)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Grafana -> http://localhost:3001  (user: admin)
kubectl get secret -n monitoring kube-prometheus-stack-grafana \
  -o jsonpath='{.data.admin-password}' | base64 -d; echo
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3001:80
```

## Dashboard panels

Requests/sec, 5xx error rate, p95 latency, ready backend pods (HPA), requests by endpoint,
responses by status class, latency p50/p95/p99, CPU per backend pod, claims submitted per
category and review decisions.
