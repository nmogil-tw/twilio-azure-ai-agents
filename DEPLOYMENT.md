# Deployment Guide

This guide provides comprehensive instructions for deploying the Twilio-Azure AI Agent application to production using Docker containers.

## Table of Contents

- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Building the Docker Image](#building-the-docker-image)
- [Cloud Platform Deployment](#cloud-platform-deployment)
  - [AWS ECS Fargate](#aws-ecs-fargate)
  - [Google Cloud Run](#google-cloud-run)
  - [Azure Container Apps](#azure-container-apps)
- [Environment Configuration](#environment-configuration)
- [SSL/TLS and Domain Setup](#ssltls-and-domain-setup)
- [Monitoring and Logging](#monitoring-and-logging)
- [Scaling Considerations](#scaling-considerations)
- [Troubleshooting](#troubleshooting)

---

## Quick Start with Docker Compose

The fastest way to test the Docker deployment locally:

### Prerequisites
- Docker and Docker Compose installed
- `.env` file with your configuration (see `.env.example`)

### Steps

```bash
# 1. Clone the repository (if not already done)
git clone <your-repo>
cd twilio-azure-ai-agents

# 2. Create your .env file from the example
cp .env.example .env
# Edit .env with your actual credentials

# 3. Build and run with Docker Compose
docker-compose up

# 4. Test the health endpoint
curl http://localhost:3000/health
```

The application will be available at `http://localhost:3000`.

### Useful Commands

```bash
# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Rebuild after code changes
docker-compose up --build
```

---

## Building the Docker Image

### Build the Image

```bash
# Build with default tag
docker build -t twilio-azure-agent:latest .

# Build with specific version tag
docker build -t twilio-azure-agent:v1.0.0 .

# Build with multiple tags
docker build -t twilio-azure-agent:latest -t twilio-azure-agent:v1.0.0 .
```

### Test the Image Locally

```bash
# Run with environment file
docker run --env-file .env -p 3000:3000 twilio-azure-agent:latest

# Run with individual environment variables
docker run \
  -e PROJECT_ENDPOINT="https://your-project.services.ai.azure.com" \
  -e PROJECT_ID="your-project-id" \
  -e AGENT_ID="your-agent-id" \
  -e TWILIO_ACCOUNT_SID="ACxxxx" \
  -e TWILIO_AUTH_TOKEN="your-token" \
  -e PRODUCTION_DOMAIN="your-domain.com" \
  -p 3000:3000 \
  twilio-azure-agent:latest
```

### Image Details

- **Base Image**: `node:20-alpine`
- **Final Size**: ~150MB (optimized multi-stage build)
- **User**: Runs as non-root `node` user for security
- **Health Check**: Built-in health check on `/health` endpoint
- **Port**: Exposes port 3000

---

## Cloud Platform Deployment

### AWS ECS Fargate

Amazon ECS (Elastic Container Service) with Fargate provides serverless container deployment.

#### Prerequisites

1. AWS CLI installed and configured
2. Docker image pushed to Amazon ECR (Elastic Container Registry)
3. IAM roles configured (ecsTaskExecutionRole, ecsTaskRole)

#### Step 1: Create ECR Repository

```bash
# Create repository
aws ecr create-repository --repository-name twilio-azure-agent --region us-east-1

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag your image
docker tag twilio-azure-agent:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/twilio-azure-agent:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/twilio-azure-agent:latest
```

#### Step 2: Store Secrets in AWS Secrets Manager

```bash
# Create secrets for sensitive environment variables
aws secretsmanager create-secret \
  --name twilio-azure/TWILIO_AUTH_TOKEN \
  --secret-string "your-twilio-auth-token" \
  --region us-east-1

aws secretsmanager create-secret \
  --name twilio-azure/PROJECT_ENDPOINT \
  --secret-string "https://your-project.services.ai.azure.com" \
  --region us-east-1

# Repeat for other secrets (see deployment/aws-ecs-task-definition.json)
```

#### Step 3: Create Task Definition

```bash
# Edit deployment/aws-ecs-task-definition.json with your values:
# - YOUR_ACCOUNT_ID
# - YOUR_REGION
# - Secret ARNs from step 2

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://deployment/aws-ecs-task-definition.json
```

#### Step 4: Create ECS Cluster and Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name twilio-azure-cluster

# Create service with Application Load Balancer
aws ecs create-service \
  --cluster twilio-azure-cluster \
  --service-name twilio-azure-agent \
  --task-definition twilio-azure-agent \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=twilio-azure-agent,containerPort=3000"
```

#### Step 5: Configure Application Load Balancer

1. Ensure health check is configured to `/health`
2. Configure SSL certificate in ALB
3. Set up WebSocket support (requires ALB, not Classic LB)
4. Update PRODUCTION_DOMAIN to point to your ALB domain

#### Step 6: Update Twilio Webhooks

Update your Twilio phone number webhooks to point to:
```
https://your-alb-domain.com/api/incoming-call
```

---

### Google Cloud Run

Google Cloud Run provides fully managed, automatically scaling container deployment.

#### Prerequisites

1. Google Cloud SDK (gcloud) installed
2. Project created in Google Cloud Console
3. Billing enabled

#### Step 1: Build and Push to Google Container Registry

```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Build and push to GCR
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/twilio-azure-agent
```

#### Step 2: Create Secrets in Secret Manager

```bash
# Create secrets
echo -n "your-twilio-auth-token" | gcloud secrets create twilio-auth-token --data-file=-
echo -n "https://your-project.services.ai.azure.com" | gcloud secrets create azure-project-endpoint --data-file=-
echo -n "your-project-id" | gcloud secrets create azure-project-id --data-file=-
echo -n "your-agent-id" | gcloud secrets create azure-agent-id --data-file=-
echo -n "ACxxxx" | gcloud secrets create twilio-account-sid --data-file=-
echo -n "your-domain.com" | gcloud secrets create production-domain --data-file=-
```

#### Step 3: Deploy to Cloud Run

```bash
# Simple deployment (CLI)
gcloud run deploy twilio-azure-agent \
  --image gcr.io/YOUR_PROJECT_ID/twilio-azure-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 3600 \
  --no-cpu-throttling \
  --set-env-vars NODE_ENV=production,PORT=3000 \
  --set-secrets PROJECT_ENDPOINT=azure-project-endpoint:latest,PROJECT_ID=azure-project-id:latest,AGENT_ID=azure-agent-id:latest,TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,PRODUCTION_DOMAIN=production-domain:latest

# Or use the YAML configuration
# Edit deployment/gcp-cloud-run.yaml with your values
gcloud run services replace deployment/gcp-cloud-run.yaml
```

#### Step 4: Configure Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service twilio-azure-agent \
  --domain your-domain.com \
  --region us-central1

# Follow DNS instructions provided by the command
```

#### Step 5: Update Twilio Webhooks

Update your Twilio phone number webhooks to:
```
https://your-service-xxx.run.app/api/incoming-call
# Or your custom domain:
https://your-domain.com/api/incoming-call
```

**Important Cloud Run Notes:**
- `--no-cpu-throttling` is required for WebSocket connections
- `--min-instances 1` prevents cold starts during calls
- `--timeout 3600` allows long-duration calls (1 hour)
- Generation 2 execution environment supports WebSockets

---

### Azure Container Apps

Azure Container Apps provides a serverless container platform with built-in scaling.

#### Prerequisites

1. Azure CLI installed and authenticated
2. Resource group created
3. Container Apps environment created

#### Step 1: Push to Azure Container Registry

```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name twilio-azure-rg --location eastus

# Create Azure Container Registry
az acr create --resource-group twilio-azure-rg --name YOUR_REGISTRY --sku Basic

# Login to ACR
az acr login --name YOUR_REGISTRY

# Tag and push image
docker tag twilio-azure-agent:latest YOUR_REGISTRY.azurecr.io/twilio-azure-agent:latest
docker push YOUR_REGISTRY.azurecr.io/twilio-azure-agent:latest
```

#### Step 2: Create Container Apps Environment

```bash
# Install Container Apps extension
az extension add --name containerapp --upgrade

# Create Container Apps environment
az containerapp env create \
  --name twilio-azure-env \
  --resource-group twilio-azure-rg \
  --location eastus
```

#### Step 3: Deploy Container App

```bash
# Deploy with secrets
az containerapp create \
  --name twilio-azure-agent \
  --resource-group twilio-azure-rg \
  --environment twilio-azure-env \
  --image YOUR_REGISTRY.azurecr.io/twilio-azure-agent:latest \
  --target-port 3000 \
  --ingress external \
  --cpu 0.5 \
  --memory 1Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --registry-server YOUR_REGISTRY.azurecr.io \
  --secrets \
    azure-project-endpoint="https://your-project.services.ai.azure.com" \
    azure-project-id="your-project-id" \
    azure-agent-id="your-agent-id" \
    twilio-account-sid="ACxxxx" \
    twilio-auth-token="your-auth-token" \
    production-domain="your-domain.com" \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    PROJECT_ENDPOINT=secretref:azure-project-endpoint \
    PROJECT_ID=secretref:azure-project-id \
    AGENT_ID=secretref:azure-agent-id \
    TWILIO_ACCOUNT_SID=secretref:twilio-account-sid \
    TWILIO_AUTH_TOKEN=secretref:twilio-auth-token \
    PRODUCTION_DOMAIN=secretref:production-domain

# Get the application URL
az containerapp show \
  --name twilio-azure-agent \
  --resource-group twilio-azure-rg \
  --query properties.configuration.ingress.fqdn
```

#### Step 4: Update Twilio Webhooks

Update your Twilio phone number webhooks to:
```
https://your-app.xxx.eastus.azurecontainerapps.io/api/incoming-call
```

---

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PROJECT_ENDPOINT` | Azure AI project endpoint | `https://your-project.services.ai.azure.com` |
| `PROJECT_ID` | Azure AI project ID | `your-project-id` |
| `AGENT_ID` | Azure AI agent ID | `your-agent-id` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (sensitive) | `your-secret-token` |
| `PRODUCTION_DOMAIN` | Production domain for webhooks | `your-app.example.com` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Set to `production` in deployment |
| `PORT` | `3000` | Server port |
| `DEBUG` | - | Enable debug logging (set to `1`) |
| `TWILIO_WORKFLOW_SID` | - | For human agent handoff |
| `TWILIO_PHONE_NUMBER` | - | For outbound calling |
| `TWILIO_INTELLIGENCE_SERVICE_SID` | - | For conversation analytics |
| `WELCOME_GREETING` | Default message | Custom greeting message |

See `.env.example` for full configuration options.

---

## SSL/TLS and Domain Setup

### Cloud Platform SSL

All three cloud platforms provide automatic SSL/TLS:

- **AWS ECS**: Configure SSL certificate in Application Load Balancer
- **GCP Cloud Run**: Automatic SSL on `.run.app` domains and custom domains
- **Azure Container Apps**: Automatic SSL on `.azurecontainerapps.io` and custom domains

### Custom Domain Configuration

#### 1. DNS Configuration

Point your domain to your cloud service:

```
# CNAME record example
your-domain.com  CNAME  your-service.cloud-provider.com
```

#### 2. Update PRODUCTION_DOMAIN

Set the `PRODUCTION_DOMAIN` environment variable to your custom domain:

```bash
PRODUCTION_DOMAIN=your-domain.com
```

#### 3. Verify WebSocket Support

Test WebSocket connectivity:

```bash
# Using wscat
npm install -g wscat
wscat -c wss://your-domain.com

# Should connect successfully (Twilio will send data)
```

### Self-Hosted with Nginx

If deploying to a VPS or using nginx as a reverse proxy:

1. Copy `deployment/nginx.conf` to `/etc/nginx/conf.d/`
2. Update `YOUR_DOMAIN` with your actual domain
3. Install SSL certificate (Let's Encrypt recommended):

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (certbot creates cron job automatically)
```

4. Test and reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Monitoring and Logging

### Health Checks

The application provides a `/health` endpoint:

```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "healthy",
  "service": "twilio-azure-conversation-relay",
  "timestamp": "2025-12-01T12:00:00.000Z"
}
```

### Application Logs

The application uses structured logging with Pino. Logs are written to stdout/stderr.

#### Viewing Logs by Platform

**AWS ECS:**
```bash
aws logs tail /ecs/twilio-azure-agent --follow
```

**GCP Cloud Run:**
```bash
gcloud run logs read --service twilio-azure-agent --follow
```

**Azure Container Apps:**
```bash
az containerapp logs show \
  --name twilio-azure-agent \
  --resource-group twilio-azure-rg \
  --follow
```

**Docker Compose:**
```bash
docker-compose logs -f
```

### Log Levels

Set `DEBUG=1` environment variable for verbose logging.

### Metrics to Monitor

1. **Active WebSocket Connections**: Logged every minute
2. **Call Success Rate**: Monitor completed vs failed calls
3. **Health Check Status**: Should always return 200
4. **Memory Usage**: Monitor for memory leaks
5. **CPU Usage**: Monitor under load

### Recommended Monitoring Tools

- **AWS**: CloudWatch
- **GCP**: Cloud Logging + Cloud Monitoring
- **Azure**: Application Insights
- **Self-hosted**: Prometheus + Grafana

---

## Scaling Considerations

### Current Architecture: Single Instance

The application uses **in-memory session state**, which works well for single-instance deployments:

- **Vertical Scaling**: Increase CPU/memory resources
- **Suitable for**: Up to 50-100 concurrent calls per instance

### Horizontal Scaling: Future Enhancement

To scale beyond one instance, you'll need:

#### 1. Redis for Session State

Add Redis to `docker-compose.yml` (example included but commented out):

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

#### 2. Modify State Manager

Update `src/services/stateManager.js` to use Redis instead of in-memory Map:

```javascript
// Current: In-memory Map
const sessions = new Map();

// Future: Redis client
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
```

#### 3. Enable Sticky Sessions

WebSocket connections require sticky sessions (route same client to same instance):

- **AWS ALB**: Enable stickiness on target group
- **GCP Cloud Run**: Not required (single instance per request)
- **Azure Container Apps**: Enable session affinity
- **Nginx**: Use `ip_hash` directive

### Scaling Recommendations

| Concurrent Calls | Architecture | Resources per Instance |
|------------------|--------------|------------------------|
| 1-50 | Single instance | 0.5 CPU, 512MB RAM |
| 50-100 | Single instance | 1 CPU, 1GB RAM |
| 100-500 | 2-5 instances + Redis | 1 CPU, 1GB RAM |
| 500+ | Kubernetes + Redis | Autoscaling |

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Fails

**Symptoms**: Twilio shows "Connection Error"

**Solutions**:
- Verify `PRODUCTION_DOMAIN` is set correctly
- Check load balancer supports WebSocket upgrade
- For GCP Cloud Run, ensure `--no-cpu-throttling` is set
- Test WebSocket connectivity: `wscat -c wss://your-domain.com`

#### 2. Health Check Failing

**Symptoms**: Container restarts frequently

**Solutions**:
```bash
# Check health endpoint
curl http://localhost:3000/health

# View container logs
docker logs container_name

# Check environment variables are set
docker exec container_name env | grep PROJECT
```

#### 3. Azure Authentication Fails

**Symptoms**: "Unable to authenticate with Azure"

**Solutions**:
- For production, set Azure Service Principal credentials:
  ```bash
  AZURE_CLIENT_ID=xxx
  AZURE_TENANT_ID=xxx
  AZURE_CLIENT_SECRET=xxx
  ```
- Or use managed identity in Azure Container Apps
- Verify project endpoint is correct (no trailing `/api/projects/...`)

#### 4. "Cannot find module" Error

**Symptoms**: Container fails to start

**Solutions**:
- Rebuild Docker image: `docker build --no-cache -t twilio-azure-agent .`
- Verify `package.json` and `package-lock.json` are copied correctly
- Check Dockerfile `COPY` commands

#### 5. Twilio Webhook Timeout

**Symptoms**: Calls drop immediately

**Solutions**:
- Verify `/api/incoming-call` endpoint is accessible
- Check webhook URL in Twilio console
- Test endpoint: `curl -X POST https://your-domain.com/api/incoming-call`
- Review application logs for errors

### Debug Mode

Enable verbose logging:

```bash
# In .env or environment variables
DEBUG=1
```

### Testing Checklist

- [ ] Health check responds: `curl https://your-domain.com/health`
- [ ] WebSocket connects: `wscat -c wss://your-domain.com`
- [ ] Twilio webhook works: Make test call
- [ ] Environment variables are set correctly
- [ ] SSL certificate is valid
- [ ] Logs show no errors

### Getting Help

1. Check application logs first
2. Verify all environment variables are set (see `.env.example`)
3. Test each component individually (health, webhook, websocket)
4. Review Twilio debugger: https://console.twilio.com/monitor/debugger

---

## Next Steps

After successful deployment:

1. **Test thoroughly**: Make test calls and verify all features work
2. **Set up monitoring**: Configure alerts for health checks and errors
3. **Document your deployment**: Note your specific configuration
4. **Plan for scaling**: Consider Redis if you need >1 instance
5. **Update Twilio**: Configure all phone numbers to use new webhooks

## Additional Resources

- [Twilio Conversation Relay Documentation](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
- [Azure AI Agents SDK](https://learn.microsoft.com/azure/ai-services/)
- [Docker Documentation](https://docs.docker.com/)
- Project README: [README.md](./README.md)
