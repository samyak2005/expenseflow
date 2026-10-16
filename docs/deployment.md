# Deploying to AWS

From an empty AWS account to ExpenseFlow running on EKS, then back to zero.
Region is `ap-south-1` (Mumbai) throughout.

Rough cost while everything is running: EKS control plane $0.10/h, three t3.medium nodes
about $0.14/h, NAT gateway $0.06/h, load balancer $0.03/h. About $0.35/h in total,
so destroy it when you're done.

## 0. Tools

```bash
brew install awscli hashicorp/tap/terraform helm kubectl
```

## 1. AWS credentials

1. In the AWS console open **IAM > Users > Create user**, name it `expenseflow-admin`.
2. Attach the `AdministratorAccess` policy directly.
3. Open the user, **Security credentials > Create access key > Command Line Interface**.
4. Configure the CLI with the key (it is stored in `~/.aws/credentials`, never in the repo):

```bash
aws configure            # region: ap-south-1, output: json
aws sts get-caller-identity
```

Setting up a budget alert (**Billing > Budgets**, e.g. $10) is a good idea.

## 2. Create the VPC and the cluster

```bash
cd terraform
terraform init
terraform plan -out tfplan
terraform apply tfplan          # about 15 minutes
aws eks update-kubeconfig --region ap-south-1 --name expenseflow-eks
kubectl get nodes               # three nodes, STATUS Ready
```

## 3. Cluster add-ons

```bash
cd ..
./scripts/install-cluster-addons.sh
```

This applies the gp3 StorageClass and the namespace, then installs ingress-nginx (which creates
the AWS load balancer), metrics-server for the HPA, and kube-prometheus-stack.

## 4. Images

Push to `main` and let the pipeline publish both images. Then, in GitHub, open
**your profile > Packages**, and for both `expenseflow-backend` and `expenseflow-frontend` go to
**Package settings > Change visibility > Public**, so the cluster can pull them without a token.

## 5. Deploy

### From the pipeline

In the repository settings:

- **Secrets and variables > Actions > Secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Secrets and variables > Actions > Variables**: `DEPLOY_ENABLED` = `true`

Re-run the latest workflow (or push a commit). The deploy job runs `helm upgrade --install`
with the commit SHA as the image tag.

### By hand

```bash
OWNER=your-github-username
SHA=$(git rev-parse HEAD)

helm upgrade --install expenseflow ./helm/expenseflow \
  -n expenseflow --create-namespace \
  -f helm/expenseflow/values-prod.yaml \
  --set backend.image.repository=ghcr.io/$OWNER/expenseflow-backend \
  --set backend.image.tag=$SHA \
  --set frontend.image.repository=ghcr.io/$OWNER/expenseflow-frontend \
  --set frontend.image.tag=$SHA \
  --wait
```

### Check it

```bash
kubectl get pods,svc,ingress,hpa -n expenseflow
helm list -n expenseflow

LB=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "http://$LB"
curl -s "http://$LB/api/claims/stats"
```

The load balancer's DNS name can take two or three minutes to start resolving.

## 6. Autoscaling

```bash
kubectl get hpa -n expenseflow -w              # terminal 1
./scripts/load-test.sh                          # terminal 2
```

CPU goes above the 60% target within a minute or so and the backend scales up from 2 pods.
After the load stops it scales back down about a minute later.

## 7. Prometheus and Grafana

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# http://localhost:9090/targets -> serviceMonitor/expenseflow/expenseflow-backend is UP

kubectl get secret -n monitoring kube-prometheus-stack-grafana \
  -o jsonpath='{.data.admin-password}' | base64 -d; echo
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3001:80
# http://localhost:3001, user admin -> Dashboards -> ExpenseFlow - Application Overview

kubectl port-forward -n expenseflow svc/expenseflow-backend 8000:8000
curl -s localhost:8000/metrics | head -30
```

## 8. Tear down

```bash
# GitHub: set DEPLOY_ENABLED to false first, so the pipeline stops trying to deploy.
helm uninstall expenseflow -n expenseflow
helm uninstall kube-prometheus-stack -n monitoring
helm uninstall ingress-nginx -n ingress-nginx
kubectl delete pvc --all -n expenseflow

cd terraform
terraform destroy               # about 10 minutes
```

Afterwards, check the EC2 > Load Balancers and EC2 > Volumes pages in the console are empty.
