# Authentication

SiSy uses a "device-based" authentication mechanism for the MVP phase ("Extreme Minimalism").

## Mechanism

- **Identity**: The user's identity is tied to their specific installation of the app.
- **Header**: Every request to the backend must include the `X-Install-Id` header.
- **Generation**: The frontend generates a stable UUID upon first launch and stores it in local storage.
- **No Login**: There is no login screen or password.

## API Usage

### Headers

```http
X-Install-Id: <uuid-string>
```

### Backend Enforcement

The backend (`main.py`) enforces the presence of this header on authenticated endpoints using a FastAPI dependency.

```python
async def get_current_user_id(x_install_id: str = Header(..., description="Device/Installation ID")):
    ...
```

## Security Note

This is **not** a high-security mechanism. It is designed for frictionless MVP usage.
- **Pros**: Zero friction, instant start.
- **Cons**: Data is locked to the device (no cloud sync across devices), uninstallation loses data (unless backed up).

For future phases, this ID can be linked to a user account (e.g. via email) to enable sync.
