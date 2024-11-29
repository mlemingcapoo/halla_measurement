
1. **Basic Database Tables Needed:**
```sql
Users Table:
- UserId (PK)
- Username (unique)
- Password
- FullName
- RoleType (enum: Admin/Staff/Employee)
- IsActive
- CreatedAt
```

2. **Basic Features:**

A. **Simple Login Flow**
- Login form
- Session management (in-memory is fine)
- "Login to continue" blocks for critical actions

B. **Activity Tracking** (using existing ActionHistory)
- Add Username to tracked actions
- Track login/logout events

3. **Protected Actions Examples:**
```plaintext
Require Login:
- Excel Import/Export
- Model Creation/Deletion
- Equipment Management
- Settings Changes
```

4. **UI Changes Needed:**
- Login page
- Show current user info in header/navbar
- Logout button
- "Login required" messages for protected actions