import { pgTable, text, timestamp, integer, boolean, varchar, decimal, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- FOUNDATION ---

export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: varchar('role', { length: 50 }).notNull(), // ceo, business_head, sales_head, sales_manager, sales_executive, finance_controller, inventory_manager, service_engineer, dealer
    dealer_id: varchar('dealer_id', { length: 255 }), // Manually link to accounts.id
    phone: text('phone'),
    avatar_url: text('avatar_url'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- PHASE 0: MVP ---

export const productCatalog = pgTable('product_catalog', {
    id: varchar('id', { length: 255 }).primaryKey(), // PCAT-YYYYMMDD-SEQ
    hsn_code: varchar('hsn_code', { length: 8 }).notNull(),
    asset_category: varchar('asset_category', { length: 20 }).notNull(), // 2W, 3W, Inverter
    asset_type: varchar('asset_type', { length: 50 }).notNull(), // Charger, Battery, SOC, Harness, Inverter
    model_type: text('model_type').notNull(),
    is_serialized: boolean('is_serialized').default(true).notNull(),
    warranty_months: integer('warranty_months').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    disabled_at: timestamp('disabled_at', { withTimezone: true }),
    disabled_by: uuid('disabled_by').references(() => users.id),
});

export const oems = pgTable('oems', {
    id: varchar('id', { length: 255 }).primaryKey(), // OEM-YYYYMMDD-SEQ
    business_entity_name: text('business_entity_name').notNull(),
    gstin: varchar('gstin', { length: 15 }).notNull().unique(),
    pan: varchar('pan', { length: 10 }),
    address_line1: text('address_line1'),
    address_line2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    pincode: varchar('pincode', { length: 6 }),
    bank_name: text('bank_name'),
    bank_account_number: text('bank_account_number').notNull(),
    ifsc_code: varchar('ifsc_code', { length: 11 }).notNull(),
    bank_proof_url: text('bank_proof_url'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const oemContacts = pgTable('oem_contacts', {
    id: varchar('id', { length: 255 }).primaryKey(), // OEM_ID-ROLE_SEQ
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id, { onDelete: 'cascade' }).notNull(),
    contact_role: varchar('contact_role', { length: 50 }).notNull(), // sales_head, sales_manager, finance_manager
    contact_name: text('contact_name').notNull(),
    contact_phone: varchar('contact_phone', { length: 20 }).notNull(),
    contact_email: text('contact_email').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventory = pgTable('inventory', {
    id: varchar('id', { length: 255 }).primaryKey(), // INV-YYYYMMDD-XXX
    product_id: varchar('product_id', { length: 255 }).references(() => productCatalog.id).notNull(),
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id).notNull(),

    // Denormalized Product Details (SOP 7.4)
    oem_name: text('oem_name').notNull(),
    asset_category: text('asset_category').notNull(),
    asset_type: text('asset_type').notNull(),
    model_type: text('model_type').notNull(),

    // Serialization
    is_serialized: boolean('is_serialized').default(true).notNull(),
    serial_number: varchar('serial_number', { length: 255 }).unique(),
    batch_number: varchar('batch_number', { length: 255 }),
    quantity: integer('quantity'),

    // Dates
    manufacturing_date: timestamp('manufacturing_date', { withTimezone: true }).notNull(),
    expiry_date: timestamp('expiry_date', { withTimezone: true }).notNull(),

    // Financials
    inventory_amount: decimal('inventory_amount', { precision: 12, scale: 2 }).notNull(),
    gst_percent: decimal('gst_percent', { precision: 5, scale: 2 }).notNull(),
    gst_amount: decimal('gst_amount', { precision: 12, scale: 2 }).notNull(),
    final_amount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),

    // Invoicing
    oem_invoice_number: text('oem_invoice_number').notNull(),
    oem_invoice_date: timestamp('oem_invoice_date', { withTimezone: true }).notNull(),
    oem_invoice_url: text('oem_invoice_url'),

    // Documents
    product_manual_url: text('product_manual_url'),
    warranty_document_url: text('warranty_document_url'),

    // Status
    status: varchar('status', { length: 20 }).default('in_transit').notNull(), // in_transit, pdi_pending, pdi_failed, available, reserved, sold, damaged, returned
    warehouse_location: text('warehouse_location'),

    // Metadata
    created_by: uuid('created_by').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- DEALER SALES ---

export const leads = pgTable('leads', {
    id: varchar('id', { length: 255 }).primaryKey(), // LEAD-YYYYMMDD-SEQ
    lead_source: varchar('lead_source', { length: 50 }).notNull(), // call_center, ground_sales, digital_marketing, database_upload, dealer_referral
    interest_level: varchar('interest_level', { length: 20 }).default('cold').notNull(), // cold, warm, hot
    lead_status: varchar('lead_status', { length: 50 }).default('new').notNull(), // new, assigned, contacted, qualified, converted, lost
    dealer_id: varchar('dealer_id', { length: 255 }).references(() => accounts.id), // Scoped to dealer org

    // Dealer Info
    owner_name: text('owner_name').notNull(),
    owner_contact: varchar('owner_contact', { length: 20 }).notNull(),
    business_name: text('business_name'),
    owner_email: text('owner_email'),

    // Location
    state: varchar('state', { length: 100 }), // can be nullable now if not always provided
    city: varchar('city', { length: 100 }),   // can be nullable
    shop_address: text('shop_address'),

    // Extended Attributes (Dealer Portal)
    mobile: varchar('mobile', { length: 20 }),
    permanent_address: text('permanent_address'),
    vehicle_ownership: varchar('vehicle_ownership', { length: 50 }),
    battery_type: varchar('battery_type', { length: 50 }),
    asset_model: text('asset_model'),
    asset_price: decimal('asset_price', { precision: 12, scale: 2 }),
    family_members: integer('family_members'),
    driving_experience: integer('driving_experience'),
    lead_type: varchar('lead_type', { length: 20 }), // hot, warm, cold
    vehicle_rc: varchar('vehicle_rc', { length: 50 }),

    // V2 Step 1 Mapping (Additive)
    full_name: text('full_name'),
    father_or_husband_name: text('father_or_husband_name'),
    dob: timestamp('dob', { withTimezone: true }),
    phone: varchar('phone', { length: 20 }),
    current_address: text('current_address'),
    is_current_same: boolean('is_current_same').notNull().default(false),
    product_category_id: varchar('product_category_id', { length: 255 }), // Changed from uuid to match catalog
    product_type_id: varchar('product_type_id', { length: 255 }), // Added for Step 1 selection
    vehicle_owner_name: text('vehicle_owner_name'),
    vehicle_owner_phone: varchar('vehicle_owner_phone', { length: 20 }),
    auto_filled: boolean('auto_filled').default(false).notNull(),
    ocr_status: varchar('ocr_status', { length: 20 }), // success, partial, failed
    ocr_error: text('ocr_error'),
    reference_id: varchar('reference_id', { length: 255 }).unique(),

    // Business Details
    interested_in: jsonb('interested_in'), // Array of product IDs
    battery_order_expected: integer('battery_order_expected'),
    investment_capacity: decimal('investment_capacity', { precision: 12, scale: 2 }),
    business_type: varchar('business_type', { length: 50 }), // retail, wholesale, distributor

    // Qualification
    qualified_by: uuid('qualified_by').references(() => users.id),
    qualified_at: timestamp('qualified_at', { withTimezone: true }),
    qualification_notes: text('qualification_notes'),

    // Conversion
    converted_deal_id: varchar('converted_deal_id', { length: 255 }),
    converted_at: timestamp('converted_at', { withTimezone: true }),

    // AI Call tracking
    total_ai_calls: integer('total_ai_calls').default(0),
    last_ai_call_at: timestamp('last_ai_call_at', { withTimezone: true }),
    last_call_outcome: text('last_call_outcome'),
    ai_priority_score: decimal('ai_priority_score', { precision: 5, scale: 2 }),
    next_call_after: timestamp('next_call_after', { withTimezone: true }),
    do_not_call: boolean('do_not_call').default(false),

    // V2 Workflow
    status: varchar('status', { length: 50 }).default('INCOMPLETE').notNull(), // INCOMPLETE, ACTIVE, CONVERTED, ABANDONED
    workflow_step: integer('workflow_step').default(1).notNull(),
    primary_product_id: varchar('primary_product_id', { length: 255 }).references(() => productCatalog.id),
    lead_score: integer('lead_score'), // hot=90, warm=60, cold=30

    // Metadata
    uploader_id: uuid('uploader_id').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        leadsSourceIdx: index('leads_source_idx').on(table.lead_source),
        leadsInterestIdx: index('leads_interest_idx').on(table.interest_level),
        leadsStatusIdx: index('leads_status_idx').on(table.lead_status),
    };
});

export const loanDetails = pgTable('loan_details', {
    id: uuid('id').defaultRandom().primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    loan_required: boolean('loan_required').default(false),
    loan_amount: decimal('loan_amount', { precision: 12, scale: 2 }),
    interest_rate: decimal('interest_rate', { precision: 5, scale: 2 }),
    tenure_months: integer('tenure_months'),
    processing_fee: decimal('processing_fee', { precision: 10, scale: 2 }),
    emi: decimal('emi', { precision: 10, scale: 2 }),
    down_payment: decimal('down_payment', { precision: 12, scale: 2 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const personalDetails = pgTable('personal_details', {
    id: uuid('id').defaultRandom().primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    aadhaar_no: varchar('aadhaar_no', { length: 20 }),
    pan_no: varchar('pan_no', { length: 20 }),
    dob: timestamp('dob', { withTimezone: true }), // Using timestamp for date
    email: text('email'),
    income: decimal('income', { precision: 12, scale: 2 }),
    finance_type: varchar('finance_type', { length: 50 }),
    financier: varchar('financier', { length: 100 }),
    asset_type: varchar('asset_type', { length: 50 }), // 2W, 3W
    vehicle_rc: varchar('vehicle_rc', { length: 50 }),
    loan_type: varchar('loan_type', { length: 100 }),
    father_husband_name: text('father_husband_name'),
    marital_status: varchar('marital_status', { length: 20 }),
    spouse_name: text('spouse_name'),
    local_address: text('local_address'),

    // OCR Confidence
    dob_confidence: decimal('dob_confidence', { precision: 5, scale: 2 }),
    name_confidence: decimal('name_confidence', { precision: 5, scale: 2 }),
    address_confidence: decimal('address_confidence', { precision: 5, scale: 2 }),
    ocr_processed_at: timestamp('ocr_processed_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


export const documents = pgTable('documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    document_type: varchar('document_type', { length: 50 }).notNull(),
    file_url: text('file_url').notNull(),
    uploaded_at: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leadDocuments = pgTable('lead_documents', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    dealer_id: varchar('dealer_id', { length: 255 }).references(() => accounts.id),
    user_id: uuid('user_id').references(() => users.id),
    doc_type: varchar('doc_type', { length: 100 }).notNull(),
    storage_path: text('storage_path').notNull(), // private/dealer_id/lead_id/filename
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leadAssignments = pgTable('lead_assignments', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),
    lead_owner: uuid('lead_owner').references(() => users.id).notNull(), // Sales Head MUST assign
    assigned_by: uuid('assigned_by').references(() => users.id).notNull(),
    assigned_at: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),

    // Lead Actor (Owner or Sales Head can assign)
    lead_actor: uuid('lead_actor').references(() => users.id),
    actor_assigned_by: uuid('actor_assigned_by').references(() => users.id),
    actor_assigned_at: timestamp('actor_assigned_at', { withTimezone: true }),

    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assignmentChangeLogs = pgTable('assignment_change_logs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),
    change_type: varchar('change_type', { length: 50 }).notNull(), // owner_assigned, owner_changed, actor_assigned, actor_changed, actor_removed
    old_user_id: uuid('old_user_id').references(() => users.id),
    new_user_id: uuid('new_user_id').references(() => users.id),
    changed_by: uuid('changed_by').references(() => users.id).notNull(),
    change_reason: text('change_reason'),
    changed_at: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deals = pgTable('deals', {
    id: varchar('id', { length: 255 }).primaryKey(), // DEAL-YYYYMMDD-XXX
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),

    // Products & Pricing
    products: jsonb('products').notNull(), // Array of { product_id, quantity, unit_price, gst_percent }
    line_total: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
    gst_amount: decimal('gst_amount', { precision: 12, scale: 2 }).notNull(),
    transportation_cost: decimal('transportation_cost', { precision: 10, scale: 2 }).default('0').notNull(),
    transportation_gst_percent: integer('transportation_gst_percent').default(18).notNull(),
    total_payable: decimal('total_payable', { precision: 12, scale: 2 }).notNull(),

    // Payment Terms
    payment_term: varchar('payment_term', { length: 20 }).notNull(), // cash, credit
    credit_period_months: integer('credit_period_months'),

    // Status
    deal_status: varchar('deal_status', { length: 50 }).default('pending_approval_l1').notNull(), // pending_approval_l1, pending_approval_l2, pending_approval_l3, approved, rejected, payment_awaited, converted, expired

    // Immutability (after invoice)
    is_immutable: boolean('is_immutable').default(false).notNull(),
    invoice_number: text('invoice_number'),
    invoice_url: text('invoice_url'),
    invoice_issued_at: timestamp('invoice_issued_at', { withTimezone: true }),

    // Expiry
    expires_at: timestamp('expires_at', { withTimezone: true }),
    expired_by: uuid('expired_by').references(() => users.id),
    expired_at: timestamp('expired_at', { withTimezone: true }),
    expiry_reason: text('expiry_reason'),

    // Rejection
    rejected_by: uuid('rejected_by').references(() => users.id),
    rejected_at: timestamp('rejected_at', { withTimezone: true }),
    rejection_reason: text('rejection_reason'),

    created_by: uuid('created_by').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable('approvals', {
    id: varchar('id', { length: 255 }).primaryKey(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(), // deal, order, provision
    entity_id: varchar('entity_id', { length: 255 }).notNull(),

    level: integer('level').notNull(), // 1, 2, 3
    approver_role: varchar('approver_role', { length: 50 }).notNull(), // sales_head, business_head, finance_controller

    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, rejected

    approver_id: uuid('approver_id').references(() => users.id),
    decision_at: timestamp('decision_at', { withTimezone: true }),
    rejection_reason: text('rejection_reason'),
    comments: text('comments'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderDisputes = pgTable('order_disputes', {
    id: varchar('id', { length: 255 }).primaryKey(), // DISP-YYYYMMDD-SEQ
    order_id: varchar('order_id', { length: 255 }).references(() => orders.id).notNull(),
    dispute_type: varchar('dispute_type', { length: 50 }).notNull(), // damage, shortage, delivery_failure
    description: text('description').notNull(),
    photos_urls: jsonb('photos_urls'), // Array of photo URLs
    assigned_to: uuid('assigned_to').references(() => users.id).notNull(),
    resolution_status: varchar('resolution_status', { length: 50 }).default('open').notNull(), // open, investigating, resolved, closed
    resolution_details: text('resolution_details'), // Added from SOP 9.6
    action_taken: text('action_taken'),           // Added from SOP 9.6
    resolved_by: uuid('resolved_by').references(() => users.id),
    resolved_at: timestamp('resolved_at'),
    created_by: uuid('created_by').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const slas = pgTable('slas', {
    id: varchar('id', { length: 255 }).primaryKey(),
    workflow_step: varchar('workflow_step', { length: 100 }).notNull(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: varchar('entity_id', { length: 255 }).notNull(),
    assigned_to: uuid('assigned_to').references(() => users.id),
    sla_deadline: timestamp('sla_deadline').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(), // active, completed, breached
    completed_at: timestamp('completed_at'),
    escalated_to: uuid('escalated_to').references(() => users.id),
    escalated_at: timestamp('escalated_at'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- PDI ---

export const oemInventoryForPDI = pgTable('oem_inventory_for_pdi', {
    id: varchar('id', { length: 255 }).primaryKey(), // PDIREQ-YYYYMMDD-XXX
    provision_id: varchar('provision_id', { length: 255 }).notNull(),
    inventory_id: varchar('inventory_id', { length: 255 }).references(() => inventory.id).notNull(),
    serial_number: varchar('serial_number', { length: 255 }),
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id).notNull(),
    pdi_status: varchar('pdi_status', { length: 20 }).default('pending').notNull(), // pending, in_progress, completed
    pdi_record_id: varchar('pdi_record_id', { length: 255 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pdiRecords = pgTable('pdi_records', {
    id: varchar('id', { length: 255 }).primaryKey(), // PDI-YYYYMMDD-XXX
    oem_inventory_id: varchar('oem_inventory_id', { length: 255 }).references(() => oemInventoryForPDI.id).notNull(),
    provision_id: varchar('provision_id', { length: 255 }).notNull(),
    service_engineer_id: uuid('service_engineer_id').references(() => users.id).notNull(),

    // Physical Inspection
    iot_imei_no: varchar('iot_imei_no', { length: 255 }),
    physical_condition: text('physical_condition').notNull(), // OK - No issues, Minor scratches, Damaged exterior, Severely damaged
    discharging_connector: varchar('discharging_connector', { length: 20 }).notNull(), // SB75, SB50
    charging_connector: varchar('charging_connector', { length: 20 }).notNull(), // SB75, SB50
    productor_sticker: varchar('productor_sticker', { length: 50 }).notNull(), // Available - damage, Available - OK, Unavailable

    // Technical Fields
    voltage: decimal('voltage', { precision: 5, scale: 2 }),
    soc: integer('soc'),
    capacity_ah: decimal('capacity_ah', { precision: 6, scale: 2 }),
    resistance_mohm: decimal('resistance_mohm', { precision: 6, scale: 2 }),
    temperature_celsius: decimal('temperature_celsius', { precision: 5, scale: 2 }),

    // GPS
    latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
    longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
    location_address: text('location_address'),

    // Documents
    product_manual_url: text('product_manual_url'),
    warranty_document_url: text('warranty_document_url'),
    pdi_photos: jsonb('pdi_photos'),

    // Result
    pdi_status: varchar('pdi_status', { length: 20 }).notNull(), // pass, fail
    failure_reason: text('failure_reason'),

    inspected_at: timestamp('inspected_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
    id: varchar('id', { length: 255 }).primaryKey(), // AUDIT-YYYYMMDD-SEQ
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: varchar('entity_id', { length: 255 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(), // create, update, delete, approve, reject, assign, complete
    changes: jsonb('changes'),
    performed_by: uuid('performed_by').references(() => users.id).notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// --- ACCOUNTS ---

export const accounts = pgTable('accounts', {
    id: varchar('id', { length: 255 }).primaryKey(), // ACC-YYYYMMDD-XXX
    business_name: text('business_name').notNull(),
    owner_name: text('owner_name').notNull(),
    email: text('email'),
    phone: varchar('phone', { length: 20 }),
    gstin: varchar('gstin', { length: 15 }),
    billing_address: text('billing_address'),
    shipping_address: text('shipping_address'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    last_order_fulfilled_at: timestamp('last_order_fulfilled_at', { withTimezone: true }),
});

// --- PROCUREMENT ---

export const provisions = pgTable('provisions', {
    id: varchar('id', { length: 255 }).primaryKey(), // PROV-YYYYMMDD-XXX
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id).notNull(),
    oem_name: text('oem_name').notNull(),
    products: jsonb('products').notNull(), // Array of { product_id, quantity }
    expected_delivery_date: timestamp('expected_delivery_date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, acknowledged, in_production, ready_for_pdi, completed, cancelled
    remarks: text('remarks'),
    created_by: uuid('created_by').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
    id: varchar('id', { length: 255 }).primaryKey(), // ORD-YYYYMMDD-XXX
    provision_id: varchar('provision_id', { length: 255 }).references(() => provisions.id).notNull(),
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id).notNull(),
    account_id: varchar('account_id', { length: 255 }).references(() => accounts.id),

    // Order items
    order_items: jsonb('order_items').notNull(), // Array of { inventory_id, serial_number, amount }
    total_amount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),

    payment_term: varchar('payment_term', { length: 20 }).notNull(), // advance, credit
    credit_period_days: integer('credit_period_days'),

    // Documents
    pi_url: text('pi_url'),
    pi_amount: decimal('pi_amount', { precision: 12, scale: 2 }),
    invoice_url: text('invoice_url'),
    grn_id: text('grn_id'),
    grn_date: timestamp('grn_date', { withTimezone: true }),

    // Payment Tracking
    payment_status: varchar('payment_status', { length: 20 }).default('unpaid').notNull(), // unpaid, partial, paid
    payment_amount: decimal('payment_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    payment_mode: varchar('payment_mode', { length: 50 }),
    transaction_id: text('transaction_id'),
    payment_date: timestamp('payment_date', { withTimezone: true }),

    // Status
    order_status: varchar('order_status', { length: 50 }).default('pi_awaited').notNull(), // pi_awaited, pi_approval_pending, pi_approved, pi_rejected, payment_made, in_transit, delivered, cancelled
    delivery_status: varchar('delivery_status', { length: 20 }).default('pending').notNull(), // pending, in_transit, delivered, failed

    // Dates
    expected_delivery_date: timestamp('expected_delivery_date', { withTimezone: true }),
    actual_delivery_date: timestamp('actual_delivery_date', { withTimezone: true }),

    created_by: uuid('created_by').references(() => users.id).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        ordersCreatedAtIdx: index('orders_created_at_idx').on(table.created_at),
        ordersPaymentStatusIdx: index('orders_payment_status_idx').on(table.payment_status),
    };
});

export const bolnaCalls = pgTable('bolna_calls', {
    id: varchar('id', { length: 255 }).primaryKey(),
    bolna_call_id: varchar('bolna_call_id', { length: 255 }).notNull().unique(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id),
    status: varchar('status', { length: 20 }).default('initiated').notNull(),
    current_phase: varchar('current_phase', { length: 100 }),
    started_at: timestamp('started_at', { withTimezone: true }),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    transcript_chunk: text('transcript_chunk'),
    chunk_received_at: timestamp('chunk_received_at', { withTimezone: true }),
    full_transcript: text('full_transcript'),
    transcript_fetched_at: timestamp('transcript_fetched_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        bolnaCallIdIdx: index('bolna_calls_bolna_call_id_idx').on(table.bolna_call_id),
        leadIdIdx: index('bolna_calls_lead_id_idx').on(table.lead_id),
        statusIdx: index('bolna_calls_status_idx').on(table.status),
        startedAtIdx: index('bolna_calls_started_at_idx').on(table.started_at),
    };
});

export const aiCallLogs = pgTable('ai_call_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),
    call_id: varchar('call_id', { length: 255 }).notNull().unique(),
    agent_id: varchar('agent_id', { length: 255 }),
    phone_number: varchar('phone_number', { length: 20 }),
    transcript: text('transcript'),
    summary: text('summary'),
    recording_url: text('recording_url'),
    call_duration: integer('call_duration'), // in seconds
    status: varchar('status', { length: 50 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        aiCallLogsLeadIdIdx: index('ai_call_logs_lead_id_idx').on(table.lead_id),
        aiCallLogsCallIdIdx: index('ai_call_logs_call_id_idx').on(table.call_id),
    };
});

// --- AI CALLS ---

export const callSessions = pgTable('call_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    session_id: text('session_id').unique(), // External ID
    status: text('status').default('active'), // active, completed
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
});

export const callRecords = pgTable('call_records', {
    id: varchar('id', { length: 255 }).primaryKey(),
    session_id: text('session_id').references(() => callSessions.session_id),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id),
    bolna_call_id: varchar('bolna_call_id', { length: 255 }).unique(),
    status: text('status').default('queued'), // queued, ringing, completed, failed
    duration_seconds: integer('duration_seconds'),
    recording_url: text('recording_url'),
    summary: text('summary'),
    transcript: text('transcript'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    ended_at: timestamp('ended_at', { withTimezone: true }),
});

export const conversationMessages = pgTable('conversation_messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    call_record_id: varchar('call_record_id', { length: 255 }).references(() => callRecords.id), // Link to record
    role: text('role'), // 'user', 'assistant'
    message: text('message'),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    productsCreated: many(productCatalog, { relationName: 'product_creator' }),
    oemsCreated: many(oems, { relationName: 'oem_creator' }),
    inventoryCreated: many(inventory, { relationName: 'inventory_creator' }),
    leadsUploaded: many(leads, { relationName: 'lead_uploader' }),
    assignmentsReceived: many(leadAssignments, { relationName: 'assigned_to_user' }),
    assignmentsGiven: many(leadAssignments, { relationName: 'assigned_by_user' }),
    dealsCreated: many(deals, { relationName: 'deal_creator' }),
    approvalsHandled: many(approvals, { relationName: 'approver_user' }),
    slasAssigned: many(slas, { relationName: 'sla_assigned' }),
    slasEscalatedTo: many(slas, { relationName: 'sla_escalated' }),
    leadsQualified: many(leads, { relationName: 'qualified_by_user' }),
    pdiInspections: many(pdiRecords, { relationName: 'pdi_service_engineer' }),
    campaigns: many(campaigns),
    loanApplications: many(loanApplications),
}));

export const productCatalogRelations = relations(productCatalog, ({ one, many }) => ({
    creator: one(users, { fields: [productCatalog.created_by], references: [users.id], relationName: 'product_creator' }),
    inventories: many(inventory),
}));

export const oemsRelations = relations(oems, ({ one, many }) => ({
    creator: one(users, { fields: [oems.created_by], references: [users.id], relationName: 'oem_creator' }),
    contacts: many(oemContacts),
}));

export const oemContactsRelations = relations(oemContacts, ({ one }) => ({
    oem: one(oems, { fields: [oemContacts.oem_id], references: [oems.id] }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
    product: one(productCatalog, { fields: [inventory.product_id], references: [productCatalog.id] }),
    creator: one(users, { fields: [inventory.created_by], references: [users.id], relationName: 'inventory_creator' }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
    uploader: one(users, { fields: [leads.uploader_id], references: [users.id], relationName: 'lead_uploader' }),
    qualifiedBy: one(users, { fields: [leads.qualified_by], references: [users.id], relationName: 'qualified_by_user' }),
    assignments: many(leadAssignments),
    deals: many(deals),
    bolnaCalls: many(bolnaCalls),
    aiCallLogs: many(aiCallLogs),
    loanApplications: many(loanApplications),
}));

export const leadAssignmentsRelations = relations(leadAssignments, ({ one }) => ({
    lead: one(leads, { fields: [leadAssignments.lead_id], references: [leads.id] }),
    owner: one(users, { fields: [leadAssignments.lead_owner], references: [users.id], relationName: 'assigned_to_user' }),
    assigner: one(users, { fields: [leadAssignments.assigned_by], references: [users.id], relationName: 'assigned_by_user' }),
    actor: one(users, { fields: [leadAssignments.lead_actor], references: [users.id], relationName: 'lead_actor_user' }),
    actorAssigner: one(users, { fields: [leadAssignments.actor_assigned_by], references: [users.id], relationName: 'actor_assigned_by_user' }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
    lead: one(leads, { fields: [deals.lead_id], references: [leads.id] }),
    creator: one(users, { fields: [deals.created_by], references: [users.id], relationName: 'deal_creator' }),
    approvals: many(approvals),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
    approver: one(users, { fields: [approvals.approver_id], references: [users.id], relationName: 'approver_user' }),
}));

export const slasRelations = relations(slas, ({ one }) => ({
    assignedUser: one(users, { fields: [slas.assigned_to], references: [users.id], relationName: 'sla_assigned' }),
    escalatedUser: one(users, { fields: [slas.escalated_to], references: [users.id], relationName: 'sla_escalated' }),
}));

export const provisionsRelations = relations(provisions, ({ one, many }) => ({
    oem: one(oems, { fields: [provisions.oem_id], references: [oems.id] }),
    creator: one(users, { fields: [provisions.created_by], references: [users.id] }),
    orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
    provision: one(provisions, { fields: [orders.provision_id], references: [provisions.id] }),
    oem: one(oems, { fields: [orders.oem_id], references: [oems.id] }),
    creator: one(users, { fields: [orders.created_by], references: [users.id] }),
    account: one(accounts, { fields: [orders.account_id], references: [accounts.id] }),
}));

export const oemInventoryForPDIRelations = relations(oemInventoryForPDI, ({ one }) => ({
    inventory: one(inventory, { fields: [oemInventoryForPDI.inventory_id], references: [inventory.id] }),
    oem: one(oems, { fields: [oemInventoryForPDI.oem_id], references: [oems.id] }),
    pdiRecord: one(pdiRecords, { fields: [oemInventoryForPDI.pdi_record_id], references: [pdiRecords.id] }),
}));

export const pdiRecordsRelations = relations(pdiRecords, ({ one }) => ({
    oemInventory: one(oemInventoryForPDI, { fields: [pdiRecords.oem_inventory_id], references: [oemInventoryForPDI.id] }),
    serviceEngineer: one(users, { fields: [pdiRecords.service_engineer_id], references: [users.id], relationName: 'pdi_service_engineer' }),
}));

export const assignmentChangeLogsRelations = relations(assignmentChangeLogs, ({ one }) => ({
    lead: one(leads, { fields: [assignmentChangeLogs.lead_id], references: [leads.id] }),
    oldUser: one(users, { fields: [assignmentChangeLogs.old_user_id], references: [users.id] }),
    newUser: one(users, { fields: [assignmentChangeLogs.new_user_id], references: [users.id] }),
    changedBy: one(users, { fields: [assignmentChangeLogs.changed_by], references: [users.id] }),
}));

export const orderDisputesRelations = relations(orderDisputes, ({ one }) => ({
    order: one(orders, { fields: [orderDisputes.order_id], references: [orders.id] }),
    resolvedBy: one(users, { fields: [orderDisputes.resolved_by], references: [users.id] }),
    creator: one(users, { fields: [orderDisputes.created_by], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
    orders: many(orders),
}));

export const bolnaCallsRelations = relations(bolnaCalls, ({ one }) => ({
    lead: one(leads, { fields: [bolnaCalls.lead_id], references: [leads.id] }),
}));

export const aiCallLogsRelations = relations(aiCallLogs, ({ one }) => ({
    lead: one(leads, { fields: [aiCallLogs.lead_id], references: [leads.id] }),
}));
export const callSessionsRelations = relations(callSessions, ({ many }) => ({
    records: many(callRecords),
}));

export const callRecordsRelations = relations(callRecords, ({ one, many }) => ({
    session: one(callSessions, { fields: [callRecords.session_id], references: [callSessions.session_id] }),
    lead: one(leads, { fields: [callRecords.lead_id], references: [leads.id] }),
    messages: many(conversationMessages),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
    record: one(callRecords, { fields: [conversationMessages.call_record_id], references: [callRecords.id] }),
}));



// --- DEALER ADDITIONS (SOP Refinements) ---

export const campaigns = pgTable('campaigns', {
    id: varchar('id', { length: 255 }).primaryKey(), // CAMP-YYYYMMDD-XXX
    name: text('name').notNull(),
    type: varchar('type', { length: 50 }).notNull(), // sms, whatsapp, email
    status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, scheduled, running, completed
    audience_filter: jsonb('audience_filter'), // Logic for segments
    message_content: text('message_content'),
    total_audience: integer('total_audience'),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    created_by: uuid('created_by').references(() => users.id).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// For "Process Loan" workflow tracking
export const loanApplications = pgTable('loan_applications', {
    id: varchar('id', { length: 255 }).primaryKey(), // LOAN-APP-XXX
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),
    applicant_name: text('applicant_name'), // De-normalized for list views
    loan_amount: decimal('loan_amount', { precision: 12, scale: 2 }),

    // Status Flow
    documents_uploaded: boolean('documents_uploaded').default(false),
    company_validation_status: varchar('company_validation_status', { length: 20 }).default('pending').notNull(), // pending, passed, failed
    facilitation_fee_status: varchar('facilitation_fee_status', { length: 20 }).default('pending').notNull(), // pending, paid
    application_status: varchar('application_status', { length: 20 }).default('new').notNull(), // new, processing, approved, disbursed, rejected

    facilitation_fee_amount: decimal('facilitation_fee_amount', { precision: 10, scale: 2 }),

    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignsRelations = relations(campaigns, ({ one }) => ({
    creator: one(users, { fields: [campaigns.created_by], references: [users.id] }),
}));

export const loanApplicationsRelations = relations(loanApplications, ({ one }) => ({
    lead: one(leads, { fields: [loanApplications.lead_id], references: [leads.id] }),
    creator: one(users, { fields: [loanApplications.created_by], references: [users.id] }),
}));
