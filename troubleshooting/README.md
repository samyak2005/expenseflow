# Troubleshooting lab

Three deliberately broken manifests. Each one shows a different way a Kubernetes app fails
and the commands that find the cause. Apply one, investigate, fix, then delete it.

---

## Lab 1 - `ImagePullBackOff` (wrong image tag)

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n expenseflow -l app=broken-image
```

**Symptom**: `STATUS` is `ErrImagePull`, then `ImagePullBackOff`.

**Investigate**

```bash
kubectl describe pod -n expenseflow -l app=broken-image | tail -15
kubectl get events -n expenseflow --sort-by=.lastTimestamp | tail
```

The Events section says `manifest unknown` / `not found` for
`...expenseflow-backend:does-not-exist`.

**Root cause**: the tag was never pushed. CI only pushes tags that are Git commit SHAs.

**Fix**: point the Deployment at a tag that exists in GHCR (or delete the lab).

```bash
kubectl delete -f troubleshooting/broken-image.yaml
```

> A private GHCR package gives the same symptom with `401 Unauthorized`: either make the
> package public or add an `imagePullSecret`.

---

## Lab 2 - Service with no endpoints (label mismatch)

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl run curl-test -n expenseflow --rm -it --restart=Never --image=busybox:1.37 -- \
  wget -qO- -T 3 http://expenseflow-broken-service:8000/health
```

**Symptom**: the request times out or is refused, although the backend pods are healthy.

**Investigate**

```bash
kubectl get endpoints -n expenseflow expenseflow-broken-service     # <none>
kubectl describe svc -n expenseflow expenseflow-broken-service | grep Selector
kubectl get pods -n expenseflow --show-labels | grep backend
```

**Root cause**: the Service selects `app.kubernetes.io/component=api`, but the backend pods are
labelled `app.kubernetes.io/component=backend`. No matching labels means no endpoints, so no traffic.

**Fix**: correct the selector, then `kubectl get endpoints` lists the pod IPs.

```bash
kubectl patch svc -n expenseflow expenseflow-broken-service --type merge \
  -p '{"spec":{"selector":{"app.kubernetes.io/component":"backend","app.kubernetes.io/instance":"expenseflow"}}}'
kubectl get endpoints -n expenseflow expenseflow-broken-service
kubectl delete -f troubleshooting/broken-service.yaml
```

---

## Lab 3 - `CrashLoopBackOff` (bad database URL)

Set the image tag in `broken-database-url.yaml` to a commit SHA that exists in GHCR first.

```bash
kubectl apply -f troubleshooting/broken-database-url.yaml
kubectl get pods -n expenseflow -l app=broken-db -w
```

**Symptom**: `Error`, then `CrashLoopBackOff`, with the restart count climbing.

**Investigate**

```bash
kubectl logs -n expenseflow -l app=broken-db --previous | tail -5
```

The log ends with `could not translate host name "postgres-typo"`: the Alembic migration
could not reach the database, so the container exited before uvicorn started.

**Root cause**: wrong `DATABASE_URL`. The real chart builds it from the Postgres Service name
and the generated Secret.

**Fix**: use the correct host (`expenseflow-postgres`) and secret, or delete the lab.

```bash
kubectl delete -f troubleshooting/broken-database-url.yaml
```

---

## General checklist

| Question | Command |
|---|---|
| Is the pod running? | `kubectl get pods -n expenseflow` |
| Why not? | `kubectl describe pod <name> -n expenseflow` (read **Events**) |
| What did the app print? | `kubectl logs <name> -n expenseflow` (add `--previous` after a crash) |
| Does the Service reach pods? | `kubectl get endpoints -n expenseflow` |
| Is the Ingress wired up? | `kubectl describe ingress -n expenseflow` |
| Is the HPA getting metrics? | `kubectl describe hpa -n expenseflow` (`<unknown>` = metrics-server missing) |
| What happened recently? | `kubectl get events -n expenseflow --sort-by=.lastTimestamp` |
| Roll back a bad release | `helm history expenseflow -n expenseflow` then `helm rollback expenseflow <rev> -n expenseflow` |
