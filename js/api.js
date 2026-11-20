/* =========================================================
   TRANSITGO - API DJANGO
========================================================= */

const API_BASE_URL = `${window.location.origin}/api/`;

const TransitAPI = {
    accessToken: sessionStorage.getItem("transitgo_access"),
    refreshToken: sessionStorage.getItem("transitgo_refresh"),
    currentUser: null,

    isAuthenticated() {
        return Boolean(this.accessToken);
    },

    async parseResponse(response) {
        if (response.status === 204) return null;

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            return await response.json();
        }

        const text = await response.text();
        return text ? { detail: text } : {};
    },

    formatError(data) {
        if (!data) return "Une erreur est survenue.";
        if (typeof data === "string") return data;

        if (data.detail) {
            return typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
        }

        return Object.entries(data)
            .map(([key, value]) => {
                const message = Array.isArray(value)
                    ? value.join(" ")
                    : typeof value === "object" && value !== null
                        ? JSON.stringify(value)
                        : String(value);

                return `${key} : ${message}`;
            })
            .join("\n") || "Une erreur est survenue.";
    },

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
                    password
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

        if (!data.access || !data.refresh) {
            throw new Error(
                "Le serveur n'a pas retourné les jetons de connexion attendus."
            );
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

    async refreshAccessToken() {
        if (!this.refreshToken) return false;

        try {
            const response = await fetch(
                `${API_BASE_URL}token/refresh/`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        refresh: this.refreshToken
                    })
                }
            );

            const data = await this.parseResponse(response);

            if (!response.ok || !data.access) {
                this.logout();
                return false;
            }

            this.accessToken = data.access;

            sessionStorage.setItem(
                "transitgo_access",
                data.access
            );

            if (data.refresh) {
                this.refreshToken = data.refresh;

                sessionStorage.setItem(
                    "transitgo_refresh",
                    data.refresh
                );
            }

            return true;

        } catch {
            this.logout();
            return false;
        }
    },

    async request(endpoint, options = {}, retry = true) {
        const headers = {
            ...(options.headers || {})
        };

        const isFormData =
            typeof FormData !== "undefined"
            && options.body instanceof FormData;

        if (!isFormData && options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        if (this.accessToken) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }

        let response;

        try {
            response = await fetch(
                `${API_BASE_URL}${endpoint}`,
                {
                    ...options,
                    headers
                }
            );
        } catch {
            throw new Error(
                "Connexion au serveur impossible. Vérifie que Django est démarré et que l'adresse API est correcte."
            );
        }

        if (
            response.status === 401
            && retry
            && this.refreshToken
            && !endpoint.startsWith("token/")
        ) {
            const refreshed = await this.refreshAccessToken();

            if (refreshed) {
                return this.request(endpoint, options, false);
            }

            throw new Error(
                "Session expirée. Veuillez vous reconnecter."
            );
        }

        const data = await this.parseResponse(response);

        if (!response.ok) {
            throw new Error(this.formatError(data));
        }

        return data;
    },

    get(endpoint) {
        return this.request(endpoint, {
            method: "GET"
        });
    },

    post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });
    },

    patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "PATCH",
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, {
            method: "DELETE"
        });
    },

    async getCurrentUser() {
        const user = await this.get("me/");
        this.currentUser = user;
        return user;
    },

    async getAll(endpoint) {
        let result = await this.get(endpoint);
        const items = [];

        while (result) {
            if (Array.isArray(result)) {
                items.push(...result);
                break;
            }

            if (Array.isArray(result.results)) {
                items.push(...result.results);

                if (!result.next) break;

                const nextUrl = new URL(result.next);
                const currentBase = new URL(API_BASE_URL);

                if (
                    nextUrl.origin !== currentBase.origin
                    || !nextUrl.pathname.startsWith(currentBase.pathname)
                ) {
                    break;
                }

                const relativeEndpoint =
                    nextUrl.pathname.substring(
                        currentBase.pathname.length
                    ) + nextUrl.search;

                result = await this.get(relativeEndpoint);

            } else {
                break;
            }
        }

        return items;
    },

    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.currentUser = null;

        sessionStorage.removeItem("transitgo_access");
        sessionStorage.removeItem("transitgo_refresh");
    }
};

window.TransitAPI = TransitAPI;
window.API = TransitAPI;