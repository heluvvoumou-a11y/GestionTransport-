/* =========================================================
   TRANSITGO - APPLICATION FRONTEND CONNECTÉE À DJANGO
   Navigation, réservation, paiements et modification départs
========================================================= */

const API = window.TransitAPI;

const ROLE_LABELS = {
    AGENT: "Agent de guichet",
    CONTROLEUR: "Contrôleur",
    CAISSIER: "Caissier",
    EXPLOITATION: "Responsable exploitation",
    RESPONSABLE: "Responsable compagnie"
};

const PAGE_TITLES = {
    dashboard: "Tableau de bord",
    departures: "Départs",
    booking: "Réservation",
    tickets: "Billets",
    control: "Contrôle des billets",
    payments: "Paiements",
    refunds: "Remboursements",
    resources: "Gestion des ressources",
    users: "Gestion des utilisateurs",
    agencies: "Gestion des agences"
};

let currentUser = null;
let currentPage = "dashboard";
let selectedTrip = null;
let editingTripId = null;

let trips = [];
let routes = [];
let agencies = [];
let vehicles = [];
let drivers = [];
let reservations = [];
let tickets = [];
let payments = [];
let refunds = [];
let users = [];
let seats = [];

const $ = id => document.getElementById(id);

/* =========================================================
   1. OUTILS GÉNÉRAUX
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function money(value) {
    return `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
}

function dateText(value) {
    if (!value) return "Non renseigné";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date non valide";
    }

    return date.toLocaleString("fr-FR");
}

function dateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 16);
}

function getRelationId(value) {
    if (value && typeof value === "object") {
        return value.id ?? "";
    }

    return value ?? "";
}

function notify(message, isError = false) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.dataset.type = isError ? "error" : "success";
    toast.classList.add("visible");

    window.setTimeout(() => {
        toast.classList.remove("visible");
    }, 4000);
}

function showError(error) {
    console.error("TransitGo :", error);
    notify(error?.message || "Une erreur est survenue.", true);
}

function setButtonLoading(button, loading, text = "Chargement...") {
    if (!button) return;

    const isInput = button.tagName === "INPUT";
    const property = isInput ? "value" : "textContent";

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button[property];
        }

        button.disabled = true;
        button[property] = text;
    } else {
        button.disabled = false;

        if (button.dataset.originalText !== undefined) {
            button[property] = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

function hasRole(...roles) {
    return Boolean(currentUser && roles.includes(currentUser.role));
}

function requireRole(...roles) {
    if (!hasRole(...roles)) {
        throw new Error("Tu n'as pas l'autorisation d'effectuer cette opération.");
    }
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

/* =========================================================
   2. NAVIGATION ET GESTION DES RÔLES
========================================================= */

function configureNavigation() {
    document.querySelectorAll("[data-roles]").forEach(element => {
        const allowed = element.dataset.roles
            .split(",")
            .map(role => role.trim());

        element.hidden = !allowed.includes(currentUser.role);
    });

    document.querySelectorAll("[data-page]").forEach(button => {
        const page = button.dataset.page;

        const allowed = button.dataset.roles
            ? button.dataset.roles.split(",").map(role => role.trim())
            : null;

        button.hidden = Boolean(
            allowed && !allowed.includes(currentUser.role)
        );

        if (button.dataset.navigationReady === "true") return;

        button.dataset.navigationReady = "true";

        button.addEventListener("click", () => {
            if (button.hidden) return;
            openPage(page);
        });
    });
}

function canOpenPage(page) {
    const permissions = {
        dashboard: [
            "AGENT",
            "CONTROLEUR",
            "CAISSIER",
            "EXPLOITATION",
            "RESPONSABLE"
        ],
        departures: [
            "AGENT",
            "EXPLOITATION",
            "RESPONSABLE"
        ],
        booking: ["AGENT"],
        tickets: [
            "AGENT",
            "EXPLOITATION",
            "CONTROLEUR",
            "RESPONSABLE"
        ],
        control: ["CONTROLEUR", "RESPONSABLE"],
        payments: ["CAISSIER", "RESPONSABLE"],
        refunds: ["CAISSIER", "RESPONSABLE"],
        resources: ["EXPLOITATION", "RESPONSABLE"],
        users: ["RESPONSABLE"],
        agencies: ["RESPONSABLE"]
    };

    return Boolean(
        currentUser &&
        (permissions[page] || []).includes(currentUser.role)
    );
}

function openPage(page) {
    const section = $(`page-${page}`);

    if (!section || !currentUser) return;

    if (!canOpenPage(page)) {
        notify("Accès non autorisé.", true);
        return;
    }

    currentPage = page;

    document.querySelectorAll(".page").forEach(item => {
        const isActive = item.id === `page-${page}`;

        item.hidden = !isActive;
        item.classList.toggle("active", isActive);
    });

    document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    setText("pageTitle", PAGE_TITLES[page] || "TransitGo");

    loadPage(page).catch(showError);
}

/* =========================================================
   3. CHARGEMENT DES PAGES
========================================================= */

