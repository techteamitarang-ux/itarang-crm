import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { successResponse, errorResponse, withErrorHandler } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';

export const GET = withErrorHandler(async (req: Request) => {
    const user = await requireRole(['dealer']);
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
        return errorResponse('Phone number is required', 400);
    }

    // Duplicate check: phone match within dealer scope only (for privacy)
    const matches = await db.select({
        id: leads.id,
        referenceId: leads.id, // Current system uses ID as referenceId
        owner_name: leads.owner_name,
        created_at: leads.created_at,
        status: leads.status,
        workflow_step: leads.workflow_step
    })
        .from(leads)
        .where(
            and(
                eq(leads.dealer_id, user.dealer_id!),
                or(
                    eq(leads.owner_contact, phone),
                    eq(leads.mobile, phone),
                    eq(leads.phone, phone)
                )
            )
        );

    return successResponse(matches);
});
