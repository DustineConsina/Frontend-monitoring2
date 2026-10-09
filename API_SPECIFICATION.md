# Backend API Specification

This document outlines the API endpoints that the frontend expects from the backend server.

## Base URL

```
http://localhost:8000/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ADMIN|STAFF|TENANT",
    "contactNumber": "+639XXXXXXXXX",
    "address": "Address here"
  }
}
```

### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "TENANT",
  "contactNumber": "+639XXXXXXXXX",
  "address": "Address here"
}
```

### POST /auth/logout
Logout current user. Requires authentication.

### GET /auth/me
Get current user information. Requires authentication.

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "ADMIN",
  ...
}
```

---

## Contract Endpoints

### GET /contracts
Get all contracts with optional filters.

**Query Parameters:**
- `status`: Filter by status (ACTIVE, EXPIRED, TERMINATED, RENEWED)
- `tenantId`: Filter by tenant ID
- `startDate`: Filter by start date
- `endDate`: Filter by end date

**Response:**
```json
[
  {
    "id": "contract_id",
    "contractNumber": "CT-2026-001",
    "tenantId": "tenant_id",
    "tenant": { /* User object */ },
    "rentalSpaceId": "space_id",
    "rentalSpace": { /* RentalSpace object */ },
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "monthlyRent": 5000.00,
    "securityDeposit": 10000.00,
    "interestRate": 2.5,
    "status": "ACTIVE",
    "qrCode": "base64_qr_code_string",
    "terms": "Contract terms...",
    "notes": "Additional notes...",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

### GET /contracts/:id
Get contract by ID.

### POST /contracts
Create new contract. Requires authentication.

**Request Body:**
```json
{
  "tenantId": "tenant_id",
  "rentalSpaceId": "space_id",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "monthlyRent": 5000.00,
  "securityDeposit": 10000.00,
  "interestRate": 2.5,
  "terms": "Contract terms...",
  "notes": "Additional notes..."
}
```

### PUT /contracts/:id
Update contract. Requires authentication.

### DELETE /contracts/:id
Delete contract. Requires authentication (Admin only).

### GET /contracts/:id/qr-code
Get QR code for contract.

**Response:**
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}
```

---

## Payment Endpoints

### GET /payments
Get all payments.

**Query Parameters:**
- `contractId`: Filter by contract ID
- `status`: Filter by status (PENDING, PAID, OVERDUE, PARTIAL)

**Response:**
```json
[
  {
    "id": "payment_id",
    "contractId": "contract_id",
    "contract": { /* Contract object */ },
    "amount": 5000.00,
    "paymentDate": "2026-02-01",
    "dueDate": "2026-02-01",
    "paymentFor": "Rent for February 2026",
    "lateFee": 0.00,
    "interest": 0.00,
    "totalAmount": 5000.00,
    "status": "PAID",
    "receiptNumber": "RCP-2026-001",
    "paymentMethod": "Cash",
    "notes": "Payment notes...",
    "createdAt": "2026-02-01T00:00:00Z",
    "updatedAt": "2026-02-01T00:00:00Z"
  }
]
```

### POST /payments
Record new payment. Requires authentication.

### PUT /payments/:id
Update payment. Requires authentication.

---

## Rental Space Endpoints

### GET /rental-spaces
Get all rental spaces.

**Query Parameters:**
- `typeId`: Filter by space type
- `status`: Filter by status (AVAILABLE, OCCUPIED, MAINTENANCE, INACTIVE)

