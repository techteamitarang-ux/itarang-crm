import { successResponse, withErrorHandler } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';

export const POST = withErrorHandler(async (req: Request) => {
    await requireRole(['dealer']);
    const body = await req.json();

    // Stub implementation as OCR vendor is not yet integrated
    // In a real scenario, this would call an OCR service with the document IDs

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock data based on typical Aadhaar extraction
    const mockDataSuccess = {
        full_name: "Rajesh Kumar",
        father_or_husband_name: "Suresh Kumar",
        dob: "1990-05-15",
        permanent_address: "Flat 402, Sunshine Apartments, Sector 12, Dwarka, New Delhi 110075",
        confidence: {
            name: 0.98,
            fatherName: 0.92,
            dob: 0.99,
            address: 0.85
        },
        auto_filled: true,
        ocr_status: 'success'
    };

    const mockDataPartial = {
        full_name: "Rajesh Kumar",
        father_or_husband_name: "", // Missing
        dob: "", // Missing
        permanent_address: "Flat 402, Sunshine Apartments, Sector 12, Dwarka, New Delhi 110075",
        confidence: {
            name: 0.98,
            fatherName: 0.12,
            dob: 0.05,
            address: 0.85
        },
        auto_filled: true,
        ocr_status: 'partial',
        missingFields: ['Father/Husband Name', 'Date of Birth']
    };

    // Simulate random behavior for testing: 70% success, 30% partial
    const data = Math.random() > 0.3 ? mockDataSuccess : mockDataPartial;

    return successResponse(data);
});
