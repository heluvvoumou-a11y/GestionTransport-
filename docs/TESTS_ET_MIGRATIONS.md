# Plan de validation et migrations

## Préparation

1. Installer Django compatible avec `models.CheckConstraint(condition=...)` (Django 5.1+ recommandé) et PostgreSQL.
2. Ajouter `operations.apps.OperationsConfig` à `INSTALLED_APPS` du projet partagé.
3. Configurer PostgreSQL en développement.
4. Générer et relire les migrations : `python manage.py makemigrations operations`.
5. Appliquer : `python manage.py migrate`.
6. Vérifier : `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py test operations`.

**État réel :** les migrations ne sont pas fournies ici : elles doivent être générées avec Django dans le projet intégré. Aucun test Django n'a été exécuté dans cet environnement (Django non installé).

## Recette SOU-DB-01 à SOU-DB-10

- 01/02 : collision véhicule/conducteur, y compris deux transactions concurrentes PostgreSQL. **Non garanti en base actuellement** ; ajouter exclusion PostgreSQL avant mise en production.
- 03 : numéro de siège dupliqué, contrainte unique.
- 04 : capacité maximale, validation/service (verrouiller le véhicule en concurrence).
- 05 : siège appartenant à un autre véhicule, validation applicative.
- 06 : arrivée avant départ, contrainte SQL.
- 07 : 50 places remplacées par 30 avec 40 billets : remplacement bloqué. Exécution complète à intégrer avec les réservations Hawa.
- 08 : paiement de supplément avec clé d'idempotence : lien unique ; véritable unicité du débit à garantir dans Payment Hawa.
- 09 : `makemigrations --check --dry-run` sans différence après génération.
- 10 : suppression véhicule historique, `PROTECT`.

## Contrainte anti-chevauchement à implémenter dans PostgreSQL

Utiliser `btree_gist` et une exclusion GiST par véhicule et par conducteur sur un intervalle `[departure_at - preparation_minutes, planned_arrival_at)`, hors départs annulés. La syntaxe exacte doit être validée selon la version de PostgreSQL et Django. **Le contrôle Python dans `services.py` n'est pas une protection suffisante contre les réservations concurrentes.**
