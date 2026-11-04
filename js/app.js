"use strict";

/* DONNÉES DE DÉMONSTRATION */

const departures = [
    {
        id: 1,
        from: "Bamako",
        to: "Ségou",
        date: "2026-11-02",
        time: "07:30",
        price: 5000,
        seats: 32
    },
    {
        id: 2,
        from: "Bamako",
        to: "Sikasso",
        date: "2026-11-02",
        time: "08:00",
        price: 7500,
        seats: 28
    },
    {
        id: 3,
        from: "Bamako",
        to: "Mopti",
        date: "2026-11-02",
        time: "06:45",
        price: 10000,
        seats: 16
    },
    {
        id: 4,
        from: "Ségou",
        to: "Bamako",
        date: "2026-11-03",
        time: "09:00",
        price: 5000,
        seats: 24
    }
];

let tickets = [
    {
        reference: "TG-1001",
        traveler: "Aminata Traoré",
        from: "Bamako",
        to: "Ségou",
        seat: 4,
        status: "Valide",
        boarded: false,
        departureId: 1,
        price: 5000
    },
    {
        reference: "TG-1002",
        traveler: "Moussa Koné",
        from: "Bamako",
        to: "Mopti",
        seat: 8,
        status: "Valide",
        boarded: true,
        departureId: 3,
        price: 10000
    }
];

let selectedDeparture = null;
let selectedSeat = null;

const $ = id => document.getElementById(id);

function money(value) {
    return new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
}

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


/* CONNEXION */

$("loginForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value.trim();

    if (!email || !password) {
        showToast("Veuillez remplir tous les champs.");
        return;
    }

    const name = email.split("@")[0];
    const role = $("role").value;

    $("userName").textContent = name;
    $("helloName").textContent = name;
    $("userRole").textContent = role;
    $("avatar").textContent = name.charAt(0).toUpperCase();

    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");

    showPage("dashboard");

    showToast("Bienvenue sur TransitGo !");
});


/* NAVIGATION */

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    $(pageId).classList.add("active");

    document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.remove("active");
    });

    const activeButton = document.querySelector(
        `[data-page="${pageId}"]`
    );

    if (activeButton) {
        activeButton.classList.add("active");
        $("pageTitle").textContent = activeButton.textContent.trim();
    }

    if (pageId === "dashboard") {
        renderDashboard();
    }

    if (pageId === "tickets") {
        renderTickets();
    }

    if (pageId === "seats") {
        renderBooking();
    }

    if (pageId === "departures") {
        renderDepartures(departures);
    }
}

document.querySelectorAll(".nav-button").forEach(button => {

    button.addEventListener("click", function() {
        showPage(this.dataset.page);
    });

});

document.querySelectorAll("[data-go]").forEach(button => {

    button.addEventListener("click", function() {
        showPage(this.dataset.go);
    });

});


/* DÉCONNEXION */

$("logoutButton").addEventListener("click", function() {

    $("appView").classList.add("hidden");
    $("loginView").classList.remove("hidden");

    $("loginForm").reset();

    showToast("Vous êtes déconnecté.");

});


/* TABLEAU DE BORD */

function renderDashboard() {

    $("departureCount").textContent = departures.length;

    $("ticketCount").textContent = tickets.length;

    $("seatCount").textContent = departures.reduce(
        (total, departure) => total + departure.seats,
        0
    );

    $("boardedCount").textContent =
        tickets.filter(ticket => ticket.boarded).length;

    $("dashboardRows").innerHTML = departures.map(departure => `

        <tr>
            <td>
                <strong>${departure.from} → ${departure.to}</strong>
            </td>

            <td>${departure.time}</td>

            <td>${departure.seats}</td>

            <td>${money(departure.price)}</td>

            <td><span class="status">Disponible</span></td>
        </tr>

    `).join("");

}


/* RECHERCHE DES DÉPARTS */

$("searchForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const from = $("fromCity").value;
    const to = $("toCity").value;
    const date = $("travelDate").value;

    const results = departures.filter(departure => {

        return (!from || departure.from === from)
            && (!to || departure.to === to)
            && (!date || departure.date === date);

    });

    renderDepartures(results);

});


function renderDepartures(results) {

    $("resultCount").textContent =
        results.length + " trajet(s) trouvé(s)";

    $("emptyDepartures").classList.toggle(
        "hidden",
        results.length > 0
    );

    $("departureResults").innerHTML = results.map(departure => `

        <div class="departure-card">

            <h3>
                ${departure.from} → ${departure.to}
            </h3>

            <p>Heure de départ : ${departure.time}</p>

            <p>Date : ${departure.date}</p>

            <p>Places disponibles : ${departure.seats}</p>

            <div class="price">
                ${money(departure.price)}
            </div>

            <button
                class="primary-button"
                onclick="selectTrip(${departure.id})"
            >
                Choisir une place →
            </button>

        </div>

    `).join("");

}


/* SÉLECTION D'UN DÉPART */

function selectTrip(id) {

    selectedDeparture = departures.find(
        departure => departure.id === id
    );

    selectedSeat = null;

    showPage("seats");

    renderBooking();

}


/* AFFICHAGE DES PLACES */

