from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Iterable

import httpx

from app.database.connection import SessionLocal
from app.models.user import User
from app.utils.constants import UserRole

PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="expo-push")


def _normalize_role(role: Any) -> str:
    if hasattr(role, "value"):
        return str(role.value)
    return str(role or "").upper()


def scopes_for_role(role: Any) -> set[str]:
    normalized = _normalize_role(role)
    if normalized in {UserRole.ADMIN.value, UserRole.MANAGER.value}:
        return {"*"}
    if normalized == UserRole.BENGKEL.value:
        return {"bengkel", "finance", "master"}
    if normalized == UserRole.JASA_ANGKUT.value:
        return {"jasa_angkut", "finance", "master"}
    if normalized == UserRole.MOBIL.value:
        return {"mobil", "finance", "master"}
    return {"finance"}


def _format_label(value: str | None, fallback: str = "Data") -> str:
    if not value:
        return fallback
    return value.replace("_", " ").strip().title()


def _build_message(payload: dict[str, Any]) -> tuple[str, str]:
    entity_map = {
        "bengkel": "Transaksi Bengkel",
        "jasa_angkut": "Muatan",
        "mobil": "Transaksi Mobil",
        "finance": "Kas & Bank",
        "master": "Data Master",
        "users": "Pengguna",
        "settings": "Pengaturan",
    }
    action_map = {
        "created": "baru dicatat",
        "updated": "diperbarui",
        "deleted": "dihapus",
        "voided": "dibatalkan",
        "status_updated": "status berubah",
        "payment_updated": "pembayaran diperbarui",
        "paid": "dibayar",
        "paid_split": "pembayaran split berhasil",
        "transfer": "transfer berhasil",
        "adjusted": "penyesuaian saldo disimpan",
        "stock_updated": "stok berubah",
        "price_updated": "harga berubah",
        "image_uploaded": "foto diperbarui",
        "media_uploaded": "media diperbarui",
        "media_deleted": "media dihapus",
        "biaya_added": "biaya ditambahkan",
        "biaya_deleted": "biaya dihapus",
        "part_service_added": "part/service ditambahkan",
        "part_service_deleted": "part/service dihapus",
    }

    entity = str(payload.get("entity") or "")
    action = str(payload.get("action") or "")
    entity_label = entity_map.get(entity, _format_label(entity))
    action_label = action_map.get(action, _format_label(action, "diperbarui"))
    ref = payload.get("entity_id")
    ref_label = f" #{ref}" if ref is not None else ""

    title = f"{entity_label} {action_label}"
    message = f"{entity_label}{ref_label} {action_label}."
    return title, message


def _chunks(items: list[dict[str, Any]], size: int = 100) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


def _send_expo_push(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """POST to Expo Push API. Returns ticket objects (aligned with messages order)."""
    if not messages:
        return []

    tickets: list[dict[str, Any]] = []
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=15.0, headers=headers) as client:
        for chunk in _chunks(messages, 100):
            try:
                response = client.post(PUSH_ENDPOINT, json=chunk)
                if response.status_code >= 400:
                    print("[Push] Expo push error", response.status_code, response.text)
                    tickets.extend([{}] * len(chunk))
                    continue
                body = response.json() if response.content else {}
                data = body.get("data")
                if isinstance(data, list):
                    tickets.extend(data)
                elif isinstance(data, dict):
                    # Single-message response shape
                    tickets.append(data)
                else:
                    tickets.extend([{}] * len(chunk))
            except Exception as exc:
                print("[Push] Failed to send expo push", exc)
                tickets.extend([{}] * len(chunk))

    return tickets


def _clear_invalid_tokens(tokens: set[str]) -> None:
    if not tokens:
        return
    db = SessionLocal()
    try:
        updated = (
            db.query(User)
            .filter(User.expo_push_token.in_(list(tokens)))
            .update({User.expo_push_token: None}, synchronize_session=False)
        )
        db.commit()
        if updated:
            print(f"[Push] Cleared {updated} invalid Expo push token(s)")
    except Exception as exc:
        db.rollback()
        print("[Push] Failed to clear invalid tokens", exc)
    finally:
        db.close()


def enqueue_push_notification(payload: dict[str, Any]) -> None:
    _EXECUTOR.submit(send_push_notification, payload)


def send_push_notification(payload: dict[str, Any]) -> None:
    scope = str(payload.get("scope") or "finance")
    title, body = _build_message(payload)
    event_id = payload.get("event_id")
    data = {
        "event_id": event_id,
        "scope": scope,
        "entity": payload.get("entity"),
        "action": payload.get("action"),
        "entity_id": payload.get("entity_id"),
        "title": title,
        "message": body,
    }

    db = SessionLocal()
    try:
        users = (
            db.query(User)
            .filter(User.is_active.is_(True))
            .filter(User.expo_push_token.isnot(None))
            .filter(User.expo_push_token != "")
            .all()
        )

        messages: list[dict[str, Any]] = []
        for user in users:
            if scope not in scopes_for_role(user.role) and "*" not in scopes_for_role(user.role):
                continue

            token = (user.expo_push_token or "").strip()
            if not token:
                continue
            # Expo tokens look like ExponentPushToken[xxx]
            if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")):
                print(f"[Push] Skip non-Expo token for user {user.id}")
                continue

            messages.append({
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data,
                "priority": "high",
                "channelId": "default",
            })

        tickets = _send_expo_push(messages)

        # Drop DeviceNotRegistered tokens so future sends stay clean
        invalid: set[str] = set()
        for message, ticket in zip(messages, tickets):
            if not isinstance(ticket, dict) or ticket.get("status") != "error":
                continue
            details = ticket.get("details")
            detail_error = ""
            if isinstance(details, dict):
                detail_error = str(details.get("error") or "")
            else:
                detail_error = str(details or "")
            err_blob = f"{ticket.get('message') or ''} {detail_error}"
            if "DeviceNotRegistered" in err_blob:
                token = str(message.get("to") or "").strip()
                if token:
                    invalid.add(token)
            else:
                print("[Push] Expo ticket error", ticket)
    finally:
        db.close()

    if invalid:
        _clear_invalid_tokens(invalid)
