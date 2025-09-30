from flask import Blueprint, render_template
from controllers.pages.controller_pages import PagesController

pages_bp = Blueprint('pages', __name__)

@pages_bp.route("/")
def home():
    """Página home com dashboard"""
    data = PagesController.home()
    return render_template("home.html", **data)

@pages_bp.route("/atas")
def atas():
    """Página do gerador de ATAs"""
    data = PagesController.atas()
    return render_template("index.html", **data)

@pages_bp.route("/pipeline")
def pipeline():
    """Página separada para gerenciar pipeline"""
    data = PagesController.pipeline()
    return render_template("pipeline.html", **data)

@pages_bp.route("/manage-cards")
def manage_cards():
    """Página para gerenciar cards"""
    data = PagesController.manage_cards()
    return render_template("manage_cards.html", **data)