function renderBooking() {

    const hasDeparture = Boolean(selectedDeparture);

    $("noDeparture").classList.toggle(
        "hidden",
        hasDeparture
    );

    $("bookingArea").classList.toggle(
        "hidden",
        !hasDeparture
    );

    if (!hasDeparture) {
        return;
    }

    $("tripTitle").textContent =
        selectedDeparture.from + " → " + selectedDeparture.to;

    $("tripDetails").textContent =
        "Départ à " + selectedDeparture.time;

    $("summaryRoute").textContent =
        selectedDeparture.from + " → " + selectedDeparture.to;

    $("summaryPrice").textContent =
        money(selectedDeparture.price);

    $("summaryTotal").textContent =
        money(selectedDeparture.price);

    $("summarySeat").textContent =
        selectedSeat ? "Place " + selectedSeat : "Aucune";

    $("confirmBooking").disabled = !selectedSeat;

    const occupied = tickets
        .filter(ticket =>
            ticket.departureId === selectedDeparture.id
            && ticket.status === "Valide"
        )
        .map(ticket => ticket.seat);

    $("seatMap").innerHTML = "";

    for (let number = 1; number <= 24; number++) {

        const button = document.createElement("button");

        button.className = "seat";
        button.textContent = number;
        button.type = "button";

        if (occupied.includes(number)) {
            button.disabled = true;
        }

        if (selectedSeat === number) {
            button.classList.add("selected");
        }

        button.addEventListener("click", function() {

            selectedSeat = number;

            renderBooking();

        });

        $("seatMap").appendChild(button);

    }

}


/* CONFIRMATION DE RÉSERVATION */

$("confirmBooking").addEventListener("click", function() {

    if (!selectedDeparture || !selectedSeat) {
        showToast("Veuillez sélectionner une place.");
        return;
    }

    const alreadyTaken = tickets.some(ticket =>
        ticket.departureId === selectedDeparture.id
        && ticket.seat === selectedSeat
        && ticket.status === "Valide"
    );

    if (alreadyTaken) {
        showToast("Cette place est déjà réservée.");
        renderBooking();
        return;
    }

    const ticket = {

        reference: "TG-" + (1003 + tickets.length),

        traveler: $("userName").textContent,

        from: selectedDeparture.from,

        to: selectedDeparture.to,

        seat: selectedSeat,

        price: selectedDeparture.price,

        status: "Valide",

        boarded: false,

        departureId: selectedDeparture.id

    };

    tickets.push(ticket);

    selectedDeparture = null;
    selectedSeat = null;

    showToast("Réservation effectuée : " + ticket.reference);

    showPage("tickets");

});


/* AFFICHAGE DES BILLETS */

function renderTickets() {

    const search = $("ticketSearch").value.toLowerCase();

    const results = tickets.filter(ticket => {

        return ticket.reference.toLowerCase().includes(search)
            || ticket.traveler.toLowerCase().includes(search)
            || ticket.from.toLowerCase().includes(search)
            || ticket.to.toLowerCase().includes(search);

    });

    $("ticketRows").innerHTML = results.map(ticket => `

        <tr>

            <td><strong>${ticket.reference}</strong></td>

            <td>${ticket.traveler}</td>

            <td>${ticket.from} → ${ticket.to}</td>

            <td>${ticket.seat}</td>

            <td>
                <span class="status">${ticket.status}</span>
            </td>

            <td>
                <span class="${ticket.boarded ? "status" : "status status-warning"}">
                    ${ticket.boarded ? "Effectué" : "En attente"}
                </span>
            </td>

        </tr>

    `).join("");

    $("emptyTickets").classList.toggle(
        "hidden",
        results.length > 0
    );

}

$("ticketSearch").addEventListener("input", renderTickets);


/* CONTRÔLE DES BILLETS */

$("controlForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const reference = $("ticketReference").value.trim();

    const ticket = tickets.find(item =>
        item.reference.toLowerCase() === reference.toLowerCase()
    );

    const result = $("controlResult");

    result.classList.remove("hidden", "success", "error");

    if (!ticket) {

        result.classList.add("error");

        result.textContent = "Billet introuvable. Vérifiez la référence.";

        return;
    }

    if (ticket.status !== "Valide") {

        result.classList.add("error");

        result.textContent = "Ce billet n'est pas valide.";

        return;
    }

    if (ticket.boarded) {

        result.classList.add("error");

        result.textContent =
            "Ce billet a déjà été contrôlé. Deuxième embarquement refusé.";

        return;
    }

    ticket.boarded = true;

    result.classList.add("success");

    result.innerHTML = `
        <strong>✓ Billet valide !</strong><br>
        Voyageur : ${ticket.traveler}<br>
        Trajet : ${ticket.from} → ${ticket.to}<br>
        Embarquement enregistré.
    `;

    renderDashboard();
    renderTickets();

});


/* EXPORTATION DES BILLETS EN CSV */

$("exportTickets").addEventListener("click", function() {

    if (tickets.length === 0) {
        showToast("Aucun billet à exporter.");
        return;
    }

    const rows = [
        ["Référence", "Voyageur", "Départ", "Arrivée", "Place", "Statut"],

        ...tickets.map(ticket => [
            ticket.reference,
            ticket.traveler,
            ticket.from,
            ticket.to,
            ticket.seat,
            ticket.status
        ])
    ];

    const csv = rows
        .map(row => row.join(";"))
        .join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "billets-transitgo.csv";

    link.click();

    URL.revokeObjectURL(url);

});


/* INITIALISATION */

renderDashboard();