async function loadPage(page) {
    switch (page) {
        case "dashboard":
            await loadDashboard();
            break;

        case "departures":
            await loadDepartures();
            break;

        case "booking":
            await loadResourcesForBooking();
            await loadReservations();
            break;

        case "tickets":
            await loadTickets();
            break;

        case "control":
            break;

        case "payments":
            await loadPayments();
            break;

        case "refunds":
            await loadRefunds();
            break;

        case "resources":
            await loadResources();
            break;

        case "users":
            await loadUsers();
            await loadAgenciesForSelect($("newAgency"));
            break;

        case "agencies":
            await loadAgencies();
            break;

        default:
            console.warn("Page inconnue :", page);
    }
}

/* =========================================================
   4. TABLEAU DE BORD
========================================================= */

async function loadDashboard() {
    trips = [];
    reservations = [];
    tickets = [];
    payments = [];

    const tasks = [];

    if (hasRole("AGENT", "EXPLOITATION", "RESPONSABLE")) {
        tasks.push(
            API.getAll("trips/").then(data => {
                trips = data;
            })
        );
    }

    if (hasRole("AGENT", "RESPONSABLE", "EXPLOITATION")) {
        tasks.push(
            API.getAll("reservations/").then(data => {
                reservations = data;
            })
        );
    }

    if (hasRole("AGENT", "CONTROLEUR", "EXPLOITATION", "RESPONSABLE")) {
        tasks.push(
            API.getAll("tickets/").then(data => {
                tickets = data;
            })
        );
    }

    if (hasRole("CAISSIER", "RESPONSABLE")) {
        tasks.push(
            API.getAll("payments/").then(data => {
                payments = data;
            })
        );
    }

    const results = await Promise.allSettled(tasks);

    const failedTasks = results.filter(
        result => result.status === "rejected"
    );

    if (failedTasks.length) {
        console.warn(
            "Certaines données du tableau de bord n'ont pas pu être chargées.",
            failedTasks
        );
    }

    setText("statDepartures", trips.length);
    setText("statReservations", reservations.length);
    setText("statTickets", tickets.length);

    const total = payments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
    );

    setText("statPaid", money(total));

    setText(
        "dashboardWelcome",
        `Bienvenue ${currentUser.first_name || currentUser.username}. Espace : ${ROLE_LABELS[currentUser.role] || currentUser.role}.`
    );
}

/* =========================================================
   5. DÉPARTS
========================================================= */

async function loadDepartures() {
    requireRole("AGENT", "EXPLOITATION", "RESPONSABLE");

    trips = await API.getAll("trips/");
    renderDepartures(trips);
}

function renderDepartures(data) {
    const container = $("departureResults");
    const empty = $("departureEmpty");

    if (!container) return;

    container.innerHTML = "";

    if (empty) {
        empty.textContent = data.length
            ? ""
            : "Aucun départ disponible.";
    }

    data.forEach(trip => {
        const route = trip.route_detail || {};
        const vehicle = trip.vehicle_detail || {};

        const card = document.createElement("article");
        card.className = "panel departure-card";

        const canBook = hasRole("AGENT") && trip.status === "PLANNED";

        const canEdit = hasRole("EXPLOITATION", "RESPONSABLE")
            && trip.status === "PLANNED";

        card.innerHTML = `
            <div class="departure-card-header">
                <strong>${escapeHTML(money(trip.price))}</strong>
                <span class="departure-tag">
                    ${escapeHTML(trip.status || "Non renseigné")}
                </span>
            </div>

            <h3>
                ${escapeHTML(route.origin || "Départ")}
                →
                ${escapeHTML(route.destination || "Destination")}
            </h3>

            <div class="departure-details">
                <span>📅 ${escapeHTML(dateText(trip.departure_at))}</span>
                <span>🚌 Véhicule : ${escapeHTML(vehicle.registration || "Non renseigné")}</span>
                <span>💺 Places disponibles : ${escapeHTML(trip.available_seats ?? 0)}</span>
            </div>

            <div class="departure-card-actions">
                ${canBook
                    ? `<button type="button" data-book-trip="${escapeHTML(trip.id)}">
                           Réserver une place
                       </button>`
                    : ""}

                ${canEdit
                    ? `<button type="button" data-edit-trip="${escapeHTML(trip.id)}">
                           Modifier
                       </button>`
                    : ""}
            </div>
        `;

        const bookButton = card.querySelector("[data-book-trip]");

        if (bookButton) {
            bookButton.addEventListener("click", () => {
                selectTrip(trip.id);
            });
        }

        const editButton = card.querySelector("[data-edit-trip]");

        if (editButton) {
            editButton.addEventListener("click", () => {
                startEditTrip(trip.id);
            });
        }

        container.appendChild(card);
    });
}

