# API REST — Gestion du transport de voyageurs

Cette API est destinée au frontend séparé HTML/CSS/JavaScript. Toutes les routes commencent par `/api/`.
Les réponses et requêtes utilisent JSON. Les montants sont des entiers en FCFA et les dates sont ISO 8601.

## 1. Démarrage

```powershell
cd chemin\vers\gestion_transport_voyageurs
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```

- API locale : `http://127.0.0.1:8000/api/`
- Depuis un autre PC du même réseau : remplacer `127.0.0.1` par l'adresse IPv4 du PC serveur.
- Pour trouver l'adresse IPv4 : `ipconfig` dans PowerShell, rubrique « Adresse IPv4 ».
- Le serveur doit être lancé avec `0.0.0.0:8000` pour accepter les connexions du réseau local.
- Créer/choisir un utilisateur Django via `/admin/` ou le compte de démonstration documenté dans le README. Changez le mot de passe de démonstration.

## 2. Authentification

Authentification JWT. Pour les routes protégées, envoyer l'en-tête :

`Authorization: Bearer VOTRE_ACCESS_TOKEN`

| URL | Méthode | Données à envoyer | Réponse |
|---|---|---|---|
| `/api/token/` | POST | `{"username":"admin","password":"mot_de_passe"}` | `access` et `refresh` |
| `/api/token/refresh/` | POST | `{"refresh":"VOTRE_REFRESH_TOKEN"}` | nouvel `access` |
| `/api/me/` | GET | aucune | profil utilisateur, rôle et agence |

Exemple de connexion :
```json
{"username":"admin","password":"Admin12345!"}
```
Exemple de réponse :
```json
{"refresh":"<refresh_token>","access":"<access_token>"}
```

## 3. Ressources et méthodes CRUD

Pour les ressources ci-dessous :
- `GET /api/ressource/` : liste (pagination : `count`, `next`, `previous`, `results`).
- `POST /api/ressource/` : création.
- `GET /api/ressource/{id}/` : détail.
- `PUT /api/ressource/{id}/` : remplacement complet.
- `PATCH /api/ressource/{id}/` : modification partielle.
- `DELETE /api/ressource/{id}/` : suppression (si les relations métier ne l'interdisent pas).

| Ressource | URL de base | Champs de création principaux |
|---|---|---|
| Agences | `/api/agencies/` | `name`, `city`, `address` (optionnel), `phone` (optionnel) |
| Itinéraires | `/api/routes/` | `origin`, `destination`, `distance_km`, `estimated_minutes` |
| Chauffeurs | `/api/drivers/` | `first_name`, `last_name`, `license_number`, `phone`, `active` |
| Véhicules | `/api/vehicles/` | `registration`, `brand`, `model`, `capacity`, `available` |
| Places | `/api/seats/` | `vehicle`, `number` ; filtre `?vehicle=ID` |
| Départs | `/api/trips/` | `route`, `agency`, `vehicle`, `driver`, `departure_at`, `arrival_at`, `price`, `status`, `notes` |
| Réservations | `/api/reservations/` | utiliser de préférence l'action de création décrite ci-dessous |
| Paiements | `/api/payments/` | lecture seule ; filtre `?reservation=ID` |
| Billets | `/api/tickets/` | lecture seule |
| Bagages | `/api/luggage/` | `reservation`, `description`, `weight_kg`, `supplement`, `delivered` |

Exemple de création d'un départ :
```json
{
  "route": 1,
  "agency": 1,
  "vehicle": 1,
  "driver": 1,
  "departure_at": "2026-11-15T08:00:00+00:00",
  "arrival_at": "2026-11-15T14:00:00+00:00",
  "price": 10000,
  "status": "PLANNED",
  "notes": ""
}
```

Filtres départs : `GET /api/trips/?status=PLANNED` ou `GET /api/trips/?route=1`.
Une réponse départ inclut `route_detail`, `agency_detail`, `vehicle_detail`, `driver_detail` et `available_seats`.

## 4. Opérations métier

### Créer une réservation
`POST /api/reservations/`

```json
{
  "trip": 1,
  "seat": 3,
  "passenger_name": "Aminata Traore",
  "passenger_phone": "+22370000000"
}
```
Réponse `201` : réservation créée avec `amount`, `status: "HOLD"` et `hold_expires_at`. La place doit appartenir au véhicule du départ et être libre. Le délai de réservation provisoire est de 15 minutes.

### Enregistrer un paiement
`POST /api/reservations/{id}/pay/`

```json
{"amount": 10000, "method": "CASH"}
```
`method` accepte `CASH`, `MOBILE` ou `CARD`. Mobile Money et carte sont des simulations dans cette version. Réponse : paiement enregistré, statut de réservation et billet si le montant total est payé.

### Annuler une réservation
`POST /api/reservations/{id}/cancel/`

Corps JSON vide `{}`. Réponse : réservation mise à jour.

### Rembourser une réservation
`POST /api/reservations/{id}/refund/`

```json
{"amount": 5000, "reason": "Annulation du voyage"}
```
Le montant remboursé ne peut pas dépasser le montant réellement encaissé.

### Contrôler un billet à l'embarquement
`POST /api/tickets/check/`

```json
{"code": "UUID_DU_BILLET"}
```
Réponse : billet contrôlé. Un billet non confirmé ou déjà contrôlé est refusé.

## 5. Codes HTTP courants

- `200` : lecture ou opération réussie.
- `201` : ressource créée.
- `400` : données invalides ou règle métier non respectée.
- `401` : token absent, invalide ou expiré.
- `403` : accès refusé.
- `404` : ressource inexistante.
- `405` : méthode HTTP non autorisée.

Les erreurs sont généralement renvoyées sous la forme `{"detail":"message"}` ou sous forme de champs invalides.

## 6. Exemple JavaScript (frontend)

```javascript
const API = "http://127.0.0.1:8000/api/";

async function connexion(username, password) {
  const response = await fetch(API + "token/", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username, password})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Connexion impossible");
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  return data;
}

async function apiGet(endpoint) {
  const response = await fetch(API + endpoint, {
    headers: {"Authorization": `Bearer ${localStorage.getItem("access")}`}
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Erreur API");
  return data;
}

// Exemple : const departs = await apiGet("trips/");
```

## 7. CORS et réseau

Par défaut, les origines de développement `http://localhost:5500`, `http://127.0.0.1:5500`, `http://localhost:3000` et `http://127.0.0.1:3000` sont autorisées.
Si le frontend utilise une autre adresse/port, définir `CORS_ALLOWED_ORIGINS` dans l'environnement, avec les origines séparées par des virgules. Ne pas utiliser `CORS_ALLOW_ALL_ORIGINS` en production.

## 8. Limites de cette version

Toutes les routes API exigent un JWT. Les permissions sont actuellement globales aux utilisateurs authentifiés ; les permissions fines par rôle doivent être ajoutées avant mise en production. Les paiements Mobile Money/carte sont simulés. Les suppressions peuvent être refusées par la base lorsque des données sont liées à la ressource.
