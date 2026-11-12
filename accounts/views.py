from django.contrib.auth import login, logout
from django.shortcuts import render, redirect
from django.contrib import messages
from .forms import LoginForm

def login_view(request):
    form = LoginForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        login(request, form.get_user())
        return redirect("dashboard")
    return render(request, "accounts/login.html", {"form": form})

def logout_view(request):
    if request.method == "POST":
        logout(request)
        messages.success(request, "Vous êtes déconnecté.")
    return redirect("login")