if ($("departureSearchForm")) {
    $("departureSearchForm").addEventListener("submit", event => {
        event.preventDefault();

        const from = $("searchFrom").value.trim().toLowerCase();
        const to = $("searchTo").value.trim().toLowerCase();
        const date = $("searchDate").value;

        const filtered = trips.filter(trip => {
            const route = trip.route_detail || {};

            const origin = (route.origin || "").toLowerCase();
            const destination = (route.destination || "").toLowerCase();

            const tripDate = trip.departure_at
                ? trip.departure_at.slice(0, 10)
                : "";

            return (!from || origin.includes(from))
                && (!to || destination.includes(to))
                && (!date || tripDate === date);
        });

        renderDepartures(filtered);
    });
}

/* =========================================================
   6. MODIFICATION D'UN DÉPART
========================================================= */

function ensureTripEditControls() {
    const form = $("tripForm");

    if (!form) {
        throw new Error("Le formulaire des départs est introuvable.");
    }

    const submitButton = form.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (!submitButton) {
        throw new Error("Le bouton d'enregistrement du départ est introuvable.");
    }

    if (!submitButton.dataset.defaultText) {
        submitButton.dataset.defaultText =
            submitButton.tagName === "INPUT"
                ? submitButton.value
                : submitButton.textContent;
    }

    let cancelButton = $("cancelTripEditBtn");

    if (!cancelButton) {
        cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.id = "cancelTripEditBtn";
        cancelButton.textContent = "Annuler la modification";
        cancelButton.hidden = true;

        submitButton.insertAdjacentElement("afterend", cancelButton);
    }

    if (cancelButton.dataset.listenerReady !== "true") {
        cancelButton.dataset.listenerReady = "true";

        cancelButton.addEventListener("click", () => {
            resetTripEditMode();
        });
    }

    return submitButton;
}

function setTripSubmitText(text) {
    const button = ensureTripEditControls();

    if (button.tagName === "INPUT") {
        button.value = text;
    } else {
        button.textContent = text;
    }
}

function resetTripEditMode(resetForm = true) {
    editingTripId = null;

    const form = $("tripForm");

    if (resetForm && form) {
        form.reset();
    }

    const button = form?.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (button) {
        const defaultText = button.dataset.defaultText;

        if (defaultText !== undefined) {
            if (button.tagName === "INPUT") {
                button.value = defaultText;
            } else {
                button.textContent = defaultText;
            }
        }
    }

    const cancelButton = $("cancelTripEditBtn");

    if (cancelButton) {
        cancelButton.hidden = true;
    }
}

async function startEditTrip(id) {
    try {
        requireRole("EXPLOITATION", "RESPONSABLE");

        let trip = trips.find(
            item => Number(item.id) === Number(id)
        );

        if (!trip) {
            trip = await API.get(`trips/${id}/`);
        }

        if (!trip) {
            throw new Error("Départ introuvable.");
        }

        if (trip.status !== "PLANNED") {
            throw new Error(
                "Seuls les départs planifiés peuvent être modifiés."
            );
        }

        await loadResources();

        const form = $("tripForm");

        if (!form) {
            throw new Error("Le formulaire des départs est introuvable.");
        }

        const routeId = getRelationId(trip.route);
        const agencyId = getRelationId(trip.agency);
        const vehicleId = getRelationId(trip.vehicle);
        const driverId = getRelationId(trip.driver);

        $("tripRoute").value = String(routeId);
        $("tripAgency").value = String(agencyId);
        $("tripVehicle").value = String(vehicleId);
        $("tripDriver").value = String(driverId);

        $("tripDeparture").value = dateTimeLocal(trip.departure_at);
        $("tripArrival").value = dateTimeLocal(trip.arrival_at);

        $("tripPrice").value = trip.price ?? "";
        $("tripNotes").value = trip.notes || "";

        editingTripId = trip.id;

        const cancelButton = $("cancelTripEditBtn");
        if (cancelButton) {
            cancelButton.hidden = false;
        }

        setTripSubmitText("Enregistrer les modifications");

        openPage("resources");

        form.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        notify("Départ chargé. Tu peux maintenant modifier ses informations.");

    } catch (error) {
        showError(error);
    }
}

/* =========================================================
   7. SÉLECTION D'UN DÉPART ET DES PLACES
========================================================= */

