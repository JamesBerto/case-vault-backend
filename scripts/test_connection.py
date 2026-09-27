import certifi
from pymongo import MongoClient

uri = "mongodb+srv://jamesberto24_db_user:DaGs6MhupJRRvTzO@casevault-admin.e9g8xua.mongodb.net/?appName=casevault-admin"

client = MongoClient(uri, tlsCAFile=certifi.where())
try:
    print(client.admin.command("ping"))
    print("Connected successfully!")
except Exception as e:
    print("Connection failed:", e)