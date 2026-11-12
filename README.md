# Gestion du transport de voyageurs — Groupe 2

Application Django de gestion d'une compagnie de transport interurbain.

## Prérequis
- Python 3.13 recommandé (Python 3.10+ compatible avec Django 5.2).
- Git.
- PyCharm ou VS Code.
- Optionnel : Docker Desktop pour PostgreSQL via Compose.

## Installation Windows (PowerShell)
```powershell
cd chemin\vers\gestion_transport_voyageurs
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py makemigrations accounts operations
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```
Ouvrir http://127.0.0.1:8000

Compte de démonstration créé par `seed_demo` :
- Identifiant : `admin`
- Mot de passe : `Admin12345!`
Changez ce mot de passe après la première connexion. Ce compte est uniquement destiné au développement local.

## API REST pour le frontend HTML/CSS/JavaScript

Django REST Framework, JWT et CORS sont inclus dans `requirements.txt`.
Consultez `docs/api.md` pour les URLs, méthodes HTTP, exemples JSON et l'authentification.

Après installation des dépendances, lancez le backend avec :
```powershell
python manage.py runserver 0.0.0.0:8000
```
L'API est disponible à `http://127.0.0.1:8000/api/`. Pour connecter un autre ordinateur du réseau local, utilisez l'adresse IPv4 du PC serveur et configurez `CORS_ALLOWED_ORIGINS` pour l'origine exacte du frontend.

## Administration
http://127.0.0.1:8000/admin/

## Exécuter les tests
```powershell
python manage.py test
python manage.py check
```

## Expiration des réservations
À exécuter périodiquement :
```powershell
python manage.py expire_reservations
```
En production, planifier cette commande avec cron ou un ordonnanceur.

## PostgreSQL avec Docker
```powershell
docker compose up --build
```
Puis dans un autre terminal :
```powershell
docker compose exec web python manage.py seed_demo
```
Accès : http://127.0.0.1:8000

## Git
```bash
git switch -c feat/nom-de-la-tache
git add .
git commit -m "feat: description"
git push -u origin feat/nom-de-la-tache
```
Créer ensuite une merge request/pull request. Ne pas committer `.env`, mots de passe ou clés.

## Important avant production
Cette livraison est une base pédagogique testable, pas un système de transport prêt à encaisser de vrais paiements. Il faut compléter les permissions fines par rôle, les règles de caisse, les protections de concurrence testées sur PostgreSQL, les sauvegardes/restaurations, la supervision, le HTTPS et les scénarios TRA restants. Les paiements Mobile Money/carte sont simulés.