async function selectTrip(id) {
    try {
        requireRole("AGENT");

        selectedTrip = trips.find(
            item => Number(item.id) === Number(id)
        );

        if (!selectedTrip) {
            selectedTrip = await API.get(`trips/${id}/`);
        }

        if (!selectedTrip || selectedTrip.status !== "PLANNED") {
            throw new Error(
                "Ce départ n'est pas disponible pour une réservation."
            );
        }

        setText(
            "selectedDepartureInfo",
            `${selectedTrip.route_detail?.origin || "Départ"} → ${selectedTrip.route_detail?.destination || "Destination"} | ${money(selectedTrip.price)}`
        );

        const bookingTripId = $("bookingTripId");

        if (bookingTripId) {
            bookingTripId.value = selectedTrip.id;
        }

        if ($("bookingTripSelect")) {
            $("bookingTripSelect").value = String(selectedTrip.id);
        }

        const vehicleId = getRelationId(selectedTrip.vehicle);

        seats = await API.getAll(
            `seats/?vehicle=${encodeURIComponent(vehicleId)}`
        );

        reservations = await API.getAll("reservations/");
        renderReservations();

        const occupied = reservations
            .filter(reservation =>
                Number(getRelationId(reservation.trip)) === Number(selectedTrip.id) &&
                ["HOLD", "CONFIRMED"].includes(reservation.status)
            )
            .map(reservation => Number(getRelationId(reservation.seat)));

        const available = seats.filter(
            seat => !occupied.includes(Number(seat.id))
        );

        const select = $("bookingSeat");

        if (!select) {
            throw new Error("Le champ de sélection des places est introuvable.");
        }

        select.innerHTML = '<option value="">Choisir une place</option>';

        available.forEach(seat => {
            const option = document.createElement("option");
            option.value = seat.id;
            option.textContent = `Place ${seat.number}`;
            select.appendChild(option);
        });

        if ($("paymentPanel")) {
            $("paymentPanel").hidden = true;
        }

        if ($("paymentResult")) {
            $("paymentResult").innerHTML = "";
        }

        if (!available.length) {
            notify("Aucune place disponible pour ce départ.", true);
        }

        openPage("booking");

    } catch (error) {
        showError(error);
    }
}

/* =========================================================
   8. RÉSERVATIONS : CHARGEMENT ET AFFICHAGE
========================================================= */

function reservationStatusLabel(status) {
    const labels = {
        HOLD: "En attente",
        CONFIRMED: "Confirmée",
        CANCELLED: "Annulée",
        EXPIRED: "Expirée"
    };

    return labels[status] || status || "Non renseigné";
}

async function loadReservations() {
    requireRole("AGENT", "EXPLOITATION", "RESPONSABLE");

    reservations = await API.getAll("reservations/");

    renderReservations();
}

function renderReservations() {
    const tbody = $("reservationRows");
    const empty = $("reservationEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!reservations.length) {
        if (empty) {
            empty.textContent = "Aucune réservation enregistrée pour le moment.";
        }

        return;
    }

    if (empty) {
        empty.textContent = "";
    }

    reservations.forEach(reservation => {
        const trip = reservation.trip_detail || {};
        const route = trip.route_detail || {};
        const seat = reservation.seat_detail || {};

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${escapeHTML(reservation.id)}</td>

            <td>
                ${escapeHTML(reservation.passenger_name || "Non renseigné")}
            </td>

            <td>
                ${escapeHTML(reservation.passenger_phone || "Non renseigné")}
            </td>

            <td>
                ${escapeHTML(route.origin || "Départ")}
                →
                ${escapeHTML(route.destination || "Destination")}
            </td>

            <td>
                ${escapeHTML(dateText(trip.departure_at))}
            </td>

            <td>
                ${escapeHTML(seat.number ?? "Non renseignée")}
            </td>

            <td>
                ${escapeHTML(money(reservation.amount))}
            </td>

            <td>
                <span class="status-badge">
                    ${escapeHTML(reservationStatusLabel(reservation.status))}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* =========================================================
   9. RÉSERVATION : CHARGEMENT DES DÉPARTS
========================================================= */

async function loadResourcesForBooking() {
    requireRole("AGENT");

    trips = await API.getAll("trips/");

    const select = $("bookingTripSelect");

    if (!select) {
        throw new Error(
            "Le champ de sélection du départ est introuvable dans index.html."
        );
    }

    const availableTrips = trips.filter(
        trip => trip.status === "PLANNED"
    );

    select.innerHTML = '<option value="">Choisir un départ</option>';

    availableTrips.forEach(trip => {
        const route = trip.route_detail || {};
        const option = document.createElement("option");

        option.value = trip.id;
        option.textContent =
            `${route.origin || "Départ"} → ${route.destination || "Destination"} | ${dateText(trip.departure_at)} | ${money(trip.price)}`;

        select.appendChild(option);
    });

    if (selectedTrip) {
        select.value = String(selectedTrip.id);
    }

    if (!availableTrips.length) {
        select.innerHTML = '<option value="">Aucun départ planifié</option>';
        notify("Aucun départ planifié disponible pour le moment.", true);
    }
}

/* =========================================================
   10. ACTUALISATION DES RÉSERVATIONS
========================================================= */

if ($("refreshReservationsBtn")) {
    $("refreshReservationsBtn").addEventListener("click", async () => {
        const button = $("refreshReservationsBtn");

        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadReservations();
            notify("Liste des réservations actualisée.");

        } catch (error) {
            showError(error);

        } finally {
            setButtonLoading(button, false);
        }
    });
}

/* =========================================================
   11. CHANGEMENT DU DÉPART À RÉSERVER
========================================================= */

if ($("bookingTripSelect")) {
    $("bookingTripSelect").addEventListener("change", async event => {
        const tripId = event.target.value;

        if (!tripId) {
            selectedTrip = null;

            if ($("bookingTripId")) {
                $("bookingTripId").value = "";
            }

            if ($("bookingSeat")) {
                $("bookingSeat").innerHTML =
                    '<option value="">Choisir une place</option>';
            }

            setText(
                "selectedDepartureInfo",
                "Sélectionne un départ dans la liste."
            );

            return;
        }

        await selectTrip(tripId);
    });
}

/* =========================================================
   12. CRÉATION D'UNE RÉSERVATION
========================================================= */

if ($("bookingForm")) {
    $("bookingForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Réservation...");

        try {
            requireRole("AGENT");

            if (!selectedTrip || !$("bookingTripId")?.value) {
                throw new Error("Choisis d'abord un départ.");
            }

            if (!$("bookingSeat")?.value) {
                throw new Error("Choisis une place avant de continuer.");
            }

            const reservation = await API.post("reservations/", {
                trip: Number($("bookingTripId").value),
                seat: Number($("bookingSeat").value),
                passenger_name: $("passengerName").value.trim(),
                passenger_phone: $("passengerPhone").value.trim(),
                passenger_document: $("passengerDocument").value.trim()
            });

            $("paymentReservationId").value = reservation.id;
            $("paymentAmount").value = reservation.amount;

            setText(
                "paymentReservationInfo",
                `Réservation #${reservation.id} — Montant total : ${money(reservation.amount)}`
            );

            $("paymentPanel").hidden = false;

            notify("Réservation créée. Effectue maintenant le paiement.");

            await loadReservations();
            await loadDepartures();

        } catch (error) {
            showError(error);

        } finally {
            setButtonLoading(button, false);
        }
    });
}

