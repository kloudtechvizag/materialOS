"""B8: same Idempotency-Key replayed 10x creates one record."""

from app.services.idempotency import run_idempotent


def test_replaying_same_idempotency_key_runs_the_mutation_once(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    call_count = {"n": 0}

    def compute():
        call_count["n"] += 1
        return 200, {"created_id": call_count["n"]}

    results = []
    for _ in range(10):
        status, body = run_idempotent(
            db,
            tenant_id=tenant.id,
            idempotency_key="fixed-key-abc",
            request_path="/things",
            request_body={"x": 1},
            compute=compute,
        )
        results.append((status, body))

    assert call_count["n"] == 1, "the underlying mutation ran more than once"
    assert all(r == results[0] for r in results), "replays returned a different response than the original"


def test_same_key_different_body_conflicts(db, tenant_ctx):
    from app.errors import AppError

    tenant = tenant_ctx["tenant"]

    run_idempotent(
        db,
        tenant_id=tenant.id,
        idempotency_key="shared-key",
        request_path="/things",
        request_body={"x": 1},
        compute=lambda: (200, {"ok": True}),
    )

    try:
        run_idempotent(
            db,
            tenant_id=tenant.id,
            idempotency_key="shared-key",
            request_path="/things",
            request_body={"x": 2},
            compute=lambda: (200, {"ok": True}),
        )
        raise AssertionError("expected an AppError for a reused key with a different body")
    except AppError as exc:
        assert exc.code.value == "IDEMPOTENCY_KEY_CONFLICT"
