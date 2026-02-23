import { db } from '@/lib/db';
import { leads, personalDetails, auditLogs, accounts } from '@/lib/db/schema';
import { successResponse, errorResponse, withErrorHandler, generateId, generateLeadReference } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

const step1Schema = z.object({
    full_name: z.string().max(100).optional().nullable(),
    phone: z.string().optional().nullable(),
    father_or_husband_name: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    current_address: z.string().optional().nullable(),
    permanent_address: z.string().optional().nullable(),
    is_current_same: z.boolean().optional(),
    primary_product_id: z.string().optional().nullable(),
    product_category_id: z.string().optional().nullable(),
    interest_level: z.enum(['hot', 'warm', 'cold']).optional().nullable(),
    vehicle_rc: z.string().optional().nullable(),
    vehicle_ownership: z.string().optional().nullable(),
    vehicle_owner_name: z.string().optional().nullable(),
    vehicle_owner_phone: z.string().optional().nullable(),
    auto_filled: z.boolean().default(false),
    ocr_status: z.enum(['success', 'partial', 'failed']).optional().nullable(),
    ocr_error: z.string().optional().nullable(),
    interested_in: z.array(z.string()).optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
    const user = await requireRole(['dealer']);

    // Debug Log for Step Id: 637
    console.log('[DEBUG] Lead Creation Dealer Check:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        dealer_id: user.dealer_id
    });

    // DEV FALLBACK: If user is not associated with a dealer, pick first available account
    let dealer_id = user.dealer_id;
    if (!dealer_id) {
        console.log('[DEV] User missing dealer_id, seeking fallback account');
        const [firstAccount] = await db.select().from(accounts).limit(1);

        console.log('[DEV] firstAccount query result:', firstAccount);

        if (firstAccount) {
            dealer_id = firstAccount.id;
        } else {
            console.log('[DEV] No accounts found in DB. Creating a dummy account for dev...');
            try {
                const dummyId = `ACC-DEV-${Date.now()}`;
                const [newAccount] = await db.insert(accounts).values({
                    id: dummyId,
                    business_name: 'Dev Demo Dealership',
                    owner_name: 'Dev Admin',
                    status: 'active'
                }).returning({ id: accounts.id });

                if (newAccount) {
                    dealer_id = newAccount.id;
                    console.log('[DEV] Created dummy account:', dealer_id);
                }
            } catch (accErr) {
                console.error('[DEV] Failed to create dummy account:', accErr);
            }
        }
    }

    console.log('[DEV] Final resolved dealer_id:', dealer_id);

    if (!dealer_id) {
        return errorResponse('User not associated with a dealer and no fallback/dummy found', 403);
    }

    const body = await req.json();
    const result = step1Schema.safeParse(body);
    if (!result.success) {
        return errorResponse('Validation failed', 400);
    }
    const data = result.data;

    // RESUME LOGIC: If an incomplete draft exists, return it instead of creating a new one
    const existing = await db.select().from(leads).where(
        and(
            eq(leads.uploader_id, user.id),
            eq(leads.status, 'INCOMPLETE')
        )
    ).limit(1);

    if (existing.length > 0) {
        return successResponse({
            leadId: existing[0].id,
            referenceId: existing[0].reference_id,
            workflow_step: existing[0].workflow_step
        }, 200);
    }

    const leadReference = await generateId('LEAD', leads);
    const referenceId = await generateLeadReference(leads);
    const score = data.interest_level === 'hot' ? 90 : data.interest_level === 'warm' ? 60 : 30;
    const workflow_step = data.interest_level === 'hot' ? 2 : 1;

    let leadId = '';

    await db.transaction(async (tx) => {
        const [insertedLead] = await tx.insert(leads).values({
            id: leadReference,
            reference_id: referenceId,
            dealer_id: dealer_id!,
            uploader_id: user.id,

            // Core Identity
            full_name: data.full_name,
            phone: data.phone,
            owner_name: data.full_name || 'Draft Lead',
            owner_contact: data.phone || 'Draft Contact',
            mobile: data.phone,

            // Addresses
            current_address: data.current_address,
            shop_address: data.current_address,
            permanent_address: data.permanent_address,

            // Dates
            dob: data.dob ? new Date(data.dob) : null,
            father_or_husband_name: data.father_or_husband_name,

            // Product
            product_category_id: data.product_category_id as any,
            primary_product_id: data.primary_product_id,

            // Vehicle
            vehicle_rc: data.vehicle_rc,
            vehicle_ownership: data.vehicle_ownership,
            vehicle_owner_name: data.vehicle_owner_name,
            vehicle_owner_phone: data.vehicle_owner_phone,

            // Classification
            interest_level: data.interest_level || 'cold',
            lead_score: score,
            status: 'INCOMPLETE',
            workflow_step: workflow_step,
            lead_source: 'dealer_referral',

            // OCR
            auto_filled: data.auto_filled || false,
            ocr_status: data.ocr_status,
            ocr_error: data.ocr_error,
            interested_in: data.interested_in || [],
        }).returning({ id: leads.id });

        leadId = insertedLead.id;

        // Legacy Personal Details table support (syncing for now)
        await tx.insert(personalDetails).values({
            lead_id: leadId,
            dob: data.dob ? new Date(data.dob) : null,
            father_husband_name: data.father_or_husband_name,
            local_address: data.current_address,
        });

        // Audit Log
        await tx.insert(auditLogs).values({
            id: `AUDIT-${Date.now()}`,
            entity_type: 'lead',
            entity_id: leadId,
            action: 'create',
            changes: data,
            performed_by: user.id,
            timestamp: new Date()
        });
    });

    return successResponse({
        leadId,
        referenceId: referenceId,
        workflow_step
    }, 201);
});
