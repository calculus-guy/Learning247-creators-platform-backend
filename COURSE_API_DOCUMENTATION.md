# Course Marketplace API Documentation

Complete API documentation based on actual implementation.

**Last Updated:** February 9, 2026  
**API Version:** 2.0

---

## Base URL

**Development:** `http://localhost:8080/api`  
**Production:** `https://your-domain.com/api`

---

## Authentication

- 🔒 = Requires authentication (user token)
- 👑 = Requires admin role

Include JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Important Notes

1. **Idempotency Key**: REQUIRED for purchase endpoint to prevent duplicate charges
2. **Coupon Code**: Case-insensitive (VALENTINE2025 = valentine2025)
3. **Access Types**:
   - `individual`: One course, lifetime access, requires `courseId`
   - `monthly`: All courses, 30 days, `courseId` must be null/omitted
   - `yearly`: All courses, 365 days, `courseId` must be null/omitted

---

# Endpoints

## 1. Get All Departments

Get list of all course departments.

**Endpoint:** `GET /courses/departments`  
**Auth:** None

**Request:**
```bash
GET /api/courses/departments
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 2,
  "departments": [
    {
      "id": "uuid-here",
      "name": "Technology Courses",
      "slug": "technology-courses",
      "description": "Learn the latest in technology",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```


---

## 2. Get Courses by Department

Get all courses in a specific department.

**Endpoint:** `GET /courses/departments/:id/courses`  
**Auth:** None

**Query Parameters:**
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `search` (optional): Search query

**Request:**
```bash
GET /api/courses/departments/uuid-here/courses?limit=10&offset=0
```

**Response:** `200 OK`
```json
{
  "success": true,
  "department": {
    "id": "uuid-here",
    "name": "Technology Courses",
    "slug": "technology-courses",
    "description": "Learn the latest in technology"
  },
  "courses": [
    {
      "id": "uuid-here",
      "departmentId": "uuid-here",
      "name": "Full Stack Web Development",
      "link": "https://course-platform.com/fullstack",
      "content": "Learn HTML, CSS, JavaScript, React, Node.js",
      "curriculum": "Module 1: HTML & CSS\nModule 2: JavaScript...",
      "duration": "12 weeks",
      "imageUrl": "https://s3.amazonaws.com/bucket/course-image.jpg",
      "isActive": true,
      "createdAt": "2026-01-20T10:30:00.000Z",
      "updatedAt": "2026-01-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 10,
    "offset": 0,
    "pages": 2
  }
}
```

**Error:** `404 Not Found`
```json
{
  "success": false,
  "message": "Department not found"
}
```


---

## 3. Search Courses

Search courses across all departments.

**Endpoint:** `GET /courses/search`  
**Auth:** None

**Query Parameters:**
- `q` (required): Search query (min 2 characters)
- `department` (optional): Filter by department ID
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Request:**
```bash
GET /api/courses/search?q=web&limit=10
```

**Response:** `200 OK`
```json
{
  "success": true,
  "query": "web",
  "courses": [
    {
      "id": "uuid-here",
      "name": "Full Stack Web Development",
      "link": "https://course-platform.com/fullstack",
      "imageUrl": "https://s3.amazonaws.com/bucket/image.jpg",
      "duration": "12 weeks",
      "isActive": true,
      "department": {
        "id": "uuid-here",
        "name": "Technology Courses"
      }
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0,
    "pages": 1
  }
}
```

