from flask import Flask
import os
from dotenv import load_dotenv

# Imports dos routers
from routers.pages.router_pages import pages_bp
from routers.ata.router_ata import ata_bp
from routers.ata.router_boards import boards_bp
from routers.pipeline.router_pipeline import pipeline_bp

# Carregar variáveis de ambiente
load_dotenv()

# Criar aplicação Flask
app = Flask(__name__)

# Registrar blueprints
app.register_blueprint(pages_bp)
app.register_blueprint(ata_bp)
app.register_blueprint(boards_bp)
app.register_blueprint(pipeline_bp)

if __name__ == "__main__":
    # Allow overriding the port via PORT env var. Default to 5001 to avoid common macOS conflicts on 5000.
    port = int(os.environ.get("PORT", "5001"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Flask app on http://{host}:{port}")
    app.run(debug=True, host=host, port=port)