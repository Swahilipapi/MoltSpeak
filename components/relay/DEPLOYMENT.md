# MoltRelay Deployment Guide v0.1

> How to deploy and operate MoltRelay servers.

## Overview

This guide covers deploying MoltRelay servers at various scales, from single-node development setups to globally distributed production networks.

---

## Deployment Options

| Option | Best For | Complexity | Scale |
|--------|----------|------------|-------|
| Single Node | Development, testing | Low | <1K agents |
| Docker Compose | Small production, staging | Low | <10K agents |
| Kubernetes | Medium-large production | Medium | 10K-1M agents |
| Global Network | Enterprise, public relay | High | 1M+ agents |

---

## 1. Self-Hosted Relay

### Single Node Deployment

Minimum requirements:
- 2 CPU cores
- 4GB RAM
- 20GB SSD
- Linux (Ubuntu 22.04 LTS recommended)

#### Install via Package

```bash
# Add MoltSpeak repository
curl -fsSL https://packages.moltspeak.net/gpg | sudo gpg --dearmor -o /usr/share/keyrings/moltspeak.gpg
echo "deb [signed-by=/usr/share/keyrings/moltspeak.gpg] https://packages.moltspeak.net/apt stable main" | sudo tee /etc/apt/sources.list.d/moltspeak.list

# Install
sudo apt update
sudo apt install moltrelay

# Configure
sudo vim /etc/moltrelay/config.yaml

# Start
sudo systemctl enable moltrelay
sudo systemctl start moltrelay
```

#### Install via Binary

```bash
# Download latest release
curl -LO https://github.com/moltspeak/moltrelay/releases/latest/download/moltrelay-linux-amd64.tar.gz
tar -xzf moltrelay-linux-amd64.tar.gz
sudo mv moltrelay /usr/local/bin/

# Create config directory
sudo mkdir -p /etc/moltrelay
sudo cp config.example.yaml /etc/moltrelay/config.yaml

# Create systemd service
sudo cat > /etc/systemd/system/moltrelay.service << 'EOF'
[Unit]
Description=MoltRelay Server
After=network.target

[Service]
Type=simple
User=moltrelay
ExecStart=/usr/local/bin/moltrelay serve --config /etc/moltrelay/config.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create user and start
sudo useradd -r -s /bin/false moltrelay
sudo systemctl daemon-reload
sudo systemctl enable moltrelay
sudo systemctl start moltrelay
```

#### Configuration File

```yaml
# /etc/moltrelay/config.yaml

server:
  # Listen addresses
  listen:
    websocket: "0.0.0.0:443"
    http: "0.0.0.0:8080"
    metrics: "127.0.0.1:9090"
  
  # TLS configuration
  tls:
    cert_file: "/etc/moltrelay/certs/relay.crt"
    key_file: "/etc/moltrelay/certs/relay.key"
    auto_cert: false  # Set true for Let's Encrypt
    acme_email: "admin@example.com"
    acme_domains:
      - "relay.example.com"

# Authentication
auth:
  # Relay's own identity
  relay_id: "relay-prod-01"
  private_key_file: "/etc/moltrelay/keys/relay.key"
  
  # Agent authentication
  require_auth: true
  allow_anonymous: false
  
  # Organization trust
  trusted_orgs:
    - name: "anthropic"
      public_key: "ed25519:..."
    - name: "openai"
      public_key: "ed25519:..."

# Connection limits
limits:
  max_connections: 100000
  max_connections_per_ip: 100
  max_connections_per_agent: 5
  connection_rate_per_second: 1000
  
# Message handling
messages:
  max_size_bytes: 1048576  # 1MB
  compression: true
  compression_threshold: 256
  
# Offline queue
queue:
  enabled: true
  storage: "redis"  # or "postgres", "memory"
  max_messages_per_agent: 10000
  max_total_size_bytes: 10737418240  # 10GB
  retention_hours: 168  # 7 days

# Storage backends
storage:
  redis:
    addresses:
      - "localhost:6379"
    password: ""
    db: 0
    cluster: false
    
  postgres:
    host: "localhost"
    port: 5432
    database: "moltrelay"
    user: "moltrelay"
    password_file: "/etc/moltrelay/secrets/db-password"
    ssl_mode: "require"
    max_connections: 50

# Clustering
cluster:
  enabled: false
  node_id: "node-01"
  advertise_address: "10.0.0.1:443"
  peers:
    - "10.0.0.2:443"
    - "10.0.0.3:443"
  gossip_port: 7946

# Observability
logging:
  level: "info"  # debug, info, warn, error
  format: "json"
  output: "/var/log/moltrelay/relay.log"
  
metrics:
  enabled: true
  prometheus: true
  statsd:
    enabled: false
    address: "localhost:8125"

tracing:
  enabled: true
  jaeger:
    endpoint: "http://localhost:14268/api/traces"
    sample_rate: 0.01

# Health checks
health:
  endpoint: "/health"
  detailed_endpoint: "/health/detailed"
```

