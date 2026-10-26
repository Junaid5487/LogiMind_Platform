import uuid
from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db import models
router = APIRouter(prefix="/db", tags=["Database Admin"])

def _model_classes():
    out = {}
    for name in dir(models):
        obj = getattr(models, name)
        if isinstance(obj, type) and getattr(obj, "__tablename__", None):
            out[obj.__tablename__] = obj
    return out
TABLE_MODELS = _model_classes()
def _get_model(table):
    if table not in TABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"Unknown table '{table}'")
    return TABLE_MODELS[table]
def _pk_columns(model):
    return [c for c in model.__table__.columns if c.primary_key]
def _type_kind(col):
    t = str(col.type).upper()
    if "INT" in t: return "integer"
    if "FLOAT" in t or "DOUBLE" in t or "REAL" in t or "NUMERIC" in t or "DECIMAL" in t: return "number"
    if "BOOL" in t: return "boolean"
    if "DATE" in t or "TIME" in t: return "datetime"
    return "text"
def _default_value(col):
    d = col.default
    if d is None: return None
    arg = getattr(d, "arg", None)
    if callable(arg):
        try: return arg()
        except TypeError:
            try: return arg(None)
            except Exception: return None
    return arg
def _coerce(col, value):
    if value is None: return None
    if isinstance(value, str):
        if value.strip() == "": return None if col.nullable else ""
        value = value.strip()
    t = _type_kind(col)
    try:
        if t == "boolean":
            if isinstance(value, bool): return value
            return str(value).lower() in ("true","1","yes","y","on")
        if t == "integer": return int(float(value))
        if t == "number": return float(value)
        if t == "datetime":
            if isinstance(value, datetime): return value
            s = str(value).replace("Z","+00:00")
            return datetime.fromisoformat(s)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid value for '{col.name}': {exc}")
    return value
def _serialize_instance(obj):
    out = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name, None)
        if isinstance(val, datetime): val = val.isoformat()
        out[col.name] = val
    return out
def _apply_defaults(instance, model):
    for col in model.__table__.columns:
        if getattr(instance, col.name, None) is None and col.default is not None:
            dv = _default_value(col)
            if dv is not None: setattr(instance, col.name, dv)
    for col in _pk_columns(model):
        if getattr(instance, col.name, None) is None and "CHAR" in str(col.type).upper():
            setattr(instance, col.name, str(uuid.uuid4()))
@router.get("/tables", response_model=List[str])
def list_tables():
    return sorted(TABLE_MODELS.keys())
@router.get("/schema/{table}", response_model=List[Dict[str, Any]])
def get_schema(table: str):
    model = _get_model(table)
    out = []
    for col in model.__table__.columns:
        fk = None
        if col.foreign_keys: fk = str(list(col.foreign_keys)[0].target_fullname)
        out.append({"name": col.name, "type": _type_kind(col), "sql_type": str(col.type), "nullable": bool(col.nullable), "primary_key": bool(col.primary_key), "default": ("auto" if col.default is not None else None), "foreign_key": fk})
    return out
@router.get("/{table}", response_model=List[Dict[str, Any]])
def list_rows(table: str, limit: int = 200, db: Session = Depends(get_db_session)):
    model = _get_model(table)
    rows = db.query(model).limit(limit).all()
    return [_serialize_instance(r) for r in rows]
@router.post("/{table}", response_model=Dict[str, Any])
def insert_row(table: str, payload: Dict[str, Any], db: Session = Depends(get_db_session)):
    model = _get_model(table)
    instance = model()
    for col in model.__table__.columns:
        if col.name in payload and payload[col.name] is not None:
            if isinstance(payload[col.name], str) and payload[col.name].strip() == "" and col.nullable:
                continue
            setattr(instance, col.name, _coerce(col, payload[col.name]))
    _apply_defaults(instance, model)
    try:
        db.add(instance)
        db.commit()
        db.refresh(instance)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Insert failed: {exc}")
    return {"status": "CREATED", "row": _serialize_instance(instance)}

@router.put("/{table}/{row_id}", response_model=Dict[str, Any])
def update_row(table: str, row_id: str, payload: Dict[str, Any], db: Session = Depends(get_db_session)):
    model = _get_model(table)
    pk_cols = _pk_columns(model)
    if len(pk_cols) != 1:
        raise HTTPException(status_code=400, detail="Composite primary keys not supported")
    pk = pk_cols[0]
    instance = db.query(model).filter(pk == row_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"Row not found in {table}")
    for col in model.__table__.columns:
        if col.name in payload:
            if col.primary_key:
                continue
            val = payload[col.name]
            if isinstance(val, str) and val.strip() == "" and col.nullable:
                val = None
            if val is None and not col.nullable:
                continue
            setattr(instance, col.name, _coerce(col, val) if val is not None or col.nullable else getattr(instance, col.name))
    try:
        db.commit()
        db.refresh(instance)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Update failed: {exc}")
    return {"status": "UPDATED", "row": _serialize_instance(instance)}

@router.delete("/{table}/{row_id}", response_model=Dict[str, Any])
def delete_row(table: str, row_id: str, db: Session = Depends(get_db_session)):
    model = _get_model(table)
    pk_cols = _pk_columns(model)
    if len(pk_cols) != 1:
        raise HTTPException(status_code=400, detail="Composite primary keys not supported")
    pk = pk_cols[0]
    instance = db.query(model).filter(pk == row_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"Row not found in {table}")
    try:
        db.delete(instance)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Delete failed: {exc}")
    return {"status": "DELETED", "id": row_id}

