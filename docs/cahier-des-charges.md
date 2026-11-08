# Cahier des charges — version initiale

## Objectif
Fournir une application web responsive de gestion du transport de voyageurs.

## Acteurs
- Agent de guichet : réservation et encaissement dans son agence.
- Responsable exploitation : départs et remplacement de véhicule.
- Contrôleur : consultation du manifeste et validation de l'embarquement.
- Caissier : rapprochement des encaissements et remises.
- Responsable compagnie : consultation multi-agences et autorisation des remboursements.

## Exigences initiales
- EXG01 : un siège ne peut appartenir à deux réservations actives du même départ.
- EXG02 : un véhicule ou un conducteur ne peut être affecté à deux départs qui se chevauchent.
- EXG03 : un billet annulé ne peut pas autoriser l'embarquement.
- EXG04 : un remboursement ne dépasse jamais le montant net encaissé.
- EXG05 : une opération non confirmée par le serveur ne doit jamais être présentée comme réussie.
- NFR01 : interface utilisable à 360 px de largeur.
- NFR02 : droits contrôlés côté serveur.
- NFR03 : montants en XOF exacts et dates stockées en UTC.
- NFR04 : erreurs et coupures réseau signalées clairement.
- NFR05 : cible de test indicative p95 < 2 secondes sur les lectures courantes avec 20 utilisateurs simulés.

## Statut
Document de départ à relire et valider avec l'enseignant. Les règles tarifaires non précisées restent à confirmer.
