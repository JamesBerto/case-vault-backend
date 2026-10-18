import certifi
from pymongo import MongoClient
from app.core.config import settings

uri = settings.MONGO_URI

client = MongoClient(uri, tlsCAFile=certifi.where())
try:
    print(client.admin.command("ping"))
    print("Connected successfully!")
except Exception as e:
    print("Connection failed:", e)
