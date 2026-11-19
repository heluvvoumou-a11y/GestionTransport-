/* =========================================================
   TRANSITGO - FRONTEND DJANGO REST API
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
let users = [];
let seats = [];

const $ = id => document.getElementById(id);


/* =========================================================
   1. OUTILS
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

    return Number.isNaN(date.getTime())
        ? "Date non valide"
        : date.toLocaleString("fr-FR");
}

function dateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);
}

function getRelationId(value) {
    return value && typeof value === "object"
        ? value.id ?? value.pk ?? ""
        : value ?? "";
}

function getRelationLabel(value, fallback = "Non renseigné") {
    if (value && typeof value === "object") {
        return value.name
            || value.username
            || value.registration
            || value.code
            || value.id
            || fallback;
    }

    return value ?? fallback;
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

    const property = button.tagName === "INPUT"
        ? "value"
        : "textContent";

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
        throw new Error(
            "Tu n'as pas l'autorisation d'effectuer cette opération."
        );
    }
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function getTripRoute(trip) {
    return trip?.route_detail || trip?.route || {};
}

function getTripRelation(trip, detailKey, relationKey) {
    return trip?.[detailKey] || trip?.[relationKey] || {};
}

function getReservationTrip(reservation) {
    const relation = reservation?.trip_detail || reservation?.trip;

    if (relation && typeof relation === "object") {
        return relation;
    }

    return trips.find(
        trip => Number(trip.id) === Number(relation)
    ) || {};
}

function getReservationSeat(reservation) {
    const relation = reservation?.seat_detail || reservation?.seat;

    if (relation && typeof relation === "object") {
        return relation;
    }

    return seats.find(
        seat => Number(seat.id) === Number(relation)
    ) || {};
}

function getPaymentReservation(payment) {
    if (
        payment?.reservation_detail
        && typeof payment.reservation_detail === "object"
    ) {
        return payment.reservation_detail;
    }

    const reservationId = getRelationId(payment?.reservation);

    return reservations.find(
        item => Number(item.id) === Number(reservationId)
    ) || {};
}

function getTicketReservation(ticket) {
    if (
        ticket?.reservation_detail
        && typeof ticket.reservation_detail === "object"
    ) {
        return ticket.reservation_detail;
    }

    const reservationId = getRelationId(ticket?.reservation);

    return reservations.find(
        item => Number(item.id) === Number(reservationId)
    ) || {};
}

function getPassengerName(reservation) {
    return reservation?.passenger_name || "Passager non renseigné";
}

function getPassengerPhone(reservation) {
    return reservation?.passenger_phone || "Téléphone non renseigné";
}

function getReservationTripLabel(reservation) {
    const trip = getReservationTrip(reservation);
    return getTripLabel(trip);
}

function getReservationDepartureDate(reservation) {
    const trip = getReservationTrip(reservation);
    return dateText(trip.departure_at);
}

function getReservationSeatLabel(reservation) {
    const seat = getReservationSeat(reservation);

    if (seat.number !== undefined && seat.number !== null) {
        return `Place ${seat.number}`;
    }

    return "Place non renseignée";
}

function reservationStatusLabel(status) {
    const labels = {
        HOLD: "En attente de paiement",
        CONFIRMED: "Confirmée",
        CANCELLED: "Annulée",
        EXPIRED: "Expirée"
    };

    return labels[status] || status || "Non renseigné";
}

function isReservationExpired(reservation) {
    if (reservation.status !== "HOLD") return false;
    if (!reservation.hold_expires_at) return false;

    const expiration = new Date(reservation.hold_expires_at);

    return !Number.isNaN(expiration.getTime())
        && expiration.getTime() <= Date.now();
}

function isReservationPayable(reservation) {
    return reservation.status === "HOLD"
        && !isReservationExpired(reservation);
}

function getTripLabel(trip) {
    const route = getTripRoute(trip);

    return `${route.origin || "Départ"} → ${route.destination || "Destination"}`;
}

function tripStatusLabel(status) {
    const labels = {
        PLANNED: "Programmé",
        BOARDING: "Embarquement",
        DEPARTED: "En route",
        ARRIVED: "Arrivé",
        CANCELLED: "Annulé"
    };

    return labels[status] || status || "Non renseigné";
}

/*
 * Retourne le nom du caissier associé à un paiement.
 * Le backend fournit received_by_name dans PaymentSerializer.
 */
function getPaymentCashier(payment) {
    if (payment?.received_by_name) {
        return payment.received_by_name;
    }

    const cashier = payment?.received_by_detail
        || payment?.received_by;

    if (!cashier) return "Non renseigné";

    if (typeof cashier === "object") {
        const fullName =
            `${cashier.first_name || ""} ${cashier.last_name || ""}`.trim();

        return fullName
            || cashier.username
            || cashier.email
            || cashier.id
            || "Non renseigné";
    }

    return "Non renseigné";
}


/* =========================================================
   2. NAVIGATION ET DROITS D'ACCÈS
========================================================= */

