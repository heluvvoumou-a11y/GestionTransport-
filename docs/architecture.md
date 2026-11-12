# Architecture
- Django 5.2 : application web monolithique.
- PostgreSQL : base de production recommandée.
- SQLite : mode de démarrage et démonstration locale.
- Templates Django : interface responsive de première version.
- Services métier dans `operations/services.py` : réservations, paiements, remboursements et embarquement.
- Tests Django : tests unitaires et intégration.
- Docker Compose : environnement reproductible.
- GitHub Actions : vérification automatique sur push et pull request.

## Limites de cette version
Le contrôle d'accès fin par rôle, les intégrations réelles de paiement, QR code scannable, clôture de caisse avancée, plan de réaffectation de véhicule et sauvegardes automatisées doivent être finalisés avant un usage réel.