**Error:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Search query must be at least 2 characters long"
}
```


---

## 4. Get Single Course

Get details of a specific course.

**Endpoint:** `GET /courses/:id`  
**Auth:** None

**Request:**
```bash
GET /api/courses/uuid-here
```

**Response:** `200 OK`
```json
{
  "success": true,
  "course": {
    "id": "uuid-here",
    "departmentId": "uuid-here",
    "name": "Full Stack Web Development",
    "link": "https://course-platform.com/fullstack",
    "content": "Learn HTML, CSS, JavaScript, React, Node.js and more",
    "curriculum": "Module 1: HTML & CSS\nModule 2: JavaScript\nModule 3: React.js\nModule 4: Node.js & Express\nModule 5: Databases\nModule 6: Deployment",
    "duration": "12 weeks",
    "imageUrl": "https://s3.amazonaws.com/bucket/course-image.jpg",
    "isActive": true,
    "createdAt": "2026-01-20T10:30:00.000Z",
    "updatedAt": "2026-01-20T10:30:00.000Z",
    "department": {
      "id": "uuid-here",
      "name": "Technology Courses",
      "slug": "technology-courses",
      "description": "Learn the latest in technology"
    }
  }
}
```

**Error:** `404 Not Found`
```json
{
  "success": false,
  "message": "Course not found"
}
```


---

## 5. Purchase Course / Access 🔒

Purchase individual course, monthly access, or yearly access.

**Endpoint:** `POST /courses/purchase`  
**Auth:** Required

**Headers:**
```
Authorization: Bearer <token>
Idempotency-Key: <unique-key>  (REQUIRED!)
Content-Type: application/json
```

### Request Body - Individual Course
```json
{
  "accessType": "individual",
  "courseId": "uuid-here",
  "currency": "NGN",
  "couponCode": "VALENTINE2025",
  "studentName": "John Doe",
  "studentEmail": "john@example.com",
  "studentPhone": "+2348012345678"
}
```

### Request Body - Monthly All-Access
```json
{
  "accessType": "monthly",
  "currency": "NGN",
  "couponCode": "VALENTINE2025",
  "studentName": "Jane Smith",
  "studentEmail": "jane@example.com",
  "studentPhone": "+2348087654321"
}
```

### Request Body - Yearly All-Access
```json
{
  "accessType": "yearly",
  "currency": "USD",
  "studentName": "Bob Johnson",
  "studentEmail": "bob@example.com",
  "studentPhone": "+1234567890"
}
```

**Response:** `200 OK` (Individual Course with Coupon)
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "accessType": "individual",
  "accessDescription": "Individual Course Access",
  "expiresAt": null,
  "pricing": {
    "currency": "NGN",
    "regularPrice": 25000,
    "finalPrice": 20000,
    "discount": 5000,
    "discountPercentage": 20,
    "couponApplied": true
  },
  "payment": {
    "gateway": "paystack",
    "requiredGateway": "paystack",
    "cached": false,
    "paymentUrl": "https://checkout.paystack.com/abc123",
    "reference": "ref_abc123xyz"
  },
  "course": {
    "id": "uuid-here",
    "name": "Full Stack Web Development",
    "department": "Technology Courses"
  }
}
```

**Response:** `200 OK` (Monthly Access with Coupon)
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "accessType": "monthly",
  "accessDescription": "Monthly All-Access Pass (30 days)",
  "expiresAt": "2026-03-09T10:30:00.000Z",
  "pricing": {
    "currency": "NGN",
    "regularPrice": 35000,
    "finalPrice": 25000,
    "discount": 10000,
    "discountPercentage": 28.57,
    "couponApplied": true
  },
  "payment": {
    "gateway": "paystack",
    "requiredGateway": "paystack",
    "cached": false,
    "paymentUrl": "https://checkout.paystack.com/xyz789",
    "reference": "ref_xyz789"
  }
}
```


**Error Responses:**

`400 Bad Request` - Missing Idempotency Key
```json
{
  "success": false,
  "message": "Idempotency-Key header is required"
}
```

`400 Bad Request` - Missing Student Details
```json
{
  "success": false,
  "message": "Student details (name, email, phone) are required"
}
```

`400 Bad Request` - Validation Failed
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Course ID is required for individual course purchases"
  ]
}
```

`404 Not Found` - Course Not Found
```json
{
  "success": false,
  "message": "Course not found"
}
```

`409 Conflict` - Already Enrolled
```json
{
  "success": false,
  "message": "You are already enrolled in this course"
}
```


---

## 6. Get My Enrollments 🔒

Get all courses the authenticated user is enrolled in.