function configureNavigation() {
    document.querySelectorAll("[data-page]").forEach(button => {
        const allowed = (button.dataset.roles || "")
            .split(",")
            .map(role => role.trim());

        button.hidden = !allowed.includes(currentUser.role);

        if (button.dataset.navigationReady === "true") return;

        button.dataset.navigationReady = "true";

        button.addEventListener("click", () => {
            if (!button.hidden) {
                openPage(button.dataset.page);
            }
        });
    });
}

function canOpenPage(page) {
    const permissions = {
        dashboard: [
            "AGENT", "CONTROLEUR", "CAISSIER",
            "EXPLOITATION", "RESPONSABLE"
        ],
        departures: ["AGENT", "EXPLOITATION", "RESPONSABLE"],
        booking: ["AGENT"],
        tickets: ["AGENT", "CONTROLEUR", "RESPONSABLE"],
        control: ["CONTROLEUR"],
        payments: ["CAISSIER", "RESPONSABLE"],
        resources: ["EXPLOITATION", "RESPONSABLE"],
        users: ["RESPONSABLE"],
        agencies: ["RESPONSABLE"]
    };

    return Boolean(
        currentUser && permissions[page]?.includes(currentUser.role)
    );
}

function openPage(page, shouldLoad = true) {
    const section = $(`page-${page}`);

    if (!section || !currentUser) return;

    if (!canOpenPage(page)) {
        notify("Accès non autorisé.", true);
        return;
    }

    currentPage = page;

    document.querySelectorAll(".page").forEach(item => {
        const active = item.id === `page-${page}`;
        item.hidden = !active;
        item.classList.toggle("active", active);
    });

    document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    setText("pageTitle", PAGE_TITLES[page] || "TransitGo");

    if (shouldLoad) {
        loadPage(page).catch(showError);
    }
}

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

        case "payments":
            await loadPayments();
            break;

        case "resources":
            await loadResources();
            break;

        case "users":
            await loadUsers();
            break;

        case "agencies":
            await loadAgencies();
            break;
    }
}


/* =========================================================
   3. TABLEAU DE BORD
========================================================= */

async function loadDashboard() {
    requireRole(
        "AGENT", "CONTROLEUR", "CAISSIER",
        "EXPLOITATION", "RESPONSABLE"
    );

    const data = await API.get("dashboard/");

    setText("statDepartures", data.departures_count ?? 0);
    setText("statReservations", data.reservations_count ?? 0);
    setText("statTickets", data.tickets_count ?? 0);
    setText("statPaid", money(data.total_paid ?? 0));

    const dashboardLabels = {
        AGENT: "Agent",
        CONTROLEUR: "Contrôleur",
        CAISSIER: "Caissier",
        EXPLOITATION: "Exploitation",
        RESPONSABLE: "Responsable"
    };

    setText(
        "dashboardWelcome",
        `Espace : ${dashboardLabels[currentUser.role] || currentUser.role}`
    );
}


/* =========================================================
   4. DÉPARTS
========================================================= */

async function loadDepartures() {
    requireRole("AGENT", "EXPLOITATION", "RESPONSABLE");

    trips = await API.getAll("trips/");

    const searchPanel = $("departureSearchPanel");
    const operationsPanel = $("operationsDeparturePanel");
    const results = $("departureResults");
    const empty = $("departureEmpty");

    const isAgent = hasRole("AGENT");

    if (searchPanel) searchPanel.hidden = !isAgent;
    if (operationsPanel) operationsPanel.hidden = isAgent;
    if (results) results.hidden = !isAgent;
    if (empty) empty.hidden = !isAgent;

    if (isAgent) {
        renderDepartures(trips);
    } else {
        renderOperationsDepartures(trips);
    }
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
        const route = getTripRoute(trip);
        const vehicle = getTripRelation(
            trip, "vehicle_detail", "vehicle"
        );

        const card = document.createElement("article");
        card.className = "panel departure-card";

        card.innerHTML = `
            <div class="departure-card-header">
                <strong>${escapeHTML(money(trip.price))}</strong>
                <span class="departure-tag">${escapeHTML(tripStatusLabel(trip.status))}</span>
            </div>

            <h3>
                ${escapeHTML(route.origin || "Départ")}
                →
                ${escapeHTML(route.destination || "Destination")}
            </h3>

            <div class="departure-details">
                <span>📅 ${escapeHTML(dateText(trip.departure_at))}</span>
                <span>🚌 ${escapeHTML(vehicle.registration || "Véhicule non renseigné")}</span>
                <span>💺 ${escapeHTML(trip.available_seats ?? "—")} places disponibles</span>
            </div>

            <div class="departure-card-actions">
                ${trip.status === "PLANNED"
                    ? `<button type="button" data-book-trip="${escapeHTML(trip.id)}">Réserver</button>`
                    : ""}
            </div>
        `;

        card.querySelector("[data-book-trip]")
            ?.addEventListener("click", () => selectTrip(trip.id));

        container.appendChild(card);
    });
}

