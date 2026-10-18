"""Explicit, idempotent migration. Run with application writes stopped."""
import asyncio

from pymongo import ASCENDING

from app.core.config import settings
from app.core.database import get_client, init_db
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission


async def run_migration() -> None:
    db = get_client()[settings.DB_NAME]
    versions = db["evidence_versions"]
    duplicates = await versions.aggregate([
        {"$group": {"_id": {"evidence_id": "$evidence_id", "version_no": "$version_no"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$limit": 10},
    ]).to_list(None)
    if duplicates:
        raise RuntimeError(f"Duplicate evidence version numbers found; resolve manually before migration: {duplicates}")

    for code in ("tag:assign", "tag:create", "evidence:delete"):
        permission = await Permission.find_one(Permission.code == code)
        if permission is None:
            await Permission(code=code, description=code.replace(":", " ")).insert()

    roles = {role.name: role for role in await Role.find_all().to_list()}
    for code, role_names in {"tag:assign": ("admin", "analyst", "reviewer"),
                             "tag:create": ("admin", "analyst"),
                             "evidence:delete": ("admin",)}.items():
        permission = await Permission.find_one(Permission.code == code)
        for name in role_names:
            role = roles.get(name)
            if role and not await RolePermission.find_one(RolePermission.role_id == str(role.id), RolePermission.permission_id == str(permission.id)):
                await RolePermission(role_id=str(role.id), permission_id=str(permission.id)).insert()

    for code, role_name in (("tag:create", "reviewer"),):
        permission = await Permission.find_one(Permission.code == code)
        role = roles.get(role_name)
        if permission and role:
            links = await RolePermission.find(RolePermission.role_id == str(role.id),
                                              RolePermission.permission_id == str(permission.id)).to_list()
            for link in links:
                await link.delete()
                print(f"Removed unintended {code} grant from built-in {role_name} role")

    for code in ("case:delete", "evidence:delete"):
        permission = await Permission.find_one(Permission.code == code)
        if permission is None:
            continue
        links = await RolePermission.find(RolePermission.permission_id == str(permission.id)).to_list()
        for link in links:
            role = await Role.get(link.role_id)
            if role and role.name in ("analyst", "reviewer"):
                await link.delete()
                print(f"Removed unintended {code} grant from built-in {role.name} role")
            elif role and role.name != "admin":
                print(f"CONFLICT: custom role {role.name!r} has {code}; runtime still denies deletion. Review this grant manually.")

    evidence_collection = db["evidence"]
    async for evidence in evidence_collection.find({}, {"_id": 1, "next_version_no": 1}):
        latest = await versions.find({"evidence_id": str(evidence["_id"])}).sort("version_no", -1).limit(1).to_list(1)
        next_number = latest[0]["version_no"] + 1 if latest else 1
        if evidence.get("next_version_no", 0) < next_number:
            await evidence_collection.update_one({"_id": evidence["_id"]}, {"$set": {"next_version_no": next_number}})

    index_keys = [("evidence_id", ASCENDING), ("version_no", ASCENDING)]
    same_keys = [index for index in await versions.list_indexes().to_list(None)
                 if list(index["key"].items()) == index_keys]
    if same_keys and not any(index.get("unique") for index in same_keys):
        raise RuntimeError("A non-unique (evidence_id, version_no) index exists. Review and remove it manually before migration.")
    if not same_keys:
        await versions.create_index(index_keys, unique=True, name="unique_evidence_version_no")

    assignments = db["case_tags"]
    duplicate_assignments = await assignments.aggregate([
        {"$group": {"_id": {"case_id": "$case_id", "tag_id": "$tag_id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$limit": 10},
    ]).to_list(None)
    if duplicate_assignments:
        raise RuntimeError(f"Duplicate case/tag assignments found; resolve manually before migration: {duplicate_assignments}")
    assignment_keys = [("case_id", ASCENDING), ("tag_id", ASCENDING)]
    assignment_indexes = [index for index in await assignments.list_indexes().to_list(None)
                          if list(index["key"].items()) == assignment_keys]
    if assignment_indexes and not any(index.get("unique") for index in assignment_indexes):
        raise RuntimeError("A non-unique (case_id, tag_id) index exists. Review it manually before migration.")
    if not assignment_indexes:
        await assignments.create_index(assignment_keys, unique=True, name="unique_case_tag")

    session_indexes = (await db["active_sessions"].list_indexes().to_list(None)
                       if "active_sessions" in await db.list_collection_names() else [])
    expiry_indexes = [index for index in session_indexes
                      if list(index["key"].items()) == [("expires_at", ASCENDING)]]
    if expiry_indexes and not any(index.get("expireAfterSeconds") == 0 for index in expiry_indexes):
        raise RuntimeError("A non-TTL active_sessions.expires_at index exists. Review it manually before migration.")
    if not expiry_indexes:
        await db["active_sessions"].create_index(
            [("expires_at", ASCENDING)], expireAfterSeconds=0, name="active_session_expiry")
    print("Migration complete: permissions, version counters, and unique indexes verified")


async def main() -> None:
    await init_db(require_migration=False)
    await run_migration()


if __name__ == "__main__":
    asyncio.run(main())