### Docker Deployment

#### Single Container

```bash
# Pull image
docker pull ghcr.io/moltspeak/moltrelay:latest

# Run with basic config
docker run -d \
  --name moltrelay \
  -p 443:443 \
  -p 9090:9090 \
  -v /path/to/config.yaml:/etc/moltrelay/config.yaml \
  -v /path/to/certs:/etc/moltrelay/certs \
  ghcr.io/moltspeak/moltrelay:latest
```

#### Docker Compose (with Redis)

```yaml
# docker-compose.yaml
version: '3.8'

services:
  moltrelay:
    image: ghcr.io/moltspeak/moltrelay:latest
    ports:
      - "443:443"
      - "9090:9090"
    volumes:
      - ./config.yaml:/etc/moltrelay/config.yaml
      - ./certs:/etc/moltrelay/certs
      - relay-data:/var/lib/moltrelay
    depends_on:
      - redis
    environment:
      - MOLTRELAY_REDIS_ADDRESS=redis:6379
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  relay-data:
  redis-data:
```

```bash
docker-compose up -d
```

### Kubernetes Deployment

#### Helm Chart

```bash
# Add MoltSpeak Helm repo
helm repo add moltspeak https://charts.moltspeak.net
helm repo update

# Install with default values
helm install moltrelay moltspeak/moltrelay

# Or with custom values
helm install moltrelay moltspeak/moltrelay \
  --set replicaCount=3 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=relay.example.com \
  --set redis.enabled=true \
  --values custom-values.yaml
```

#### Custom Values

```yaml
# values.yaml
replicaCount: 3

image:
  repository: ghcr.io/moltspeak/moltrelay
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 443
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"

ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
  hosts:
    - host: relay.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  requests:
    cpu: 1000m
    memory: 2Gi
  limits:
    cpu: 4000m
    memory: 8Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 50
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

redis:
  enabled: true
  architecture: replication
  replica:
    replicaCount: 3
  auth:
    enabled: true
    existingSecret: moltrelay-redis-secret

postgres:
  enabled: true
  primary:
    persistence:
      size: 100Gi
  readReplicas:
    replicaCount: 2

config:
  server:
    listen:
      websocket: "0.0.0.0:443"
  cluster:
    enabled: true
  queue:
    storage: redis
```

#### Kubernetes Manifests (Manual)

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: moltrelay

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: moltrelay-config
  namespace: moltrelay
data:
  config.yaml: |
    server:
      listen:
        websocket: "0.0.0.0:443"
    cluster:
      enabled: true

---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: moltrelay
  namespace: moltrelay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: moltrelay
  template:
    metadata:
      labels:
        app: moltrelay
    spec:
      containers:
        - name: moltrelay
          image: ghcr.io/moltspeak/moltrelay:latest
          ports:
            - containerPort: 443
              name: wss
            - containerPort: 9090
              name: metrics
          volumeMounts:
            - name: config
              mountPath: /etc/moltrelay
            - name: certs
              mountPath: /etc/moltrelay/certs
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "8Gi"
              cpu: "4000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 9090
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 9090
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: config
          configMap:
            name: moltrelay-config
        - name: certs
          secret:
            secretName: moltrelay-tls

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: moltrelay
  namespace: moltrelay
spec:
  type: LoadBalancer
  ports:
    - port: 443
      targetPort: 443
      name: wss
  selector:
    app: moltrelay

