# Dictionnaire de données — contribution Souleymane

Le schéma est défini dans `operations/models.py`. Tous les montants sont des entiers en XOF.

| Modèle | Rôle | Contraintes majeures |
|---|---|---|
| Agency | Agence d'exploitation | `code` unique |
| Route | Trajet direct origine/destination | durée positive, villes distinctes |
| Driver | Conducteur | numéro de permis unique, date d'expiration |
| Vehicle | Véhicule | immatriculation unique, capacité positive |
| Seat | Siège physique | `(vehicle, number)` unique, numéro positif |
| Departure | Départ planifié | arrivée après départ, tarif XOF |
| DepartureSeat | Inventaire des sièges par départ | `(departure, seat)` unique, siège du véhicule affecté |
| VehicleReplacement | Demande et historique de remplacement | ancien et nouveau véhicule distincts |
| BaggageCategory | Règles de bagages | limites de pièces/poids, supplément par défaut |
| Baggage | Bagage rattaché logiquement à une réservation | reçu unique, pièces positives, suivi d'état |
| BaggageEvent | Journal de suivi des bagages | historique conservé |
| BaggagePaymentLink | Référence vers paiement de Hawa | une liaison par bagage, clé d'idempotence unique |

**Points d'intégration à confirmer :** `reservation_reference`, `payment_reference` et les identifiants d'acteurs doivent être remplacés par des clés étrangères réelles après confirmation des noms d'applications et de modèles de Hawa et du module utilisateurs. Ne pas créer de second modèle de réservation ou de paiement.
