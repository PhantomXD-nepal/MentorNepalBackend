# Backend Integration Guide

This document provides a complete reference for integrating with the CareerPath backend API.

## Base URL

```
http://localhost:3000/api
```

All endpoints are prefixed with `/api`.

---

## Authentication

The API uses **better-auth** for authentication. Sessions are managed via cookies or Bearer tokens.

### Authentication Flow

1. Sign up or sign in to receive a session
2. Include session cookie or `Authorization: Bearer <token>` header in requests
3. Some routes require specific roles: `mentee`, `mentor`, or `admin`

### Getting Current Session

```http
GET /api/auth/session
```

**Auth:** Required

**Response (200):**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "mentee", "emailVerified": false, "onboardingComplete": false },
  "session": { "expiresAt": "..." }
}
```

**Response (401):** No active session

---

## Onboarding Routes

### Select User Role

```http
POST /api/onboarding/role
```

**Auth:** Required

**Request Body:**
```json
{
  "role": "mentor" | "mentee"
}
```

**Response (200):**
```json
{ "message": "Role selected successfully", "role": "mentor" }
```

**Errors:** 400 (validation), 401 (unauthorized)

---

### Create Mentor Profile

```http
POST /api/onboarding/mentor
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "fullName": "John Doe",
  "headline": "Senior Software Engineer",
  "bio": "10 years experience in...",
  "expertise": ["JavaScript", "TypeScript", "React"],
  "yearsExp": 10,
  "hourlyRate": 50,
  "company": "Tech Corp",
  "title": "Senior Engineer",
  "avatarUrl": "https://...",
  "linkedinUrl": "https://linkedin.com/in/...",
  "location": "San Francisco, CA",
  "languages": ["English", "Nepali"]
}
```

**Response (200):**
```json
{ "message": "Mentor profile created" }
```

**Errors:** 400 (validation), 401 (unauthorized), 403 (not mentor role)

---

### Create Mentee Profile

```http
POST /api/onboarding/mentee
```

**Auth:** Required, Role: `mentee`

**Request Body:**
```json
{
  "fullName": "Jane Doe",
  "goals": ["Learn React", "Get a job"],
  "careerStage": "student" | "early" | "mid" | "senior",
  "interests": ["Web Development", "Mobile Apps"],
  "bio": "Computer science student...",
  "avatarUrl": "https://..."
}
```

**Response (200):**
```json
{ "message": "Mentee profile created" }
```

**Errors:** 400 (validation), 401 (unauthorized), 403 (not mentee role)

---

### Complete Onboarding

```http
POST /api/onboarding/complete
```

**Auth:** Required

**Response (200):**
```json
{ "message": "Onboarding completed" }
```

**Errors:** 401 (unauthorized), 500 (internal error)

---

## Mentor Routes

### List Mentors

```http
GET /api/mentors
```

**Auth:** Required

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `expertise` - comma-separated expertise areas
- `minRate` - minimum hourly rate
- `maxRate` - maximum hourly rate
- `verified` - filter by verified status
- `search` - search by name/expertise

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "name": "John Doe",
      "avatar": "https://...",
      "expertise": ["JavaScript", "React"],
      "hourlyRate": 50,
      "verified": true,
      "rating": 4.8,
      "reviewCount": 10
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

---

### Get My Mentor Profile

```http
GET /api/mentors/me
```

**Auth:** Required, Role: `mentor`

**Response (200):**
```json
{
  "id": "...",
  "userId": "...",
  "fullName": "John Doe",
  "headline": "Senior Engineer",
  "bio": "...",
  "expertiseTags": "[\"JavaScript\"]",
  "yearsExp": 10,
  "sessionPrice": 50,
  "avatarUrl": "https://...",
  "linkedinUrl": "https://...",
  "location": "San Francisco",
  "languages": "[\"English\"]",
  "documents": "[]",
  "isVerified": true,
  "isActive": true,
  "totalSessions": 5,
  "avgRating": 4.8,
  "reviewCount": 10,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors:** 401 (unauthorized), 403 (not a mentor), 404 (profile not found)

---

### Get Mentor by ID

```http
GET /api/mentors/:mentorId
```

**Auth:** Not required

**Response (200):** Same as `/api/mentors/me` response

**Errors:** 404 (mentor not found)

---

### Update Mentor Profile

```http
PUT /api/mentors/me
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "expertiseTags": ["JavaScript", "TypeScript"],
  "yearsExp": 5,
  "sessionPrice": 75,
  "bio": "Updated bio",
  "fullName": "John Doe",
  "headline": "Updated headline",
  "avatarUrl": "https://...",
  "linkedinUrl": "https://...",
  "location": "New York, NY",
  "languages": ["English", "Spanish"]
}
```

**Response (200):**
```json
{
  "id": "...",
  "userId": "...",
  "fullName": "John Doe",
  // ... updated fields
}
```

**Errors:** 401 (unauthorized), 403 (not a mentor)

---

### Get Mentor Documents

```http
GET /api/mentors/:mentorId/documents
```

**Auth:** Required

**Response (200):**
```json
{
  "documents": ["https://..."]
}
```

**Errors:** 401 (unauthorized), 403 (not authorized), 404 (mentor not found)

---

### Append Mentor Documents

```http
POST /api/mentors/me/documents
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "documents": ["https://..."]
}
```

**Response (200):**
```json
{
  "documents": ["https://...", "https://..."]
}
```

**Errors:** 401 (unauthorized), 403 (not a mentor), 404 (profile not found)

---

### Replace Mentor Documents

```http
PATCH /api/mentors/me/documents
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "documents": ["https://new-doc.pdf"]
}
```

**Response (200):**
```json
{
  "documents": ["https://new-doc.pdf"]
}
```

**Errors:** 401 (unauthorized), 403 (not a mentor), 404 (profile not found)

---

### Remove Mentor Document

```http
DELETE /api/mentors/me/documents
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "document": "https://..."
}
```

**Response (200):**
```json
{
  "documents": ["https://remaining.pdf"]
}
```

**Errors:** 401 (unauthorized), 403 (not a mentor), 404 (profile not found)

---

## Session Routes

### Book Session

```http
POST /api/sessions
```

**Auth:** Required, Role: `mentee`

**Request Body:**
```json
{
  "mentorId": "mentor-profile-id",
  "startTime": "2024-06-01T10:00:00.000Z",
  "endTime": "2024-06-01T10:30:00.000Z",
  "topic": "Career guidance",
  "notes": "Looking to discuss resume"
}
```

**Response (201):**
```json
{
  "id": "...",
  "mentorId": "...",
  "menteeId": "...",
  "scheduledAt": "2024-06-01T10:00:00.000Z",
  "durationMins": 30,
  "status": "pending",
  "meetingUrl": "https://meet.jit.si/...",
  "topic": "Career guidance",
  "menteeNote": "Looking to discuss resume",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors:** 400 (invalid time), 401 (unauthorized), 403 (not a mentee), 404 (mentor not found), 409 (time slot unavailable), 429 (rate limited)

---

### Get User Sessions

```http
GET /api/sessions
```

**Auth:** Required

**Query Parameters:**
- `status` - filter by status: `pending`, `confirmed`, `cancelled`, `completed`
- `role` - filter by role: `mentor` or `mentee`
- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "mentorId": "...",
      "menteeId": "...",
      "scheduledAt": "2024-06-01T10:00:00.000Z",
      "durationMins": 30,
      "status": "pending",
      "meetingUrl": "https://...",
      "topic": "...",
      "createdAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

**Errors:** 401 (unauthorized)

---

### Get Session by ID

```http
GET /api/sessions/:sessionId
```

**Auth:** Required

**Response (200):**
```json
{
  "id": "...",
  "mentorId": "...",
  "menteeId": "...",
  "scheduledAt": "2024-06-01T10:00:00.000Z",
  "durationMins": 30,
  "status": "confirmed",
  "meetingUrl": "https://...",
  "topic": "...",
  "createdAt": "..."
}
```

**Errors:** 401 (unauthorized), 403 (not authorized), 404 (session not found)

---

### Confirm Session

```http
PATCH /api/sessions/:sessionId/confirm
```

**Auth:** Required, Role: `mentor`

**Response (200):**
```json
{
  "id": "...",
  "status": "confirmed",
  // ... other fields
}
```

**Errors:** 401 (unauthorized), 403 (not authorized), 404 (session not found), 409 (already confirmed/cancelled)

---

### Cancel Session

```http
PATCH /api/sessions/:sessionId/cancel
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "reason": "Schedule conflict"
}
```

**Response (200):**
```json
{
  "id": "...",
  "status": "cancelled",
  "cancelledBy": "...",
  "cancelReason": "Schedule conflict"
}
```

**Errors:** 401 (unauthorized), 403 (not authorized), 404 (session not found), 409 (already completed/cancelled)

---

### Complete Session

```http
PATCH /api/sessions/:sessionId/complete
```

**Auth:** Required, Role: `mentor`

**Response (200):**
```json
{
  "id": "...",
  "status": "completed"
}
```

**Errors:** 401 (unauthorized), 403 (not authorized), 404 (session not found), 409 (not confirmed)

---

### Join Session

```http
GET /api/sessions/:sessionId/join
```

**Auth:** Required

**Response (200):**
```json
{
  "roomUrl": "https://meet.jit.si/..."
}
```

**Errors:** 401 (unauthorized), 403 (not authorized / session not confirmed / not started yet / already ended), 404 (session not found)

---

## Review Routes

### Submit Review

```http
POST /api/reviews
```

**Auth:** Required, Role: `mentee`

**Request Body:**
```json
{
  "sessionId": "session-id",
  "rating": 5,
  "content": "Great session! Very helpful."
}
```

**Response (201):**
```json
{
  "id": "...",
  "sessionId": "...",
  "mentorId": "...",
  "menteeId": "...",
  "rating": 5,
  "content": "Great session! Very helpful.",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors:** 400 (invalid), 401 (unauthorized), 403 (not a mentee / session not completed / already reviewed), 404 (session not found), 429 (rate limited)

---

### Get Mentor Reviews

```http
GET /api/reviews/:mentorId
```

**Auth:** Not required

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "mentorId": "...",
      "menteeId": "...",
      "rating": 5,
      "content": "Great session!",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "stats": { "average": 4.8, "total": 10 },
  "pagination": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

**Errors:** 404 (mentor not found)

---

## Availability Routes

### Get Mentor Availability

```http
GET /api/availability/:mentorId
```

**Auth:** Not required

**Response (200):**
```json
[
  {
    "id": "...",
    "mentorId": "...",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "isActive": true
  }
]
```

**Errors:** 404 (mentor not found)

---

### Update Mentor Availability

```http
PUT /api/availability
```

**Auth:** Required, Role: `mentor`

**Request Body:**
```json
{
  "slots": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 4, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00" }
  ]
}
```

`dayOfWeek`: 0 (Sunday) to 6 (Saturday)
`startTime`/`endTime`: 24-hour format "HH:MM"

**Response (200):**
```json
[
  { "id": "...", "mentorId": "...", "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "isActive": true }
]
```

**Errors:** 400 (invalid slots), 401 (unauthorized), 403 (not a mentor)

---

### Get Open Time Slots

```http
GET /api/availability/:mentorId/open
```

**Auth:** Not required

**Query Parameter:** `weekStart` (required) - ISO date format "YYYY-MM-DD"

**Response (200):**
```json
[
  { "startTime": "2024-06-03T09:00:00.000Z", "endTime": "2024-06-03T17:00:00.000Z", "available": true },
  { "startTime": "2024-06-03T17:00:00.000Z", "endTime": "2024-06-03T18:00:00.000Z", "available": false }
]
```

**Errors:** 404 (mentor not found)

---

## Admin Routes

All admin routes require the `admin` role.

### Get Verification Requests

```http
GET /api/admin/verification-requests
```

**Auth:** Required, Role: `admin`

**Query Parameters:**
- `status` (default: `pending`)
- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "mentorId": "...",
      "mentorName": "John Doe",
      "linkedinUrl": "https://...",
      "documents": ["https://..."],
      "status": "pending",
      "adminNote": null,
      "reviewedBy": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### Review Verification Request

```http
PATCH /api/admin/verification-requests/:id
```

**Auth:** Required, Role: `admin`

**Request Body:**
```json
{
  "status": "approved" | "rejected",
  "notes": "All documents verified"
}
```

**Response (200):**
```json
{
  "id": "...",
  "status": "approved",
  "adminNote": "All documents verified",
  "reviewedBy": "admin-user-id",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors:** 404 (request not found), 409 (already reviewed)

---

### Get All Users

```http
GET /api/admin/users
```

**Auth:** Required, Role: `admin`

**Query Parameters:**
- `role` - filter by role: `mentee`, `mentor`, `admin`
- `search` - search by name
- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "mentor",
      "onboardingComplete": false,
      "emailVerified": false,
      "createdAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

---

### Get Platform Stats

```http
GET /api/admin/stats
```

**Auth:** Required, Role: `admin`

**Response (200):**
```json
{
  "totalUsers": 100,
  "totalMentors": 20,
  "totalMentees": 80,
  "totalSessions": 150,
  "completedSessions": 120,
  "pendingVerifications": 5,
  "averageSessionRating": 4.7
}
```

---

### Suspend Mentor

```http
PATCH /api/admin/mentors/:mentorId/suspend
```

**Auth:** Required, Role: `admin`

**Request Body:**
```json
{
  "suspended": true,
  "reason": "Policy violation"
}
```

**Response (200):**
```json
{
  "id": "...",
  "userId": "...",
  "isActive": false
}
```

**Errors:** 404 (mentor not found)

---

## Notifications Routes

These routes are defined but not fully implemented (return 501).

### Get Notifications

```http
GET /api/notifications
```

### Mark All as Read

```http
PATCH /api/notifications/read
```

### Mark One as Read

```http
PATCH /api/notifications/:id/read
```

---

## Error Responses

Standard error format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

### Common Error Codes

| Code | Description |
|------|------------|
| 400  | Bad request - invalid input |
| 401  | Unauthorized - not logged in |
| 403  | Forbidden - not authorized |
| 404  | Not found |
| 409  | Conflict - resource state conflict |
| 429  | Too many requests - rate limited |
| 500  | Internal server error |

---

## Database Schema Overview

### Users
- `id` - primary key
- `email` - unique
- `name`
- `role` - `mentee`, `mentor`, or `admin`
- `onboardingComplete` - boolean

### Mentor Profiles
- `id` - primary key
- `userId` - foreign key to user
- `fullName`, `headline`, `bio`
- `expertiseTags` - JSON array
- `yearsExp`
- `sessionPrice` - hourly rate
- `isVerified` - admin verified
- `isActive` - not suspended
- `avgRating`, `reviewCount`

### Mentee Profiles
- `id` - primary key
- `userId` - foreign key to user
- `fullName`, `bio`
- `goals` - JSON array
- `careerStage` - `student`, `early`, `mid`, `senior`
- `interests` - JSON array

### Sessions
- `id` - primary key
- `mentorId` - foreign key to mentor profile
- `menteeId` - foreign key to mentee profile
- `scheduledAt` - ISO timestamp
- `durationMins`
- `status` - `pending`, `confirmed`, `completed`, `cancelled`
- `meetingUrl`

### Reviews
- `id` - primary key
- `sessionId` - one per session
- `mentorId`, `menteeId`
- `rating` - 1-5
- `comment`
- `isPublic` - default true

### Availability Slots
- `id` - primary key
- `mentorId` - foreign key
- `dayOfWeek` - 0-6
- `startTime`, `endTime` - "HH:MM"
- `isActive`

### Verification Requests
- `id` - primary key
- `mentorId` - foreign key
- `linkedinUrl`
- `documents` - JSON array
- `status` - `pending`, `approved`, `rejected`

---

## Rate Limits

- **Session booking:** 10 requests/hour per user
- **Reviews:** 5 requests/hour per user
- Some endpoints use caching (Redis or in-memory)

---

## Notes for Integration

1. **Authentication:** Use `/api/auth/session` to check current auth state. Store and include session cookies or Bearer token.

2. **Onboarding Flow:** Users must select role -> create profile -> call `/api/onboarding/complete` before accessing role-specific features.

3. **Sessions:** Only mentees can book. Mentors must confirm. Sessions can only be joined when confirmed and within the time window.

4. **Reviews:** One review per session. Only after session is `completed`.

5. **Availability:** Set weekly recurring slots, then the system calculates open slots for any week based on booked sessions.

6. **Mentor Verification:** Mentors submit documents during onboarding. Admins approve/reject via `/api/admin/verification-requests`.

7. **Time Formats:** All timestamps in ISO 8601 format. Availability times in "HH:MM" 24-hour format. Day of week: 0=Sunday to 6=Saturday.

8. **JSON Fields:** Some fields are stored as JSON strings - parse on read, stringify on write:
   - `expertiseTags`
   - `goals`
   - `interests`
   - `languages`
   - `documents`