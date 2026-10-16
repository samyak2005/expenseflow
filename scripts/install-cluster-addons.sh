#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Cluster: $(kubectl config current-context)"

echo "==> StorageClass + namespace"
kubectl apply -f k8s/storageclass-gp3.yaml
kubectl apply -f k8s/namespace.yaml

echo "==> Helm repositories"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update >/dev/null

echo "==> ingress-nginx"
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --wait --timeout 10m

echo "==> metrics-server"
helm upgrade --install metrics-server metrics-server/metrics-server \
  -n kube-system --wait --timeout 5m

echo "==> kube-prometheus-stack"
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/kube-prometheus-stack-values.yaml \
  --wait --timeout 15m

echo
echo "Load balancer (DNS can take a few minutes):"
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'; echo