**Endpoint:** `GET /courses/my-enrollments`  
**Auth:** Required

**Query Parameters:**
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Request:**
```bash
GET /api/courses/my-enrollments?limit=10&offset=0
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "enrollments": [
    {
      "id": "uuid-here",
      "userId": 123,
      "courseId": "uuid-here",
      "purchaseId": "uuid-here",
      "studentName": "John Doe",
      "studentEmail": "john@example.com",
      "studentPhone": "+2348012345678",
      "accessType": "individual",
      "expiresAt": null,
      "isExpired": false,
      "daysUntilExpiry": null,
      "accessDescription": "Lifetime Access",
      "credentialsSent": true,
      "sentBy": 456,
      "sentAt": "2026-02-09T11:00:00.000Z",
      "createdAt": "2026-02-09T10:30:00.000Z",
      "updatedAt": "2026-02-09T11:00:00.000Z",
      "course": {
        "id": "uuid-here",
        "name": "Full Stack Web Development",
        "link": "https://course-platform.com/fullstack",
        "imageUrl": "https://s3.amazonaws.com/bucket/image.jpg",
        "duration": "12 weeks",
        "isActive": true,
        "department": {
          "id": "uuid-here",
          "name": "Technology Courses",
          "slug": "technology-courses"
        }
      },
      "purchase": {
        "id": "uuid-here",
        "amount": 20000,
        "currency": "NGN",
        "paymentGateway": "paystack",
        "createdAt": "2026-02-09T10:30:00.000Z"
      }
    },
    {
      "id": "uuid-here",
      "userId": 123,
      "courseId": null,
      "purchaseId": "uuid-here",
      "studentName": "John Doe",
      "studentEmail": "john@example.com",
      "studentPhone": "+2348012345678",
      "accessType": "monthly",
      "expiresAt": "2026-03-09T10:30:00.000Z",
      "isExpired": false,
      "daysUntilExpiry": 28,
      "accessDescription": "Monthly All-Access",
      "credentialsSent": true,
      "course": null,
      "purchase": {
        "id": "uuid-here",
        "amount": 25000,
        "currency": "NGN",
        "paymentGateway": "paystack",
        "createdAt": "2026-02-09T10:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 10,
    "offset": 0,
    "pages": 1
  }
}
```


---

# Admin Endpoints 👑

All admin endpoints require admin role authentication.

## 7. Get All Enrollments (Admin)

Get all course enrollments with advanced filtering.

**Endpoint:** `GET /admin/course-enrollments`  
**Auth:** Admin Required

**Query Parameters:**
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `search` (optional): Search by student name, email, or phone
- `courseId` (optional): Filter by specific course UUID
- `departmentId` (optional): Filter by department UUID
- `credentialsSent` (optional): Filter by credentials sent status (true/false)
- `accessType` (optional): Filter by access type (individual/monthly/yearly)
- `expiryStatus` (optional): Filter by expiry status (active/expired/expiring_soon)

**Request:**
```bash
# Get all monthly subscriptions that are active
GET /api/admin/course-enrollments?accessType=monthly&expiryStatus=active&limit=20
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "enrollments": [
    {
      "id": "uuid-here",
      "userId": 123,
      "courseId": null,
      "purchaseId": "uuid-here",
      "studentName": "Jane Smith",
      "studentEmail": "jane@example.com",
      "studentPhone": "+2348087654321",
      "accessType": "monthly",
      "expiresAt": "2026-03-09T10:30:00.000Z",
      "isExpired": false,
      "daysUntilExpiry": 28,
      "accessDescription": "Monthly All-Access",
      "credentialsSent": false,
      "sentBy": null,
      "sentAt": null,
      "createdAt": "2026-02-09T10:30:00.000Z",
      "updatedAt": "2026-02-09T10:30:00.000Z",
      "course": null,
      "user": {
        "id": 123,
        "firstname": "Jane",
        "lastname": "Smith",
        "email": "jane@example.com"
      },
      "purchase": {
        "id": "uuid-here",
        "amount": 25000,
        "currency": "NGN",
        "paymentGateway": "paystack",
        "paymentReference": "ref_xyz789",
        "createdAt": "2026-02-09T10:30:00.000Z"
      }
    }
  ],
  "summary": {
    "byAccessType": {
      "individual": 45,
      "monthly": 12,
      "yearly": 8
    },
    "byExpiryStatus": {
      "expired": 3,
      "active": 62
    }
  },
  "pagination": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "pages": 1
  },
  "filters": {
    "status": "all",
    "search": null,
    "courseId": null,
    "departmentId": null,
    "credentialsSent": null,
    "accessType": "monthly",
    "expiryStatus": "active"
  }
}
```


