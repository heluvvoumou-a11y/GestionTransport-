from rest_framework.permissions import BasePermission, SAFE_METHODS


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return "RESPONSABLE"

    profile = getattr(user, "profile", None)

    return profile.role if profile else None


# ==========================================
# RESPONSABLE
# ==========================================

class IsResponsable(BasePermission):
    message = "Accès réservé au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) == "RESPONSABLE"


# ==========================================
# RESPONSABLE OU EXPLOITATION
# ==========================================

class IsResponsableOrExploitation(BasePermission):
    message = "Accès réservé au responsable ou à l'exploitation."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "RESPONSABLE",
            "EXPLOITATION",
        ]


# ==========================================
# AGENT OU RESPONSABLE
# ==========================================

class IsAgentOrResponsable(BasePermission):
    message = "Accès réservé à l'agent ou au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "AGENT",
            "RESPONSABLE",
        ]


# ==========================================
# AGENT, CAISSIER OU RESPONSABLE
# ==========================================

class IsAgentOrCaissierOrResponsable(BasePermission):
    message = "Accès réservé à l'agent, au caissier ou au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "AGENT",
            "CAISSIER",
            "RESPONSABLE",
        ]


# ==========================================
# CAISSIER OU RESPONSABLE
# ==========================================

class IsCaissierOrResponsable(BasePermission):
    message = "Accès réservé au caissier ou au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "CAISSIER",
            "RESPONSABLE",
        ]


# ==========================================
# CONTROLEUR OU RESPONSABLE
# ==========================================

class IsControleurOrResponsable(BasePermission):
    message = "Accès réservé au contrôleur ou au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "CONTROLEUR",
            "RESPONSABLE",
        ]


# ==========================================
# CONSULTATION DES BILLETS
# ==========================================

class IsTicketReader(BasePermission):
    message = "Vous n'avez pas accès à la consultation des billets."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "AGENT",
            "EXPLOITATION",
            "CONTROLEUR",
            "RESPONSABLE",
        ]


# ==========================================
# CONSULTATION ET GESTION DES DEPARTS
# ==========================================

class IsTripAccess(BasePermission):
    message = "Seul le responsable ou l'exploitation peut modifier les départs."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if request.method in SAFE_METHODS:
            return role in [
                "AGENT",
                "EXPLOITATION",
                "CONTROLEUR",
                "RESPONSABLE",
            ]

        return role in [
            "EXPLOITATION",
            "RESPONSABLE",
        ]


# ==========================================
# GESTION DES RESERVATIONS ET PAIEMENTS
# ==========================================

class IsReservationAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        if action == "pay":
            return role in [
                "AGENT",
                "CAISSIER",
                "RESPONSABLE",
            ]

        if request.method in SAFE_METHODS:
            return role in [
                "AGENT",
                "EXPLOITATION",
                "RESPONSABLE",
            ]

        return role in [
            "AGENT",
            "RESPONSABLE",
        ]


# ==========================================
# CONSULTATION DES PAIEMENTS
# ==========================================

class IsPaymentReader(BasePermission):
    message = "Accès réservé au caissier ou au responsable."

    def has_permission(self, request, view):
        return get_user_role(request.user) in [
            "CAISSIER",
            "RESPONSABLE",
        ]


# ==========================================
# GESTION DES REMBOURSEMENTS
# ==========================================

class IsRefundAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        # Le caissier et le responsable peuvent consulter.
        if action in ["list", "retrieve"]:
            return role in [
                "CAISSIER",
                "RESPONSABLE",
            ]

        # Le caissier et le responsable peuvent créer une demande.
        if action == "create":
            return role in [
                "CAISSIER",
                "RESPONSABLE",
            ]

        # Seul le responsable peut approuver ou refuser.
        if action in ["approve", "reject"]:
            return role == "RESPONSABLE"

        return False


# ==========================================
# CONTROLE DES BILLETS
# ==========================================

class IsTicketAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        if action == "check":
            return role in [
                "CONTROLEUR",
                "RESPONSABLE",
            ]

        return role in [
            "AGENT",
            "EXPLOITATION",
            "CONTROLEUR",
            "RESPONSABLE",
        ]