import { db } from '@/lib/db';
import { leads, personalDetails, auditLogs } from '@/lib/db/schema';
import { successResponse, errorResponse, withErrorHandler } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const step1Schema = z.object({
    full_name: z.string().min(2).max(100).optional(),
    phone: z.string().regex(/^\+91[0-9]{10}$/).optional(),
    father_or_husband_name: z.string().optional(),
    dob: z.string().optional().refine(val => {
        if (!val) return true;
        const birthDate = new Date(val);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        return age >= 18;
    }, { message: "Age must be at least 18" }),
    current_address: z.string().optional(),
    permanent_address: z.string().optional(),
    is_current_same: z.boolean().optional(),
    primary_product_id: z.string().optional(),
    product_category_id: z.string().optional(),
    interest_level: z.enum(['hot', 'warm', 'cold']).optional(),
    vehicle_rc: z.string().optional(),
    vehicle_ownership: z.string().optional(),
    vehicle_owner_name: z.string().optional(),
    vehicle_owner_phone: z.string().optional(),
    auto_filled: z.boolean().optional(),
    ocr_status: z.enum(['success', 'partial', 'failed']).optional(),
    ocr_error: z.string().optional(),
});

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: { id: string } }) => {
    const user = await requireRole(['dealer']);
    const { id } = params;
    const rawBody = await req.json();

    const result = step1Schema.safeParse(rawBody);
    if (!result.success) {
        return errorResponse(result.error.issues[0]?.message || 'Validation failed', 400);
    }
    const body = result.data as any;

    const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

    if (!lead) return errorResponse('Lead not found', 404);
    if (lead.uploader_id !== user.id) return errorResponse('Forbidden', 403);

    // We only update if it is INCOMPLETE or if specific rules allow
    // For V2, we focus on persistent wizard updates

    await db.transaction(async (tx) => {
        // Update leads table
        const leadFields = [
            'full_name', 'phone', 'father_or_husband_name', 'dob', 'current_address', 'permanent_address',
            'primary_product_id', 'product_category_id', 'interest_level', 'lead_score', 'status',
            'workflow_step', 'vehicle_rc', 'vehicle_ownership', 'vehicle_owner_name', 'vehicle_owner_phone',
            'auto_filled', 'ocr_status', 'ocr_error'
        ];

        const leadUpdates: any = {};
        leadFields.forEach(f => {
            if (body[f] !== undefined) {
                if (f === 'dob' && body[f]) leadUpdates[f] = new Date(body[f]);
                else leadUpdates[f] = body[f];
            }
        });

        // Legacy mapping sync
        if (body.full_name) leadUpdates.owner_name = body.full_name;
        if (body.phone) {
            leadUpdates.owner_contact = body.phone;
            leadUpdates.mobile = body.phone;
        }
        if (body.current_address) leadUpdates.shop_address = body.current_address;

        if (Object.keys(leadUpdates).length > 0) {
            await tx.update(leads).set({ ...leadUpdates, updated_at: new Date() }).where(eq(leads.id, id));
        }

        // Sync to personalDetails (Legacy)
        const personalFields = ['dob', 'father_or_husband_name', 'current_address', 'aadhaar_no', 'pan_no', 'email', 'income', 'finance_type', 'financier', 'marital_status'];
        const personalUpdates: any = {};

        if (body.dob) personalUpdates.dob = new Date(body.dob);
        if (body.father_or_husband_name) personalUpdates.father_husband_name = body.father_or_husband_name;
        if (body.current_address) personalUpdates.local_address = body.current_address;

        // Handle other fields if present in body
        ['aadhaar_no', 'pan_no', 'email', 'income', 'finance_type', 'financier', 'marital_status'].forEach(f => {
            if (body[f] !== undefined) personalUpdates[f] = body[f];
        });

        if (Object.keys(personalUpdates).length > 0) {
            await tx.update(personalDetails).set(personalUpdates).where(eq(personalDetails.lead_id, id));
        }

        // Log audit
        await tx.insert(auditLogs).values({
            id: `AUDIT-${Date.now()}`,
            entity_type: 'lead',
            entity_id: id,
            action: 'update',
            changes: body,
            performed_by: user.id,
            timestamp: new Date()
        });
    });

    return successResponse({ message: 'Lead updated successfully' });
});