---

## 8. Get Expiring Soon (Admin)

Get enrollments that will expire within a specified number of days.

**Endpoint:** `GET /admin/course-enrollments/expiring-soon`  
**Auth:** Admin Required

**Query Parameters:**
- `days` (optional): Number of days threshold (default: 7)
- `limit` (optional): Maximum results (default: 50)

**Request:**
```bash
GET /api/admin/course-enrollments/expiring-soon?days=3&limit=20
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 5,
  "daysThreshold": 3,
  "enrollments": [
    {
      "id": "uuid-here",
      "userId": 123,
      "studentName": "Jane Smith",
      "studentEmail": "jane@example.com",
      "studentPhone": "+2348087654321",
      "accessType": "monthly",
      "expiresAt": "2026-02-11T10:30:00.000Z",
      "isExpired": false,
      "daysUntilExpiry": 2,
      "accessDescription": "Monthly All-Access",
      "user": {
        "id": 123,
        "firstname": "Jane",
        "lastname": "Smith",
        "email": "jane@example.com"
      },
      "purchase": {
        "amount": 25000,
        "currency": "NGN"
      }
    }
  ]
}
```

---

## 9. Get Enrollment Statistics (Admin)

Get comprehensive enrollment statistics.

**Endpoint:** `GET /admin/course-enrollments/stats`  
**Auth:** Admin Required

**Request:**
```bash
GET /api/admin/course-enrollments/stats
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "pending": 30,
    "completed": 120,
    "completionRate": 80,
    "byAccessType": {
      "individual": 100,
      "monthly": 35,
      "yearly": 15
    },
    "expiryStats": {
      "expired": 8,
      "expiringSoon": 5,
      "active": 137
    },
    "byDepartment": [
      {
        "department": {
          "id": "uuid-here",
          "name": "Technology Courses"
        },
        "count": 75
      },
      {
        "department": {
          "id": null,
          "name": "All Courses"
        },
        "count": 50
      }
    ]
  },
  "period": "month",
  "filters": {
    "departmentId": null,
    "courseId": null
  }
}
```


---

## 10. Get Enrollment Details (Admin)

Get detailed information about a specific enrollment.

**Endpoint:** `GET /admin/course-enrollments/:id`  
**Auth:** Admin Required

**Request:**
```bash
GET /api/admin/course-enrollments/uuid-here
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "enrollment": {
    "id": "uuid-here",
    "userId": 123,
    "courseId": null,
    "purchaseId": "uuid-here",
    "studentName": "Jane Smith",
    "studentEmail": "jane@example.com",
    "studentPhone": "+2348087654321",
    "accessType": "monthly",
    "expiresAt": "2026-03-09T10:30:00.000Z",
    "isExpired": false,
    "daysUntilExpiry": 28,
    "accessDescription": "Monthly All-Access",
    "credentialsSent": true,
    "sentBy": 456,
    "sentAt": "2026-02-09T12:00:00.000Z",
    "course": null,
    "user": {
      "id": 123,
      "firstname": "Jane",
      "lastname": "Smith",
      "email": "jane@example.com"
    },
    "purchase": {
      "id": "uuid-here",
      "amount": 25000,
      "currency": "NGN",
      "paymentGateway": "paystack",
      "paymentReference": "ref_xyz789"
    },
    "adminUser": {
      "id": 456,
      "firstname": "Admin",
      "lastname": "User",
      "email": "admin@example.com"
    }
  }
}
```

