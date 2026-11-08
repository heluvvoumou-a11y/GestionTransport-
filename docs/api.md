# Interfaces HTTP de la version initiale
Les écrans Django utilisent des vues authentifiées :
- `GET /` : tableau de bord.
- `GET /departures/` : liste des départs.
- `GET, POST /departures/new/` : création d'un départ.
- `GET, POST /reservations/new/` : réservation.
- `GET /reservations/` : liste des réservations.
- `GET /reservations/<id>/` : détail.
- `GET, POST /reservations/<id>/payment/` : paiement.
- `POST /reservations/<id>/cancel/` : annulation.
- `GET, POST /reservations/<id>/refund/` : remboursement.
- `GET /tickets/` : billets.
- `GET, POST /tickets/check/` : contrôle.
- `GET /luggage/` : bagages.
- `/admin/` : administration Django.

Les vues ne constituent pas encore une API REST publique. Ajouter DRF et une spécification OpenAPI si l'application mobile ou un frontend séparé est retenu.
