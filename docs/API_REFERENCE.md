# Harmonia API Reference

**Version**: 1.0.0
**Base URL**: `http://localhost:3000/api`
**Authentication**: JWT Bearer tokens
**Date**: December 4, 2025

---

## Overview

The Harmonia API provides comprehensive endpoints for user authentication, song generation, and music creation workflows. All endpoints return JSON responses and use standard HTTP status codes.

### Authentication

Most endpoints require authentication via JWT Bearer tokens. Include the token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Error Handling

All endpoints follow consistent error response format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Rate Limiting

API endpoints are rate-limited to prevent abuse. Current limits:

- Authentication endpoints: 10 requests per minute
- Song generation endpoints: 5 requests per minute per user

---

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request Body**:

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Response (201 Created)**:

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Error Responses**:

- `409 Conflict`: Email or username already exists
- `400 Bad Request`: Invalid input data

### POST /auth/login

Authenticate user with credentials.

**Request Body**:

```json
{
  "emailOrUsername": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK)**:

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid credentials

### POST /auth/refresh

Refresh access token using refresh token.

**Headers**:

```http
Authorization: Bearer <refresh_token>
```

**Response (200 OK)**:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or expired refresh token

### GET /auth/session

Validate current user session.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "johndoe",
    "role": "user"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or expired access token

### POST /auth/logout

Logout user (client-side token removal).

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "message": "Logged out successfully",
  "success": true
}
```

---

## Song Generation Endpoints

### POST /songs/generate-metadata

Generate song metadata from narrative using AI.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Request Body**:

```json
{
  "narrative": "A story about a young musician discovering their passion for music",
  "duration": 180,
  "model": "deepseek"
}
```

**Parameters**:

- `narrative` (string, required): Story or theme for the song (500-2000 characters)
- `duration` (number, optional): Target song duration in seconds (15-120, default: 180)
- `model` (string, optional): AI model to use (default: configured model)

**Response (200 OK)**:

```json
{
  "title": "Discovering Passion",
  "lyrics": "[Verse 1]\nIn the quiet of the night...",
  "genre": "folk",
  "mood": ["melancholic", "hopeful"],
  "syllableCount": 245,
  "wordCount": 180
}
```

**Error Responses**:

- `400 Bad Request`: Invalid narrative or parameters
- `401 Unauthorized`: Missing or invalid authentication
- `503 Service Unavailable`: AI service unavailable

### POST /songs/suggest-genres

Suggest musical genres based on narrative.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Request Body**:

```json
{
  "narrative": "A high-energy adventure story about racing through the city",
  "model": "deepseek"
}
```

**Response (200 OK)**:

```json
{
  "genres": ["electronic", "rock", "hip-hop"],
  "confidence": [0.85, 0.72, 0.68]
}
```

### POST /songs/parse-mmsl

Parse M-MSL (Micro Music Score Language) notation.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Request Body**:

```json
{
  "mmsl": "[Verse 1]\nGuitar: Am F C G\n(Play with energy)\nHere are the lyrics..."
}
```

**Response (200 OK)**:

```json
{
  "sections": [
    {
      "type": "verse",
      "number": 1,
      "chords": ["Am", "F", "C", "G"],
      "performance": "Play with energy",
      "lyrics": "Here are the lyrics..."
    }
  ],
  "instruments": ["guitar"],
  "tempo": 120,
  "key": "A minor"
}
```

### POST /songs/validate-mmsl

Validate M-MSL syntax without parsing.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Request Body**:

```json
{
  "mmsl": "[Verse 1]\nGuitar: Am F C G\nHere are the lyrics..."
}
```

**Response (200 OK)**:

```json
{
  "valid": true,
  "errors": []
}
```

**Invalid Response**:

```json
{
  "valid": false,
  "errors": [
    {
      "line": 2,
      "column": 8,
      "message": "Invalid chord progression"
    }
  ]
}
```

### POST /songs/export-stems

Export song stems in various formats.

**Headers**:

```http
Authorization: Bearer <access_token>
```

**Request Body**:

```json
{
  "songId": "507f1f77bcf86cd799439011",
  "format": "wav",
  "instruments": ["guitar", "drums", "bass"],
  "sampleRate": 44100,
  "bitDepth": 16
}
```