**Error:** `404 Not Found`
```json
{
  "success": false,
  "message": "Enrollment not found"
}
```


---

## 11. Mark Credentials Sent (Admin)

Mark credentials as sent for a specific enrollment.

**Endpoint:** `PATCH /admin/course-enrollments/:id/mark-sent`  
**Auth:** Admin Required

**Request Body:**
```json
{
  "sent": true,
  "notes": "Access granted on third-party platform"
}
```

**Request:**
```bash
PATCH /api/admin/course-enrollments/uuid-here/mark-sent
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "sent": true,
  "notes": "Access granted"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Credentials marked as sent",
  "enrollment": {
    "id": "uuid-here",
    "credentialsSent": true,
    "sentBy": 456,
    "sentAt": "2026-02-09T12:00:00.000Z"
  },
  "previousStatus": false
}
```

---

## 12. Batch Mark Credentials Sent (Admin)

Update credentials sent status for multiple enrollments at once.

**Endpoint:** `PATCH /admin/course-enrollments/batch-mark-sent`  
**Auth:** Admin Required

**Request Body:**
```json
{
  "enrollmentIds": ["uuid-1", "uuid-2", "uuid-3"],
  "sent": true,
  "notes": "Batch access granted"
}
```

**Request:**
```bash
PATCH /api/admin/course-enrollments/batch-mark-sent
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enrollmentIds": ["uuid-1", "uuid-2", "uuid-3"],
  "sent": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Batch update completed: 3 successful, 0 failed",
  "results": {
    "successful": 3,
    "failed": 0,
    "errors": []
  }
}
```

**Error:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Array of enrollment IDs is required"
}
```


---

## 13. Export Enrollments (Admin)

Export enrollment data as CSV or JSON.

**Endpoint:** `GET /admin/course-enrollments/export`  
**Auth:** Admin Required

**Query Parameters:**
- `format` (optional): Export format ('csv' or 'json', default: 'csv')
- `credentialsSent` (optional): Filter by credentials sent (true/false)
- `courseId` (optional): Filter by course UUID
- `departmentId` (optional): Filter by department UUID
- `accessType` (optional): Filter by access type (individual/monthly/yearly)
- `expiryStatus` (optional): Filter by expiry status (active/expired/expiring_soon)
- `startDate` (optional): Filter by start date (YYYY-MM-DD)
- `endDate` (optional): Filter by end date (YYYY-MM-DD)

**Request:**
```bash
# Export expired enrollments as CSV
GET /api/admin/course-enrollments/export?format=csv&expiryStatus=expired
Authorization: Bearer <admin-token>

