from datetime import datetime
from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)

@main_bp.get("/")
@main_bp.get("/index.html")
def home():
    return render_template("index.html")

@main_bp.get("/about.html")
def about():
    return render_template("about.html")

@main_bp.get("/projects.html")
def projects():
    return render_template("projects.html")

@main_bp.get("/work.html")
def work():
    return render_template("work.html")

@main_bp.get("/contact.html")
def contact():
    return render_template("contact.html")

@main_bp.app_context_processor
def inject_year():
    return {"current_year": datetime.now().year}