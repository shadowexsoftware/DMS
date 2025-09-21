# src/routers/auth/security.py
import os, datetime, jwt, bcrypt
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"

def hash_password(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())

def verify_password(plain: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed)

def make_jwt(sub: str, ttl_minutes=720):
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {"sub": sub, "iat": int(now.timestamp()), "exp": int((now + datetime.timedelta(minutes=ttl_minutes)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_jwt(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
