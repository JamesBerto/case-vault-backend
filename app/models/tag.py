from beanie import Document, Indexed

class Tag(Document):
    name: Indexed(str, unique=True)

    class Settings:
        name = "tags"