"""Authentication routes — registration, login, and profile."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check for existing username
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )

    # Check for existing email
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create user
    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate token
    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Login with username and password."""
    user = db.query(User).filter(User.username == data.username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at
    )
