#!/usr/bin/env bash
# Usage: PODS=4 DURATION=180 ./scripts/load-test.sh
set -euo pipefail

NAMESPACE="${NAMESPACE:-expenseflow}"
TARGET="${TARGET:-http://expenseflow-backend:8000/api/claims/stats}"
PODS="${PODS:-4}"
DURATION="${DURATION:-180}"

cleanup() {
  echo "==> Removing load generators"
  kubectl delete pod -n "$NAMESPACE" -l app=load-generator --ignore-not-found --wait=false >/dev/null
}
trap cleanup EXIT

echo "==> Starting $PODS load generators against $TARGET for ${DURATION}s"
for i in $(seq 1 "$PODS"); do
  kubectl run "load-generator-$i" -n "$NAMESPACE" --restart=Never \
    --labels=app=load-generator --image=busybox:1.37 -- \
    /bin/sh -c "end=\$((\$(date +%s)+$DURATION)); while [ \$(date +%s) -lt \$end ]; do wget -q -O /dev/null $TARGET; done" >/dev/null
done

end=$(( $(date +%s) + DURATION ))
while [ "$(date +%s)" -lt "$end" ]; do
  kubectl get hpa -n "$NAMESPACE" --no-headers 2>/dev/null || true
  sleep 15
done
echo "==> Done"
