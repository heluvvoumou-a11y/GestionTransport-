/* =========================================================
   TRANSITGO - APPLICATION FRONTEND
   Démonstration locale avec localStorage

   IMPORTANT :
   - Les données sont enregistrées dans le navigateur.
   - Le paiement est simulé.
   - L'authentification et les permissions réelles
     devront être assurées par le backend Django.
========================================================= */


/* =========================================================
   1. CONFIGURATION ET DONNÉES
========================================================= */

const STORAGE_KEYS = {
    departures: "transitgo_departures",
    tickets: "transitgo_tickets",
    users: "transitgo_users"
};

const rolePages = {
    Agent: ["dashboard", "departures", "seats", "tickets"],
    "Contrôleur": ["dashboard", "tickets", "control"],
    Administrateur: [
        "dashboard",
        "tickets",
        "admin",
        "adminTickets",
        "adminUsers"
    ]
};

let currentUser = null;
let selectedDeparture = null;
let selectedSeat = null;


/* =========================================================
   2. OUTILS GÉNÉRAUX
========================================================= */

function getData(key, fallback = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (error) {
        console.error("Erreur de lecture des données :", error);
        return fallback;
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getDepartures() {
    return getData(STORAGE_KEYS.departures, []);
}

function getTickets() {
    return getData(STORAGE_KEYS.tickets, []);
}

function getUsers() {
    return getData(STORAGE_KEYS.users, []);
}

function saveDepartures(data) {
    saveData(STORAGE_KEYS.departures, data);
}

function saveTickets(data) {
    saveData(STORAGE_KEYS.tickets, data);
}

function saveUsers(data) {
    saveData(STORAGE_KEYS.users, data);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("fr-FR") + " FCFA";
}

function formatDate(date) {
    if (!date) return "Non renseignée";

    const parts = date.split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden", "success", "error", "warning");
    toast.classList.add(type);

    window.clearTimeout(showToast.timeout);

    showToast.timeout = window.setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.remove("hidden");
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.add("hidden");
}

function isCancelled(ticket) {
    return ticket.status === "Annulé" ||
        ticket.status === "Annule" ||
        ticket.cancelled === true;
}

function isPaid(ticket) {
    return ticket.paymentStatus === "Payé" ||
        ticket.paymentStatus === "Payé (simulation)";
}

function getTicketStatus(ticket) {
    if (isCancelled(ticket)) return "Annulé";
    if (ticket.boarded) return "Embarqué";
    if (isPaid(ticket)) return "Payé";

    return "En attente";
}

function statusBadge(status) {
    let cssClass = "status-pending";

    if (status === "Payé") cssClass = "status-paid";
    if (status === "Annulé") cssClass = "status-cancelled";
    if (status === "Embarqué") cssClass = "status-boarded";

    return `<span class="status-badge ${cssClass}">${escapeHTML(status)}</span>`;
}


/* =========================================================
   3. DONNÉES INITIALES
========================================================= */

function initializeData() {
    const existingDepartures = getData(STORAGE_KEYS.departures, null);
    const existingTickets = getData(STORAGE_KEYS.tickets, null);
    const existingUsers = getData(STORAGE_KEYS.users, null);

    if (existingDepartures === null) {
        const departures = [
            {
                id: "DEP-001",
                from: "Bamako",
                to: "Ségou",
                date: todayString(),
                time: "08:00",
                price: 5000,
                totalSeats: 30,
                seats: 30
            },
            {
                id: "DEP-002",
                from: "Bamako",
                to: "Sikasso",
                date: todayString(),
                time: "09:30",
                price: 7500,
                totalSeats: 30,
                seats: 30
            },
            {
                id: "DEP-003",
                from: "Bamako",
                to: "Mopti",
                date: todayString(),
                time: "07:00",
                price: 10000,
                totalSeats: 35,
                seats: 35
            },
            {
                id: "DEP-004",
                from: "Ségou",
                to: "Bamako",
                date: todayString(),
                time: "14:00",
                price: 5000,
                totalSeats: 30,
                seats: 30
            }
        ];

        saveDepartures(departures);
    }

    if (existingTickets === null) {
        const tickets = [
            {
                id: "TKT-001",
                reference: "TG-1001",
                departureId: "DEP-001",
                passengerName: "Aminata Traoré",
                passengerPhone: "70000001",
                from: "Bamako",
                to: "Ségou",
                date: todayString(),
                time: "08:00",
                seat: 1,
                price: 5000,
                paymentMethod: "Orange Money",
                paymentStatus: "Payé (simulation)",
                status: "Payé",
                boarded: false,
                cancelled: false,
                createdAt: new Date().toISOString()
            },
            {
                id: "TKT-002",
                reference: "TG-1002",
                departureId: "DEP-002",
                passengerName: "Moussa Diallo",
                passengerPhone: "70000002",
                from: "Bamako",
                to: "Sikasso",
                date: todayString(),
                time: "09:30",
                seat: 2,
                price: 7500,
                paymentMethod: "Moov Money",
                paymentStatus: "Payé (simulation)",
                status: "Payé",
                boarded: false,
                cancelled: false,
                createdAt: new Date().toISOString()
            }
        ];

        saveTickets(tickets);

        // Les places des billets de démonstration sont occupées.
        const departures = getDepartures();

        tickets.forEach(ticket => {
            const departure = departures.find(
                item => item.id === ticket.departureId
            );

            if (departure && !isCancelled(ticket)) {
                departure.seats = Math.max(0, departure.seats - 1);
            }
        });

        saveDepartures(departures);
    }

    if (existingUsers === null) {
        saveUsers([
            {
                id: "USR-001",
                name: "Agent Démonstration",
                email: "agent@transitgo.test",
                role: "Agent",
                active: true
            },
            {
                id: "USR-002",
                name: "Contrôleur Démonstration",
                email: "controleur@transitgo.test",
                role: "Contrôleur",
                active: true
            },
            {
                id: "USR-003",
                name: "Administrateur Démonstration",
                email: "admin@transitgo.test",
                role: "Administrateur",
                active: true
            }
        ]);
    }

    // Compatibilité avec les anciennes données de démonstration.
    normalizeDepartures();
    normalizeTickets();
}

function normalizeDepartures() {
    const departures = getDepartures();

    departures.forEach(departure => {
        if (departure.totalSeats === undefined) {
            departure.totalSeats = Number(departure.seats || 0);
        }

        if (departure.seats === undefined) {
            departure.seats = departure.totalSeats;
        }
    });

    saveDepartures(departures);
}

function normalizeTickets() {
    const tickets = getTickets();

    tickets.forEach(ticket => {
        if (ticket.cancelled === undefined) {
            ticket.cancelled = false;
        }

        if (ticket.boarded === undefined) {
            ticket.boarded = false;
        }

        if (!ticket.status) {
            ticket.status = isCancelled(ticket)
                ? "Annulé"
                : ticket.boarded
                    ? "Embarqué"
                    : isPaid(ticket)
                        ? "Payé"
                        : "En attente";
        }
    });

    saveTickets(tickets);
}


/* =========================================================
   4. CONNEXION ET DÉCONNEXION
========================================================= */

function login(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    if (!email || !password || !role) {
        showToast("Veuillez remplir tous les champs.", "error");
        return;
    }

    // Simulation locale seulement.
    // En production, Django devra authentifier l'utilisateur
    // et fournir son véritable rôle.
    currentUser = {
        email,
        role,
        name: email.split("@")[0]
    };

    const demoUsers = getUsers();
    const knownUser = demoUsers.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (knownUser && knownUser.active === false) {
        showToast("Ce compte est désactivé dans la démonstration.", "error");
        return;
    }

    if (knownUser) {
        currentUser.name = knownUser.name;
        currentUser.role = knownUser.role;
    }

    hideElement("loginView");
    showElement("appView");

    setText("userName", currentUser.name);
    setText("userRole", currentUser.role);

    configureInterface();
    navigate("dashboard");

    showToast("Connexion réussie.");
}

function logout() {
    currentUser = null;
    selectedDeparture = null;
    selectedSeat = null;

    hideElement("appView");
    showElement("loginView");

    document.getElementById("loginForm").reset();

    showToast("Vous êtes déconnecté.");
}


/* =========================================================
   5. NAVIGATION ET RÔLES
========================================================= */

function configureInterface() {
    if (!currentUser) return;

    const allowedPages = rolePages[currentUser.role] || [];

    document.querySelectorAll("[data-page]").forEach(button => {
        const page = button.dataset.page;
        const allowed = allowedPages.includes(page);

        button.classList.toggle("hidden", !allowed);
    });

    document.querySelectorAll("[data-roles]").forEach(element => {
        const roles = element.dataset.roles
            .split(",")
            .map(role => role.trim());

        element.classList.toggle(
            "hidden",
            !roles.includes(currentUser.role)
        );
    });
}

function navigate(page) {
    if (!currentUser) return;

    const allowedPages = rolePages[currentUser.role] || [];

    if (!allowedPages.includes(page)) {
        showToast("Vous n'avez pas accès à cette page.", "error");
        return;
    }

    const target = document.getElementById(page);

    if (!target) {
        showToast("Cette page est introuvable.", "error");
        return;
    }

    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    const titles = {
        dashboard: "Tableau de bord",
        departures: "Départs",
        seats: "Réservation",
        tickets: "Billets",
        control: "Contrôle des billets",
        admin: "Gestion des départs",
        adminTickets: "Gestion des billets",
        adminUsers: "Gestion des utilisateurs"
    };

    setText("pageTitle", titles[page] || "TransitGo");

    switch (page) {
        case "dashboard":
            renderDashboard();
            break;

        case "departures":
            renderDepartures();
            break;

        case "seats":
            renderSeatMap();
            break;

        case "tickets":
            renderTickets();
            break;

        case "admin":
            renderAdminDepartures();
            break;

        case "adminTickets":
            renderAdminTickets();
            break;

        case "adminUsers":
            renderAdminUsers();
            break;
    }
}


/* =========================================================
   6. TABLEAU DE BORD
========================================================= */

function renderDashboard() {
    const departures = getDepartures();
    const tickets = getTickets();

    setText("statDepartures", departures.length);
    setText("statTickets", tickets.length);

    setText(
        "statPaid",
        tickets.filter(ticket => isPaid(ticket) && !isCancelled(ticket)).length
    );

    setText(
        "statBoarded",
        tickets.filter(ticket => ticket.boarded && !isCancelled(ticket)).length
    );

    const tbody = document.getElementById("upcomingDepartures");
    if (!tbody) return;

    const upcoming = departures
        .filter(departure => departure.date >= todayString())
        .sort((a, b) => {
            return `${a.date} ${a.time}`.localeCompare(
                `${b.date} ${b.time}`
            );
        })
        .slice(0, 6);

    tbody.innerHTML = "";

    if (upcoming.length === 0) {
        showElement("dashboardEmpty");
        return;
    }

    hideElement("dashboardEmpty");

    upcoming.forEach(departure => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(departure.from)} → ${escapeHTML(departure.to)}</td>
            <td>${formatDate(departure.date)}</td>
            <td>${escapeHTML(departure.time)}</td>
            <td>${Number(departure.seats)}</td>
        `;

        tbody.appendChild(row);
    });
}


/* =========================================================
   7. RECHERCHE DES DÉPARTS
========================================================= */

function renderDepartures(filters = {}) {
    const container = document.getElementById("departureResults");
    if (!container) return;

    const departures = getDepartures();

    const from = (filters.from || "").toLowerCase();
    const to = (filters.to || "").toLowerCase();
    const date = filters.date || "";

    const results = departures.filter(departure => {
        const matchesFrom = !from ||
            departure.from.toLowerCase().includes(from);

        const matchesTo = !to ||
            departure.to.toLowerCase().includes(to);

        const matchesDate = !date || departure.date === date;

        return matchesFrom &&
            matchesTo &&
            matchesDate &&
            departure.seats > 0 &&
            departure.date >= todayString();
    });

    container.innerHTML = "";

    if (results.length === 0) {
        showElement("departureEmpty");
        return;
    }

    hideElement("departureEmpty");

    results.forEach(departure => {
        const card = document.createElement("article");
        card.className = "departure-card";

        card.innerHTML = `
            <div class="departure-card-header">
                <span class="departure-tag">Départ disponible</span>
                <strong>${formatMoney(departure.price)}</strong>
            </div>

            <h3>${escapeHTML(departure.from)} → ${escapeHTML(departure.to)}</h3>

            <div class="departure-details">
                <span>📅 ${formatDate(departure.date)}</span>
                <span>🕒 ${escapeHTML(departure.time)}</span>
                <span>💺 ${Number(departure.seats)} places disponibles</span>
            </div>

            <button class="btn btn-primary btn-full" data-select-departure="${escapeHTML(departure.id)}">
                Choisir ce départ
            </button>
        `;

        container.appendChild(card);
    });
}

function searchDepartures(event) {
    event.preventDefault();

    const from = document.getElementById("searchFrom").value.trim();
    const to = document.getElementById("searchTo").value.trim();
    const date = document.getElementById("searchDate").value;

    renderDepartures({ from, to, date });
}


/* =========================================================
   8. SÉLECTION DU DÉPART
========================================================= */

function selectDeparture(departureId) {
    const departure = getDepartures().find(
        item => item.id === departureId
    );

    if (!departure) {
        showToast("Départ introuvable.", "error");
        return;
    }

    if (departure.seats <= 0) {
        showToast("Il n'y a plus de places disponibles.", "error");
        return;
    }

    selectedDeparture = departure;
    selectedSeat = null;

    navigate("seats");

    renderSelectedDeparture();
    renderSeatMap();
}

function renderSelectedDeparture() {
    const container = document.getElementById("selectedDepartureDetails");
    if (!container || !selectedDeparture) return;

    container.innerHTML = `
        <p><strong>Trajet :</strong> ${escapeHTML(selectedDeparture.from)} → ${escapeHTML(selectedDeparture.to)}</p>
        <p><strong>Date :</strong> ${formatDate(selectedDeparture.date)}</p>
        <p><strong>Heure :</strong> ${escapeHTML(selectedDeparture.time)}</p>
        <p><strong>Prix :</strong> ${formatMoney(selectedDeparture.price)}</p>
    `;

    showElement("selectedDepartureInfo");
}


/* =========================================================
   9. PLAN DES PLACES
========================================================= */

function renderSeatMap() {
    const container = document.getElementById("seatMap");
    if (!container) return;

    container.innerHTML = "";

    if (!selectedDeparture) {
        container.innerHTML = `
            <div class="empty-state">
                Veuillez d'abord choisir un départ.
            </div>
        `;

        setText("selectedSeatText", "Aucune place sélectionnée.");
        return;
    }

    const departure = getDepartures().find(
        item => item.id === selectedDeparture.id
    );

    if (!departure) {
        container.textContent = "Ce départ n'existe plus.";
        return;
    }

    const tickets = getTickets();

    const occupiedSeats = tickets
        .filter(ticket =>
            ticket.departureId === departure.id &&
            !isCancelled(ticket)
        )
        .map(ticket => Number(ticket.seat));

    const totalSeats = Number(departure.totalSeats || departure.seats);

    for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber++) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "seat";

        const occupied = occupiedSeats.includes(seatNumber);

        if (occupied) {
            button.classList.add("occupied");
            button.disabled = true;
            button.title = "Place déjà réservée";
        } else {
            button.classList.add("available");
            button.title = `Place ${seatNumber}`;

            if (selectedSeat === seatNumber) {
                button.classList.add("selected");
            }

            button.addEventListener("click", () => {
                selectedSeat = seatNumber;
                renderSeatMap();
            });
        }

        button.textContent = seatNumber;

        container.appendChild(button);
    }

    setText(
        "selectedSeatText",
        selectedSeat
            ? `Place sélectionnée : ${selectedSeat}`
            : "Aucune place sélectionnée."
    );
}


/* =========================================================
   10. RÉSERVATION ET PAIEMENT SIMULÉ
========================================================= */

function confirmBooking(event) {
    event.preventDefault();

    if (!selectedDeparture) {
        showToast("Veuillez sélectionner un départ.", "error");
        return;
    }

    if (!selectedSeat) {
        showToast("Veuillez sélectionner une place.", "error");
        return;
    }

    const passengerName = document
        .getElementById("passengerName")
        .value.trim();

    const passengerPhone = document
        .getElementById("passengerPhone")
        .value.trim();

    const paymentMethod = document
        .getElementById("paymentMethod")
        .value;

    if (!passengerName || !passengerPhone || !paymentMethod) {
        showToast("Veuillez remplir toutes les informations.", "error");
        return;
    }

    const departures = getDepartures();

    const departure = departures.find(
        item => item.id === selectedDeparture.id
    );

    if (!departure) {
        showToast("Ce départ n'existe plus.", "error");
        return;
    }

    if (departure.date < todayString()) {
        showToast("La date de ce départ est dépassée.", "error");
        return;
    }

    const tickets = getTickets();

    const alreadyReserved = tickets.some(ticket =>
        ticket.departureId === departure.id &&
        Number(ticket.seat) === Number(selectedSeat) &&
        !isCancelled(ticket)
    );

    if (alreadyReserved) {
        showToast("Cette place vient d'être réservée.", "error");
        renderSeatMap();
        return;
    }

    if (departure.seats <= 0) {
        showToast("Il n'y a plus de places disponibles.", "error");
        return;
    }

    const confirmation = window.confirm(
        `Confirmer le paiement simulé de ${formatMoney(departure.price)} ?\n\n` +
        `Voyageur : ${passengerName}\n` +
        `Trajet : ${departure.from} - ${departure.to}\n` +
        `Place : ${selectedSeat}\n` +
        `Mode : ${paymentMethod}\n\n` +
        `Aucun argent réel ne sera débité.`
    );

    if (!confirmation) {
        showToast("Paiement non confirmé. Aucun billet généré.", "warning");
        return;
    }

    // Le billet est créé seulement après confirmation
    // du paiement simulé.
    const reference = generateTicketReference();

    const ticket = {
        id: "TKT-" + Date.now(),
        reference,
        departureId: departure.id,
        passengerName,
        passengerPhone,
        from: departure.from,
        to: departure.to,
        date: departure.date,
        time: departure.time,
        seat: selectedSeat,
        price: departure.price,
        paymentMethod,
        paymentStatus: "Payé (simulation)",
        status: "Payé",
        boarded: false,
        cancelled: false,
        createdAt: new Date().toISOString()
    };

    tickets.push(ticket);
    saveTickets(tickets);

    departure.seats = Math.max(0, Number(departure.seats) - 1);
    saveDepartures(departures);

    document.getElementById("bookingForm").reset();

    selectedDeparture = null;
    selectedSeat = null;

    renderDashboard();
    renderDepartures();

    showToast(`Paiement confirmé ! Billet ${reference} généré.`);

    navigate("tickets");
}

function generateTicketReference() {
    const tickets = getTickets();

    let reference;

    do {
        reference = "TG-" + Math.floor(1000 + Math.random() * 9000);
    } while (tickets.some(ticket => ticket.reference === reference));

    return reference;
}


/* =========================================================
   11. AFFICHAGE DES BILLETS
========================================================= */

function renderTickets(search = "") {
    const tbody = document.getElementById("ticketRows");
    if (!tbody) return;

    const query = search.toLowerCase();

    const tickets = getTickets().filter(ticket => {
        if (currentUser.role === "Agent") {
            // En démonstration, l'agent voit les billets disponibles.
            return true;
        }

        return true;
    }).filter(ticket => {
        const searchable = [
            ticket.reference,
            ticket.passengerName,
            ticket.from,
            ticket.to
        ].join(" ").toLowerCase();

        return searchable.includes(query);
    });

    tbody.innerHTML = "";

    if (tickets.length === 0) {
        showElement("ticketEmpty");
        return;
    }

    hideElement("ticketEmpty");

    tickets.forEach(ticket => {
        const row = document.createElement("tr");
        const status = getTicketStatus(ticket);

        row.innerHTML = `
            <td><strong>${escapeHTML(ticket.reference)}</strong></td>
            <td>${escapeHTML(ticket.passengerName)}</td>
            <td>${escapeHTML(ticket.from)} → ${escapeHTML(ticket.to)}</td>
            <td>${escapeHTML(ticket.seat)}</td>
            <td>${escapeHTML(ticket.paymentStatus || "En attente")}</td>
            <td>${statusBadge(status)}</td>
        `;

        tbody.appendChild(row);
    });
}


/* =========================================================
   12. EXPORTATION CSV
========================================================= */

function exportTicketsCSV() {
    const tickets = getTickets();

    if (tickets.length === 0) {
        showToast("Aucun billet à exporter.", "warning");
        return;
    }

    const headers = [
        "Référence",
        "Voyageur",
        "Téléphone",
        "Départ",
        "Arrivée",
        "Date",
        "Heure",
        "Place",
        "Prix",
        "Paiement",
        "Statut"
    ];

    const rows = tickets.map(ticket => [
        ticket.reference,
        ticket.passengerName,
        ticket.passengerPhone,
        ticket.from,
        ticket.to,
        ticket.date,
        ticket.time,
        ticket.seat,
        ticket.price,
        ticket.paymentMethod,
        getTicketStatus(ticket)
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(value => {
            const safeValue = String(value ?? "").replace(/"/g, '""');
            return `"${safeValue}"`;
        }).join(";"))
        .join("\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "transitgo-billets.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Exportation terminée.");
}


/* =========================================================
   13. CONTRÔLE DES BILLETS
========================================================= */

function controlTicket(event) {
    event.preventDefault();

    const reference = document
        .getElementById("controlReference")
        .value.trim()
        .toUpperCase();

    const result = document.getElementById("controlResult");

    if (!reference || !result) return;

    result.classList.remove("hidden", "success", "error", "warning");

    const tickets = getTickets();

    const ticket = tickets.find(
        item => item.reference.toUpperCase() === reference
    );

    if (!ticket) {
        displayControlResult(
            "error",
            "Billet introuvable",
            "Cette référence ne correspond à aucun billet enregistré."
        );
        return;
    }

    if (isCancelled(ticket)) {
        displayControlResult(
            "error",
            "Billet annulé",
            "Ce billet a été annulé. L'embarquement est interdit."
        );
        return;
    }

    if (!isPaid(ticket)) {
        displayControlResult(
            "error",
            "Paiement non confirmé",
            "Ce billet ne possède pas de paiement confirmé."
        );
        return;
    }

    if (ticket.boarded) {
        displayControlResult(
            "warning",
            "Billet déjà contrôlé",
            "L'embarquement de ce billet a déjà été enregistré."
        );
        return;
    }

    const departure = getDepartures().find(
        item => item.id === ticket.departureId
    );

    if (!departure) {
        displayControlResult(
            "error",
            "Départ introuvable",
            "Le départ associé à ce billet n'existe plus."
        );
        return;
    }

    if (departure.date < todayString()) {
        displayControlResult(
            "error",
            "Billet expiré",
            "La date du voyage est dépassée."
        );
        return;
    }

    if (departure.date > todayString()) {
        displayControlResult(
            "warning",
            "Voyage pas encore prévu",
            `Ce billet est valable pour le ${formatDate(departure.date)}.`
        );
        return;
    }

    const confirmation = window.confirm(
        `Billet valide.\n\n` +
        `Voyageur : ${ticket.passengerName}\n` +
        `Trajet : ${ticket.from} - ${ticket.to}\n` +
        `Place : ${ticket.seat}\n\n` +
        `Confirmer l'embarquement ?`
    );

    if (!confirmation) {
        displayControlResult(
            "warning",
            "Contrôle non enregistré",
            "L'embarquement n'a pas été enregistré."
        );
        return;
    }

    ticket.boarded = true;
    ticket.status = "Embarqué";
    ticket.boardedAt = new Date().toISOString();

    saveTickets(tickets);

    displayControlResult(
        "success",
        "Billet valide - Embarquement enregistré",
        `
            Voyageur : ${escapeHTML(ticket.passengerName)}<br>
            Trajet : ${escapeHTML(ticket.from)} → ${escapeHTML(ticket.to)}<br>
            Place : ${escapeHTML(ticket.seat)}<br>
            Référence : ${escapeHTML(ticket.reference)}
        `
    );

    renderDashboard();
}

function displayControlResult(type, title, message) {
    const result = document.getElementById("controlResult");

    result.className = `control-result ${type}`;
    result.innerHTML = `
        <h3>${escapeHTML(title)}</h3>
        <p>${message}</p>
    `;

    showElement("controlResult");
}


/* =========================================================
   14. ADMINISTRATION DES DÉPARTS
========================================================= */

function addDeparture(event) {
    event.preventDefault();

    const from = document.getElementById("adminFrom").value.trim();
    const to = document.getElementById("adminTo").value.trim();
    const date = document.getElementById("adminDate").value;
    const time = document.getElementById("adminTime").value;
    const price = Number(document.getElementById("adminPrice").value);
    const seats = Number(document.getElementById("adminSeats").value);

    if (!from || !to || !date || !time || price <= 0 || seats <= 0) {
        showToast("Veuillez vérifier les informations du départ.", "error");
        return;
    }

    if (from.toLowerCase() === to.toLowerCase()) {
        showToast("Les villes de départ et d'arrivée doivent être différentes.", "error");
        return;
    }

    if (date < todayString()) {
        showToast("La date du départ ne peut pas être passée.", "error");
        return;
    }

    const departures = getDepartures();

    const departure = {
        id: "DEP-" + Date.now(),
        from,
        to,
        date,
        time,
        price,
        totalSeats: seats,
        seats
    };

    departures.push(departure);
    saveDepartures(departures);

    document.getElementById("adminDepartureForm").reset();

    renderAdminDepartures();
    renderDashboard();

    showToast("Départ ajouté avec succès.");
}

function renderAdminDepartures() {
    const tbody = document.getElementById("adminDepartureRows");
    if (!tbody) return;

    const departures = getDepartures();

    tbody.innerHTML = "";

    if (departures.length === 0) {
        showElement("adminDepartureEmpty");
        return;
    }

    hideElement("adminDepartureEmpty");

    departures.forEach(departure => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(departure.from)} → ${escapeHTML(departure.to)}</td>
            <td>${formatDate(departure.date)}</td>
            <td>${escapeHTML(departure.time)}</td>
            <td>${formatMoney(departure.price)}</td>
            <td>${Number(departure.seats)} / ${Number(departure.totalSeats)}</td>
            <td>
                <button class="btn btn-small btn-secondary"
                    data-edit-departure="${escapeHTML(departure.id)}">
                    Modifier
                </button>

                <button class="btn btn-small btn-danger"
                    data-delete-departure="${escapeHTML(departure.id)}">
                    Supprimer
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function editDeparture(departureId) {
    const departures = getDepartures();

    const departure = departures.find(
        item => item.id === departureId
    );

    if (!departure) {
        showToast("Départ introuvable.", "error");
        return;
    }

    const from = window.prompt("Ville de départ :", departure.from);
    if (from === null) return;

    const to = window.prompt("Ville d'arrivée :", departure.to);
    if (to === null) return;

    const date = window.prompt("Date (AAAA-MM-JJ) :", departure.date);
    if (date === null) return;

    const time = window.prompt("Heure (HH:MM) :", departure.time);
    if (time === null) return;

    const priceInput = window.prompt("Prix en FCFA :", departure.price);
    if (priceInput === null) return;

    const price = Number(priceInput);

    if (
        !from.trim() ||
        !to.trim() ||
        from.trim().toLowerCase() === to.trim().toLowerCase() ||
        !date ||
        !time ||
        price <= 0 ||
        date < todayString()
    ) {
        showToast("Informations invalides. Modification annulée.", "error");
        return;
    }

    departure.from = from.trim();
    departure.to = to.trim();
    departure.date = date;
    departure.time = time;
    departure.price = price;

    // Les billets existants conservent leur référence.
    // Leurs informations de trajet sont actualisées.
    const tickets = getTickets();

    tickets.forEach(ticket => {
        if (ticket.departureId === departureId) {
            ticket.from = departure.from;
            ticket.to = departure.to;
            ticket.date = departure.date;
            ticket.time = departure.time;
            ticket.price = departure.price;
        }
    });

    saveDepartures(departures);
    saveTickets(tickets);

    renderAdminDepartures();
    renderDashboard();

    showToast("Départ modifié.");
}

function deleteDeparture(departureId) {
    const departures = getDepartures();

    const departure = departures.find(
        item => item.id === departureId
    );

    if (!departure) return;

    const hasActiveTickets = getTickets().some(ticket =>
        ticket.departureId === departureId &&
        !isCancelled(ticket)
    );

    if (hasActiveTickets) {
        showToast(
            "Impossible de supprimer ce départ : des billets actifs y sont associés.",
            "error"
        );
        return;
    }

    const confirmation = window.confirm(
        `Voulez-vous vraiment supprimer le départ ${departure.from} - ${departure.to} ?`
    );

    if (!confirmation) return;

    saveDepartures(
        departures.filter(item => item.id !== departureId)
    );

    renderAdminDepartures();
    renderDashboard();

    showToast("Départ supprimé.");
}


/* =========================================================
   15. ADMINISTRATION DES BILLETS
========================================================= */

function renderAdminTickets() {
    const tbody = document.getElementById("adminTicketRows");
    if (!tbody) return;

    const tickets = getTickets();

    setText("adminTotalTickets", tickets.length);

    setText(
        "adminPaidTickets",
        tickets.filter(ticket => isPaid(ticket) && !isCancelled(ticket)).length
    );

    setText(
        "adminCancelledTickets",
        tickets.filter(ticket => isCancelled(ticket)).length
    );

    setText(
        "adminBoardedTickets",
        tickets.filter(ticket => ticket.boarded && !isCancelled(ticket)).length
    );

    const query = (
        document.getElementById("adminTicketSearch")?.value || ""
    ).toLowerCase();

    const filter = (
        document.getElementById("adminTicketFilter")?.value || ""
    ).toLowerCase();

    const filteredTickets = tickets.filter(ticket => {
        const searchable = [
            ticket.reference,
            ticket.passengerName,
            ticket.passengerPhone,
            ticket.from,
            ticket.to
        ].join(" ").toLowerCase();

        const matchesSearch = searchable.includes(query);
        const status = getTicketStatus(ticket).toLowerCase();
        const matchesFilter = !filter || status === filter;

        return matchesSearch && matchesFilter;
    });

    tbody.innerHTML = "";

    if (filteredTickets.length === 0) {
        showElement("adminTicketEmpty");
        return;
    }

    hideElement("adminTicketEmpty");

    filteredTickets.forEach(ticket => {
        const row = document.createElement("tr");
        const status = getTicketStatus(ticket);

        let action = "";

        if (!isCancelled(ticket) && !ticket.boarded) {
            action = `
                <button class="btn btn-small btn-danger"
                    data-cancel-ticket="${escapeHTML(ticket.id)}">
                    Annuler
                </button>
            `;
        } else {
            action = `<span class="muted-text">Aucune action</span>`;
        }

        row.innerHTML = `
            <td><strong>${escapeHTML(ticket.reference)}</strong></td>
            <td>${escapeHTML(ticket.passengerName)}</td>
            <td>${escapeHTML(ticket.passengerPhone)}</td>
            <td>${escapeHTML(ticket.from)} → ${escapeHTML(ticket.to)}</td>
            <td>${escapeHTML(ticket.seat)}</td>
            <td>${escapeHTML(ticket.paymentMethod)}</td>
            <td>${statusBadge(status)}</td>
            <td>${action}</td>
        `;

        tbody.appendChild(row);
    });
}

function cancelTicket(ticketId) {
    const tickets = getTickets();

    const ticket = tickets.find(item => item.id === ticketId);

    if (!ticket) {
        showToast("Billet introuvable.", "error");
        return;
    }

    if (isCancelled(ticket)) {
        showToast("Ce billet est déjà annulé.", "warning");
        return;
    }

    if (ticket.boarded) {
        showToast(
            "Impossible d'annuler un billet déjà utilisé pour l'embarquement.",
            "error"
        );
        return;
    }

    const confirmation = window.confirm(
        `Confirmer l'annulation du billet ${ticket.reference} ?`
    );

    if (!confirmation) return;

    ticket.cancelled = true;
    ticket.status = "Annulé";
    ticket.cancelledAt = new Date().toISOString();

    saveTickets(tickets);

    // La place est remise à disposition une seule fois,
    // au moment de l'annulation.
    const departures = getDepartures();

    const departure = departures.find(
        item => item.id === ticket.departureId
    );

    if (departure) {
        departure.seats = Math.min(
            Number(departure.totalSeats),
            Number(departure.seats) + 1
        );

        saveDepartures(departures);
    }

    renderAdminTickets();
    renderTickets();
    renderDashboard();
    renderAdminDepartures();

    showToast(`Billet ${ticket.reference} annulé.`);
}


/* =========================================================
   16. ADMINISTRATION DES UTILISATEURS
========================================================= */

function addUser(event) {
    event.preventDefault();

    const name = document.getElementById("adminUserName").value.trim();
    const email = document.getElementById("adminUserEmail").value.trim();
    const role = document.getElementById("adminUserRole").value;

    if (!name || !email || !role) {
        showToast("Veuillez remplir tous les champs.", "error");
        return;
    }

    const users = getUsers();

    const emailExists = users.some(
        user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
        showToast("Cette adresse e-mail existe déjà.", "error");
        return;
    }

    const user = {
        id: "USR-" + Date.now(),
        name,
        email,
        role,
        active: true
    };

    users.push(user);
    saveUsers(users);

    document.getElementById("adminUserForm").reset();

    renderAdminUsers();

    showToast("Utilisateur ajouté à la démonstration.");
}

function renderAdminUsers() {
    const tbody = document.getElementById("adminUserRows");
    if (!tbody) return;

    const users = getUsers();

    tbody.innerHTML = "";

    if (users.length === 0) {
        showElement("adminUserEmpty");
        return;
    }

    hideElement("adminUserEmpty");

    users.forEach(user => {
        const row = document.createElement("tr");

        const status = user.active
            ? statusBadge("Actif")
            : statusBadge("Désactivé");

        const toggleLabel = user.active
            ? "Désactiver"
            : "Activer";

        row.innerHTML = `
            <td>${escapeHTML(user.name)}</td>
            <td>${escapeHTML(user.email)}</td>
            <td>${escapeHTML(user.role)}</td>
            <td>${status}</td>
            <td>
                <button class="btn btn-small btn-secondary"
                    data-toggle-user="${escapeHTML(user.id)}">
                    ${toggleLabel}
                </button>

                <button class="btn btn-small btn-danger"
                    data-delete-user="${escapeHTML(user.id)}">
                    Supprimer
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function toggleUser(userId) {
    const users = getUsers();

    const user = users.find(item => item.id === userId);

    if (!user) return;

    user.active = !user.active;

    saveUsers(users);
    renderAdminUsers();

    showToast(
        user.active
            ? "Utilisateur activé."
            : "Utilisateur désactivé."
    );
}

function deleteUser(userId) {
    const users = getUsers();

    const user = users.find(item => item.id === userId);

    if (!user) return;

    if (user.role === "Administrateur") {
        showToast(
            "La suppression d'un administrateur est bloquée dans cette démonstration.",
            "error"
        );
        return;
    }

    const confirmation = window.confirm(
        `Supprimer l'utilisateur ${user.name} ?`
    );

    if (!confirmation) return;

    saveUsers(users.filter(item => item.id !== userId));

    renderAdminUsers();

    showToast("Utilisateur supprimé de la démonstration.");
}


/* =========================================================
   17. ÉVÉNEMENTS
========================================================= */

function initializeEvents() {
    // Connexion
    document.getElementById("loginForm")
        ?.addEventListener("submit", login);

    // Déconnexion
    document.getElementById("logoutBtn")
        ?.addEventListener("click", logout);

    // Navigation
    document.querySelectorAll("[data-page]").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.page);
        });
    });

    // Recherche des départs
    document.getElementById("departureSearchForm")
        ?.addEventListener("submit", searchDepartures);

    // Réservation
    document.getElementById("bookingForm")
        ?.addEventListener("submit", confirmBooking);

    // Recherche des billets
    document.getElementById("ticketSearch")
        ?.addEventListener("input", event => {
            renderTickets(event.target.value);
        });

    // Export CSV
    document.getElementById("exportTicketsBtn")
        ?.addEventListener("click", exportTicketsCSV);

    // Contrôle des billets
    document.getElementById("controlForm")
        ?.addEventListener("submit", controlTicket);

    // Ajout d'un départ
    document.getElementById("adminDepartureForm")
        ?.addEventListener("submit", addDeparture);

    // Ajout d'un utilisateur
    document.getElementById("adminUserForm")
        ?.addEventListener("submit", addUser);

    // Recherche et filtre des billets administrateur
    document.getElementById("adminTicketSearch")
        ?.addEventListener("input", renderAdminTickets);

    document.getElementById("adminTicketFilter")
        ?.addEventListener("change", renderAdminTickets);

    // Actions sur les tableaux : délégation d'événements.
    document.addEventListener("click", event => {
        const selectButton = event.target.closest("[data-select-departure]");

        if (selectButton) {
            selectDeparture(selectButton.dataset.selectDeparture);
            return;
        }

        const editButton = event.target.closest("[data-edit-departure]");

        if (editButton) {
            editDeparture(editButton.dataset.editDeparture);
            return;
        }

        const deleteDepartureButton = event.target.closest("[data-delete-departure]");

        if (deleteDepartureButton) {
            deleteDeparture(deleteDepartureButton.dataset.deleteDeparture);
            return;
        }

        const cancelButton = event.target.closest("[data-cancel-ticket]");

        if (cancelButton) {
            cancelTicket(cancelButton.dataset.cancelTicket);
            return;
        }

        const toggleButton = event.target.closest("[data-toggle-user]");

        if (toggleButton) {
            toggleUser(toggleButton.dataset.toggleUser);
            return;
        }

        const deleteUserButton = event.target.closest("[data-delete-user]");

        if (deleteUserButton) {
            deleteUser(deleteUserButton.dataset.deleteUser);
        }
    });
}


/* =========================================================
   18. DÉMARRAGE DE L'APPLICATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeData();
    initializeEvents();

    console.log("TransitGo est prêt.");
});