# Export all enrollments as JSON
GET /api/admin/course-enrollments/export?format=json
Authorization: Bearer <admin-token>
```

**Response:** CSV or JSON file download

---

# Pricing Information

## Current Pricing (Regular)

| Access Type | NGN | USD | Duration |
|------------|-----|-----|----------|
| Individual Course | ₦25,000 | $30 | Lifetime |
| Monthly All-Access | ₦35,000 | $42 | 30 days |
| Yearly All-Access | ₦280,000 | $336 | 365 days |

## Promo Pricing (with VALENTINE2025 coupon)

| Access Type | NGN | USD | Savings | Discount |
|------------|-----|-----|---------|----------|
| Individual Course | ₦20,000 | $24 | ₦5,000 / $6 | 20% |
| Monthly All-Access | ₦25,000 | $30 | ₦10,000 / $12 | 28.57% |
| Yearly All-Access | ₦250,000 | $300 | ₦30,000 / $36 | 10.71% |

**Coupon Code:** `VALENTINE2025` (case-insensitive)  
**Valid Until:** February 28, 2026 at 11:59 PM

---

# Access Types Explained

## Individual Course
- **Payment:** One-time
- **Access:** Lifetime access to ONE specific course
- **Requires:** `courseId` in request
- **Expiry:** Never expires (`expiresAt` is null)
- **Use Case:** User wants to learn a specific skill

## Monthly All-Access
- **Payment:** One-time (manual renewal)
- **Access:** 30 days access to ALL courses
- **Requires:** NO `courseId` (must be null/omitted)
- **Expiry:** 30 days from purchase
- **Use Case:** User wants to explore multiple courses

## Yearly All-Access
- **Payment:** One-time (manual renewal)
- **Access:** 365 days access to ALL courses
- **Requires:** NO `courseId` (must be null/omitted)
- **Expiry:** 365 days from purchase
- **Use Case:** Serious learner, best value

---

# Payment Flow

1. **User selects course/access type** on frontend
2. **Frontend calls** `POST /courses/purchase` with:
   - Unique `Idempotency-Key` header
   - Student details
   - Access type and currency
   - Optional coupon code
3. **Backend validates** and creates purchase record
4. **Backend returns** payment URL (Paystack or Stripe)
5. **Frontend redirects** user to payment URL
6. **User completes payment** on payment gateway
7. **Webhook receives** payment confirmation
8. **Backend creates** enrollment record
9. **Admin grants access** on third-party platform
10. **Admin marks** credentials as sent
11. **User receives** access credentials

---

# Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input or validation failed |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions (not admin) |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate purchase/enrollment |
| 500 | Internal Server Error |

---

# Testing with Postman

## Environment Variables
```
BASE_URL = http://localhost:8080/api
USER_TOKEN = your_user_jwt_token
ADMIN_TOKEN = your_admin_jwt_token
```

## Sample Test Sequence

### 1. Browse Courses
```
GET {{BASE_URL}}/courses/departments
GET {{BASE_URL}}/courses/departments/:id/courses
GET {{BASE_URL}}/courses/:id
GET {{BASE_URL}}/courses/search?q=web
```

### 2. Purchase (User)
```
POST {{BASE_URL}}/courses/purchase
Headers:
  Authorization: Bearer {{USER_TOKEN}}
  Idempotency-Key: test-{{$timestamp}}
  Content-Type: application/json
Body:
{
  "accessType": "monthly",
  "currency": "NGN",
  "couponCode": "VALENTINE2025",
  "studentName": "Test User",
  "studentEmail": "test@example.com",
  "studentPhone": "+2348012345678"
}
```

### 3. View Enrollments (User)
```
GET {{BASE_URL}}/courses/my-enrollments
Headers:
  Authorization: Bearer {{USER_TOKEN}}
```

### 4. Admin Operations
```
GET {{BASE_URL}}/admin/course-enrollments?accessType=monthly
GET {{BASE_URL}}/admin/course-enrollments/expiring-soon?days=7
GET {{BASE_URL}}/admin/course-enrollments/stats
PATCH {{BASE_URL}}/admin/course-enrollments/:id/mark-sent
Headers:
  Authorization: Bearer {{ADMIN_TOKEN}}
```

---

# Frontend Integration Notes

## 1. Idempotency Key Generation
```javascript
// Generate unique key for each purchase attempt
const idempotencyKey = `purchase-${userId}-${Date.now()}-${Math.random()}`;
```

## 2. Coupon Code Handling
- Always trim and convert to uppercase before sending
- Show discount amount and percentage to user
- Handle invalid coupon gracefully (no discount applied)

## 3. Access Type Display
```javascript
if (enrollment.courseId) {
  // Individual course
  display = enrollment.course.name;
} else {
  // Monthly/Yearly
  display = "All Courses";
}
```

## 4. Expiry Display
```javascript
if (enrollment.expiresAt) {
  // Show expiry date and days remaining
  display = `Expires in ${enrollment.daysUntilExpiry} days`;
} else {
  // Lifetime access
  display = "Lifetime Access";
}
```

## 5. Credentials Status
```javascript
if (enrollment.credentialsSent) {
  status = "Access Granted ✅";
  showAccessLink = true;
} else {
  status = "Pending Access ⏳";
  showAccessLink = false;
}
```

---

**Last Updated:** February 9, 2026  
**API Version:** 2.0  
**Status:** Production Ready
