// Type definitions for the PFDA Contract Monitoring System

export type UserRole = 'ADMIN' | 'STAFF' | 'TENANT'

export interface User {
  id?: string
  name?: string
  email?: string
  firstName?: string
  lastName?: string
  contact_person?: string
  contactPerson?: string
  business_name?: string
  businessName?: string
  business_address?: string
  businessAddress?: string
  business_type?: string
  businessType?: string
  businessPermitNumber?: string
  business_permit_number?: string
  tin?: string
  tenant_code?: string
  tenantCode?: string
  role?: UserRole
  phone?: string
  contactNumber?: string
  contact_number?: string
  address?: string
  status?: string
  user?: User
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type SpaceStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'

export interface RentalSpaceType {
  id: string
  name: string
  description?: string
  baseRatePerSqm: number
  totalSpaces: number
  createdAt: string
  updatedAt: string
}

export interface RentalSpace {
  id: string
  spaceNumber?: string
  space_number?: string
  name?: string
  typeId?: string
  type?: RentalSpaceType
  squareMeters?: number
  size_sqm?: number
  location?: string
  spaceCode?: string
  space_code?: string
  spaceType?: string
  space_type?: string
  sizeSqm?: number
  status?: SpaceStatus
  base_rental_rate?: number
  baseRentalRate?: number
  rental_amount?: number
  rentalAmount?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type ContractStatus = 'ACTIVE' | 'FOR_RENEWAL' | 'EXPIRED' | 'TERMINATED' | 'RENEWED' | 'PENDING'

export interface Contract {
  id?: string
  contractNumber?: string
  contract_number?: string
  tenantId?: string
  tenant_id?: string
  tenant?: User
  rentalSpaceId?: string
  rental_space_id?: string
  rentalSpace?: RentalSpace
  rental_space?: RentalSpace
  startDate?: string
  start_date?: string
  endDate?: string
  end_date?: string
  monthlyRent?: number
  monthlyRental?: number
  monthly_rental?: number
  monthly_rent?: number
  securityDeposit?: number
  depositAmount?: number
  deposit_amount?: number
  security_deposit?: number
  interestRate?: number
  interest_rate?: number
  status?: ContractStatus | 'active' | 'active' | string
  qrCode?: string
  qr_code?: string
  terms?: string
  termsConditions?: string
  terms_conditions?: string
  notes?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  payments?: Payment[]
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL' | 'DELINQUENT'

export interface Payment {
  id?: string
  contractId?: string
  contract_id?: string
  contract?: Contract
  tenantId?: string
  tenant_id?: string
  tenant?: User
  amount?: number
  amount_due?: number
  amountDue?: number
  amount_paid?: number
  amountPaid?: number
  paymentDate?: string
  payment_date?: string
  dueDate?: string
  due_date?: string
  paymentFor?: string
  payment_for?: string
  paymentMethod?: string
  payment_method?: string
  paymentNumber?: string
  payment_number?: string
  referenceNumber?: string
  reference_number?: string
  balance?: number | string
  lateFee?: number
  late_fee?: number
  interest?: number
  interest_amount?: number
  interestAmount?: number
  totalAmount?: number
  total_amount?: number
  status?: PaymentStatus
  receiptNumber?: string
  receipt_number?: string
  remarks?: string
  notes?: string
  billingPeriodStart?: string
  billing_period_start?: string
  billingPeriodEnd?: string
  billing_period_end?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  demandLetters?: DemandLetter[]
  demand_letters?: DemandLetter[]
}

export type DemandLetterStatus = 'issued' | 'sent' | 'paid' | 'cancelled'

export interface DemandLetter {
  id?: string
  demandNumber?: string
  demand_number?: string
  contractId?: string
  contract_id?: string
  contract?: Contract
  tenantId?: string
  tenant_id?: string
  tenant?: User
  paymentId?: string
  payment_id?: string
  payment?: Payment
  outstandingBalance?: number
  outstanding_balance?: number
  totalAmountDemanded?: number
  total_amount_demanded?: number
  issuedDate?: string
  issued_date?: string
  dueDate?: string
  due_date?: string
  status?: DemandLetterStatus
  emailSentTo?: string
  email_sent_to?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type NotificationType = 
  | 'PAYMENT_DUE' 
  | 'PAYMENT_OVERDUE' 
  | 'CONTRACT_RENEWAL' 
  | 'CONTRACT_EXPIRING'

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface Notification {
  id: string
  contractId: string
  contract?: Contract
  type: NotificationType
  subject: string
  message: string
  sentDate?: string
  status: NotificationStatus
  createdAt: string
}

export interface Message {
  id?: string
  senderId?: string
  sender_id?: string
  sender?: User
  receiverId?: string
  receiver_id?: string
  receiver?: User
  subject?: string
  content?: string
  isRead?: boolean
  is_read?: boolean
  createdAt?: string | null
  created_at?: string | null
  deliveryStatus?: string | null
  delivery_status?: string | null
  smsStatus?: string | null
  sms_status?: string | null
  smsMessageId?: string | null
  sms_message_id?: string | null
}

export interface AuditLog {
  id?: string
  userId?: string
  user_id?: string
  user?: User
  action?: string
  entity?: string
  entityId?: string
  entity_id?: string
  oldValues?: string
  old_values?: string
  newValues?: string
  new_values?: string
  ipAddress?: string
  ip_address?: string
  userAgent?: string
  user_agent?: string
  createdAt?: string
  created_at?: string
}

export interface DashboardStats {
  totalContracts?: number
  activeContracts?: number
  renewalContracts?: number
  expiredContracts?: number
  delinquentContracts?: number
  terminatedContracts?: number
  totalRevenue?: number
  monthlyRevenue?: number
  pendingPayments?: number
  overduePayments?: number
  partialPayments?: number
  delinquentTenants?: number
  availableSpaces?: number
  occupiedSpaces?: number
  totalRentalSpaces?: number
  totalTenants?: number
  recentPayments?: Payment[]
  expiringContracts?: Contract[]
  renewalContractsList?: Contract[]
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}
