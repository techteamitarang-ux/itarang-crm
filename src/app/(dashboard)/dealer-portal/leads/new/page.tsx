'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    CheckCircle2, Save, User, ArrowLeft, ArrowRight, Loader2,
    Banknote, FileCheck, Filter, UploadCloud, X, AlertCircle,
    Info, Scan, Plus, Trash2, AlertTriangle, Calendar
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { HelpModal, AutofillModal, DuplicateModal } from '@/components/leads/lead-v2-modals';

const steps = [
    { id: 1, title: 'Customer Info', icon: User },
    { id: 2, title: 'Loan Details', icon: Banknote },
    { id: 3, title: 'Classification', icon: Filter },
    { id: 4, title: 'Personal', icon: FileCheck },
    { id: 5, title: 'Documents', icon: UploadCloud },
];

function NewLeadWizardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const step = parseInt(searchParams.get('step') || '1');
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [isModified, setIsModified] = useState(false);

    // Categories and Products
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);

    // Modals
    const [showHelp, setShowHelp] = useState(false);
    const [showAutofill, setShowAutofill] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);

    const [formData, setFormData] = useState<any>({
        full_name: '',
        phone: '',
        current_address: '',
        permanent_address: '',
        is_current_same: false,
        product_category_id: '',
        primary_product_id: '',
        interested_in: [], // Secondary products
        vehicle_rc: '',
        vehicle_ownership: '',
        vehicle_owner_name: '',
        vehicle_owner_phone: '',
        interest_level: 'cold',
        dob: '',
        father_or_husband_name: '',
        auto_filled: false,
        ocr_status: null,
        ocr_error: null,
        asset_model: '', // Categorized name for UI
    });

    const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

    // Fetch Inventory Data
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/inventory/categories', { credentials: 'include' });
                const data = await res.json();
                if (data.success) setCategories(data.data);
            } catch (e) { console.error("Failed to load categories", e); }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        if (formData.asset_model) {
            const fetchProducts = async () => {
                setLoadingInventory(true);
                try {
                    const res = await fetch(`/api/inventory/products?category=${encodeURIComponent(formData.asset_model)}`, { credentials: 'include' });
                    const data = await res.json();
                    if (data.success) setProducts(data.data);
                } catch (e) { console.error("Failed to load products", e); }
                finally { setLoadingInventory(false); }
            };
            fetchProducts();
        }
    }, [formData.asset_model]);

    // Age Calculation
    useEffect(() => {
        if (formData.dob) {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setCalculatedAge(age);
        } else {
            setCalculatedAge(null);
        }
    }, [formData.dob]);

    // Resumption Logic
    useEffect(() => {
        const checkInProgress = async () => {
            try {
                const res = await fetch('/api/leads/in-progress', { credentials: 'include' });
                const result = await res.json();
                if (result.success && result.data) {
                    const lead = result.data;

                    setLeadId(lead.id);
                    setFormData((prev: any) => ({
                        ...prev,
                        full_name: lead.full_name || lead.owner_name || '',
                        phone: lead.phone || lead.owner_contact || '',
                        current_address: lead.current_address || lead.shop_address || '',
                        permanent_address: lead.permanent_address || '',
                        product_category_id: lead.product_category_id || '',
                        primary_product_id: lead.primary_product_id || '',
                        interested_in: lead.interested_in || [],
                        interest_level: lead.interest_level || 'cold',
                        vehicle_rc: lead.vehicle_rc || '',
                        vehicle_ownership: lead.vehicle_ownership || '',
                        vehicle_owner_name: lead.vehicle_owner_name || '',
                        vehicle_owner_phone: lead.vehicle_owner_phone || '',
                        asset_model: lead.asset_model || '',
                        dob: lead.dob ? new Date(lead.dob).toISOString().split('T')[0] : '',
                        father_or_husband_name: lead.father_or_husband_name || '',
                        auto_filled: lead.auto_filled || false,
                        ocr_status: lead.ocr_status,
                        ocr_error: lead.ocr_error,
                        is_current_same: lead.current_address === lead.permanent_address && !!lead.current_address
                    }));
                    setLastSaved(new Date(lead.updated_at).toLocaleTimeString());

                    if (!searchParams.get('step')) {
                        router.replace(`?step=${lead.workflow_step}`);
                    }
                }
            } catch (e) { console.error("Resumption failed", e); }
        };
        checkInProgress();
    }, []);

    const ensureLead = async () => {
        if (leadId) return leadId;

        try {
            const res = await fetch('/api/leads/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    interest_level: formData.interest_level || 'cold'
                })
            });
            const result = await res.json();

            if (res.ok) {
                const id = result.data?.leadId || result.data?.id || result.leadId || result.id || result.data?.lead_id;
                if (id) {
                    setLeadId(id);
                    return id;
                }
                setApiError("Lead initialized but no leadId returned from API");
            } else {
                setApiError(result.error?.message || "Failed to initialize lead");
            }
        } catch (e) {
            console.error("ensureLead failed", e);
            setApiError("Connection error during lead initialization");
        }
        return null;
    };

    const updateField = (field: string, value: any) => {
        let finalValue = value;

        // Auto-capitalize Full Name / Owner Name
        if (['full_name', 'father_or_husband_name', 'vehicle_owner_name'].includes(field)) {
            finalValue = value.split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
        }

        // Vehicle RC uppercase
        if (field === 'vehicle_rc') {
            finalValue = value.toUpperCase();
        }

        setFormData((prev: any) => ({ ...prev, [field]: finalValue }));
        setIsModified(true);
        if (errors[field]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleDuplicateCheck = async () => {
        if (!formData.phone || formData.phone.length < 13) return;
        try {
            const res = await fetch(`/api/leads/check-duplicate?phone=${encodeURIComponent(formData.phone)}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setDuplicateMatches(data.data);
                setShowDuplicates(true);
            }
        } catch (e) { console.error("Duplicate check failed", e); }
    };

    const handleAutofill = (data: any) => {
        const fields = {
            full_name: data.full_name || data.fullName || '',
            father_or_husband_name: data.father_or_husband_name || data.fatherName || '',
            dob: data.dob || '',
            permanent_address: data.permanent_address || data.address || ''
        };

        const missing: string[] = [];
        if (!fields.full_name) missing.push("Full Name");
        if (!fields.father_or_husband_name) missing.push("Father/Husband Name");
        if (!fields.dob) missing.push("DOB");
        if (!fields.permanent_address) missing.push("Permanent Address");

        const status = data.ocrStatus || data.ocr_status || (missing.length === 4 ? 'failed' : missing.length > 0 ? 'partial' : 'success');

        setFormData((prev: any) => ({
            ...prev,
            ...fields,
            auto_filled: status !== 'failed',
            ocr_status: status,
            ocr_error: missing.length > 0 ? `Could not read the following fields: ${missing.join(', ')}` : null
        }));
        setIsModified(true);
    };

    const handleCreateLead = async () => {
        const stepErrors: any = {};

        // Validations per BRD
        if (!formData.full_name || formData.full_name.length < 2) stepErrors.full_name = "Please enter a valid full name";
        if (!/^[a-zA-Z\s.-]+$/.test(formData.full_name)) stepErrors.full_name = "No special characters except (.) and (-)";

        if (!formData.phone || !/^\+91[0-9]{10}$/.test(formData.phone)) stepErrors.phone = "Valid phone required (+91XXXXXXXXXX)";
        if (!formData.primary_product_id) stepErrors.primary_product_id = "Product selection required";

        if (!formData.dob) {
            stepErrors.dob = "DOB required";
        } else if (calculatedAge && calculatedAge < 18) {
            stepErrors.dob = "Customer must be at least 18 years old";
        }

        if (formData.current_address && formData.current_address.length < 20) {
            stepErrors.current_address = "Address must be at least 20 characters";
        }

        // Vehicle Conditional Validation
        if (formData.vehicle_rc) {
            if (!formData.vehicle_ownership) stepErrors.vehicle_ownership = "Required (Vehicle detected)";
            if (!formData.vehicle_owner_name) stepErrors.vehicle_owner_name = "Required (Vehicle detected)";
            if (!formData.vehicle_owner_phone) stepErrors.vehicle_owner_phone = "Required (Vehicle detected)";
        }

        if (Object.keys(stepErrors).length > 0) {
            setErrors(stepErrors);
            setApiError("Please fix validation errors");
            return;
        }

        if (!confirm("Are you sure you want to create this lead?")) return;

        setLoading(true);
        try {
            const url = leadId ? `/api/dealer/leads/${leadId}` : '/api/leads/create';
            const method = leadId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error?.message || "Failed to save lead");

            const finalId = result.data?.leadId || result.data?.id || leadId;
            if (!leadId && finalId) setLeadId(finalId);

            setLastSaved(new Date().toLocaleTimeString());
            setIsModified(false);

            if (formData.interest_level === 'hot') {
                router.push('?step=2');
            } else {
                router.push('/dealer-portal/leads');
            }
        } catch (e: any) {
            setApiError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (!isModified) {
            router.push('/dealer-portal/leads');
            return;
        }
        if (confirm("You have unsaved changes. Discard?")) {
            router.push('/dealer-portal/leads');
        }
    };

    const isVehicleCategory = categories.find(c => c.name === formData.asset_model)?.isVehicleCategory;

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">New Lead Application</h1>
                    {leadId && <p className="text-brand-600 font-mono text-sm mt-1">Ref ID: {leadId}</p>}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowHelp(true)} className="p-2 bg-white border rounded-xl hover:bg-gray-50 text-gray-500 shadow-sm transition-all hover:scale-105">
                        <Info className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowAutofill(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-xl font-bold text-sm shadow-sm transition-all hover:scale-105 active:scale-95">
                        <Scan className="w-4 h-4" />
                        Auto-fill
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-12 relative px-4">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 rounded-full" />
                <div className="absolute top-1/2 left-0 h-1 bg-brand-600 -z-10 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }} />
                {steps.map((s) => {
                    const isActive = s.id === step;
                    const isCompleted = s.id < step;
                    const Icon = s.icon;
                    return (
                        <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-brand-600 bg-brand-50 text-brand-600 shadow-lg scale-110' : isCompleted ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-400'}`}>
                                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive || isCompleted ? 'text-brand-700' : 'text-gray-400'}`}>{s.title}</span>
                        </div>
                    );
                })}
            </div>

            {apiError && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2"><AlertTriangle className="w-5 h-5" /><span>{apiError}</span><button onClick={() => setApiError(null)} className="ml-auto"><X className="w-4 h-4" /></button></div>}

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                {step === 1 && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        {/* Section 1: Personal */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b pb-4">
                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><User className="w-5 h-5" /></div>
                                <h2 className="text-xl font-bold text-gray-800">Customer Personal Information</h2>
                            </div>

                            {/* OCR Banners */}
                            {formData.ocr_status === 'success' && (
                                <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-center gap-2 text-xs text-brand-700 font-bold animate-in fade-in slide-in-from-top-1">
                                    <CheckCircle2 className="w-4 h-4 text-brand-600" />
                                    Auto-filled from Aadhaar (edit if needed)
                                </div>
                            )}
                            {formData.ocr_status === 'partial' && (
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-xs text-amber-700 font-bold animate-in fade-in slide-in-from-top-1">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                        <p>{formData.ocr_error}. Please enter manually.</p>
                                    </div>
                                </div>
                            )}
                            {formData.ocr_status === 'failed' && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-xs text-red-700 font-bold animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                        <p>Could not read document clearly. Please upload a clearer image or enter details manually.</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <Input label="Full Name *" value={formData.full_name} onChange={(v: string) => updateField('full_name', v)} placeholder="e.g. Rajesh Kumar" error={errors.full_name} autoComplete="name" />
                                <div className="space-y-1.5">
                                    <Input label="Mobile Number *" value={formData.phone} onChange={(v: string) => updateField('phone', v)} onBlur={handleDuplicateCheck} placeholder="+91XXXXXXXXXX" error={errors.phone} autoComplete="tel" />
                                    <p className="text-[10px] text-gray-400">Must include +91 prefix</p>
                                </div>
                                <Input label="Father/Husband Name *" value={formData.father_or_husband_name} onChange={(v: string) => updateField('father_or_husband_name', v)} error={errors.father_or_husband_name} />
                                <div className="space-y-1">
                                    <Input label="Date of Birth *" type="date" value={formData.dob} onChange={(v: string) => updateField('dob', v)} error={errors.dob} icon={<Calendar className="w-4 h-4" />} />
                                    {calculatedAge !== null && (
                                        <p className={`text-[10px] font-bold px-1 ${calculatedAge < 18 ? 'text-red-500' : 'text-brand-600'}`}>
                                            Calculated Age: {calculatedAge} years {calculatedAge < 18 ? '(Minimum 18 required)' : ''}
                                        </p>
                                    )}
                                </div>
                                <TextArea label="Current Address (Min 20 chars)" value={formData.current_address} onChange={(v: string) => updateField('current_address', v)} error={errors.current_address} />
                                <div className="md:col-span-2 flex items-center gap-2 px-1">
                                    <input type="checkbox" id="sameAddress" checked={formData.is_current_same} onChange={(e) => {
                                        updateField('is_current_same', e.target.checked);
                                        if (e.target.checked) updateField('permanent_address', formData.current_address);
                                    }} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                                    <label htmlFor="sameAddress" className="text-sm text-gray-600 cursor-pointer text-[10px] font-bold uppercase tracking-wider">Permanent address is same as current</label>
                                </div>
                                {!formData.is_current_same && <TextArea label="Permanent Address" value={formData.permanent_address} onChange={(v: string) => updateField('permanent_address', v)} />}
                            </div>
                        </div>

                        {/* Section 2: Products */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b pb-4">
                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><Filter className="w-5 h-5" /></div>
                                <h2 className="text-xl font-bold text-gray-800">Product Details</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Select label="Product Category *" value={formData.asset_model} onChange={(v: string) => {
                                    const cat = categories.find(c => c.name === v);
                                    setFormData((prev: any) => ({ ...prev, asset_model: v, product_category_id: cat?.id || '' }));
                                }}>
                                    <option value="">Select Category</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </Select>
                                {formData.asset_model && (
                                    <div className="space-y-4">
                                        <Select label="Primary Product *" value={formData.primary_product_id} onChange={(v: string) => updateField('primary_product_id', v)} error={errors.primary_product_id}>
                                            <option value="">Select Primary Model</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} {!p.inStock ? '(Order from OEM)' : ''}</option>
                                            ))}
                                        </Select>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Secondary Products (Interested In)</label>
                                            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border rounded-2xl min-h-[50px]">
                                                {formData.interested_in.length === 0 && <span className="text-[10px] text-gray-400 italic">No secondary products selected</span>}
                                                {formData.interested_in.map((pid: string) => {
                                                    const p = products.find(prod => prod.id === pid);
                                                    return (
                                                        <div key={pid} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-brand-200 text-brand-700 rounded-full text-[10px] font-bold shadow-sm animate-in zoom-in-95">
                                                            {p?.name || pid}
                                                            <button onClick={() => updateField('interested_in', formData.interested_in.filter((id: string) => id !== pid))} className="hover:text-red-500 transition-colors">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-2">
                                                <select className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500/10" onChange={(e) => {
                                                    if (e.target.value && !formData.interested_in.includes(e.target.value)) {
                                                        updateField('interested_in', [...formData.interested_in, e.target.value]);
                                                    }
                                                    e.target.value = '';
                                                }}>
                                                    <option value="">Add Another Product</option>
                                                    {products.filter(p => p.id !== formData.primary_product_id).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Vehicle (Conditional) */}
                        {isVehicleCategory && (
                            <div className="space-y-6 pt-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                                <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                    <div className="p-2 bg-brand-100 rounded-lg text-brand-700 shadow-sm"><Banknote className="w-5 h-5" /></div>
                                    <h2 className="text-xl font-bold text-gray-800">Existing Vehicle Information</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <Input label="Vehicle Registration Number (RC) *" value={formData.vehicle_rc} onChange={(v: string) => updateField('vehicle_rc', v)} placeholder="TS09AB1234" className="uppercase" />
                                        {formData.vehicle_rc && (
                                            <div className="p-2 bg-brand-50 border border-brand-100 rounded-lg flex items-center gap-2 text-[10px] text-brand-700 font-bold animate-in slide-in-from-left-2">
                                                <AlertCircle className="w-3 h-3" />
                                                Vehicle details entered. Dependent fields are now required.
                                            </div>
                                        )}
                                    </div>
                                    <Select label={`Vehicle Ownership ${formData.vehicle_rc ? '*' : ''}`} value={formData.vehicle_ownership} onChange={(v: string) => updateField('vehicle_ownership', v)} error={errors.vehicle_ownership}>
                                        <option value="">Select Ownership</option>
                                        <option>Self</option>
                                        <option>Financed</option>
                                        <option>Company</option>
                                        <option>Leased</option>
                                        <option>Family</option>
                                    </Select>
                                    <Input label={`Vehicle Owner Name ${formData.vehicle_rc ? '*' : ''}`} value={formData.vehicle_owner_name} onChange={(v: string) => updateField('vehicle_owner_name', v)} error={errors.vehicle_owner_name} />
                                    <Input label={`Owner Phone ${formData.vehicle_rc ? '*' : ''}`} value={formData.vehicle_owner_phone} onChange={(v: string) => updateField('vehicle_owner_phone', v)} placeholder="+91..." error={errors.vehicle_owner_phone} />
                                </div>
                            </div>
                        )}

                        {/* Section 4: Classification */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b pb-4">
                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><CheckCircle2 className="w-5 h-5" /></div>
                                <h2 className="text-xl font-bold text-gray-800">Lead Qualification & Priority</h2>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { id: 'hot', label: 'Hot Lead', color: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
                                    { id: 'warm', label: 'Warm Lead', color: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                                    { id: 'cold', label: 'Cold Lead', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
                                ].map((choice) => (
                                    <button
                                        key={choice.id}
                                        onClick={() => updateField('interest_level', choice.id)}
                                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all duration-300 ${formData.interest_level === choice.id ? `${choice.border} ${choice.bg} shadow-md scale-105` : 'border-gray-100 bg-white hover:border-gray-200'
                                            }`}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${choice.color}`} />
                                        <span className={`font-bold ${formData.interest_level === choice.id ? choice.text : 'text-gray-500'}`}>{choice.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-8 p-1">
                <div className="text-xs text-gray-400 italic">
                    {lastSaved ? `Last saved at ${lastSaved}` : isModified ? 'Click Create to save progress' : ''}
                </div>
                <div className="flex gap-4">
                    <button onClick={handleCancel} className="px-6 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors">Cancel</button>
                    <button onClick={handleCreateLead} disabled={loading} className="flex items-center gap-2 px-10 py-3 bg-brand-600 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/20 hover:bg-brand-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Create New Lead
                    </button>
                </div>
            </div>

            {/* Modals */}
            <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
            <AutofillModal
                isOpen={showAutofill}
                onClose={() => setShowAutofill(false)}
                onAutofill={handleAutofill}
                leadId={leadId}
                ensureLead={ensureLead}
            />
            <DuplicateModal isOpen={showDuplicates} onClose={() => setShowDuplicates(false)} matches={duplicateMatches} onContinue={handleCreateLead} />
        </div>
    );
}

export default function NewLeadWizard() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewLeadWizardContent />
        </Suspense>
    );
}

const Input = ({ label, type = 'text', value, onChange, onBlur, placeholder, error, autoComplete, className = "", icon }: any) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{label}</label>
        <div className="relative group">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 ${error ? 'border-red-300 ring-red-50 bg-red-50' : ''} ${className}`}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500">{icon}</div>}
        </div>
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
    </div>
);

const TextArea = ({ label, value, onChange, error }: any) => (
    <div className="space-y-1.5 md:col-span-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{label}</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 min-h-[100px] ${error ? 'border-red-300 bg-red-50' : ''}`}
        />
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
    </div>
);

const Select = ({ label, value, onChange, children, error }: any) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%221.67%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat ${error ? 'border-red-300 bg-red-50' : ''}`}
        >
            {children}
        </select>
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
    </div>
);
