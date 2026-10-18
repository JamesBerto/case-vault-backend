from beanie import Document, Indexed

class Tag(Document):
    name: Indexed(str, unique=True)
    assignment_revision: int = 0

    class Settings:
        name = "tags"
