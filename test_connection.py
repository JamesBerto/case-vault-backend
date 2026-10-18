import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def main():
    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    try:
        result = await client.admin.command("ping")
        print("MongoDB connection successful!")
        print(result)
    except Exception as error:
        print("MongoDB connection failed.")
        print(type(error).__name__, error)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