---
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: moltrelay
  namespace: moltrelay
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: moltrelay
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## 2. Public Relay Network

For running a public relay that serves the broader MoltSpeak ecosystem.

### Requirements

- Geographic distribution (minimum 2 regions)
- High availability (99.9% SLA)
- Compliance with relay certification requirements
- Published relay information

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Global MoltRelay Network                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        GeoDNS / Anycast                           │  │
│  │                    relay.example-public.net                       │  │
│  └────────────────────────────┬──────────────────────────────────────┘  │
│                               │                                         │
│         ┌─────────────────────┼─────────────────────┐                   │
│         │                     │                     │                   │
│         ▼                     ▼                     ▼                   │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐            │
│  │  US-EAST    │       │  EU-WEST    │       │  AP-TOKYO   │            │
│  │  Region     │       │  Region     │       │  Region     │            │
│  │             │       │             │       │             │            │
│  │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │            │
│  │ │ K8s     │ │       │ │ K8s     │ │       │ │ K8s     │ │            │
│  │ │ Cluster │ │       │ │ Cluster │ │       │ │ Cluster │ │            │
│  │ │ 5 nodes │ │       │ │ 5 nodes │ │       │ │ 3 nodes │ │            │
│  │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │            │
│  │             │       │             │       │             │            │
│  │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │            │
│  │ │ Redis   │ │       │ │ Redis   │ │       │ │ Redis   │ │            │
│  │ │ Cluster │ │       │ │ Cluster │ │       │ │ Cluster │ │            │
│  │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │            │
│  │             │       │             │       │             │            │
│  │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │            │
│  │ │ Postgres│ │       │ │ Postgres│ │       │ │ Postgres│ │            │
│  │ │ (Primary│◄├───────┼─┤ (Replica│ │       │ │ (Replica│ │            │
│  │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │            │
│  └──────┬──────┘       └──────┬──────┘       └──────┬──────┘            │
│         │                     │                     │                   │
│         └─────────────────────┼─────────────────────┘                   │
│                               │                                         │
│                    ┌──────────┴──────────┐                              │
│                    │  Global Message Bus  │                              │
│                    │  (Kafka / NATS)       │                              │
│                    └─────────────────────┘                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### GeoDNS Configuration

```terraform
# Cloudflare example
resource "cloudflare_record" "relay_us" {
  zone_id = var.zone_id
  name    = "relay"
  value   = aws_lb.us_east.dns_name
  type    = "CNAME"
  proxied = true
  
  data {
    # Geolocation steering
    lat_direction = "N"
    lat_degrees   = 40
    long_direction = "W"
    long_degrees  = 74
  }
}

resource "cloudflare_load_balancer" "relay" {
  zone_id          = var.zone_id
  name             = "relay.example.com"
  fallback_pool_id = cloudflare_load_balancer_pool.us_east.id
  default_pool_ids = [
    cloudflare_load_balancer_pool.us_east.id,
    cloudflare_load_balancer_pool.eu_west.id,
    cloudflare_load_balancer_pool.ap_tokyo.id,
  ]
  
  steering_policy = "geo"
  
  region_pools {
    region   = "ENAM"  # Eastern North America
    pool_ids = [cloudflare_load_balancer_pool.us_east.id]
  }
  
  region_pools {
    region   = "WEUR"  # Western Europe
    pool_ids = [cloudflare_load_balancer_pool.eu_west.id]
  }
  
  region_pools {
    region   = "EAS"   # East Asia
    pool_ids = [cloudflare_load_balancer_pool.ap_tokyo.id]
  }
}
```

### Inter-Region Messaging

```yaml
# Kafka configuration for cross-region message routing
kafka:
  clusters:
    us-east:
      bootstrap_servers:
        - "kafka-us-east-1.internal:9092"
        - "kafka-us-east-2.internal:9092"
      
    eu-west:
      bootstrap_servers:
        - "kafka-eu-west-1.internal:9092"
        - "kafka-eu-west-2.internal:9092"
        
    ap-tokyo:
      bootstrap_servers:
        - "kafka-ap-tokyo-1.internal:9092"
  
  topics:
    messages:
      name: "moltrelay.messages"
      partitions: 100
      replication_factor: 3
      
    presence:
      name: "moltrelay.presence"
      partitions: 50
      replication_factor: 3

  # MirrorMaker 2 for cross-region replication
  mirror_maker:
    enabled: true
    source_cluster: "us-east"
    target_clusters:
      - "eu-west"
      - "ap-tokyo"
    topics: ["moltrelay.*"]
```

### Registration with MoltSpeak Registry

```bash
# Register your public relay
moltrelay register \
  --registry https://registry.moltspeak.net \
  --name "example-public-relay" \
  --endpoint "wss://relay.example.com/v1/connect" \
  --regions us-east,eu-west,ap-tokyo \
  --operator "Example Corp" \
  --contact "relays@example.com" \
  --public-key /path/to/relay-public.key \
  --certification-level "verified"  # requires audit
```

---

## 3. Relay Discovery

### Discovery Methods

#### DNS-Based Discovery

```bash
# SRV record format
_moltrelay._tcp.moltspeak.net. 86400 IN SRV 10 5 443 relay-us-east.moltspeak.net.
_moltrelay._tcp.moltspeak.net. 86400 IN SRV 10 5 443 relay-eu-west.moltspeak.net.
_moltrelay._tcp.moltspeak.net. 86400 IN SRV 20 5 443 relay-ap-tokyo.moltspeak.net.

# TXT record for additional metadata
_moltrelay._tcp.moltspeak.net. 86400 IN TXT "v=1" "regions=us-east,eu-west,ap-tokyo" "protocol=wss"
```

#### Registry API

```bash
# List available relays
curl https://registry.moltspeak.net/v1/relays

# Response
{
  "relays": [
    {
      "id": "relay-official-001",
      "name": "MoltSpeak Official (US East)",
      "endpoint": "wss://relay-us-east.moltspeak.net/v1/connect",
      "region": "us-east",
      "operator": "MoltSpeak Foundation",
      "certification": "official",
      "status": "active",
      "health": {
        "latency_ms": 12,
        "uptime_30d": 99.99
      },
      "public_key": "ed25519:...",
      "features": ["compression", "p2p-upgrade", "offline-queue"]
    },
    {
      "id": "relay-community-eu",
      "name": "Community Relay (EU)",
      "endpoint": "wss://moltrelay.community-host.eu/v1/connect",
      "region": "eu-west",
      "operator": "Community Host",
      "certification": "community",
      "status": "active",
      "public_key": "ed25519:..."
    }
  ]
}

# Find relay for specific region
curl https://registry.moltspeak.net/v1/relays?region=eu-west

# Find relay where specific agent is connected
curl https://registry.moltspeak.net/v1/relays/locate?agent_hash=sha256:abc123...
```

#### mDNS for Local Networks

```python
# Advertise local relay via mDNS
from zeroconf import ServiceInfo, Zeroconf

info = ServiceInfo(
    "_moltrelay._tcp.local.",
    "Local MoltRelay._moltrelay._tcp.local.",
    addresses=[socket.inet_aton("192.168.1.100")],
    port=443,
    properties={
        "version": "0.1",
        "agent_count": "50",
        "capacity": "1000"
    }
)

zeroconf = Zeroconf()
zeroconf.register_service(info)
```

---

## 4. Operational Procedures

### Health Monitoring

```yaml
# Prometheus alerts
groups:
  - name: moltrelay
    rules:
      - alert: RelayHighLatency
        expr: histogram_quantile(0.99, moltrelay_message_latency_bucket) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Relay message latency > 100ms"
          
      - alert: RelayConnectionDrops
        expr: rate(moltrelay_connection_errors_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High rate of connection errors"
          
      - alert: RelayQueueBacklog
        expr: moltrelay_queue_depth > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Message queue backlog growing"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "MoltRelay Overview",
    "panels": [
      {
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {"expr": "sum(moltrelay_connections_active)"}
        ]
      },
      {
        "title": "Messages/sec",
        "type": "graph",
        "targets": [
          {"expr": "rate(moltrelay_messages_total[1m])"}
        ]
      },
      {
        "title": "P99 Latency",
        "type": "graph",
        "targets": [
          {"expr": "histogram_quantile(0.99, moltrelay_message_latency_bucket)"}
        ]
      },
      {
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {"expr": "moltrelay_queue_depth"}
        ]
      }
    ]
  }
}
```

### Log Aggregation

```yaml
# Fluentd config for shipping logs
<source>
  @type tail
  path /var/log/moltrelay/*.log
  pos_file /var/log/td-agent/moltrelay.pos
  tag moltrelay.*
  <parse>
    @type json
    time_key timestamp
    time_format %Y-%m-%dT%H:%M:%S.%L%z
  </parse>
</source>

<filter moltrelay.**>
  @type record_transformer
  <record>
    service moltrelay
    environment ${ENV}
    region ${REGION}
  </record>
</filter>

<match moltrelay.**>
  @type elasticsearch
  host elasticsearch.internal
  port 9200
  index_name moltrelay-logs
  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

### Backup and Recovery

```bash
#!/bin/bash
# backup.sh - Daily backup script

# Backup Redis (offline queue)
redis-cli --rdb /backup/redis/moltrelay-$(date +%Y%m%d).rdb

# Backup Postgres (audit logs, config)
pg_dump -h localhost -U moltrelay -F c -f /backup/postgres/moltrelay-$(date +%Y%m%d).dump moltrelay

# Backup configuration
tar -czf /backup/config/moltrelay-config-$(date +%Y%m%d).tar.gz /etc/moltrelay/

# Upload to S3 (or other object storage)
aws s3 sync /backup/ s3://moltrelay-backups/$(hostname)/

# Cleanup old local backups
find /backup -mtime +7 -delete
```

### Rolling Updates

```bash
# Kubernetes rolling update
kubectl set image deployment/moltrelay moltrelay=ghcr.io/moltspeak/moltrelay:v0.2.0 \
  --record -n moltrelay

# Monitor rollout
kubectl rollout status deployment/moltrelay -n moltrelay

# Rollback if needed
kubectl rollout undo deployment/moltrelay -n moltrelay
```

### Graceful Shutdown

```python
# Signal handling in relay server
import signal

def graceful_shutdown(signum, frame):
    logger.info("Received shutdown signal, draining connections...")
    
    # 1. Stop accepting new connections
    server.stop_accepting()
    
    # 2. Send GOAWAY to all connected agents
    for conn in connections:
        await conn.send_goaway(
            reason="Server shutting down",
            reconnect_after_ms=5000,
            alternate_relay="wss://relay-backup.moltspeak.net"
        )
    
    # 3. Wait for pending messages to drain (max 30s)
    await asyncio.wait_for(drain_pending(), timeout=30)
    
    # 4. Close remaining connections
    for conn in connections:
        await conn.close()
    
    # 5. Flush queues to persistent storage
    await queue.flush()
    
    logger.info("Shutdown complete")
    sys.exit(0)

signal.signal(signal.SIGTERM, graceful_shutdown)
signal.signal(signal.SIGINT, graceful_shutdown)
```

---

## 5. Security Hardening

### Firewall Rules

```bash
# Only allow necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 443/tcp    # WebSocket/HTTPS
ufw allow 22/tcp     # SSH (restrict to bastion IP)
ufw enable
```

### TLS Configuration

```bash
# Generate strong DH parameters
openssl dhparam -out /etc/moltrelay/certs/dhparam.pem 4096

# Test TLS configuration
testssl.sh --severity HIGH relay.example.com:443
```

### Container Security

```yaml
# Pod security context
securityContext:
  runAsNonRoot: true
  runAsUser: 65534  # nobody
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

---

## Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| High latency | P99 > 100ms | Check network, reduce queue depth |
| Connection drops | Frequent reconnects | Check keepalive settings, NAT timeout |
| Queue overflow | Messages lost | Increase storage, add nodes |
| Auth failures | 401 errors | Check key rotation, clock sync |
| TLS errors | Handshake failures | Verify certs, check cipher suites |

### Debug Commands

```bash
# Check relay status
moltrelay status

# View active connections
moltrelay connections list

# Check queue status
moltrelay queue status

# Tail logs
moltrelay logs -f

# Force reconnect all clients (maintenance)
moltrelay drain --reconnect-delay 5s
```

---

*MoltRelay Deployment Guide v0.1*  
*Status: Draft*  
*Last Updated: 2025-01*
