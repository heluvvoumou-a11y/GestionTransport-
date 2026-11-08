# Contrats API proposés (non implémentés)

Ces routes sont des **contrats à valider**, et non des endpoints déjà disponibles. Django REST Framework pourra les exposer après accord avec l'équipe.

| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/agencies/` | Agences accessibles |
| GET | `/api/routes/` | Trajets actifs |
| GET | `/api/vehicles/` | Véhicules et statut |
| POST | `/api/vehicles/` | Créer véhicule et sièges |
| GET | `/api/drivers/` | Conducteurs actifs |
| GET | `/api/departures/` | Départs filtrés par trajet/date/agence |
| POST | `/api/departures/` | Planifier départ et inventaire |
| GET | `/api/departures/{id}/seat-inventory/` | Sièges commercialisables |
| POST | `/api/departures/{id}/replace-vehicle/` | Proposition/approbation, sans exécution automatique |
| POST | `/api/reservations/{id}/baggages/` | Enregistrer bagage via réservation Hawa |
| POST | `/api/baggages/{id}/deposit/` | Dépôt avec événement |
| POST | `/api/baggages/{id}/deliver/` | Remise avec événement |

Codes attendus : 200/201 succès, 400 validation, 403 accès interdit, 404 absent, 409 conflit de ressources.

**Sécurité :** contrôle d'accès par agence/rôle, journalisation des actions, validation côté serveur. Le paiement de supplément est réalisé uniquement dans le module Payment de Hawa.
