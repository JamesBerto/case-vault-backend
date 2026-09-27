from app.models.audit_transaction import AuditTransaction

async def log_action(actor_user_id, action, case_id=None, evidence_id=None, metadata=None):
    entry = AuditTransaction(
        actor_user_id=actor_user_id, action=action,
        case_id=case_id, evidence_id=evidence_id, metadata=metadata or {},
    )
    await entry.insert()
    return entry