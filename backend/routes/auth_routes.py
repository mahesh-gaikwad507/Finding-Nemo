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
    """Register a new team account with team name, leader name, and phone number."""
    phone = data.phone_number.strip()
    team = data.team_name.strip()
    leader = data.leader_name.strip()

    # Check for existing phone number
    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Phone number '{phone}' is already registered with a team."
        )

    # Derive unique username
    base_user = data.username.strip() if data.username else team.lower().replace(" ", "_")
    uname = base_user
    counter = 1
    while db.query(User).filter(User.username == uname).first():
        uname = f"{base_user}_{counter}"
        counter += 1

    email = data.email.strip() if data.email else f"{phone}@dexerity.local"
    if db.query(User).filter(User.email == email).first():
        email = f"{phone}_{counter}@dexerity.local"

    # Create user
    user = User(
        username=uname,
        email=email,
        password_hash=hash_password(data.password),
        team_name=team,
        leader_name=leader,
        phone_number=phone,
        is_admin=False
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
            team_name=user.team_name,
            leader_name=user.leader_name,
            phone_number=user.phone_number,
            is_admin=user.is_admin,
            locked_domain=user.locked_domain,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Login with username (mahesh123 for admin), team name, or phone number."""
    query_val = (data.username or data.team_name or data.phone_number or "").strip()

    if not query_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a username, team name, or phone number"
        )

    # Allow login by username, phone number, or team name
    user = db.query(User).filter(
        (User.username == query_val) |
        (User.phone_number == query_val) |
        (User.team_name == query_val)
    ).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Check your username/phone and password."
        )

    # Ensure admin flag is true for mahesh123
    if user.username.lower() == "mahesh123" and not user.is_admin:
        user.is_admin = True
        db.commit()

    from services.quiz_service import get_user_locked_domain
    locked = get_user_locked_domain(db, user.id)

    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            team_name=user.team_name,
            leader_name=user.leader_name,
            phone_number=user.phone_number,
            is_admin=user.is_admin or (user.username.lower() == "mahesh123"),
            locked_domain=locked,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the current authenticated user's profile."""
    from services.quiz_service import get_user_locked_domain
    locked = get_user_locked_domain(db, current_user.id)

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        team_name=current_user.team_name,
        leader_name=current_user.leader_name,
        phone_number=current_user.phone_number,
        is_admin=current_user.is_admin or (current_user.username.lower() == "mahesh123"),
        locked_domain=locked,
        created_at=current_user.created_at
    )


