#!/bin/bash
# One-time provisioning for the Lightsail instance that runs the API: Docker, swap and the
# directory deploy.sh ships into. Idempotent, so re-running it after a bundle change is safe.
#
# Run it over ssh rather than as Lightsail user data: user data executes under dash, where the
# `set -o pipefail` below aborts the whole script and leaves a bare box behind.
#
#   scp -i ~/.ssh/study-platform-lightsail scripts/lightsail-provision.sh ubuntu@<ip>:/tmp/
#   ssh  -i ~/.ssh/study-platform-lightsail ubuntu@<ip> 'sudo bash /tmp/lightsail-provision.sh'
#
# Afterwards, write the awslogs driver's credentials into
# /etc/systemd/system/docker.service.d/aws-credentials.conf — see DEPLOYMENT.md §4c.
set -euxo pipefail

# 2 GB matches what the Fargate task had, so this is headroom rather than a crutch:
# it absorbs Whisper/OCR spikes on top of the ~570 MB peak seen in CloudWatch.
# swappiness is low so it is genuinely spare capacity, not a hot path.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
sysctl -p /etc/sysctl.d/99-swappiness.conf

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

usermod -aG docker ubuntu
mkdir -p /opt/study-platform
chmod 700 /opt/study-platform

# Keep any container that falls back to the local log driver from filling the 20 GB disk.
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {"max-size": "10m", "max-file": "3"}
}
JSON
systemctl restart docker
systemctl enable docker

touch /opt/study-platform/.provisioned
