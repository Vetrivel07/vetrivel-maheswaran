from flask import Flask
from dotenv import load_dotenv

def create_app():
    load_dotenv()
    app = Flask(__name__, static_folder="static", template_folder="templates")

    from app.main.routes import main_bp
    from app.rag.routes import rag_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(rag_bp)
    
    return app