**Response:**
```json
[
  {
    "id": "space_id",
    "spaceNumber": "Stall 1",
    "typeId": "type_id",
    "type": {
      "id": "type_id",
      "name": "Food Stall",
      "description": "Food stalls for vendors",
      "baseRatePerSqm": 150.00,
      "totalSpaces": 10
    },
    "squareMeters": 12.0,
    "location": "Food Court Area - Stall 1",
    "status": "AVAILABLE",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

### GET /rental-spaces/:id
Get rental space by ID.

---

## Message Endpoints

### GET /messages
Get messages for current user. Requires authentication.

**Query Parameters:**
- `unreadOnly`: boolean

**Response:**
```json
[
  {
    "id": "message_id",
    "senderId": "sender_id",
    "sender": { /* User object */ },
    "receiverId": "receiver_id",
    "receiver": { /* User object */ },
    "subject": "Payment Reminder",
    "content": "Your payment is due...",
    "isRead": false,
    "createdAt": "2026-02-01T00:00:00Z"
  }
]
```

### POST /messages
Send message. Requires authentication.

**Request Body:**
```json
{
  "receiverId": "receiver_id",  // null for broadcast
  "subject": "Message subject",
  "content": "Message content..."
}
```

### PUT /messages/:id/read
Mark message as read. Requires authentication.

---

## Notification Endpoints

### GET /notifications
Get notifications for current user. Requires authentication.

**Response:**
```json
[
  {
    "id": "notification_id",
    "contractId": "contract_id",
    "contract": { /* Contract object */ },
    "type": "PAYMENT_DUE|PAYMENT_OVERDUE|CONTRACT_RENEWAL|CONTRACT_EXPIRING",
    "subject": "Payment Due Reminder",
    "message": "Your payment is due on...",
    "sentDate": "2026-02-01T00:00:00Z",
    "status": "SENT|PENDING|FAILED",
    "createdAt": "2026-02-01T00:00:00Z"
  }
]
```

### PUT /notifications/:id/read
Mark notification as read. Requires authentication.

---

## Report Endpoints

### GET /reports/active-contracts
Get active contracts report. Requires authentication.

### GET /reports/expired-contracts
Get expired contracts report. Requires authentication.

### GET /reports/delinquent-contracts
Get delinquent contracts report. Requires authentication.

### GET /reports/payment-history
Get payment history report. Requires authentication.

**Query Parameters:**
- `startDate`: Start date for report
- `endDate`: End date for report

### GET /reports/dashboard-stats
Get dashboard statistics. Requires authentication.

**Response:**
```json
{
  "totalContracts": 100,
  "activeContracts": 85,
  "expiredContracts": 10,
  "delinquentContracts": 5,
  "totalRevenue": 500000.00,
  "pendingPayments": 15,
  "availableSpaces": 20,
  "occupiedSpaces": 41,
  "recentPayments": [ /* Payment objects */ ],
  "expiringContracts": [ /* Contract objects */ ]
}
```

---

## Tenant Endpoints

### GET /tenants
Get all tenants. Requires authentication (Staff/Admin).

**Query Parameters:**
- `search`: Search by name or email

### GET /tenants/:id
Get tenant by ID. Requires authentication.

### POST /tenants
Create new tenant. Requires authentication (Staff/Admin).

### PUT /tenants/:id
Update tenant. Requires authentication.

---

## Audit Log Endpoints

### GET /audit-logs
Get audit logs. Requires authentication (Admin/Staff only).

**Query Parameters:**
- `userId`: Filter by user
- `entity`: Filter by entity type (Contract, Payment, User, etc.)
- `action`: Filter by action (CREATE, UPDATE, DELETE, VIEW)

**Response:**
```json
[
  {
    "id": "log_id",
    "userId": "user_id",
    "user": { /* User object */ },
    "action": "UPDATE",
    "entity": "Contract",
    "entityId": "contract_id",
    "oldValues": "{...}",
    "newValues": "{...}",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2026-02-01T00:00:00Z"
  }
]
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "message": "Error message here",
  "status": 400
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Notes for Backend Implementation

1. **QR Code Generation:**
   - Generate QR codes containing contract ID and verification token
   - Return as base64 encoded data URL
   - Use libraries like `qrcode` or similar

2. **Email Notifications:**
   - Implement automated email sending for:
     - Payment due (7 days before)
     - Payment overdue (immediately after due date)
     - Contract expiring (30 days before)
     - Contract renewal reminders
   - Use email service like Nodemailer with SMTP

3. **Interest Calculation:**
   - Calculate monthly interest on overdue payments
   - Formula: `interest = (amount * interestRate / 100)`
   - Add to payment total automatically

4. **Audit Logging:**
   - Log all CREATE, UPDATE, DELETE operations
   - Capture IP address and user agent from request headers
   - Store both old and new values as JSON

5. **Authentication:**
   - Use JWT tokens with expiration
   - Implement token refresh mechanism
   - Hash passwords with bcrypt (minimum 10 rounds)

6. **Database:**
   - Use MySQL (compatible with XAMPP)
   - Implement proper indexes for search performance
   - Use transactions for critical operations

7. **File Exports:**
   - Implement PDF export using libraries like `pdfkit` or `puppeteer`
   - Implement Excel export using `exceljs` or similar
   - Return as downloadable files

8. **CORS:**
   - Enable CORS for frontend URL
   - Allow credentials for cookie-based sessions

9. **Validation:**
   - Validate all inputs server-side
   - Return detailed validation errors
   - Use libraries like Joi or Zod

10. **Rate Limiting:**
    - Implement rate limiting on login endpoint
    - Protect against brute force attacks
    - Use libraries like `express-rate-limit`