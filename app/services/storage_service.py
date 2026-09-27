import hashlib
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from app.core.database import get_client
from app.core.config import settings

def get_bucket() -> AsyncIOMotorGridFSBucket:
    client = get_client()
    return AsyncIOMotorGridFSBucket(client[settings.DB_NAME])

async def store_file(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """Stores file bytes in GridFS. Returns (storage_path, file_hash)."""
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    bucket = get_bucket()
    file_id = await bucket.upload_from_stream(filename, file_bytes)
    return str(file_id), file_hash

async def fetch_file(storage_path: str) -> bytes:
    bucket = get_bucket()
    stream = await bucket.open_download_stream(ObjectId(storage_path))
    return await stream.read()

async def verify_integrity(storage_path: str, expected_hash: str) -> bool:
    """Re-hashes the stored file and compares against the recorded hash."""
    file_bytes = await fetch_file(storage_path)
    actual_hash = hashlib.sha256(file_bytes).hexdigest()
    return actual_hash == expected_hash