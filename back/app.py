# app.py
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import time
import logging

from config import settings, apply_flask_config, load_dotenv_if_present
from src.logs.config import setup_logging
from src.bot.api import init_bot

load_dotenv_if_present()

def create_app() -> Flask:
    setup_logging(debug=settings.DEBUG, base_dir="logs")

    app = Flask(__name__)
    apply_flask_config(app, settings)

    CORS(
        app,
        supports_credentials=settings.CORS_ALLOW_CREDENTIALS,
        resources={r"/*": {"origins": settings.CORS_ALLOW_ORIGINS}},
    )

    log = logging.getLogger("api")

    @app.before_request
    def _start_timer():
        g._t0 = time.perf_counter()

    @app.after_request
    def _log_access(resp):
        try:
            dt = (time.perf_counter() - getattr(g, "_t0", time.perf_counter())) * 1000.0
            log.info("%s %s %s %s %.1fms UA=%s",
                     request.remote_addr,
                     request.method,
                     request.path,
                     resp.status_code,
                     dt,
                     request.headers.get("User-Agent","-")[:150])
        except Exception:
            pass
        return resp

    from src.routers.admin.routes import bp as admin_bp
    from src.routers.dms.routes import bp as dms_bp
    from src.routers.auth.routes import bp as auth_bp
    from src.routers.export.routes import bp as export_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(dms_bp)
    app.register_blueprint(export_bp)

    init_bot(app)

    @app.get("/health")
    def health():
        log.debug("health ping")
        return jsonify({"ok": True, "env": settings.APP_ENV})

    return app

app = create_app()

if __name__ == "__main__":
    app.run(host=settings.HOST, port=settings.PORT, debug=settings.DEBUG)
