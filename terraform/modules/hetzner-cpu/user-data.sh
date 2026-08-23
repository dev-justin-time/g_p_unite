#!/bin/bash
# FCM Agent Server — cloud-init bootstrap
set -euo pipefail

echo "=== FCM Agent Setup: ${agent_id} (${agent_type}) ==="

# Update system
apt-get update -qq
apt-get install -y -qq curl docker.io docker-compose jq

# Install Docker Compose v2
curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create agent directory
mkdir -p /opt/fcm-agent
cd /opt/fcm-agent

# Write agent config
cat > .env <<EOF
FCM_AGENT_TYPE=${agent_type}
FCM_AGENT_ID=${agent_id}
FCM_CAPABILITIES=${capabilities}
FCM_STAKE=${stake}
FCM_REGISTRY_CONTRACT=${registry}
FCM_RPC_URL=${rpc_url}
FCM_TOKEN_CONTRACT=${token}
HEALTH_PORT=8081
EOF

# Pull and start agent container
docker pull ghcr.io/fcm/agent:latest 2>/dev/null || echo "Using local image"
docker-compose up -d

# Install health check monitor
cat > /usr/local/bin/fcm-health-monitor <<'HEALTH'
#!/bin/bash
while true; do
  STATUS=$(curl -sf http://localhost:8081/health | jq -r '.status' 2>/dev/null || echo "unreachable")
  if [ "$STATUS" != "healthy" ]; then
    echo "[$(date -Iseconds)] Agent unhealthy: $STATUS"
    docker restart fcm-agent-${agent_id} 2>/dev/null || true
  fi
  sleep 60
done
HEALTH
chmod +x /usr/local/bin/fcm-health-monitor

# Start health monitor as service
cat > /etc/systemd/system/fcm-health-monitor.service <<EOF
[Unit]
Description=FCM Agent Health Monitor
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/fcm-health-monitor
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable fcm-health-monitor
systemctl start fcm-health-monitor

echo "=== FCM Agent ${agent_id} ready ==="
