# PFDA Contract Monitoring System - Frontend

A modern web-based contract monitoring system for the Philippine Fisheries Development Authority (PFDA) Fish Port in Bulan, Sorsogon. This frontend application provides a comprehensive interface for managing rental contracts, payments, tenants, and communications.

## 🌟 Features

### 1. **Contract Management**
- Digital storage of all rental contracts
- Contract creation, viewing, and tracking
- Support for Food Stalls (10 stalls), Market Hall Bays (39 bays), and Bañera Warehouse Bays (12 bays)
- Contract status tracking (Active, Expired, Terminated, Renewed)
- Automatic contract expiration monitoring

### 2. **Payment Monitoring**
- Payment tracking and recording
- Automatic calculation of rental fees
- Late fee and interest computation
- Payment history and receipts
- Delinquency tracking
- Payment due date reminders

### 3. **QR Code Integration**
- Unique QR code for each contract
- Displays contract details when scanned
- Shows rental space size and location map
- Printable QR code cards for tenants

### 4. **Email Notifications**
- Automatic monthly payment reminders
- Contract renewal notifications
- Payment due and overdue alerts
- Contract expiration warnings

### 5. **Chat/Messaging System**
- Real-time communication between staff and tenants
- Message inbox and compose functionality
- Read/unread status tracking
- Broadcast messaging capability

### 6. **Reports Generation**
- Active contracts report
- Expired contracts report
- Delinquent contracts report
- Payment history report
- Revenue summary
- Space occupancy report
- Export to PDF and Excel

### 7. **Audit Trail**
- Tracks all user actions
- Records who viewed or edited records
- IP address and timestamp logging
- Complete activity history

### 8. **Search and Filter**
- Advanced search across contracts, tenants, and payments
- Filter by status, date range, space type
- Quick access to specific records

### 9. **Dashboard Overview**
- Real-time statistics and metrics
- Recent payments display
- Expiring contracts alerts
- Quick action buttons
- Revenue tracking

### 10. **User Management**
- Role-based access (Admin, Staff, Tenant)
- Tenant profile management
- Contact information tracking
- User authentication and authorization

## 🛠️ Technology Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Authentication:** Custom JWT-based auth with Context API
- **State Management:** React Context API
- **HTTP Client:** Fetch API
- **Form Handling:** React Hook Form with Zod validation
- **Icons:** Emoji-based icons for lightweight performance

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn
- Backend API server running (separate repository)

## 🚀 Getting Started

### 1. Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd contract_monitoring

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Application Configuration
NEXT_PUBLIC_APP_NAME=PFDA Contract Monitoring System
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Semaphore SMS Configuration (server-side only)
SEMAPHORE_API_KEY=your-semaphore-api-key
SEMAPHORE_SENDER_NAME=PFDA
```

For production on Vercel, set `NEXT_PUBLIC_API_URL` to the Render API URL,
including `/api` (currently `https://backend-monitoring2.onrender.com/api`).
The production API URL is also the default in the frontend, so the Vercel
project can build without a separate API environment variable. Set
`NEXT_PUBLIC_API_URL` in Vercel only if the backend URL changes.