/* =========================================================
   13. PAIEMENT DEPUIS LA RÉSERVATION
========================================================= */

if ($("paymentForm")) {
    $("paymentForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Paiement...");

        try {
            requireRole("AGENT");

            const id = $("paymentReservationId").value;
            const amount = Number($("paymentAmount").value);
            const method = $("paymentMethod").value;

            if (!id) {
                throw new Error("Aucune réservation à payer.");
            }

            if (!Number.isInteger(amount) || amount <= 0) {
                throw new Error("Saisis un montant valide en FCFA.");
            }

            const result = await API.post(
                `reservations/${id}/pay/`,
                { amount, method }
            );

            const resultElement = $("paymentResult");

            if (resultElement) {
                if (result.ticket) {
                    resultElement.innerHTML = `
                        <h3>Paiement confirmé</h3>
                        <p>Ton billet a été généré.</p>
                        <p>
                            <strong>Code :</strong>
                            ${escapeHTML(result.ticket.code)}
                        </p>
                        <p>Conserve ce code pour le contrôle à l'embarquement.</p>
                    `;

                    notify("Paiement confirmé et billet généré.");

                } else {
                    resultElement.textContent =
                        "Paiement enregistré. Le montant restant doit être réglé avant la génération du billet.";

                    notify("Paiement partiel enregistré.");
                }
            }

            await loadReservations();
            await loadTickets();
            await loadDashboard();

        } catch (error) {
            showError(error);

        } finally {
            setButtonLoading(button, false);
        }
    });
}

/* =========================================================
   14. BILLETS
========================================================= */

async function loadTickets() {
    requireRole("AGENT", "CONTROLEUR", "EXPLOITATION", "RESPONSABLE");

    tickets = await API.getAll("tickets/");
    renderTickets();
}

function renderTickets() {
    const tbody = $("ticketRows");
    const empty = $("ticketEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.textContent = tickets.length
            ? ""
            : "Aucun billet enregistré.";
    }

    tickets.forEach(ticket => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(ticket.code)}</td>
            <td>${escapeHTML(ticket.reservation)}</td>
            <td>${escapeHTML(dateText(ticket.issued_at))}</td>
            <td>
                <span class="status-badge ${ticket.checked ? "status-boarded" : "status-pending"}">
                    ${ticket.checked ? "Contrôlé" : "Non contrôlé"}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

if ($("refreshTicketsBtn")) {
    $("refreshTicketsBtn").addEventListener("click", () => {
        loadTickets().catch(showError);
    });
}

/* =========================================================
   15. CONTRÔLE DES BILLETS
========================================================= */

if ($("controlForm")) {
    $("controlForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Vérification...");

        const resultElement = $("controlResult");

        try {
            requireRole("CONTROLEUR", "RESPONSABLE");

            const code = $("controlReference").value.trim();

            if (!code) {
                throw new Error("Saisis le code du billet.");
            }

            const result = await API.post("tickets/check/", { code });

            if (resultElement) {
                resultElement.className = "control-result success";
                resultElement.innerHTML = `
                    <h3>Billet validé</h3>
                    <p>
                        Embarquement enregistré pour le billet
                        <strong>${escapeHTML(result.code || code)}</strong>.
                    </p>
                `;
            }

            notify("Billet contrôlé avec succès.");
            $("controlReference").value = "";

        } catch (error) {
            if (resultElement) {
                resultElement.className = "control-result error";
                resultElement.textContent = error.message;
            }

            showError(error);

        } finally {
            setButtonLoading(button, false);
        }
    });
}

