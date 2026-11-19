from rest_framework.permissions import BasePermission, SAFE_METHODS


# =====================================================
# GESTION DES RÔLES
# =====================================================

def get_user_role(user):
    """
    Retourne le rôle de l'utilisateur connecté.
    Un superutilisateur est considéré comme RESPONSABLE.
    """
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return "RESPONSABLE"

    profile = getattr(user, "profile", None)
    return profile.role if profile else None


def is_read_only_for_responsable(request, role):
    """
    Le Responsable peut consulter, mais ne peut pas effectuer
    les opérations normalement réservées aux autres rôles.
    """
    return role == "RESPONSABLE" and request.method in SAFE_METHODS


# =====================================================
# RESPONSABLE
# Consultation uniquement
# =====================================================

class IsResponsable(BasePermission):
    message = "Accès réservé au responsable."

    def has_permission(self, request, view):
        return (
            get_user_role(request.user) == "RESPONSABLE"
            and request.method in SAFE_METHODS
        )


# =====================================================
# RESPONSABLE OU EXPLOITATION
# Exploitation : gestion complète
# Responsable : consultation uniquement
# =====================================================

class IsResponsableOrExploitation(BasePermission):
    message = "Accès réservé au responsable ou à l'exploitation."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role == "EXPLOITATION":
            return True

        return is_read_only_for_responsable(request, role)


# =====================================================
# AGENT OU RESPONSABLE
# =====================================================

class IsAgentOrResponsable(BasePermission):
    message = "Accès réservé à l'agent ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role == "AGENT":
            return True

        return is_read_only_for_responsable(request, role)


# =====================================================
# AGENT, CAISSIER OU RESPONSABLE
# =====================================================

class IsAgentOrCaissierOrResponsable(BasePermission):
    message = "Accès réservé à l'agent, au caissier ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role in ["AGENT", "CAISSIER"]:
            return True

        return is_read_only_for_responsable(request, role)


# =====================================================
# CAISSIER OU RESPONSABLE
# =====================================================

class IsCaissierOrResponsable(BasePermission):
    message = "Accès réservé au caissier ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role == "CAISSIER":
            return True

        return is_read_only_for_responsable(request, role)


# =====================================================
# CONTROLEUR OU RESPONSABLE
# =====================================================

class IsControleurOrResponsable(BasePermission):
    message = "Accès réservé au contrôleur ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role == "CONTROLEUR":
            return True

        return is_read_only_for_responsable(request, role)


# =====================================================
# CONSULTATION DES BILLETS
# =====================================================

class IsTicketReader(BasePermission):
    message = "Vous n'avez pas accès à la consultation des billets."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        return (
            request.method in SAFE_METHODS
            and role in [
                "AGENT",
                "EXPLOITATION",
                "CONTROLEUR",
                "RESPONSABLE",
            ]
        )


# =====================================================
# CONSULTATION ET GESTION DES DEPARTS
# =====================================================

class IsTripAccess(BasePermission):
    message = (
        "Vous n'avez pas les autorisations nécessaires "
        "pour gérer les départs."
    )

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        if role == "EXPLOITATION":
            return True

        if role == "RESPONSABLE":
            return request.method in SAFE_METHODS

        if request.method in SAFE_METHODS:
            return role in [
                "AGENT",
                "CAISSIER",
                "CONTROLEUR",
            ]

        return False


# =====================================================
# GESTION DES RESERVATIONS ET PAIEMENTS
# =====================================================

class IsReservationAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        if action == "pay":
            return role == "CAISSIER"

        if action in ["list", "retrieve"]:
            return role in [
                "AGENT",
                "CAISSIER",
                "EXPLOITATION",
                "RESPONSABLE",
            ]

        if action == "create":
            return role == "AGENT"

        if action == "cancel":
            return role == "AGENT"

        return False


# =====================================================
# CONSULTATION DES PAIEMENTS
# =====================================================

class IsPaymentReader(BasePermission):
    message = "Accès réservé au caissier ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        return (
            request.method in SAFE_METHODS
            and role in [
                "CAISSIER",
                "RESPONSABLE",
            ]
        )


# =====================================================
# GESTION DES REMBOURSEMENTS
# =====================================================

class IsRefundAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        if action in ["list", "retrieve"]:
            return role in [
                "CAISSIER",
                "RESPONSABLE",
            ]

        if action == "create":
            return role == "CAISSIER"

        if action in ["approve", "reject"]:
            return role == "RESPONSABLE"

        if action == "complete":
            return role == "CAISSIER"

        return False


# =====================================================
# CONTROLE DES BILLETS
# =====================================================

class IsTicketAccess(BasePermission):
    message = "Vous n'avez pas les autorisations nécessaires."

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        action = getattr(view, "action", None)

        if action == "check":
            return role == "CONTROLEUR"

        if action in ["list", "retrieve"]:
            return role in [
                "AGENT",
                "EXPLOITATION",
                "CONTROLEUR",
                "RESPONSABLE",
            ]

        return False


# =====================================================
# CONSULTATION DES AGENCES
# Exploitation et Responsable : consultation uniquement
# =====================================================

class IsAgencyReader(BasePermission):
    message = "Accès réservé à l'exploitation ou au responsable."

    def has_permission(self, request, view):
        role = get_user_role(request.user)

        return (
            role in ("EXPLOITATION", "RESPONSABLE")
            and request.method in SAFE_METHODS
        )