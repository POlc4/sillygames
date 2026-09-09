---
name: deploy-check
description: Vérifier l'état de la production SillyGames (VM Oracle, conteneurs, HTTPS, dernière image déployée, sauvegardes) et diagnostiquer un déploiement raté. À utiliser après un push sur main, avant un rollback, ou quand le site ne répond pas.
---

# Vérifier le déploiement

Ne modifie rien sans l'accord de l'utilisateur : ce skill observe et propose.

## 1. Depuis GitHub (lecture publique)

```bash
# Dernier run Deploy et sa conclusion
curl -s "https://api.github.com/repos/POlc4/sillygames/actions/workflows/deploy.yml/runs?per_page=1" \
  | grep -E '"(status|conclusion|head_sha|html_url)"' | head -4
# Images publiées (tags)
curl -s https://ghcr.io/v2/polc4/sillygames-backend/tags/list 2>/dev/null | head -c 400 || echo "paquet privé ou API indisponible"
```

## 2. Depuis l'extérieur (site public)

```bash
DOMAIN=$(grep -m1 '^DOMAIN=' deploy/.env.example | cut -d= -f2)   # remplacer par le vrai domaine
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" "https://$DOMAIN/"
curl -sS "https://$DOMAIN/api/health"
curl -sSI "https://$DOMAIN/" | grep -iE "strict-transport|content-security|x-frame|server:"
```

Attendu : 200, `{"status":"ok","database":"ok"}`, en-têtes de sécurité présents, pas d'en-tête `Server`.

## 3. Sur la VM (SSH, demander l'hôte et l'utilisateur si inconnus)

```bash
ssh <user>@<host> '
  cd /opt/sillygames
  grep ^IMAGE_TAG .env
  docker compose ps
  docker compose logs --no-color --tail 30 backend
  docker compose logs --no-color --tail 30 caddy | grep -iE "error|certificate|obtain" || true
  ls -lt backups | head -4
  df -h / | tail -1
  free -m | head -2
'
```

Points à contrôler : tous les services `healthy`, `IMAGE_TAG` égal au `sha-` du dernier commit de main, certificat obtenu sans erreur dans les logs Caddy, sauvegarde de moins de 48 h, disque sous 80 %.

## 4. Diagnostic rapide

| Symptôme | Cause probable | Piste |
| --- | --- | --- |
| 502 sur tout le site | frontend ou backend non `healthy` | `docker compose logs backend` (migration en échec ?) |
| Certificat invalide | port 80/443 fermé dans le VCN ou iptables, DNS DuckDNS pas à jour | `curl -I http://IP` depuis l'extérieur, `dig +short DOMAIN` |
| Deploy vert mais vieille version | `IMAGE_TAG` non mis à jour ou `pull` en échec (paquet GHCR privé) | visibilité du paquet, `docker compose pull` à la main |
| Site absent, VM arrêtée | récupération Oracle pour inactivité | recréer la VM, `vm-setup.sh`, restaurer la sauvegarde (runbook) |

## 5. Rollback (uniquement si demandé)

```bash
ssh <user>@<host> 'cd /opt/sillygames && sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=sha-<précédent>|" .env && docker compose pull --quiet && docker compose up -d --wait && docker compose ps'
```
