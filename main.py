"""
Inmobiliaria Mica — Backend MVP (FastAPI + Postgres)

Stack:
- FastAPI + uvicorn
- psycopg (sync, una conexión-pool simple por request via context manager)
- bcrypt para passwords
- pyjwt para tokens (HS256, exp 30 días)

Endpoints clave:
- GET  /tenant/{slug}        → branding del tenant (lo consume el HTML al cargar)
- POST /auth/login           → email+password → JWT
- GET/POST/PATCH/DELETE  /api/leads, /api/propiedades, /api/clientes-activos
- Aliases /crm/* que apunta a los mismos handlers (el HTML actual los usa).

Filtrado siempre por tenant_slug='mica-demo' (MVP single-tenant por ahora).
"""

import os
import datetime as dt
from contextlib import contextmanager
from typing import Any, Optional

import bcrypt
import jwt
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Header, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pathlib import Path
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────
PG_DSN = os.environ["PG_DSN"]
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-prod-please")
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30
TENANT_SLUG = "mica-demo"  # MVP single-tenant

# ── App + CORS ────────────────────────────────────────────────────────────────
app = FastAPI(title="Inmobiliaria Mica — CRM API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB helpers ────────────────────────────────────────────────────────────────
@contextmanager
def db_cursor():
    """Una conexión por request. Simple y suficiente para el MVP de demo."""
    conn = psycopg.connect(PG_DSN, row_factory=dict_row, autocommit=False)
    try:
        with conn.cursor() as cur:
            yield cur
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Auth helpers ──────────────────────────────────────────────────────────────
def _make_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "tenant": TENANT_SLUG,
        "exp": dt.datetime.utcnow() + dt.timedelta(days=JWT_EXP_DAYS),
        "iat": dt.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    if payload.get("tenant") != TENANT_SLUG:
        raise HTTPException(403, "Tenant no autorizado")
    return payload


# ── Models (Pydantic permisivo: lo que mande el HTML, lo aceptamos) ──────────
class LoginIn(BaseModel):
    email: str
    password: str


# ── Health & meta ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return RedirectResponse(url="/app-inmobiliaria/", status_code=302)


@app.get("/health")
def health():
    try:
        with db_cursor() as cur:
            cur.execute("SELECT 1 AS ok;")
            cur.fetchone()
        return {"ok": True, "db": "up"}
    except Exception as e:
        raise HTTPException(503, f"DB down: {e}")


@app.get("/crm/version")
def crm_version():
    return {"version": "0.1.0", "tenant": TENANT_SLUG}


# ── Tenant info (consumido por el HTML al cargar) ─────────────────────────────
@app.get("/tenant/{slug}")
def get_tenant(slug: str):
    if slug != TENANT_SLUG:
        raise HTTPException(404, f"tenant no encontrado: {slug}")
    return {
        "slug": TENANT_SLUG,
        "nombre": "Inmobiliaria Demo Mica",
        "api_url": "",          # vacío → el HTML usa SAAS_API actual
        "api_prefix": "",       # vacío → el HTML hace fetch(SAAS_API + '/crm/clientes') directo
                                # (antes era '/crm' pero el HTML concatena /crm/clientes → /crm/crm/clientes)
        "color_primario": "#f59e0b",
        "logo_url": "/app-inmobiliaria/favicon.png",
        "ciudad": "Buenos Aires",
        "estado_pago": "trial",
    }


# ── Login ─────────────────────────────────────────────────────────────────────
@app.post("/auth/login")
def login(body: LoginIn):
    email = body.email.strip().lower()
    pwd = body.password.encode()
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, email, password_hash, nombre FROM auth_users "
            "WHERE tenant_slug=%s AND lower(email)=%s LIMIT 1;",
            (TENANT_SLUG, email),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Credenciales incorrectas")
    if not bcrypt.checkpw(pwd, row["password_hash"].encode()):
        raise HTTPException(401, "Credenciales incorrectas")
    token = _make_token(row["id"], row["email"])
    return {"token": token, "nombre": row["nombre"] or "Usuario"}


# ── CRUD genérico ─────────────────────────────────────────────────────────────
# Whitelist de columnas editables por tabla — evita SQL injection y campos raros
EDITABLE: dict[str, set[str]] = {
    "leads": {
        "telefono", "nombre", "apellido", "email", "ciudad", "operacion",
        "tipo_propiedad", "zona", "presupuesto", "score", "score_numerico",
        "estado", "sub_nicho", "notas_bot", "fuente", "fuente_detalle",
        "propiedad_interes", "fecha_whatsapp", "fecha_cita",
        "fecha_ultimo_contacto", "llego_whatsapp", "estado_seguimiento",
        "cantidad_seguimientos", "proximo_seguimiento", "ultimo_contacto_bot",
        "asesor_asignado", "tipo_cliente", "propiedad_interes_id",
        "updated_by", "created_by",
    },
    "propiedades": {
        "titulo", "descripcion", "tipo", "operacion", "zona", "precio",
        "moneda", "presupuesto", "disponible", "dormitorios", "banios",
        "metros_cubiertos", "metros_terreno", "imagen_url", "maps_url",
        "direccion", "propietario_nombre", "propietario_telefono",
        "propietario_email", "comision_pct", "tipo_cartera",
        "asesor_asignado", "loteo", "numero_lote", "propietario_id",
        "updated_by", "created_by",
    },
    "clientes_activos": {
        "nombre", "apellido", "telefono", "email", "propiedad", "estado_pago",
        "monto_cuota", "cuotas_pagadas", "cuotas_total", "proximo_vencimiento",
        "notas", "documento", "lead_id", "origen_creacion", "fecha_alta",
        "roles", "updated_by", "created_by",
    },
}


def _filter_cols(table: str, payload: dict) -> dict:
    cols = EDITABLE[table]
    return {k: v for k, v in payload.items() if k in cols}


def _list_rows(table: str) -> list[dict]:
    with db_cursor() as cur:
        cur.execute(
            f"SELECT * FROM {table} WHERE tenant_slug=%s ORDER BY id DESC LIMIT 500;",
            (TENANT_SLUG,),
        )
        return cur.fetchall()


def _insert_row(table: str, payload: dict) -> dict:
    data = _filter_cols(table, payload)
    if not data:
        raise HTTPException(400, "Sin campos válidos para insertar")
    data["tenant_slug"] = TENANT_SLUG
    cols = list(data.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    with db_cursor() as cur:
        cur.execute(
            f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) RETURNING *;",
            tuple(data[c] for c in cols),
        )
        return cur.fetchone()


def _update_row(table: str, row_id: int, payload: dict) -> dict:
    data = _filter_cols(table, payload)
    if not data:
        raise HTTPException(400, "Sin campos válidos para actualizar")
    set_clause = ", ".join(f"{c}=%s" for c in data.keys())
    params = tuple(list(data.values()) + [row_id, TENANT_SLUG])
    with db_cursor() as cur:
        cur.execute(
            f"UPDATE {table} SET {set_clause}, updated_at=CURRENT_TIMESTAMP "
            f"WHERE id=%s AND tenant_slug=%s RETURNING *;",
            params,
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"{table} id={row_id} no encontrado")
    return row


def _delete_row(table: str, row_id: int) -> dict:
    with db_cursor() as cur:
        cur.execute(
            f"DELETE FROM {table} WHERE id=%s AND tenant_slug=%s RETURNING id;",
            (row_id, TENANT_SLUG),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"{table} id={row_id} no encontrado")
    return {"ok": True, "id": row["id"]}


# ── Rutas: leads ──────────────────────────────────────────────────────────────
def _register_crud(table: str, prefixes: list[str]):
    """Registra GET list, POST, PATCH /{id}, DELETE /{id} bajo cada prefijo."""
    for prefix in prefixes:
        @app.get(f"{prefix}", name=f"list_{table}_{prefix.replace('/', '_')}")
        def _list(_user=Depends(require_auth), _table=table):
            return _list_rows(_table)

        @app.post(f"{prefix}", name=f"create_{table}_{prefix.replace('/', '_')}")
        def _create(body: dict = Body(...), _user=Depends(require_auth), _table=table):
            return _insert_row(_table, body)

        @app.patch(f"{prefix}/{{row_id}}", name=f"update_{table}_{prefix.replace('/', '_')}")
        def _update(row_id: int, body: dict = Body(...), _user=Depends(require_auth), _table=table):
            return _update_row(_table, row_id, body)

        @app.delete(f"{prefix}/{{row_id}}", name=f"delete_{table}_{prefix.replace('/', '_')}")
        def _delete(row_id: int, _user=Depends(require_auth), _table=table):
            return _delete_row(_table, row_id)


# /api/* es lo pedido por el spec; /crm/* es lo que el HTML actual ya consume.
_register_crud("leads",            ["/api/leads",            "/crm/clientes"])
_register_crud("propiedades",      ["/api/propiedades",      "/crm/propiedades"])
_register_crud("clientes_activos", ["/api/clientes-activos", "/crm/activos"])


# ── Endpoints auxiliares que el HTML usa para dashboards ──────────────────────
@app.get("/crm/metricas")
def metricas(_user=Depends(require_auth)):
    with db_cursor() as cur:
        cur.execute("SELECT estado, COUNT(*) AS n FROM leads WHERE tenant_slug=%s GROUP BY estado;", (TENANT_SLUG,))
        por_estado = {r["estado"]: r["n"] for r in cur.fetchall()}
        cur.execute("SELECT COUNT(*) AS n FROM leads WHERE tenant_slug=%s;", (TENANT_SLUG,))
        total_leads = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM propiedades WHERE tenant_slug=%s;", (TENANT_SLUG,))
        total_props = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM clientes_activos WHERE tenant_slug=%s;", (TENANT_SLUG,))
        total_activos = cur.fetchone()["n"]
    return {
        "total_leads": total_leads,
        "total_propiedades": total_props,
        "total_clientes_activos": total_activos,
        "leads_por_estado": por_estado,
    }


@app.get("/crm/loteos")
def loteos_stub(_user=Depends(require_auth)):
    # El HTML pide loteos; devolvemos vacío para el MVP demo.
    return []


@app.get("/crm/resumenes")
def resumenes_stub(_user=Depends(require_auth)):
    return {"items": [], "total": 0}


# ── Static — sirve el CRM web bajo /app-inmobiliaria/ ────────────────────────
# Montado al final para no pisar las rutas API. `html=True` hace que
# GET /app-inmobiliaria/ devuelva index.html automáticamente.
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount(
        "/app-inmobiliaria",
        StaticFiles(directory=str(_static_dir), html=True),
        name="app",
    )
