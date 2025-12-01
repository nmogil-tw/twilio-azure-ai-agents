# Deployment Guide

Production deployment guide for Twilio-Azure AI Agents using Docker.

## Table of Contents

- [Quick Start (Local)](#quick-start-local)
- [Cloud Deployment](#cloud-deployment)
  - [AWS ECS Fargate](#aws-ecs-fargate)
  - [Google Cloud Run](#google-cloud-run)
  - [Azure Container Apps](#azure-container-apps)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Local)

### Prerequisites
- Docker and Docker Compose
- `.env` file with credentials (see `.env.example`)

### Local Testing

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Run with Docker Compose
docker-compose up

# Test
curl http://localhost:3000/health
```

**Image Details**: `node:20-slim` base, ~200MB, runs as non-root user, port 3000

---

## Cloud Deployment

### Before Deploying

1. **Remove local-only settings** from `.env`:
   ```bash
   # Comment out or remove:
   # NODE_TLS_REJECT_UNAUTHORIZED=0
   # NGROK_DOMAIN=...
   ```

2. **Set production domain**:
   ```bash
   PRODUCTION_DOMAIN=your-app.example.com
   ```

3. **Use secrets management** (not .env files) in production

### AWS ECS Fargate

```bash
# 1. Push to ECR
aws ecr create-repository --repository-name twilio-azure-agent
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
docker tag twilio-azure-agent:latest ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/twilio-azure-agent:latest
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/twilio-azure-agent:latest

# 2. Store secrets in AWS Secrets Manager
aws secretsmanager create-secret --name twilio-azure/TWILIO_AUTH_TOKEN --secret-string "token"
aws secretsmanager create-secret --name twilio-azure/AZURE_CLIENT_SECRET --secret-string "secret"
# ... repeat for all sensitive vars

# 3. Create task definition & service
# See deployment/aws-ecs-task-definition.json
aws ecs register-task-definition --cli-input-json file://deployment/aws-ecs-task-definition.json
aws ecs create-service --cluster CLUSTER --service-name twilio-azure-agent --task-definition twilio-azure-agent

# 4. Configure ALB for /health health check + WebSocket support
# 5. Update Twilio webhooks to ALB URL
```

**Key Points**: Use Application Load Balancer (not Classic), enable WebSocket upgrade, configure SSL certificate

---

### Google Cloud Run

```bash
# 1. Build and push
gcloud config set project PROJECT_ID
gcloud builds submit --tag gcr.io/PROJECT_ID/twilio-azure-agent

# 2. Create secrets
echo -n "token" | gcloud secrets create twilio-auth-token --data-file=-
# ... repeat for all sensitive vars

# 3. Deploy
gcloud run deploy twilio-azure-agent \
  --image gcr.io/PROJECT_ID/twilio-azure-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --min-instances 1 \
  --timeout 3600 \
  --no-cpu-throttling \
  --set-env-vars NODE_ENV=production \
  --set-secrets PROJECT_ENDPOINT=azure-endpoint:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest
  # ... add all secrets

# 4. Update Twilio webhooks to .run.app URL
```

**Key Points**: `--no-cpu-throttling` is REQUIRED for WebSockets, `--min-instances 1` prevents cold starts

---

### Azure Container Apps

```bash
# 1. Push to ACR
az acr create --resource-group RG_NAME --name REGISTRY_NAME --sku Basic
az acr login --name REGISTRY_NAME
docker tag twilio-azure-agent:latest REGISTRY_NAME.azurecr.io/twilio-azure-agent:latest
docker push REGISTRY_NAME.azurecr.io/twilio-azure-agent:latest

# 2. Create environment & deploy
az extension add --name containerapp --upgrade
az containerapp env create --name twilio-env --resource-group RG_NAME --location eastus
az containerapp create \
  --name twilio-azure-agent \
  --resource-group RG_NAME \
  --environment twilio-env \
  --image REGISTRY_NAME.azurecr.io/twilio-azure-agent:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --secrets azure-client-secret="secret" twilio-auth-token="token" \
  --env-vars NODE_ENV=production AZURE_CLIENT_SECRET=secretref:azure-client-secret

# 3. Update Twilio webhooks to .azurecontainerapps.io URL
```

**Key Points**: Use managed identity when possible, set `--min-replicas 1` for production

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_CLIENT_ID` | Azure Service Principal | `8e7a3538-...` |
| `AZURE_TENANT_ID` | Azure Tenant ID | `418b0a35-...` |
| `AZURE_CLIENT_SECRET` | Azure Secret (sensitive) | `W~08Q~~S~...` |
| `PROJECT_ENDPOINT` | Azure AI endpoint | `https://your-project.services.ai.azure.com` |
| `PROJECT_ID` | Azure AI project ID | `your-project-id` |
| `AGENT_ID` | Azure AI agent ID | `asst_...` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio token (sensitive) | `your-token` |
| `PRODUCTION_DOMAIN` | Production domain | `your-app.com` |

**See `.env.example` for optional variables** (workflow SID, phone number, intelligence SID, etc.)

---

## Monitoring

### Health Check
```bash
curl https://your-domain.com/health
# Returns: {"status":"healthy","service":"twilio-azure-conversation-relay","timestamp":"..."}
```

### View Logs
```bash
# AWS
aws logs tail /ecs/twilio-azure-agent --follow

# GCP
gcloud run logs read --service twilio-azure-agent --follow

# Azure
az containerapp logs show --name twilio-azure-agent --resource-group RG --follow

# Docker
docker-compose logs -f
```

### Metrics to Monitor
- Active WebSocket connections (logged every minute)
- Call success rate
- Health check status (should always be 200)
- Memory/CPU usage

---

## Scaling

**Current**: Single instance with in-memory state (good for 50-100 concurrent calls)

**For >1 instance**: Requires Redis for session state + sticky sessions on load balancer

| Concurrent Calls | Setup | Resources/Instance |
|-----------------|-------|-------------------|
| 1-50 | 1 instance | 0.5 CPU, 512MB |
| 50-100 | 1 instance | 1 CPU, 1GB |
| 100-500 | 2-5 instances + Redis | 1 CPU, 1GB |
| 500+ | Kubernetes + Redis | Autoscaling |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **WebSocket fails** | Verify `PRODUCTION_DOMAIN`, check LB supports WebSocket upgrade, ensure `--no-cpu-throttling` (GCP) |
| **Health check fails** | `curl http://localhost:3000/health`, check logs, verify env vars |
| **Azure auth fails** | Set Service Principal credentials (AZURE_CLIENT_ID/TENANT_ID/CLIENT_SECRET), or use managed identity |
| **Module not found** | Rebuild: `docker build --no-cache -t twilio-azure-agent .` |
| **Twilio timeout** | Verify `/api/incoming-call` is accessible, check Twilio webhook URL |

**Enable debug mode**: Set `DEBUG=1` environment variable

**Testing checklist**:
- [ ] `curl https://your-domain.com/health` returns 200
- [ ] `wscat -c wss://your-domain.com` connects
- [ ] Test call to Twilio number works
- [ ] All environment variables set
- [ ] SSL certificate valid

---

## Important Notes

> ⚠️ **This is an example configuration. Review and customize for your specific production environment, security requirements, and compliance needs before deploying.**

- **Remove** `NODE_TLS_REJECT_UNAUTHORIZED=0` before production (local testing only)
- **Use secrets management** (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault) - never commit secrets
- **Configure monitoring & alerts** for production
- **Test thoroughly** in staging before production
- **Review security**: Network policies, IAM roles, firewall rules
- All cloud platforms provide automatic SSL/TLS
- WebSocket support required (verify load balancer configuration)

**Resources**:
- [Twilio Conversation Relay Docs](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
- [Azure AI Agents SDK](https://learn.microsoft.com/azure/ai-services/)
- Project [README.md](./README.md)