function renderOperationsDepartures(data) {
    const container = $("operationsDepartureList");
    if (!container) return;

    if (!data.length) {
        container.innerHTML =
            '<p class="empty-state">Aucun départ programmé.</p>';
        return;
    }

    const canEdit = hasRole("EXPLOITATION");

    const rows = data.map(trip => {
        const route = getTripRoute(trip);
        const vehicle = getTripRelation(
            trip, "vehicle_detail", "vehicle"
        );
        const driver = getTripRelation(
            trip, "driver_detail", "driver"
        );
        const agency = getTripRelation(
            trip, "agency_detail", "agency"
        );

        const driverName = driver.first_name || driver.last_name
            ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim()
            : getRelationLabel(driver, "Non renseigné");

        return `
            <tr>
                <td>#${escapeHTML(trip.id)}</td>
                <td>
                    <strong>${escapeHTML(route.origin || "Départ")}</strong>
                    → ${escapeHTML(route.destination || "Destination")}
                </td>
                <td>${escapeHTML(dateText(trip.departure_at))}</td>
                <td>${escapeHTML(vehicle.registration || getRelationLabel(vehicle))}</td>
                <td>${escapeHTML(driverName)}</td>
                <td>${escapeHTML(money(trip.price))}</td>
                <td>
                    <span class="status-badge">${escapeHTML(tripStatusLabel(trip.status))}</span>
                </td>
                <td class="action-cell">
                    <button type="button"
                        data-view-trip="${escapeHTML(trip.id)}">
                        Consulter
                    </button>
                    ${canEdit && trip.status === "PLANNED"
                        ? `<button type="button" data-edit-trip="${escapeHTML(trip.id)}">Modifier</button>`
                        : ""}
                </td>
            </tr>

            <tr id="trip-details-${escapeHTML(trip.id)}" class="trip-details-row" hidden>
                <td colspan="8">
                    <div class="trip-details-content">
                        <p><strong>Référence :</strong> ${escapeHTML(trip.id)}</p>
                        <p><strong>Agence :</strong> ${escapeHTML(getRelationLabel(agency))}</p>
                        <p><strong>Véhicule :</strong> ${escapeHTML(vehicle.registration || getRelationLabel(vehicle))}</p>
                        <p><strong>Chauffeur :</strong> ${escapeHTML(driverName)}</p>
                        <p><strong>Heure d'arrivée :</strong> ${escapeHTML(dateText(trip.arrival_at))}</p>
                        <p><strong>Places disponibles :</strong> ${escapeHTML(trip.available_seats ?? "Non renseigné")}</p>
                        <p><strong>Notes :</strong> ${escapeHTML(trip.notes || "Aucune note")}</p>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    container.innerHTML = `
        <table class="operations-table">
            <thead>
                <tr>
                    <th>Référence</th>
                    <th>Itinéraire</th>
                    <th>Départ</th>
                    <th>Véhicule</th>
                    <th>Chauffeur</th>
                    <th>Prix</th>
                    <th>Statut</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    container.querySelectorAll("[data-view-trip]").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.viewTrip;
            const details = $(`trip-details-${id}`);

            if (!details) return;

            details.hidden = !details.hidden;
            button.textContent = details.hidden ? "Consulter" : "Masquer";
        });
    });

    container.querySelectorAll("[data-edit-trip]").forEach(button => {
        button.addEventListener("click", () => {
            startEditTrip(button.dataset.editTrip);
        });
    });
}

if ($("departureSearchForm")) {
    $("departureSearchForm").addEventListener("submit", event => {
        event.preventDefault();

        requireRole("AGENT");

        const from = $("searchFrom").value.trim().toLowerCase();
        const to = $("searchTo").value.trim().toLowerCase();
        const date = $("searchDate").value;

        const filtered = trips.filter(trip => {
            const route = getTripRoute(trip);
            const origin = String(route.origin || "").toLowerCase();
            const destination = String(route.destination || "").toLowerCase();
            const tripDate = trip.departure_at?.slice(0, 10) || "";

            return (!from || origin.includes(from))
                && (!to || destination.includes(to))
                && (!date || tripDate === date);
        });

        renderDepartures(filtered);
    });
}