/* =========================================================
   16. PAIEMENTS - ESPACE CAISSIER / RESPONSABLE
========================================================= */

async function loadPayments() {
    requireRole("CAISSIER", "RESPONSABLE");

    payments = await API.getAll("payments/");

    const tbody = $("paymentRows");
    const empty = $("paymentEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.textContent = payments.length
            ? ""
            : "Aucun paiement enregistré.";
    }

    payments.forEach(payment => {
        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td>${escapeHTML(payment.reference)}</td>
                <td>${escapeHTML(payment.reservation)}</td>
                <td>${escapeHTML(money(payment.amount))}</td>
                <td>${escapeHTML(payment.method)}</td>
                <td>${escapeHTML(dateText(payment.paid_at))}</td>
            </tr>
        `);
    });
}

if ($("refreshPaymentsBtn")) {
    $("refreshPaymentsBtn").addEventListener("click", () => {
        loadPayments().catch(showError);
    });
}

/* =========================================================
   17. REMBOURSEMENTS
========================================================= */

async function loadRefunds() {
    requireRole("CAISSIER", "RESPONSABLE");

    refunds = await API.getAll("refunds/");
    renderRefunds();
}

function renderRefunds() {
    const tbody = $("refundRows");
    const empty = $("refundEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.textContent = refunds.length
            ? ""
            : "Aucune demande.";
    }

    refunds.forEach(refund => {
        const actions = hasRole("RESPONSABLE") &&
            refund.status === "PENDING"
            ? `
                <button type="button" data-approve="${escapeHTML(refund.id)}">
                    Approuver
                </button>
                <button type="button" data-reject="${escapeHTML(refund.id)}">
                    Refuser
                </button>
            `
            : "";

        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td>${escapeHTML(refund.id)}</td>
                <td>${escapeHTML(refund.reservation)}</td>
                <td>${escapeHTML(money(refund.amount))}</td>
                <td>${escapeHTML(refund.reason)}</td>
                <td>${escapeHTML(refund.status)}</td>
                <td>${actions}</td>
            </tr>
        `);
    });

    tbody.querySelectorAll("[data-approve]").forEach(button => {
        button.addEventListener("click", () => {
            reviewRefund(button.dataset.approve, "approve");
        });
    });

    tbody.querySelectorAll("[data-reject]").forEach(button => {
        button.addEventListener("click", () => {
            reviewRefund(button.dataset.reject, "reject");
        });
    });
}

if ($("refundForm")) {
    $("refundForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("CAISSIER", "RESPONSABLE");

            const amount = Number($("refundAmount").value);

            if (!Number.isInteger(amount) || amount <= 0) {
                throw new Error("Saisis un montant de remboursement valide.");
            }

            await API.post("refunds/", {
                reservation: Number($("refundReservation").value),
                amount,
                reason: $("refundReason").value.trim()
            });

            event.target.reset();

            notify("Demande de remboursement envoyée.");
            await loadRefunds();

        } catch (error) {
            showError(error);
        }
    });
}

async function reviewRefund(id, action) {
    try {
        requireRole("RESPONSABLE");

        const actionLabel = action === "approve"
            ? "approuver"
            : "refuser";

        if (!confirm(`Confirmer : ${actionLabel} ce remboursement ?`)) {
            return;
        }

        await API.post(`refunds/${id}/${action}/`, {});

        notify("Demande traitée.");
        await loadRefunds();

    } catch (error) {
        showError(error);
    }
}

/* =========================================================
   18. RESSOURCES
========================================================= */

async function loadResources() {
    requireRole("EXPLOITATION", "RESPONSABLE");

    const requests = [
        API.getAll("routes/"),
        API.getAll("vehicles/"),
        API.getAll("drivers/")
    ];

    if (hasRole("RESPONSABLE")) {
        requests.push(API.getAll("agencies/"));
    }

    const results = await Promise.all(requests);

    routes = results[0];
    vehicles = results[1];
    drivers = results[2];

    if (hasRole("RESPONSABLE")) {
        agencies = results[3];
    } else if (currentUser.agency_id) {
        agencies = [{
            id: currentUser.agency_id,
            name: "Mon agence",
            city: ""
        }];
    } else {
        agencies = [];
    }

    fillSelect(
        $("tripRoute"),
        routes,
        item => `${item.origin} → ${item.destination}`
    );

    fillSelect(
        $("tripAgency"),
        agencies,
        item => item.city
            ? `${item.name} (${item.city})`
            : item.name
    );

    fillSelect(
        $("tripVehicle"),
        vehicles,
        item => `${item.registration} — ${item.capacity} places`
    );

    fillSelect(
        $("tripDriver"),
        drivers,
        item => `${item.first_name} ${item.last_name}`
    );
}

function fillSelect(select, items, labelFunction) {
    if (!select) return;

    select.innerHTML = '<option value="">Choisir</option>';

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = labelFunction(item);
        select.appendChild(option);
    });
}

/* =========================================================
   19. CRÉATION D'UN ITINÉRAIRE
========================================================= */