### 3. Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Building for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
contract_monitoring/
├── app/                          # Next.js App Router
│   ├── dashboard/               # Dashboard pages
│   │   ├── contracts/          # Contract management
│   │   ├── payments/           # Payment tracking
│   │   ├── tenants/            # Tenant management
│   │   ├── spaces/             # Rental spaces
│   │   ├── messages/           # Chat system
│   │   ├── reports/            # Reports generation
│   │   ├── notifications/      # Notifications
│   │   └── audit-logs/         # Audit trail
│   ├── login/                  # Authentication
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (redirects)
│   └── globals.css             # Global styles
├── components/                  # Reusable components
│   └── ProtectedRoute.tsx      # Auth guard
├── contexts/                    # React contexts
│   └── AuthContext.tsx         # Authentication state
├── lib/                         # Utilities
│   └── api-client.ts           # API client
├── types/                       # TypeScript types
│   └── index.ts                # Type definitions
└── public/                      # Static assets
```

## 🔐 Authentication

The system uses JWT-based authentication. Users must log in to access the dashboard.

**Default Admin Credentials** (when backend is seeded):
- Email: `admin@pfda-bulan.gov.ph`
- Password: `admin123`

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop browsers (1920x1080 and above)
- Tablets (768px and above)
- Mobile devices (375px and above)

## 🎨 User Interface

### Color Scheme
- **Primary:** Blue (#2563EB)
- **Success:** Green (#10B981)
- **Warning:** Orange/Yellow (#F59E0B)
- **Danger:** Red (#EF4444)
- **Info:** Cyan (#06B6D4)

### Components
- Sidebar navigation with collapsed mobile view
- Modal dialogs for forms
- Toast notifications for feedback
- Data tables with sorting and filtering
- Cards for data display
- Forms with validation

## 🔗 API Integration

The frontend communicates with the backend via REST API. All endpoints are prefixed with the `NEXT_PUBLIC_API_URL` environment variable.

### API Client (`lib/api-client.ts`)

The API client handles:
- HTTP requests to backend
- JWT token management
- Request/response interceptors
- Error handling

## 📄 Available Pages

### Public Pages
- `/login` - User login

### Protected Pages
- `/dashboard` - Main dashboard with statistics
- `/dashboard/contracts` - Contract list and management
- `/dashboard/contracts/[id]` - Contract details
- `/dashboard/contracts/[id]/qr` - QR code display
- `/dashboard/payments` - Payment tracking
- `/dashboard/tenants` - Tenant management
- `/dashboard/spaces` - Rental spaces overview
- `/dashboard/messages` - Chat/messaging system
- `/dashboard/reports` - Report generation
- `/dashboard/notifications` - System notifications
- `/dashboard/audit-logs` - Audit trail (Admin/Staff only)

## 🧪 Development

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting (optional)

### Best Practices
- Use TypeScript interfaces for all data structures
- Implement error boundaries
- Add loading states for async operations
- Use proper semantic HTML
- Follow accessibility guidelines

## 🔧 Configuration

### Tailwind CSS
Configured in `tailwind.config.ts` with custom colors and utilities.

### TypeScript
Configured in `tsconfig.json` with strict mode enabled.

### Next.js
Configured in `next.config.ts` for optimal performance.

## 📊 Features Detail

### Contract Management
- Create contracts with tenant and space selection
- View contract details with complete information
- Generate QR codes for each contract
- Track contract status and expiration
- Automatic status updates

### Payment System
- Record payments with receipt generation
- Calculate late fees based on interest rate
- Track payment status (Paid, Pending, Overdue)
- Payment history for each contract
- Automatic overdue detection

### QR Code System
- Generate unique QR codes per contract
- Display contract info and space map
- Printable QR cards
- Downloadable QR images

### Notification System
- Email reminders for payment due dates
- Contract expiration alerts
- Renewal reminders
- Delinquency notifications

### Reporting
- Export reports to PDF/Excel (backend integration)
- Filter reports by date range
- Multiple report types
- Printable reports

## 🚧 Roadmap

- [ ] Mobile app version
- [ ] Real-time chat updates (WebSocket)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Calendar view for contracts
- [ ] Bulk operations for contracts
- [ ] Document upload for contracts

## 📞 Support

For issues, questions, or feature requests, contact:
- **Philippine Fisheries Development Authority**
- Fish Port, Bulan, Sorsogon
- Email: admin@pfda-bulan.gov.ph

## 📜 License

Copyright © 2026 PFDA Bulan, Sorsogon. All rights reserved.

## 👥 Credits

Developed for the Philippine Fisheries Development Authority (PFDA) Fish Port in Bulan, Sorsogon to modernize and streamline contract monitoring and rental space management.

---

**Note:** This is the frontend application. You need a separate backend API server for full functionality. Refer to the backend repository for API documentation and setup instructions.
