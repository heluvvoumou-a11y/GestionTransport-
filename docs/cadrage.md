# Cadrage — Gestion du transport de voyageurs

## Objectif
Centraliser la planification des départs, la réservation des sièges, l'émission des billets, les paiements, le contrôle à l'embarquement, les annulations, les remboursements et les bagages d'une compagnie possédant plusieurs agences.

## Acteurs
- Agent de guichet : recherche un départ, réserve une place, encaisse un paiement et remet un billet.
- Responsable exploitation : gère les trajets, véhicules, conducteurs et départs.
- Contrôleur : vérifie le billet et enregistre l'embarquement.
- Caissier : rapproche les encaissements et remboursements.
- Responsable compagnie : supervise les agences, utilisateurs et opérations sensibles.

## Périmètre du socle
Agences, trajets directs, véhicules, conducteurs, sièges, départs, réservations temporaires, paiements manuels, billets, embarquement, annulation, remboursement et bagages.

## Hors périmètre initial
Vente de places par tronçons, géolocalisation GPS temps réel et paiement en ligne réel. Les moyens Mobile Money et carte de cette version sont des simulations, pas des intégrations de paiement.

## Règles métier
1. Un siège d'un départ ne peut avoir qu'une réservation active.
2. Une réservation temporaire expire après 15 minutes.
3. Un billet est émis uniquement lorsque le montant dû est entièrement encaissé.
4. Un paiement ne peut pas dépasser le montant restant dû.
5. Un billet ne peut être contrôlé qu'une fois.
6. Le total remboursé ne dépasse jamais le total réellement encaissé.
7. Un véhicule et un conducteur ne peuvent pas être affectés à deux départs dont les périodes se chevauchent.
8. Les montants sont exprimés en FCFA entiers.
9. Les opérations critiques doivent être effectuées côté serveur dans une transaction.
10. Les rôles et autorisations doivent être contrôlés côté serveur avant ouverture à la production.

## Hypothèses à valider avec l'enseignant
- Politique exacte de remboursement et frais d'annulation.
- Durée réelle de réservation temporaire.
- Temps de battement requis entre deux voyages d'un même véhicule/conducteur.
- Documents d'identité obligatoires ou facultatifs.
- Procédure de clôture de caisse et règles de rapprochement.

## Critères d'acceptation
Un agent peut réserver une place disponible, encaisser le montant dû, obtenir un billet, puis un contrôleur peut enregistrer l'embarquement une seule fois. Les conflits de siège, les paiements excessifs et les remboursements excessifs sont refusés.