if ($("refreshDeparturesBtn")) {
    $("refreshDeparturesBtn").addEventListener("click", async () => {
        const button = $("refreshDeparturesBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadDepartures();
            notify("Liste des départs actualisée.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   5. SÉLECTION D'UN DÉPART ET DES PLACES
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
                "Ce départ n'accepte plus de réservations."
            );
        }

        const route = getTripRoute(selectedTrip);

        setText(
            "selectedDepartureInfo",
            `${route.origin || "Départ"} → ${route.destination || "Destination"} | ${money(selectedTrip.price)}`
        );

        $("bookingTripId").value = selectedTrip.id;
        $("bookingTripSelect").value = String(selectedTrip.id);

        const vehicleId = getRelationId(selectedTrip.vehicle);

        if (!vehicleId) {
            throw new Error(
                "Le véhicule associé à ce départ est introuvable."
            );
        }

        seats = await API.getAll(
            `seats/?vehicle=${encodeURIComponent(vehicleId)}`
        );

        reservations = await API.getAll("reservations/");

        const occupied = reservations
            .filter(item =>
                Number(getRelationId(item.trip)) === Number(selectedTrip.id)
                && ["HOLD", "CONFIRMED"].includes(item.status)
                && !isReservationExpired(item)
            )
            .map(item => Number(getRelationId(item.seat)));

        const available = seats.filter(
            seat => !occupied.includes(Number(seat.id))
        );

        const select = $("bookingSeat");

        select.innerHTML =
            '<option value="">Choisir une place</option>';

        available.forEach(seat => {
            const option = document.createElement("option");
            option.value = seat.id;
            option.textContent = `Place ${seat.number}`;
            select.appendChild(option);
        });

        if (!available.length) {
            notify("Aucune place disponible dans la liste.", true);
        }

        openPage("booking");

    } catch (error) {
        showError(error);
    }
}


/* =========================================================
   6. RÉSERVATIONS AGENT
========================================================= */

async function loadReservations() {
    requireRole("AGENT", "CAISSIER", "EXPLOITATION", "RESPONSABLE");

    reservations = await API.getAll("reservations/");

    if (hasRole("AGENT")) renderReservations();
    if (hasRole("CAISSIER")) renderUnpaidReservations();
}

function renderReservations() {
    const tbody = $("reservationRows");
    const empty = $("reservationEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.textContent = reservations.length
            ? ""
            : "Aucune réservation enregistrée.";
    }

    reservations.forEach(reservation => {
        const trip = getReservationTrip(reservation);
        const route = getTripRoute(trip);
        const seat = getReservationSeat(reservation);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${escapeHTML(reservation.id)}</td>
            <td>${escapeHTML(reservation.passenger_name)}</td>
            <td>${escapeHTML(reservation.passenger_phone)}</td>
            <td>${escapeHTML(route.origin || "Départ")} → ${escapeHTML(route.destination || "Destination")}</td>
            <td>${escapeHTML(dateText(trip.departure_at))}</td>
            <td>${escapeHTML(seat.number ?? getRelationId(reservation.seat) ?? "—")}</td>
            <td>${escapeHTML(money(reservation.amount))}</td>
            <td>${escapeHTML(reservationStatusLabel(reservation.status))}</td>
        `;

        tbody.appendChild(row);
    });
}

if ($("refreshReservationsBtn")) {
    $("refreshReservationsBtn").addEventListener("click", async () => {
        const button = $("refreshReservationsBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadReservations();
            notify("Réservations actualisées.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   7. DÉPARTS POUR L'AGENT
========================================================= */

async function loadResourcesForBooking() {
    requireRole("AGENT");

    trips = await API.getAll("trips/");

    const select = $("bookingTripSelect");
    if (!select) return;

    const availableTrips = trips.filter(
        trip => trip.status === "PLANNED"
    );

    select.innerHTML =
        '<option value="">Choisir un départ</option>';

    availableTrips.forEach(trip => {
        const route = getTripRoute(trip);
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
        select.innerHTML =
            '<option value="">Aucun départ planifié</option>';
    }
}

if ($("bookingTripSelect")) {
    $("bookingTripSelect").addEventListener("change", event => {
        const id = event.target.value;

        if (!id) {
            selectedTrip = null;
            $("bookingTripId").value = "";

            $("bookingSeat").innerHTML =
                '<option value="">Choisir une place</option>';

            setText("selectedDepartureInfo", "Sélectionne un départ.");
            return;
        }

        selectTrip(id);
    });
}


/* =========================================================
   8. CRÉATION DE RÉSERVATION
========================================================= */

if ($("bookingForm")) {
    $("bookingForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Enregistrement...");

        try {
            requireRole("AGENT");

            if (!selectedTrip || !$("bookingTripId").value) {
                throw new Error("Choisis un départ.");
            }

            if (!$("bookingSeat").value) {
                throw new Error("Choisis une place.");
            }

            await API.post("reservations/", {
                trip: Number($("bookingTripId").value),
                seat: Number($("bookingSeat").value),
                passenger_name: $("passengerName").value.trim(),
                passenger_phone: $("passengerPhone").value.trim(),
                passenger_document: $("passengerDocument").value.trim()
            });

            event.target.reset();
            selectedTrip = null;

            setText(
                "selectedDepartureInfo",
                "Sélectionne un départ dans la liste."
            );

            $("bookingTripId").value = "";
            $("bookingSeat").innerHTML =
                '<option value="">Choisir une place</option>';

            notify(
                "Réservation créée. Le voyageur doit régler le montant auprès du caissier."
            );

            await loadReservations();
            await loadResourcesForBooking();

        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   9. PAIEMENTS - CAISSIER
========================================================= */

function renderUnpaidReservations() {
    requireRole("CAISSIER");

    const tbody = $("unpaidReservationRows");
    const empty = $("unpaidReservationEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    const unpaid = reservations.filter(isReservationPayable);

    if (empty) {
        empty.textContent = unpaid.length
            ? ""
            : "Aucune réservation valide en attente de paiement.";
    }

    unpaid.forEach(reservation => {
        const trip = getReservationTrip(reservation);
        const route = getTripRoute(trip);
        const seat = getReservationSeat(reservation);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${escapeHTML(reservation.id)}</td>
            <td>${escapeHTML(reservation.passenger_name)}</td>
            <td>${escapeHTML(reservation.passenger_phone)}</td>
            <td>${escapeHTML(route.origin || "Départ")} → ${escapeHTML(route.destination || "Destination")}</td>
            <td>${escapeHTML(dateText(trip.departure_at))}</td>
            <td>${escapeHTML(seat.number ?? getRelationId(reservation.seat) ?? "—")}</td>
            <td>${escapeHTML(money(reservation.amount))}</td>
            <td>
                <button type="button"
                    data-pay-reservation="${escapeHTML(reservation.id)}">
                    Encaisser
                </button>
            </td>
        `;

        row.querySelector("[data-pay-reservation]")
            .addEventListener("click", () => {
                selectReservationForPayment(reservation.id);
            });

        tbody.appendChild(row);
    });
}

function selectReservationForPayment(id) {
    requireRole("CAISSIER");

    const reservation = reservations.find(
        item => Number(item.id) === Number(id)
    );

    if (!reservation || !isReservationPayable(reservation)) {
        notify(
            "Cette réservation n'est plus payable ou son délai a expiré.",
            true
        );
        loadPayments().catch(showError);
        return;
    }

    $("cashierReservationId").value = reservation.id;
    $("cashierPaymentAmount").value = reservation.amount;

    setText(
        "cashierReservationInfo",
        `Réservation #${reservation.id} — ${reservation.passenger_name} — Montant total : ${money(reservation.amount)}`
    );

    $("cashierPaymentResult").innerHTML = "";
    $("cashierPaymentPanel").hidden = false;

    $("cashierPaymentPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeCashierPaymentPanel() {
    if ($("cashierPaymentPanel")) {
        $("cashierPaymentPanel").hidden = true;
    }

    $("cashierPaymentForm")?.reset();

    if ($("cashierReservationId")) {
        $("cashierReservationId").value = "";
    }

    if ($("cashierPaymentResult")) {
        $("cashierPaymentResult").innerHTML = "";
    }
}

if ($("closeCashierPaymentBtn")) {
    $("closeCashierPaymentBtn").addEventListener(
        "click",
        closeCashierPaymentPanel
    );
}

if ($("cashierPaymentForm")) {
    $("cashierPaymentForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Encaissement...");

        try {
            requireRole("CAISSIER");

            const id = $("cashierReservationId").value;
            const amount = Number($("cashierPaymentAmount").value);
            const method = $("cashierPaymentMethod").value;

            if (!id) {
                throw new Error("Sélectionne une réservation à encaisser.");
            }

            if (!Number.isInteger(amount) || amount <= 0) {
                throw new Error("Le montant total est invalide.");
            }

            const reservation = reservations.find(
                item => Number(item.id) === Number(id)
            );

            if (!reservation || !isReservationPayable(reservation)) {
                throw new Error(
                    "Cette réservation a expiré ou n'est plus payable."
                );
            }

            if (Number(reservation.amount) !== amount) {
                throw new Error(
                    "Le montant ne correspond pas à la réservation."
                );
            }

            const result = await API.post(
                `reservations/${id}/pay/`,
                { amount, method }
            );

            const ticketCode = result?.ticket?.code
                || result?.ticket_code
                || "";

            $("cashierPaymentResult").innerHTML = `
                <h3>Paiement confirmé</h3>
                <p>Le montant total a été encaissé.</p>
                <p>Le serveur a confirmé le paiement et traité la génération du billet.</p>
                ${ticketCode
                    ? `<p><strong>Code du billet :</strong> ${escapeHTML(ticketCode)}</p>`
                    : ""}
            `;

            notify("Paiement intégral enregistré.");

            $("cashierPaymentForm").reset();
            $("cashierReservationId").value = "";

            await loadPayments();
            await loadDashboard();

        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}

async function loadPayments() {
    requireRole("CAISSIER", "RESPONSABLE");

    const results = await Promise.all([
        API.getAll("payments/"),
        API.getAll("reservations/"),
        API.getAll("trips/")
    ]);

    payments = results[0];
    reservations = results[1];
    trips = results[2];

    renderPaymentHistory();

    if (hasRole("CAISSIER")) {
        renderUnpaidReservations();
    }

    if ($("cashierUnpaidPanel")) {
        $("cashierUnpaidPanel").hidden = !hasRole("CAISSIER");
    }

    /*
     * Le Responsable compagnie consulte les paiements.
     * Il ne peut pas encaisser ni modifier un paiement.
     */
    if ($("cashierPaymentPanel")) {
        $("cashierPaymentPanel").hidden = !hasRole("CAISSIER")
            || $("cashierPaymentPanel").hidden;
    }
}


/* =========================================================
   HISTORIQUE DES PAIEMENTS ET RECETTES
========================================================= */

function renderPaymentHistory() {
    const tbody = $("paymentRows");
    const empty = $("paymentEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    // Total des paiements réellement enregistrés.
    const totalRevenue = payments.reduce((total, payment) => {
        return total + Number(payment.amount || 0);
    }, 0);

    // Nombre total de paiements enregistrés.
    const paymentCount = payments.length;

    setText("paymentTotalRevenue", money(totalRevenue));
    setText("paymentCount", paymentCount);

    if (empty) {
        empty.textContent = payments.length
            ? ""
            : "Aucun paiement enregistré.";
    }

    payments.forEach(payment => {
        const reservation = getPaymentReservation(payment);

        const reservationId =
            getRelationId(payment.reservation)
            || reservation.id
            || "—";

        const passengerName = getPassengerName(reservation);
        const cashierName = getPaymentCashier(payment);

        const row = document.createElement("tr");

        /*
         * Colonnes prévues dans le nouvel index.html :
         * Référence paiement, Réservation, Voyageur,
         * Montant, Mode, Date, Caissier.
         *
         * La référence de paiement reste distincte du code
         * du billet : elle peut être un UUID.
         */
        row.innerHTML = `
            <td>${escapeHTML(payment.reference || "Non renseignée")}</td>
            <td>${escapeHTML(`#${reservationId}`)}</td>
            <td>${escapeHTML(passengerName)}</td>
            <td>${escapeHTML(money(payment.amount))}</td>
            <td>${escapeHTML(payment.method || "Non renseigné")}</td>
            <td>${escapeHTML(dateText(payment.paid_at))}</td>
            <td>${escapeHTML(cashierName)}</td>
        `;

        tbody.appendChild(row);
    });
}

if ($("refreshUnpaidBtn")) {
    $("refreshUnpaidBtn").addEventListener("click", async () => {
        const button = $("refreshUnpaidBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            requireRole("CAISSIER");

            await loadPayments();
            notify("Réservations à encaisser actualisées.");

        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}

if ($("refreshPaymentsBtn")) {
    $("refreshPaymentsBtn").addEventListener("click", async () => {
        const button = $("refreshPaymentsBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadPayments();
            notify("Historique des paiements actualisé.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   10. BILLETS
========================================================= */

async function loadTickets() {
    requireRole("AGENT", "CONTROLEUR", "RESPONSABLE");

    tickets = await API.getAll("tickets/");

    renderTickets();
}


/* =========================================================
   AFFICHAGE DES BILLETS - SANS QR CODE
========================================================= */

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
        const reservation = getTicketReservation(ticket);

        const row = document.createElement("tr");

        /*
         * Huit colonnes uniquement.
         * La colonne QR code a été complètement supprimée.
         *
         * Le code est affiché tel que fourni par le backend.
         * C'est le backend qui doit générer TG-1001, TG-1002, etc.
         */
        row.innerHTML = `
            <td>
                <strong>${escapeHTML(ticket.code || "Code indisponible")}</strong>
            </td>

            <td>${escapeHTML(getPassengerName(reservation))}</td>

            <td>${escapeHTML(getPassengerPhone(reservation))}</td>

            <td>${escapeHTML(getReservationTripLabel(reservation))}</td>

            <td>${escapeHTML(getReservationDepartureDate(reservation))}</td>

            <td>${escapeHTML(getReservationSeatLabel(reservation))}</td>

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
    $("refreshTicketsBtn").addEventListener("click", async () => {
        const button = $("refreshTicketsBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadTickets();
            notify("Liste des billets actualisée.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   11. CONTRÔLE DES BILLETS - CONTRÔLEUR UNIQUEMENT
========================================================= */

if ($("controlForm")) {
    $("controlForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        setButtonLoading(button, true, "Vérification...");

        const resultElement = $("controlResult");

        try {
            requireRole("CONTROLEUR");

            const code = $("controlReference").value.trim();

            if (!code) {
                throw new Error("Saisis le code du billet.");
            }

            const result = await API.post(
                "tickets/check/",
                { code }
            );

            if (resultElement) {
                resultElement.className = "control-result success";
                resultElement.innerHTML = `
                    <h3>Billet validé</h3>
                    <p>Embarquement enregistré pour le billet
                        <strong>${escapeHTML(result.code || code)}</strong>.
                    </p>
                `;
            }

            $("controlReference").value = "";
            notify("Billet contrôlé avec succès.");

            await loadTickets();

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
   12. RESSOURCES
========================================================= */

async function loadResources() {
    requireRole("EXPLOITATION", "RESPONSABLE");

    const results = await Promise.all([
        API.getAll("routes/"),
        API.getAll("vehicles/"),
        API.getAll("drivers/"),
        API.getAll("agencies/")
    ]);

    routes = results[0];
    vehicles = results[1];
    drivers = results[2];
    agencies = results[3];

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

    renderResourceLists();
    applyResourcePermissions();
}

function applyResourcePermissions() {
    const canManage = hasRole("EXPLOITATION");

    [
        "routeCreatePanel",
        "driverCreatePanel",
        "vehicleCreatePanel",
        "tripCreatePanel"
    ].forEach(id => {
        const element = $(id);
        if (element) element.hidden = !canManage;
    });
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

function renderResourceLists() {
    const routeContainer = $("routeList");
    const driverContainer = $("driverList");
    const vehicleContainer = $("vehicleList");

    if (routeContainer) {
        routeContainer.innerHTML = routes.length
            ? routes.map(route => `
                <div class="resource-item">
                    <strong>${escapeHTML(route.origin)} → ${escapeHTML(route.destination)}</strong>
                    <span>${escapeHTML(route.distance_km ?? 0)} km</span>
                </div>
            `).join("")
            : '<p class="empty-state">Aucun itinéraire enregistré.</p>';
    }

    if (driverContainer) {
        driverContainer.innerHTML = drivers.length
            ? drivers.map(driver => `
                <div class="resource-item">
                    <strong>${escapeHTML(driver.first_name)} ${escapeHTML(driver.last_name)}</strong>
                    <span>${escapeHTML(driver.phone || "Téléphone non renseigné")}</span>
                    <span>${driver.active ? "Actif" : "Inactif"}</span>
                </div>
            `).join("")
            : '<p class="empty-state">Aucun chauffeur enregistré.</p>';
    }

    if (vehicleContainer) {
        vehicleContainer.innerHTML = vehicles.length
            ? vehicles.map(vehicle => `
                <div class="resource-item">
                    <strong>${escapeHTML(vehicle.registration)}</strong>
                    <span>${escapeHTML(vehicle.brand || "")} ${escapeHTML(vehicle.model || "")}</span>
                    <span>${escapeHTML(vehicle.capacity)} places</span>
                    <span>${vehicle.available ? "Disponible" : "Indisponible"}</span>
                </div>
            `).join("")
            : '<p class="empty-state">Aucun véhicule enregistré.</p>';
    }
}


/* =========================================================
   13. MODIFICATION D'UN DÉPART
========================================================= */

function ensureTripEditControls() {
    const form = $("tripForm");

    if (!form) {
        throw new Error("Formulaire de départ introuvable.");
    }

    const submit = form.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (!submit) {
        throw new Error("Bouton d'enregistrement introuvable.");
    }

    if (!submit.dataset.defaultText) {
        submit.dataset.defaultText =
            submit.tagName === "INPUT"
                ? submit.value
                : submit.textContent;
    }

    let exitButton = $("exitTripEditBtn");

    if (!exitButton) {
        exitButton = document.createElement("button");
        exitButton.type = "button";
        exitButton.id = "exitTripEditBtn";
        exitButton.textContent = "Quitter le mode modification";
        exitButton.hidden = true;

        submit.insertAdjacentElement("afterend", exitButton);
    }

    if (exitButton.dataset.listenerReady !== "true") {
        exitButton.dataset.listenerReady = "true";

        exitButton.addEventListener("click", () => {
            resetTripEditMode();
        });
    }

    return submit;
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

    if (resetForm) {
        $("tripForm")?.reset();
    }

    const button = $("tripForm")?.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (button && button.dataset.defaultText !== undefined) {
        if (button.tagName === "INPUT") {
            button.value = button.dataset.defaultText;
        } else {
            button.textContent = button.dataset.defaultText;
        }
    }

    const exitButton = $("exitTripEditBtn");

    if (exitButton) {
        exitButton.hidden = true;
    }

    setText("tripFormTitle", "Programmer un départ");
}

async function startEditTrip(id) {
    try {
        requireRole("EXPLOITATION");

        let trip = trips.find(
            item => Number(item.id) === Number(id)
        );

        if (!trip) {
            trip = await API.get(`trips/${id}/`);
        }

        if (!trip || trip.status !== "PLANNED") {
            throw new Error(
                "Seuls les départs programmés peuvent être modifiés."
            );
        }

        await loadResources();

        ensureTripEditControls();

        $("tripRoute").value =
            String(getRelationId(trip.route));

        $("tripAgency").value =
            String(getRelationId(trip.agency));

        $("tripVehicle").value =
            String(getRelationId(trip.vehicle));

        $("tripDriver").value =
            String(getRelationId(trip.driver));

        $("tripDeparture").value =
            dateTimeLocal(trip.departure_at);

        $("tripArrival").value =
            dateTimeLocal(trip.arrival_at);

        $("tripPrice").value = trip.price ?? "";
        $("tripNotes").value = trip.notes || "";

        editingTripId = trip.id;

        $("exitTripEditBtn").hidden = false;

        setText("tripFormTitle", `Modifier le départ #${trip.id}`);
        setTripSubmitText("Enregistrer les modifications");

        openPage("resources", false);

        $("tripForm").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        notify("Départ chargé pour modification.");

    } catch (error) {
        showError(error);
    }
}


/* =========================================================
   14. CRÉATION DES RESSOURCES
========================================================= */

if ($("routeForm")) {
    $("routeForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION");

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

if ($("driverForm")) {
    $("driverForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION");

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

if ($("vehicleForm")) {
    $("vehicleForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            requireRole("EXPLOITATION");

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

if ($("tripForm")) {
    $("tripForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        const isEditing = editingTripId !== null;

        setButtonLoading(
            button,
            true,
            isEditing ? "Modification..." : "Création..."
        );

        try {
            requireRole("EXPLOITATION");

            const departureValue = $("tripDeparture").value;
            const arrivalValue = $("tripArrival").value;
            const price = Number($("tripPrice").value);

            if (
                !$("tripRoute").value
                || !$("tripAgency").value
                || !$("tripVehicle").value
                || !$("tripDriver").value
            ) {
                throw new Error(
                    "Complète les informations du départ."
                );
            }

            if (!departureValue) {
                throw new Error(
                    "Indique la date et l'heure du départ."
                );
            }

            if (!Number.isFinite(price) || price <= 0) {
                throw new Error(
                    "Le prix doit être supérieur à zéro."
                );
            }

            const departureDate = new Date(departureValue);
            const arrivalDate = arrivalValue
                ? new Date(arrivalValue)
                : null;

            if (arrivalDate && arrivalDate <= departureDate) {
                throw new Error(
                    "L'arrivée doit être après le départ."
                );
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

            if (isEditing) {
                await API.patch(`trips/${editingTripId}/`, body);

                resetTripEditMode();
                notify("Départ modifié.");

                trips = await API.getAll("trips/");
                openPage("departures");

            } else {
                body.status = "PLANNED";

                await API.post("trips/", body);

                event.target.reset();
                trips = await API.getAll("trips/");

                notify("Départ programmé.");
                await loadResources();
            }

        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   15. UTILISATEURS - CONSULTATION RESPONSABLE
========================================================= */

async function loadUsers() {
    requireRole("RESPONSABLE");

    const results = await Promise.all([
        API.getAll("users/"),
        API.getAll("agencies/")
    ]);

    users = results[0];
    agencies = results[1];

    const tbody = $("userRows");
    const empty = $("userEmpty");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (empty) {
        empty.textContent = users.length
            ? ""
            : "Aucun utilisateur enregistré.";
    }

    users.forEach(user => {
        const fullName =
            `${user.first_name || ""} ${user.last_name || ""}`.trim();

        const agency = agencies.find(
            item => Number(item.id) === Number(user.agency_id)
        );

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(user.username)}</td>
            <td>${escapeHTML(fullName || "Non renseigné")}</td>
            <td>${escapeHTML(user.email || "Non renseigné")}</td>
            <td>${escapeHTML(ROLE_LABELS[user.role] || user.role || "")}</td>
            <td>${escapeHTML(agency?.name || "Aucune agence")}</td>
            <td>${user.is_active ? "Actif" : "Désactivé"}</td>
        `;

        tbody.appendChild(row);
    });

    const userForm = $("userForm");
    if (userForm) userForm.hidden = true;
}

if ($("refreshUsersBtn")) {
    $("refreshUsersBtn").addEventListener("click", async () => {
        const button = $("refreshUsersBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadUsers();
            notify("Liste des utilisateurs actualisée.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   16. AGENCES - CONSULTATION RESPONSABLE
========================================================= */

async function loadAgencies() {
    requireRole("RESPONSABLE");

    agencies = await API.getAll("agencies/");

    const container = $("agencyRows");
    if (!container) return;

    container.innerHTML = "";

    if (!agencies.length) {
        container.innerHTML =
            '<p class="empty-state">Aucune agence enregistrée.</p>';
        return;
    }

    agencies.forEach(agency => {
        const card = document.createElement("article");
        card.className = "panel";

        card.innerHTML = `
            <h3>${escapeHTML(agency.name)}</h3>
            <p>${escapeHTML(agency.city)}</p>
            <p>${escapeHTML(agency.address || "Adresse non renseignée")}</p>
            <p>${escapeHTML(agency.phone || "Téléphone non renseigné")}</p>
        `;

        container.appendChild(card);
    });

    const agencyForm = $("agencyForm");
    if (agencyForm) agencyForm.hidden = true;
}

if ($("refreshAgenciesBtn")) {
    $("refreshAgenciesBtn").addEventListener("click", async () => {
        const button = $("refreshAgenciesBtn");
        setButtonLoading(button, true, "Actualisation...");

        try {
            await loadAgencies();
            notify("Liste des agences actualisée.");
        } catch (error) {
            showError(error);
        } finally {
            setButtonLoading(button, false);
        }
    });
}


/* =========================================================
   17. CONNEXION
========================================================= */

async function startApplication(user) {
    currentUser = user;

    $("loginSection").hidden = true;
    $("appSection").hidden = false;

    const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim();

    setText("userName", fullName || user.username);
    setText("userRole", ROLE_LABELS[user.role] || user.role);

    configureNavigation();
    applyResourcePermissions();

    if ($("userForm")) $("userForm").hidden = true;
    if ($("agencyForm")) $("agencyForm").hidden = true;

    if ($("cashierUnpaidPanel")) {
        $("cashierUnpaidPanel").hidden = !hasRole("CAISSIER");
    }

    if ($("cashierPaymentPanel")) {
        $("cashierPaymentPanel").hidden = true;
    }

    openPage("dashboard");
}

if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async event => {
        event.preventDefault();

        const button = event.submitter;
        const errorElement = $("loginError");

        if (errorElement) errorElement.textContent = "";

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
   18. DÉCONNEXION
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
        users = [];
        seats = [];

        $("appSection").hidden = true;
        $("loginSection").hidden = false;

        $("loginForm")?.reset();

        resetTripEditMode(false);

        document.querySelectorAll(".page").forEach(page => {
            page.hidden = true;
            page.classList.remove("active");
        });

        notify("Déconnexion effectuée.");
    });
}


/* =========================================================
   19. REPRISE DE SESSION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    if (!API || typeof API.isAuthenticated !== "function") {
        console.error(
            "TransitGo : api.js ne fournit pas isAuthenticated()."
        );
        return;
    }

    if (!API.isAuthenticated()) return;

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