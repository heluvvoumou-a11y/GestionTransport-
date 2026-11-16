/* =========================================================
   TRANSITGO - API DJANGO
   Communication entre le frontend et Django REST Framework
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api/";

const TransitAPI = {
    accessToken: sessionStorage.getItem("transitgo_access"),
    refreshToken: sessionStorage.getItem("transitgo_refresh"),
    currentUser: null,

    // Vérifier si une session existe
    isAuthenticated() {
        return Boolean(this.accessToken);
    },

    // Lire la réponse du serveur
    async parseResponse(response) {
        if (response.status === 204) return null;

        const type = response.headers.get("content-type") || "";

        if (type.includes("application/json")) {
            return response.json();
        }

        const text = await response.text();
        return text ? { detail: text } : {};
    },

    // Formater les erreurs Django
    formatError(data) {
        if (!data) return "Une erreur est survenue.";

        if (typeof data === "string") return data;

        if (data.detail) return data.detail;

        return Object.entries(data)
            .map(([key, value]) =>
                `${key} : ${Array.isArray(value) ? value.join(" ") : String(value)}`
            )
            .join("\n") || "Une erreur est survenue.";
    },

    // Connexion
    async login(username, password) {
        let response;

        try {
            response = await fetch(`${API_BASE_URL}token/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password: password
                })
            });
        } catch {
            throw new Error(
                "Impossible de joindre Django. Vérifie que le serveur est démarré."
            );
        }

        const data = await this.parseResponse(response);

        if (!response.ok) {
            throw new Error(this.formatError(data));
        }

        this.accessToken = data.access;
        this.refreshToken = data.refresh;

        sessionStorage.setItem("transitgo_access", data.access);
        sessionStorage.setItem("transitgo_refresh", data.refresh);

        try {
            this.currentUser = await this.getCurrentUser();
            return this.currentUser;
        } catch (error) {
            this.logout();
            throw error;
        }
    },

    // Renouveler le jeton
    async refreshAccessToken() {
        if (!this.refreshToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}token/refresh/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    refresh: this.refreshToken
                })
            });

            const data = await this.parseResponse(response);

            if (!response.ok || !data.access) {
                this.logout();
                return false;
            }

            this.accessToken = data.access;
            sessionStorage.setItem("transitgo_access", data.access);

            if (data.refresh) {
                this.refreshToken = data.refresh;
                sessionStorage.setItem("transitgo_refresh", data.refresh);
            }

            return true;

        } catch {
            this.logout();
            return false;
        }
    },

    // Requête générale vers Django
    async request(endpoint, options = {}, retry = true) {
        const headers = { ...(options.headers || {}) };

        if (!(options.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }

        if (this.accessToken) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }

        let response;

        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });
        } catch {
            throw new Error(
                "Connexion au serveur impossible. Vérifie Django et ta connexion."
            );
        }

        if (
            response.status === 401 &&
            retry &&
            this.refreshToken &&
            !endpoint.startsWith("token/")
        ) {
            if (await this.refreshAccessToken()) {
                return this.request(endpoint, options, false);
            }

            throw new Error("Session expirée. Reconnecte-toi.");
        }

        const data = await this.parseResponse(response);

        if (!response.ok) {
            throw new Error(this.formatError(data));
        }

        return data;
    },

    // GET
    get(endpoint) {
        return this.request(endpoint, {
            method: "GET"
        });
    },

    // POST
    post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });
    },

    // PATCH
    patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "PATCH",
            body: JSON.stringify(body)
        });
    },

    // DELETE
    delete(endpoint) {
        return this.request(endpoint, {
            method: "DELETE"
        });
    },

    // Informations de l'utilisateur connecté
    async getCurrentUser() {
        const user = await this.get("me/");
        this.currentUser = user;
        return user;
    },

    // Récupérer toutes les pages d'une liste Django
    async getAll(endpoint) {
        let result = await this.get(endpoint);
        let items = [];

        while (result) {
            if (Array.isArray(result)) {
                items = items.concat(result);
                break;
            }

            if (Array.isArray(result.results)) {
                items = items.concat(result.results);

                if (!result.next) break;

                const nextUrl = new URL(result.next);
                const currentBase = new URL(API_BASE_URL);

                if (nextUrl.origin !== currentBase.origin ||
                    !nextUrl.pathname.startsWith(currentBase.pathname)) {
                    break;
                }

                const relative =
                    nextUrl.pathname.substring(currentBase.pathname.length) +
                    nextUrl.search;

                result = await this.get(relative);

            } else {
                break;
            }
        }

        return items;
    },

    // Déconnexion
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.currentUser = null;

        sessionStorage.removeItem("transitgo_access");
        sessionStorage.removeItem("transitgo_refresh");
    }
};

// Compatibilité avec les deux noms utilisés par les fichiers
window.TransitAPI = TransitAPI;
window.API = TransitAPI;