if ($("routeForm")) {
    $("routeForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION", "RESPONSABLE");

            await API.post("routes/", {
                origin: $("routeOrigin").value.trim(),
                destination: $("routeDestination").value.trim(),
                distance_km: Number($("routeDistance").value || 0),
                estimated_minutes: Number($("routeDuration").value || 0)
            });

            event.target.reset();

            notify("Itinéraire créé.");
            await loadResources();

        } catch (error) {
            showError(error);
        }
    });
}

/* =========================================================
   20. AJOUT D'UN CHAUFFEUR
========================================================= */

if ($("driverForm")) {
    $("driverForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION", "RESPONSABLE");

            await API.post("drivers/", {
                first_name: $("driverFirstName").value.trim(),
                last_name: $("driverLastName").value.trim(),
                phone: $("driverPhone").value.trim(),
                license_number: $("driverLicense").value.trim(),
                active: true
            });

            event.target.reset();

            notify("Chauffeur ajouté.");
            await loadResources();

        } catch (error) {
            showError(error);
        }
    });
}

/* =========================================================
   21. AJOUT D'UN VÉHICULE
========================================================= */

if ($("vehicleForm")) {
    $("vehicleForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION", "RESPONSABLE");

            await API.post("vehicles/", {
                registration: $("vehicleRegistration").value.trim(),
                brand: $("vehicleBrand").value.trim(),
                model: $("vehicleModel").value.trim(),
                capacity: Number($("vehicleCapacity").value),
                available: true
            });

            event.target.reset();

            notify("Véhicule ajouté.");
            await loadResources();

        } catch (error) {
            showError(error);
        }
    });
}

/* =========================================================
   22. PROGRAMMATION ET MODIFICATION D'UN DÉPART
========================================================= */

