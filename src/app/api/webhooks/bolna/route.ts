import { db } from '@/lib/db';
import { leads, auditLogs, users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withErrorHandler, successResponse, errorResponse, generateId } from '@/lib/api-utils';

/**
 * Bolna.ai Webhook Handler
 * Receives call outcomes and updates lead status/interest.
 */
export const POST = withErrorHandler(async (req: Request) => {
    const body = await req.json();

    // Bolna payload structure
    const {
        call_id,
        agent_id,
        user_number,
        conversation_duration,
        transcript,
        summary,
        recording_url,
        status,
        metadata
    } = body;

    let leadId = metadata?.lead_id;

    if (!leadId && user_number) {
        // Fallback: Try to find lead by phone number
        // Note: phone numbers in DB might have +91 or might not.
        // We'll try to match exact or with +91
        const cleanNumber = user_number.replace(/\D/g, '').slice(-10);
        const [leadByPhone] = await db.select().from(leads)
            .where(sql`${leads.owner_contact} LIKE ${'%' + cleanNumber}`).limit(1);

        if (leadByPhone) {
            leadId = leadByPhone.id;
        }
    }

    if (!leadId) {
        console.warn('[Bolna Webhook] Missing lead_id and could not find lead by phone number', body);
        return errorResponse('Could not identify lead', 400);
    }

    // 1. Fetch Lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
        return errorResponse('Lead not found', 404);
    }

    // 2. Map Bolna status/data to system interest/status
    // Note: detected_interest and sentiment might be in some versions of the payload
    const detected_interest = body.detected_interest || (summary?.toLowerCase().includes('interested') ? 'high' : 'low');
    const sentiment = body.sentiment || 'neutral';

    let interestLevel: 'cold' | 'warm' | 'hot' = lead.interest_level as any || 'cold';

    if (detected_interest?.toLowerCase() === 'high' || sentiment?.toLowerCase() === 'positive') {
        interestLevel = 'hot';
    } else if (detected_interest?.toLowerCase() === 'low' || sentiment?.toLowerCase() === 'negative') {
        interestLevel = 'cold';
    } else if (detected_interest) {
        interestLevel = 'warm';
    }

    // 3. Store the AI Call Log
    try {
        const { aiCallLogs } = await import('@/lib/db/schema');
        await db.insert(aiCallLogs).values({
            lead_id: leadId,
            call_id: call_id || `bolna-${Date.now()}`,
            agent_id: agent_id,
            phone_number: user_number,
            transcript: transcript,
            summary: summary,
            recording_url: recording_url,
            call_duration: conversation_duration,
            status: status,
            created_at: new Date()
        }).onConflictDoUpdate({
            target: aiCallLogs.call_id,
            set: {
                transcript: transcript,
                summary: summary,
                recording_url: recording_url,
                call_duration: conversation_duration,
                status: status,
                updated_at: new Date()
            }
        } as any);
    } catch (logError) {
        console.error('[Bolna Webhook] Failed to store call log:', logError);
    }

    // 4. Update Lead status
    const updates: any = {
        interest_level: interestLevel,
        updated_at: new Date(),
    };

    const canQualify = interestLevel !== 'cold';
    if (canQualify && (interestLevel === 'hot' || interestLevel === 'warm') && lead.lead_status !== 'qualified') {
        updates.lead_status = 'qualified';
        updates.qualified_at = new Date();
        updates.qualification_notes = `AI-Qualified via Bolna call. Summary: ${summary || 'No summary provided'}`;

        const [admin] = await db.select().from(users).limit(1);
        if (admin) {
            updates.qualified_by = admin.id;
        }
    }

    await db.update(leads).set(updates).where(eq(leads.id, leadId));

    // 5. Create Audit Log
    try {
        const [admin] = await db.select().from(users).limit(1);
        if (admin) {
            await db.insert(auditLogs).values({
                id: await generateId('AUDIT', auditLogs),
                entity_type: 'lead',
                entity_id: leadId,
                action: 'update',
                changes: {
                    interest_level: interestLevel,
                    lead_status: updates.lead_status,
                    bolna_call_id: call_id
                },
                performed_by: admin.id,
                timestamp: new Date(),
            });
        }
    } catch (auditError) {
        console.error('[Bolna Webhook] Audit logging failed:', auditError);
    }

    return successResponse({
        lead_id: leadId,
        interest_level: interestLevel,
        qualified: updates.lead_status === 'qualified'
    });
});
