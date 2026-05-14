# Admin

## Overview

The admin panel is a separate Vite React app in `admin/`, running on port `3001` in development. It has its own login and uses admin-scoped API endpoints for feedback and user management.

## Backend Routes

`AdminController` is mounted at `/api/admin`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/auth/login` | Admin login |
| `GET` | `/api/admin/feedback/stats` | Feedback aggregate stats |
| `GET` | `/api/admin/feedback` | List feedback with filters/paging |
| `GET` | `/api/admin/feedback/{id}` | Feedback detail |
| `PATCH` | `/api/admin/feedback/{id}/status` | Update feedback status |
| `PATCH` | `/api/admin/feedback/{id}/note` | Save internal admin note |
| `DELETE` | `/api/admin/feedback/{id}` | Delete feedback |
| `GET` | `/api/admin/users` | List users with filters/paging |
| `PATCH` | `/api/admin/users/{id}/active` | Activate/deactivate a user |

User feedback is submitted from the main app through `POST /api/feedback`.

## Frontend Files

| Path | Role |
| --- | --- |
| `admin/src/App.tsx` | Admin routes |
| `admin/src/context/AuthContext.tsx` | Admin auth state |
| `admin/src/services/api.ts` | API client |
| `admin/src/pages/DashboardPage.tsx` | Overview |
| `admin/src/pages/FeedbackListPage.tsx` | Feedback list |
| `admin/src/pages/FeedbackDetailPage.tsx` | Feedback detail and note/status actions |
| `admin/src/pages/UserManagementPage.tsx` | User list and active toggle |

## Backend Handlers

Admin commands and queries live under `server/StudyPlatform.Application/Admin`.

### Admin Login

Admin login verifies credentials the same way as regular login, but additionally asserts `user.IsAdmin`. A non-admin user attempting to use admin credentials gets `FORBIDDEN`, not a 404.

```csharp
// AdminLoginCommand.cs
public async Task<Result<AdminTokenResponse>> Handle(AdminLoginCommand request, CancellationToken ct)
{
    var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), ct);

    if (user == null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        return Result<AdminTokenResponse>.Failure("Invalid credentials.", "INVALID_CREDENTIALS");

    if (!user.IsAdmin)
        return Result<AdminTokenResponse>.Failure("Access denied.", "FORBIDDEN");

    var token = _tokenService.GenerateAccessToken(user);
    return Result<AdminTokenResponse>.Success(new AdminTokenResponse(token), "Login successful.");
}
```

The generated token carries the `Admin` role claim, which the `[Authorize(Roles = "Admin")]` attribute on every other admin endpoint enforces.

### User Active Toggle

`SetUserActiveStatusCommand` prevents an admin from deactivating their own account or changing any other admin's status:

```csharp
// SetUserActiveStatusCommand.cs
public async Task<Result<UserDto>> Handle(SetUserActiveStatusCommand request, CancellationToken ct)
{
    var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, ct);
    if (user == null)
        return Result<UserDto>.Failure("User not found.", "NOT_FOUND");

    if (user.IsAdmin)
        return Result<UserDto>.Failure("Cannot change status of an admin account.", "FORBIDDEN");

    user.IsActive = request.IsActive;
    user.UpdatedAt = DateTime.UtcNow;

    await _unitOfWork.SaveChangesAsync(ct);
    return Result<UserDto>.Success(new UserDto(...));
}
```

The controller adds a second guard preventing a logged-in admin from deactivating themselves before even dispatching the command:

```csharp
// AdminController.cs — self-deactivation guard
var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
if (Guid.TryParse(adminId, out var adminGuid) && adminGuid == id)
    return BadRequest(BaseResponse<object>.Fail("Cannot change your own account status."));
```
