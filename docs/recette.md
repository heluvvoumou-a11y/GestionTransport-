# Cahier de recette — à compléter après exécution
| ID | Scénario | Résultat attendu | Résultat observé | Statut |
|---|---|---|---|---|
| TRA01 | Deux agents réservent le même dernier siège simultanément | Une seule réservation active | À exécuter | À faire |
| TRA02 | Même demande de paiement soumise deux fois | Pas de double paiement logique | À renforcer / tester | À faire |
| TRA03 | Même billet contrôlé deux fois | Second contrôle refusé | Test automatisé inclus | À vérifier |
| TRA04 | Paiement après expiration | Pas de billet sans réservation valide | Test à compléter | À faire |
| TRA05 | Véhicule/conducteur déjà affecté | Affectation incompatible refusée | Contrôle de chevauchement simple | À vérifier |
| TRA06 | Remboursement supérieur au montant encaissé | Refus | Test automatisé inclus | À vérifier |
| TRA07 | Remplacement par véhicule de capacité insuffisante | Blocage et plan de réaffectation | Non implémenté | À faire |
| TRA08-09 | Expiration et confirmation concurrentes | État cohérent | À tester sur PostgreSQL | À faire |
| TRA10-11 | Double supplément bagage et capacité véhicule | Pas de double encaissement / dépassement | À faire | À faire |

Ne déclarez jamais un test réussi sans l'avoir exécuté et consigné.
