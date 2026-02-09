
import { withErrorHandler, successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';
import { triggerBolnaCall } from '@/lib/bolna';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST = withErrorHandler(async (req: Request) => {
    // 1. Authenticate user
    await requireAuth();

    // 2. Parse request body
    const { leadId } = await req.json();

    if (!leadId) {
        return errorResponse('Lead ID is required', 400);
    }

    // 3. Fetch lead details (phone number)
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
        return errorResponse('Lead not found', 404);
    }

    if (!lead.owner_contact) {
        return errorResponse('Lead has no contact number', 400);
    }

    // 4. Trigger Bolna call with full context
    const result = await triggerBolnaCall(lead.owner_contact, lead.id, lead);

    if (!result.success) {
        return errorResponse(result.error || 'Failed to trigger Bolna call', 500);
    }

    return successResponse({
        message: 'Call triggered successfully',
        callId: result.callId
    });
});