**Parameters**:

- `songId` (string, required): Unique song identifier
- `format` (string, optional): Export format ("wav", "mp3", "flac") - default: "wav"
- `instruments` (array, optional): Specific instruments to export - default: all
- `sampleRate` (number, optional): Sample rate in Hz (22050, 44100, 48000) - default: 44100
- `bitDepth` (number, optional): Bit depth (16, 24, 32) - default: 16

**Response (200 OK)**:

```json
{
  "success": true,
  "exportId": "exp_507f1f77bcf86cd799439011",
  "files": [
    {
      "instrument": "guitar",
      "filename": "guitar_stem.wav",
      "size": 2457600,
      "url": "/downloads/exp_507f1f77/guitar_stem.wav"
    }
  ],
  "zipUrl": "/downloads/exp_507f1f77/stems.zip"
}
```

---

## Health Check Endpoints

### GET /\_\_health

Basic health check endpoint for load balancers and monitoring.

**Response (200 OK)**:

```json
{
  "ok": true
}
```

---

## Data Models

### User Object

```typescript
interface User {
  id: string; // MongoDB ObjectId
  email: string; // Unique email address
  username: string; // Unique username
  role: 'user' | 'admin'; // User role
  createdAt: Date; // Account creation timestamp
  updatedAt: Date; // Last update timestamp
}
```

### Song Metadata

```typescript
interface SongMetadata {
  title: string; // Generated song title
  lyrics: string; // Complete lyrics with structure
  genre: string; // Primary musical genre
  mood: string[]; // Emotional mood descriptors
  syllableCount: number; // Total syllables in lyrics
  wordCount: number; // Total words in lyrics
}
```

### M-MSL Section

```typescript
interface MMSLSection {
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro';
  number?: number; // Section number (for verses/choruses)
  chords?: string[]; // Chord progression
  performance?: string; // Performance instructions
  lyrics: string; // Section lyrics
  audioCue?: string; // Audio timing cues
}
```

---

## WebSocket Integration

### Connection

Connect to WebSocket server for real-time updates:

```websocket
ws://localhost:3000
```

### Events

#### Song Generation Progress

```json
{
  "event": "song:progress",
  "data": {
    "songId": "507f1f77bcf86cd799439011",
    "stage": "generating_lyrics",
    "progress": 65,
    "message": "Composing verse 2..."
  }
}
```

#### Export Completion

```json
{
  "event": "export:complete",
  "data": {
    "exportId": "exp_507f1f77bcf86cd799439011",
    "status": "success",
    "downloadUrl": "/downloads/exp_507f1f77/stems.zip"
  }
}
```

---

## Rate Limiting

| Endpoint Category | Limit       | Window   |
| ----------------- | ----------- | -------- |
| Authentication    | 10 requests | 1 minute |
| Song Generation   | 5 requests  | 1 minute |
| Health Checks     | 60 requests | 1 minute |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1638360000
```

---

## Error Codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| 400  | Bad Request - Invalid input                   |
| 401  | Unauthorized - Missing/invalid authentication |
| 403  | Forbidden - Insufficient permissions          |
| 404  | Not Found - Resource doesn't exist            |
| 409  | Conflict - Resource already exists            |
| 422  | Unprocessable Entity - Validation failed      |
| 429  | Too Many Requests - Rate limit exceeded       |
| 500  | Internal Server Error - Server error          |
| 503  | Service Unavailable - External service down   |

---

## SDK Examples

### JavaScript/TypeScript

```javascript
// Authentication
const login = async (emailOrUsername, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  });
  return response.json();
};

// Song Generation
const generateSong = async (narrative, token) => {
  const response = await fetch('/api/songs/generate-metadata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ narrative, duration: 180 }),
  });
  return response.json();
};
```

### cURL Examples

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"johndoe","password":"secure123"}'

# Generate song metadata
curl -X POST http://localhost:3000/api/songs/generate-metadata \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"narrative":"A love story set in Paris","duration":240}'
```

---

## Changelog

### Version 1.0.0 (December 4, 2025)

- Initial API release
- Authentication endpoints
- Song metadata generation
- M-MSL parsing and validation
- Stem export functionality
- WebSocket real-time updates
- Rate limiting implementation
