import asyncio
import certifi
from urllib.parse import urlsplit, quote_plus
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


async def test():
    print("Testing MongoDB connection...")

    parsed = urlsplit(settings.MONGO_URI)

    uri = (
        f"mongodb+srv://"
        f"{quote_plus(parsed.username)}:"
        f"{quote_plus(parsed.password)}@"
        f"{parsed.hostname}/?"
        f"{parsed.query}"
    )

    client = AsyncIOMotorClient(
        uri,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )

    try:
        result = await client.admin.command("ping")
        print("SUCCESS:", result)
    except Exception as e:
        print("ERROR:")
        print(repr(e))
    finally:
        client.close()


asyncio.run(test())