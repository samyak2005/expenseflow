#!/usr/bin/env bash
# Local Kubernetes on kind: cluster, add-ons, and the app images CI pushed to GHCR.
#   ./scripts/local-cluster.sh up       create everything
#   ./scripts/local-cluster.sh deploy   deploy the newest image CI has built
#   ./scripts/local-cluster.sh down     delete the cluster
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=expenseflow
CTX="kind-$CLUSTER"
OWNER="${OWNER:-samyak2005}"
k() { kubectl --context "$CTX" "$@"; }
h() { helm --kube-context "$CTX" "$@"; }

latest_built_sha() {
  gh run list -R "$OWNER/expenseflow" --workflow ci-cd.yml --branch main --status success \
    --limit 1 --json headSha --jq '.[0].headSha'
}

create_cluster() {
  if kind get clusters | grep -qx "$CLUSTER"; then
    echo "==> kind cluster $CLUSTER already exists"
  else
    kind create cluster --config k8s/kind-cluster.yaml
  fi
}

install_addons() {
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
  helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
  helm repo update >/dev/null

  echo "==> ingress-nginx"
  h upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    -n ingress-nginx --create-namespace \
    --set controller.hostPort.enabled=true \
    --set controller.service.type=NodePort \
    --set-string controller.nodeSelector.ingress-ready=true \
    --set-json 'controller.tolerations=[{"key":"node-role.kubernetes.io/control-plane","operator":"Exists","effect":"NoSchedule"}]' \
    --wait --timeout 5m

  echo "==> metrics-server"
  h upgrade --install metrics-server metrics-server/metrics-server \
    -n kube-system --set 'args={--kubelet-insecure-tls}' --wait --timeout 5m

  echo "==> kube-prometheus-stack"
  h upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
    -n monitoring --create-namespace \
    -f monitoring/kube-prometheus-stack-values.yaml \
    -f monitoring/kube-prometheus-stack-kind.yaml \
    --wait --timeout 10m
}

deploy_app() {
  local tag="${TAG:-$(latest_built_sha)}"
  echo "==> expenseflow @ ${tag:0:7}"
  k apply -f k8s/namespace.yaml
  h upgrade --install expenseflow ./helm/expenseflow -n expenseflow \
    -f helm/expenseflow/values-local.yaml \
    --set backend.image.repository="ghcr.io/$OWNER/expenseflow-backend" \
    --set backend.image.tag="$tag" \
    --set frontend.image.repository="ghcr.io/$OWNER/expenseflow-frontend" \
    --set frontend.image.tag="$tag" \
    --wait --timeout 10m
  k get pods -n expenseflow
  echo
  echo "App:        http://expenseflow.localtest.me"
  echo "Grafana:    http://grafana.localtest.me  (admin / $(k get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d))"
  echo "Prometheus: http://prometheus.localtest.me/targets"
}

case "${1:-up}" in
  up) create_cluster; install_addons; deploy_app ;;
  deploy) deploy_app ;;
  down) kind delete cluster --name "$CLUSTER" ;;
  *) echo "usage: $0 [up|deploy|down]" >&2; exit 1 ;;
esac
