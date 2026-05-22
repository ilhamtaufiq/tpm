from typing import Annotated, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.models.user import User
from app.utils.security import verify_token
from app.utils.constants import UserRole, KasBankSource


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )

    return user


def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin role required.",
        )
    return current_user


def require_manager_or_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require manager or admin role."""
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Manager or Admin role required.",
        )
    return current_user


def require_unit_manager_or_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require admin, manager, or unit admin role."""
    if current_user.role not in [
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.BENGKEL,
        UserRole.JASA_ANGKUT,
        UserRole.MOBIL,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Unit, Manager, or Admin role required.",
        )
    return current_user


def get_unit_scope_for_role(role: UserRole) -> KasBankSource | None:
    if role == UserRole.BENGKEL:
        return KasBankSource.BENGKEL
    if role == UserRole.JASA_ANGKUT:
        return KasBankSource.JASA_ANGKUT
    if role == UserRole.MOBIL:
        return KasBankSource.JUAL_BELI_MOBIL
    return None


# Type aliases for cleaner dependency injection
DBSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, Depends(require_admin)]
ManagerUser = Annotated[User, Depends(require_manager_or_admin)]
UnitManagerUser = Annotated[User, Depends(require_unit_manager_or_admin)]
