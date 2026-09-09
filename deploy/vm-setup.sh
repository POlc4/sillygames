#!/usr/bin/env bash
# Prépare une VM Ubuntu 24.04 (Oracle Always Free) pour héberger SillyGames.
# À lancer une fois, en tant qu'utilisateur sudo (ubuntu) : bash vm-setup.sh
# Idempotent : peut être relancé sans dégât.
set -euo pipefail

APP_DIR=/opt/sillygames
REPO_RAW=https://raw.githubusercontent.com/POlc4/sillygames/main/deploy

echo ">>> Paquets de base"
sudo apt-get update -q
sudo apt-get install -y -q ca-certificates curl gnupg iptables-persistent

echo ">>> Docker Engine (dépôt officiel, versions figées par apt)"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -q
  sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker

echo ">>> Pare-feu : ouverture de 80 et 443 (les images Oracle bloquent tout sauf 22 dans iptables)"
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 5 -p tcp --dport "$port" -j ACCEPT
  fi
done
if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
fi
sudo netfilter-persistent save
echo "    Rappel : ouvrir aussi 80/443 dans la Security List du VCN (console Oracle)."

echo ">>> Swap (les VM à 1 Go en ont besoin)"
if [ ! -f /swapfile ] && [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 2048 ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo ">>> Dossier applicatif $APP_DIR"
sudo mkdir -p "$APP_DIR/backups"
sudo chown -R "$USER:$USER" "$APP_DIR"
cd "$APP_DIR"
curl -fsSL "$REPO_RAW/docker-compose.prod.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/Caddyfile" -o Caddyfile
curl -fsSL "$REPO_RAW/backup.sh" -o backup.sh && chmod +x backup.sh
if [ ! -f .env ]; then
  curl -fsSL "$REPO_RAW/.env.example" -o .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
  chmod 600 .env
  echo "    .env créé avec des secrets aléatoires. Renseigner DOMAIN avant le premier démarrage."
fi

echo ">>> Sauvegarde quotidienne (03:00) et nettoyage des images"
( crontab -l 2>/dev/null | grep -v sillygames ; \
  echo "0 3 * * * $APP_DIR/backup.sh >> $APP_DIR/backups/backup.log 2>&1 # sillygames" ; \
  echo "30 3 * * 0 docker image prune -f >/dev/null 2>&1 # sillygames" ) | crontab -

echo ">>> Terminé. Étapes suivantes :"
echo "    1. Se déconnecter/reconnecter (groupe docker)."
echo "    2. Éditer $APP_DIR/.env : DOMAIN=<sous-domaine>.duckdns.org"
echo "    3. cd $APP_DIR && docker compose pull && docker compose up -d"
