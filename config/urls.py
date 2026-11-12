from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from accounts import views as account_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/login/", account_views.login_view, name="login"),
    path("accounts/logout/", account_views.logout_view, name="logout"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("api.urls")),
    path("", include("operations.urls")),
]
