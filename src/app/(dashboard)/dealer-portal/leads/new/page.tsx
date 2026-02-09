'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Save, User, ArrowLeft, ArrowRight, Loader2, Banknote, FileCheck, Filter, UploadCloud, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const steps = [
    { id: 1, title: 'Customer Info', icon: User },
    { id: 2, title: 'Loan Details', icon: Banknote },
    { id: 3, title: 'Classification', icon: Filter },
    { id: 4, title: 'Personal', icon: FileCheck },
    { id: 5, title: 'Documents', icon: UploadCloud },
];

export default function NewLeadWizard() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // New state for detailed upload feedback
    const [uploadStatus, setUploadStatus] = useState<Record<string, {
        status: "idle" | "uploading" | "success" | "error",
        message?: string
    }>>({});

    const [formData, setFormData] = useState({
        // Step 1
        full_name: '',
        phone: '',
        permanent_address: '',
        vehicle_ownership: '2W',
        battery_type: 'Lead Acid',
        asset_model: '',
        asset_price: '',
        family_members: '',
        driving_experience: '',

        // Step 2
        loan_required: false,
        loan_amount: '',
        interest_rate: '',
        tenure_months: '12',
        processing_fee: '',
        emi: '',
        down_payment: '',

        // Step 3
        interest_level: 'cold',

        // Step 4
        aadhaar_no: '',
        pan_no: '',
        dob: '',
        email: '',
        income: '',
        finance_type: 'Private',
        financier: '',
        asset_type: '2W',
        vehicle_rc: '',
        loan_type: 'Self owner self loan',
        father_husband_name: '',
        marital_status: 'Single',
        spouse_name: '',
        local_address: '',

        // Step 5
        documents: [] as { type: string, url: string }[]
    });

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when field updates
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Set status to uploading
        setUploadStatus(prev => ({
            ...prev,
            [docType]: { status: 'uploading', message: 'Uploading file...' }
        }));
        setApiError(null);

        try {
            const data = new FormData();
            data.append('file', file);
            data.append('documentType', docType);

            const res = await fetch('/api/dealer/upload', {
                method: 'POST',
                body: data
            });

            // Try to parse JSON answer
            let result;
            try {
                result = await res.json();
            } catch (jsonErr) {
                console.warn('JSON parse error in upload:', jsonErr);
                throw new Error('Server returned an invalid response (not JSON)');
            }

            if (!res.ok) {
                // If API returns an error structure
                if (result && typeof result === 'object') {
                    throw new Error(result.error || result.message || 'Upload failed');
                }
                throw new Error('Upload failed with status ' + res.status);
            }

            if (!result || !result.data || !result.data.url) {
                throw new Error('Invalid response structure from server');
            }

            const newDoc = { type: docType, url: result.data.url };

            // Update form data and success status
            setFormData(prev => ({
                ...prev,
                documents: [...prev.documents.filter(d => d.type !== docType), newDoc]
            }));

            setUploadStatus(prev => ({
                ...prev,
                [docType]: { status: 'success', message: `${docType} uploaded successfully` }
            }));

        } catch (err: any) {
            console.error('Upload Error:', err);
            const errorMsg = err instanceof Error ? err.message : 'File upload failed';

            // Set error status
            setUploadStatus(prev => ({
                ...prev,
                [docType]: { status: 'error', message: errorMsg }
            }));

            // Also keep global logging/banner if needed, but per-file status is better
            // setApiError(errorMsg); // Optional: keep global or not? User request says per-file.
        }
    };

    const validateStep = (currentStep: number) => {
        const newErrors: Record<string, string> = {};

        if (currentStep === 1) {
            if (!formData.full_name) newErrors.full_name = "Full name is required";
            if (!formData.phone) newErrors.phone = "Mobile number is required";
            else if (!/^\+91[0-9]{10}$/.test(formData.phone)) newErrors.phone = "Must appear as +91XXXXXXXXXX";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return false;
        }

        return true;
    };

    const nextStep = () => {
        if (validateStep(step)) {
            setStep(s => Math.min(s + 1, steps.length));
            window.scrollTo(0, 0);
        }
    };

    const prevStep = () => {
        setStep(s => Math.max(s - 1, 1));
        window.scrollTo(0, 0);
    };

    const handleSubmit = async () => {
        if (!validateStep(step)) return;

        setLoading(true);
        setApiError(null);
        try {
            const payload = {
                ...formData,
                asset_price: Number(formData.asset_price) || 0,
                family_members: Number(formData.family_members) || 0,
                driving_experience: Number(formData.driving_experience) || 0,
                loan_amount: Number(formData.loan_amount) || 0,
                interest_rate: Number(formData.interest_rate) || 0,
                tenure_months: Number(formData.tenure_months) || 0,
                processing_fee: Number(formData.processing_fee) || 0,
                emi: Number(formData.emi) || 0,
                down_payment: Number(formData.down_payment) || 0,
                income: Number(formData.income) || 0
            };

            const response = await fetch('/api/dealer/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Parse response safely
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse response JSON:', jsonError);
                throw new Error('Server returned an invalid response');
            }

            console.log("Submit API Response:", data);

            if (!response.ok || data?.success === false) {
                const errorMessage =
                    data?.message ||
                    (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
                    'Lead submission failed';
                throw new Error(errorMessage);
            }

            // Success case check
            if (data.data && data.data.id) {
                // Success - Show alert and redirect
                alert('Lead created successfully!');
                router.push(`/dealer-portal/leads?new=${data.data.id}`);
                router.refresh();
            } else {
                throw new Error('Invalid response structure from server: missing lead ID');
            }

        } catch (err: any) {
            console.error("Lead submission error:", err);
            const msg = err.message || "Unexpected error occurred";
            setApiError(msg);
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    const FINANCE_TYPES = ['Private', 'Bank', 'NBFC'];
    const ASSET_TYPES = ['2W', '3W', '4W', 'Commercial'];
    const LOAN_TYPES = [
        'Self owner self loan',
        'Self ownership family relationship loan',
        'Second hand ownership self loan',
        'Second hand ownership family relationship loan'
    ];

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900">Create New Lead</h1>
                <p className="text-gray-500 mt-2">Step {step} of {steps.length}: {steps[step - 1].title}</p>
            </div>

            {/* Global Error Banner */}
            {apiError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <span>{apiError}</span>
                    </div>
                    <button onClick={() => setApiError(null)} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Progress Bar */}
            <div className="hidden md:flex items-center justify-between mb-12 relative px-4">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full" />
                <div
                    className="absolute top-1/2 left-0 h-1 bg-brand-600 -z-10 rounded-full transition-all duration-300"
                    style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((s) => {
                    const isActive = s.id === step;
                    const isCompleted = s.id < step;
                    const Icon = s.icon;

                    return (
                        <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                ${isActive ? 'border-brand-600 bg-brand-50 text-brand-600 shadow-md scale-110' :
                                    isCompleted ? 'border-brand-600 bg-brand-600 text-white' :
                                        'border-gray-200 bg-white text-gray-400'}
                            `}>
                                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <span className={`text-xs font-semibold ${isActive || isCompleted ? 'text-brand-700' : 'text-gray-400'}`}>
                                {s.title}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Form Container */}
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xl min-h-[500px]">

                {/* STEP 1: Customer Info */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Customer Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Full Name *" value={formData.full_name} onChange={(v: string) => updateField('full_name', v)} placeholder="e.g. Rajesh Kumar" error={errors.full_name} />
                            <Input label="Mobile Number *" value={formData.phone} onChange={(v: string) => updateField('phone', v)} placeholder="+919876543210" error={errors.phone} />
                            <TextArea label="Permanent Address" value={formData.permanent_address} onChange={(v: string) => updateField('permanent_address', v)} />

                            <Select label="Vehicle Ownership" value={formData.vehicle_ownership} onChange={(v: string) => updateField('vehicle_ownership', v)}>
                                <option>2W</option>
                                <option>3W</option>
                                <option>4W</option>
                            </Select>

                            <Select label="Battery Type" value={formData.battery_type} onChange={(v: string) => updateField('battery_type', v)}>
                                <option>Lead Acid</option>
                                <option>Lithium Ion</option>
                            </Select>

                            <Input label="Asset Model" value={formData.asset_model} onChange={(v: string) => updateField('asset_model', v)} placeholder="e.g. Honda Activa" />
                            <Input label="Asset Price (₹)" type="number" value={formData.asset_price} onChange={(v: string) => updateField('asset_price', v)} />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Input label="Family Members" type="number" value={formData.family_members} onChange={(v: string) => updateField('family_members', v)} />
                            <Input label="Driving Exp (Years)" type="number" value={formData.driving_experience} onChange={(v: string) => updateField('driving_experience', v)} />
                        </div>
                    </div>
                )}

                {/* STEP 2: Loan Details */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Loan Requirments</h2>

                        <div className="flex items-center gap-4 mb-6">
                            <span className="font-medium text-gray-700">Loan Required?</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateField('loan_required', true)}
                                    className={`px-4 py-2 rounded-lg border ${formData.loan_required ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => updateField('loan_required', false)}
                                    className={`px-4 py-2 rounded-lg border ${!formData.loan_required ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                >
                                    No
                                </button>
                            </div>
                        </div>

                        {formData.loan_required && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <Input label="Loan Amount (₹)" type="number" value={formData.loan_amount} onChange={(v: string) => updateField('loan_amount', v)} />
                                <Input label="Interest Rate (%)" type="number" value={formData.interest_rate} onChange={(v: string) => updateField('interest_rate', v)} />
                                <Input label="Tenure (Months)" type="number" value={formData.tenure_months} onChange={(v: string) => updateField('tenure_months', v)} />
                                <Input label="Processing Fee (₹)" type="number" value={formData.processing_fee} onChange={(v: string) => updateField('processing_fee', v)} />
                                <Input label="Monthly EMI (₹)" type="number" value={formData.emi} onChange={(v: string) => updateField('emi', v)} />
                                <Input label="Down Payment (₹)" type="number" value={formData.down_payment} onChange={(v: string) => updateField('down_payment', v)} />
                            </div>
                        )}
                        {!formData.loan_required && (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                No loan details required. Click Next to proceed.
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: Classification */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Lead Classification</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {['hot', 'warm', 'cold'].map((type) => (
                                <div
                                    key={type}
                                    onClick={() => updateField('interest_level', type)}
                                    className={`
                                        cursor-pointer p-8 rounded-xl border-2 flex flex-col items-center gap-4 transition-all hover:scale-105
                                        ${formData.interest_level === type
                                            ? 'border-brand-600 bg-brand-50 shadow-md transform scale-105'
                                            : 'border-gray-200 hover:border-brand-300 bg-white'
                                        }
                                    `}
                                >
                                    <div className={`w-4 h-4 rounded-full ${type === 'hot' ? 'bg-red-500' : type === 'warm' ? 'bg-yellow-500' : 'bg-blue-500'
                                        }`} />
                                    <span className="font-bold text-lg capitalize text-gray-800">{type} Lead</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 4: Personal & Verification */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Personal Verification</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Aadhaar Number" value={formData.aadhaar_no} onChange={(v: string) => updateField('aadhaar_no', v)} />
                            <Input label="PAN Number" value={formData.pan_no} onChange={(v: string) => updateField('pan_no', v)} />
                            <Input label="Date of Birth" type="date" value={formData.dob} onChange={(v: string) => updateField('dob', v)} />
                            <Input label="Email" type="email" value={formData.email} onChange={(v: string) => updateField('email', v)} />
                            <Input label="Monthly Income" type="number" value={formData.income} onChange={(v: string) => updateField('income', v)} />

                            <Select label="Marital Status" value={formData.marital_status} onChange={(v: string) => updateField('marital_status', v)}>
                                <option>Single</option>
                                <option>Married</option>
                                <option>Divorced</option>
                            </Select>

                            {formData.marital_status === 'Married' && (
                                <Input label="Spouse Name" value={formData.spouse_name} onChange={(v: string) => updateField('spouse_name', v)} />
                            )}

                            <Input label="Father/Husband Name" value={formData.father_husband_name} onChange={(v: string) => updateField('father_husband_name', v)} />

                            <Select label="Asset Type" value={formData.asset_type} onChange={(v: string) => updateField('asset_type', v)}>
                                {ASSET_TYPES.map(a => <option key={a}>{a}</option>)}
                            </Select>

                            <Select label="Finance Type" value={formData.finance_type} onChange={(v: string) => updateField('finance_type', v)}>
                                {FINANCE_TYPES.map(f => <option key={f}>{f}</option>)}
                            </Select>

                            {formData.finance_type !== 'Private' && (
                                <Input label="Financier Name" value={formData.financier} onChange={(v: string) => updateField('financier', v)} />
                            )}

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Vehicle RC Search</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.vehicle_rc}
                                        onChange={(e) => updateField('vehicle_rc', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                                        placeholder="MH12AB1234"
                                    />
                                    <button className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium">
                                        Verify RC
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Loan Type</label>
                                <div className="space-y-2">
                                    {LOAN_TYPES.map(type => (
                                        <label key={type} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="radio"
                                                name="loan_type"
                                                checked={formData.loan_type === type}
                                                onChange={() => updateField('loan_type', type)}
                                                className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>


                            <TextArea label="Local Address" value={formData.local_address} onChange={(v: string) => updateField('local_address', v)} />
                        </div>
                    </div>
                )}

                {/* STEP 5: Documents */}
                {step === 5 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Document Upload</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                'Passport Photo', 'PAN Card', 'Aadhaar Front', 'Aadhaar Back',
                                'Bank Statement', 'Address Proof', 'RC Copy', 'Passbook (Front)', 'Stamp Paper (₹50)',
                                'Undated Cheque 1', 'Undated Cheque 2', 'Undated Cheque 3', 'Undated Cheque 4'
                            ].map((docType) => {
                                const uploadedDoc = formData.documents.find(d => d.type === docType);
                                const status = uploadStatus[docType];

                                return (
                                    <div key={docType} className={`border rounded-xl p-4 bg-gray-50 transition-all ${status?.status === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-sm text-gray-700 flex items-center gap-2">
                                                {docType}
                                                {/* Status Icons */}
                                                {status?.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                                                {status?.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                                {status?.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                                            </span>
                                            {uploadedDoc && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                        </div>

                                        {uploadedDoc ? (
                                            <div className="relative group">
                                                <div className="h-32 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                                                    {/* Preview placeholder - in real app use Next Image or img tag */}
                                                    <img src={uploadedDoc.url} alt={docType} className="h-full w-full object-cover" />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setFormData(p => ({ ...p, documents: p.documents.filter(d => d.type !== docType) }));
                                                        setUploadStatus(prev => {
                                                            const next = { ...prev };
                                                            delete next[docType];
                                                            return next;
                                                        });
                                                    }}
                                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className={`h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors ${status?.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : 'border-gray-300'}`}>
                                                {status?.status === 'uploading' ? (
                                                    <div className="flex flex-col items-center text-blue-600">
                                                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                                        <span className="text-xs font-medium">Uploading...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <UploadCloud className={`w-8 h-8 mb-2 ${status?.status === 'error' ? 'text-red-400' : 'text-gray-400'}`} />
                                                        <span className={`text-xs ${status?.status === 'error' ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                                                            {status?.status === 'error' ? 'Retry Upload' : 'Click to upload'}
                                                        </span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,.pdf"
                                                    disabled={status?.status === 'uploading'}
                                                    onChange={(e) => handleFileUpload(e, docType)}
                                                />
                                            </label>
                                        )}

                                        {/* Status Message Footer */}
                                        {status && (
                                            <div className={`mt-2 text-xs flex items-center gap-1 ${status.status === 'success' ? 'text-green-600' :
                                                status.status === 'error' ? 'text-red-600' :
                                                    'text-blue-600'
                                                }`}>
                                                {status.message}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                    onClick={prevStep}
                    disabled={step === 1}
                    className="flex items-center px-6 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>

                {step < steps.length ? (
                    <button
                        onClick={nextStep}
                        className="flex items-center px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium shadow-lg shadow-brand-500/30 transition-all hover:scale-105"
                    >
                        Next Step <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center px-8 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium shadow-lg shadow-green-500/30 transition-all hover:scale-105"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Submit Application
                    </button>
                )}
            </div>
        </div>
    );
}

// UI Helpers
const Input = ({ label, type = 'text', value, onChange, placeholder, error }: any) => (
    <div className="space-y-1.5 w-full">
        <label className="text-sm font-medium text-gray-700 flex justify-between">
            {label}
            {error && <span className="text-red-500 text-xs flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> {error}</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg outline-none transition-all 
                ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-brand-500'} 
                focus:ring-2`}
            placeholder={placeholder}
        />
    </div>
);

const TextArea = ({ label, value, onChange }: any) => (
    <div className="space-y-1.5 md:col-span-2 w-full">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all min-h-[100px]"
        />
    </div>
);

const Select = ({ label, value, onChange, children }: any) => (
    <div className="space-y-1.5 w-full">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all bg-white"
        >
            {children}
        </select>
    </div>
);