if ($("tripForm")) {
    $("tripForm").addEventListener("submit", async event => {
        event.preventDefault();

        const submitButton = event.submitter;

        setButtonLoading(
            submitButton,
            true,
            editingTripId ? "Modification..." : "Création..."
        );

        try {
            requireRole("EXPLOITATION", "RESPONSABLE");

            const departureValue = $("tripDeparture").value;
            const arrivalValue = $("tripArrival").value;
            const price = Number($("tripPrice").value);

            if (!$("tripRoute").value) {
                throw new Error("Choisis un itinéraire.");
            }

            if (!$("tripAgency").value) {
                throw new Error(
                    "Aucune agence disponible. Vérifie l'agence associée à ton compte."
                );
            }

            if (!$("tripVehicle").value) {
                throw new Error("Choisis un véhicule.");
            }

            if (!$("tripDriver").value) {
                throw new Error("Choisis un chauffeur.");
            }

            if (!departureValue) {
                throw new Error("Indique la date et l'heure du départ.");
            }

            if (!Number.isFinite(price) || price <= 0) {
                throw new Error("Le prix doit être supérieur à zéro.");
            }

            const departureDate = new Date(departureValue);

            if (Number.isNaN(departureDate.getTime())) {
                throw new Error("La date de départ n'est pas valide.");
            }

            let arrivalDate = null;

            if (arrivalValue) {
                arrivalDate = new Date(arrivalValue);

                if (Number.isNaN(arrivalDate.getTime())) {
                    throw new Error("La date d'arrivée n'est pas valide.");
                }

                if (arrivalDate <= departureDate) {
                    throw new Error(
                        "L'arrivée doit être prévue après le départ."
                    );
                }
            }

            const body = {
                route: Number($("tripRoute").value),
                agency: Number($("tripAgency").value),
                vehicle: Number($("tripVehicle").value),
                driver: Number($("tripDriver").value),
                departure_at: departureDate.toISOString(),
                arrival_at: arrivalDate
                    ? arrivalDate.toISOString()
                    : null,
                price,
                notes: $("tripNotes").value.trim()
            };

            if (editingTripId) {
                await API.patch(
                    `trips/${editingTripId}/`,
                    body
                );

                notify("Départ modifié avec succès.");

                resetTripEditMode();

            } else {
                body.status = "PLANNED";

                await API.post("trips/", body);

                event.target.reset();

                notify("Départ programmé.");
            }

            trips = await API.getAll("trips/");

            renderDepartures(trips);

        } catch (error) {
            showError(error);

        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

/* =========================================================
   23. UTILISATEURS
========================================================= */

async function loadUsers() {
    requireRole("RESPONSABLE");

    users = await API.getAll("users/");

    const tbody = $("userRows");
    if (!tbody) return;

    tbody.innerHTML = "";

    users.forEach(user => {
        const fullName =
            `${user.first_name || ""} ${user.last_name || ""}`.trim();

        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(fullName || "Non renseigné")}</td>
                <td>${escapeHTML(ROLE_LABELS[user.role] || user.role || "")}</td>
                <td>
                    <span class="status-badge ${user.is_active ? "status-paid" : "status-cancelled"}">
                        ${user.is_active ? "Actif" : "Désactivé"}
                    </span>
                </td>
                <td>
                    <button
                        type="button"
                        data-toggle-user="${escapeHTML(user.id)}"
                        data-active="${user.is_active}">
                        ${user.is_active ? "Désactiver" : "Activer"}
                    </button>
                </td>
            </tr>
        `);
    });

    tbody.querySelectorAll("[data-toggle-user]").forEach(button => {
        button.addEventListener("click", async () => {
            try {
                requireRole("RESPONSABLE");

                const active = button.dataset.active === "true";

                await API.patch(
                    `users/${button.dataset.toggleUser}/`,
                    { is_active: !active }
                );

                notify("Utilisateur mis à jour.");
                await loadUsers();

            } catch (error) {
                showError(error);
            }
        });
    });
}

if ($("userForm")) {
    $("userForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("RESPONSABLE");

            const body = {
                username: $("newUsername").value.trim(),
                first_name: $("newFirstName").value.trim(),
                last_name: $("newLastName").value.trim(),
                email: $("newEmail").value.trim(),
                password: $("newPassword").value,
                role: $("newRole").value,
                is_active: true
            };

            if ($("newAgency").value) {
                body.agency_id = Number($("newAgency").value);
            }

            await API.post("users/", body);

            event.target.reset();

            notify("Utilisateur créé.");
            await loadUsers();

        } catch (error) {
            showError(error);
        }
    });
}

async function loadAgenciesForSelect(select) {
    if (!select) return;

    requireRole("RESPONSABLE");

    agencies = await API.getAll("agencies/");

    fillSelect(
        select,
        agencies,
        item => `${item.name} (${item.city})`
    );
}

/* =========================================================
   24. AGENCES
========================================================= */

async function loadAgencies() {
    requireRole("RESPONSABLE");

    agencies = await API.getAll("agencies/");

    const container = $("agencyRows");
    if (!container) return;

    container.innerHTML = "";

    if (!agencies.length) {
        container.innerHTML = `
            <div class="empty-state">
                Aucune agence enregistrée.
            </div>
        `;
        return;
    }

    agencies.forEach(agency => {
        container.insertAdjacentHTML("beforeend", `
            <div class="panel">
                <h3>${escapeHTML(agency.name)}</h3>
                <p>${escapeHTML(agency.city)}</p>
                <p>${escapeHTML(agency.address || "Adresse non renseignée")}</p>
                <p>${escapeHTML(agency.phone || "Téléphone non renseigné")}</p>
            </div>
        `);
    });
}

if ($("agencyForm")) {
    $("agencyForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("RESPONSABLE");

            await API.post("agencies/", {
                name: $("agencyName").value.trim(),
                city: $("agencyCity").value.trim(),
                address: $("agencyAddress").value.trim(),
                phone: $("agencyPhone").value.trim()
            });

            event.target.reset();

            notify("Agence créée.");
            await loadAgencies();

        } catch (error) {
            showError(error);
        }
    });
}

/* =========================================================
   25. CONNEXION
========================================================= */

async function startApplication(user) {
    currentUser = user;

    $("loginSection").hidden = true;
    $("appSection").hidden = false;

    const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim();

    setText("userName", fullName || user.username);

    setText(
        "userRole",
        ROLE_LABELS[user.role] || user.role || "Utilisateur"
    );

    configureNavigation();
    openPage("dashboard");
}

if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        const errorElement = $("loginError");

        if (errorElement) {
            errorElement.textContent = "";
        }

        setButtonLoading(button, true, "Connexion...");

        try {
            const user = await API.login(
                $("username").value.trim(),
                $("password").value
            );

            await startApplication(user);

        } catch (error) {
            if (errorElement) {
                errorElement.textContent = error.message;
            } else {
                showError(error);
            }

        } finally {
            setButtonLoading(button, false);
        }
    });
}

/* =========================================================
   26. DÉCONNEXION
========================================================= */

if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", () => {
        API.logout();

        currentUser = null;
        currentPage = "dashboard";
        selectedTrip = null;
        editingTripId = null;

        trips = [];
        routes = [];
        agencies = [];
        vehicles = [];
        drivers = [];
        reservations = [];
        tickets = [];
        payments = [];
        refunds = [];
        users = [];
        seats = [];

        $("appSection").hidden = true;
        $("loginSection").hidden = false;

        $("loginForm").reset();

        resetTripEditMode(false);

        document.querySelectorAll(".page").forEach(page => {
            page.hidden = true;
            page.classList.remove("active");
        });

        notify("Déconnexion effectuée.");
    });
}

/* =========================================================
   27. REPRISE D'UNE SESSION EXISTANTE
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    if (!API || typeof API.isAuthenticated !== "function") {
        console.error(
            "TransitGo : api.js ne fournit pas la fonction isAuthenticated()."
        );
        return;
    }

    if (!API.isAuthenticated()) {
        return;
    }

    try {
        const user = await API.getCurrentUser();
        await startApplication(user);

    } catch (error) {
        console.error(
            "Impossible de reprendre la session :",
            error
        );

        API.logout();

        $("loginSection").hidden = false;
        $("appSection").hidden = true;
    }
});