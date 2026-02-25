'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Megaphone, Send, Users, MessageSquareText, Loader2, Sparkles } from 'lucide-react';

type Segment = {
    id: string;
    name: string;
    description: string;
};

const SEGMENTS: Segment[] = [
    { id: 'all_customers', name: 'All Customers', description: 'Send to all customers/leads in your database.' },
    { id: 'hot_leads', name: 'Hot Leads', description: 'Only leads marked as HOT (high intent).' },
    { id: 'pending_loans', name: 'Pending Loans', description: 'Customers with loan applications in processing status.' },
    { id: 'inactive_customers', name: 'Inactive Customers', description: 'Leads not updated in 30 days or marked lost.' },
];

export default function NewCampaignPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [type, setType] = useState<'sms' | 'whatsapp' | 'email'>('whatsapp');
    const [segment, setSegment] = useState<string>('all_customers');
    const [message, setMessage] = useState('');
    const [estimating, setEstimating] = useState(false);
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const segmentMeta = useMemo(() => SEGMENTS.find(s => s.id === segment), [segment]);

    const estimate = async () => {
        setEstimating(true);
        setError(null);
        try {
            const res = await fetch('/api/campaigns/estimate-audience', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ segment }),
            });
            const data = await res.json();
            if (res.ok && data.success) setAudienceCount(data.data.count);
            else setAudienceCount(null);
        } catch {
            setAudienceCount(null);
            setError('Could not estimate audience.');
        } finally {
            setEstimating(false);
        }
    };

    useEffect(() => {
        estimate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segment]);

    const createCampaign = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    type,
                    message_content: message,
                    audience_filter: { segment },
                    total_audience: audienceCount ?? undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                router.push('/dealer-portal');
            } else {
                setError(data?.error?.message || 'Failed to create campaign');
            }
        } catch {
            setError('Connection lost. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <Link
                        href="/dealer-portal"
                        className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-sm font-semibold"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Start Campaign</h1>
                        <p className="text-gray-500 mt-1">Create an SMS/WhatsApp campaign (BRD MVP). Scheduling & billing can be added next.</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                                <Megaphone className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-900">Campaign Details</h2>
                                <p className="text-sm text-gray-500">Define channel, audience segment and message.</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <label className="text-sm font-semibold text-gray-700">Campaign Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., February EMI Reminder"
                                    className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-200 outline-none text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700">Channel</label>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        {([
                                            { id: 'whatsapp', label: 'WhatsApp' },
                                            { id: 'sms', label: 'SMS' },
                                            { id: 'email', label: 'Email' },
                                        ] as const).map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setType(c.id)}
                                                className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${type === c.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-700">Audience Segment</label>
                                    <select
                                        value={segment}
                                        onChange={(e) => setSegment(e.target.value)}
                                        className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-200 outline-none text-sm"
                                    >
                                        {SEGMENTS.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <div className="mt-2 text-xs text-gray-500">{segmentMeta?.description}</div>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700">Message</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    placeholder="Write your message here..."
                                    className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-200 outline-none text-sm"
                                />
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                    <span>{message.length} characters</span>
                                    <button
                                        type="button"
                                        onClick={() => setMessage((m) => m || 'Hello {name}, your next payment is due. Please contact us for assistance.')}
                                        className="inline-flex items-center gap-1.5 hover:text-brand-700"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Suggest text
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={createCampaign}
                        disabled={saving || !name.trim() || !message.trim()}
                        className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold ${saving || !name.trim() || !message.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'
                            }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {saving ? 'Creating…' : 'Create Campaign (Draft)'}
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 text-gray-900 font-bold">
                            <Users className="w-5 h-5 text-brand-600" />
                            Audience Estimate
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Approximate recipients for the selected segment.</p>

                        <div className="mt-4">
                            {estimating ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Estimating…
                                </div>
                            ) : (
                                <div className="text-4xl font-extrabold text-gray-900">{audienceCount ?? '—'}</div>
                            )}
                            <button
                                type="button"
                                onClick={estimate}
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-sm font-semibold"
                            >
                                <MessageSquareText className="w-4 h-4" />
                                Recalculate
                            </button>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-sm">
                        MVP notes:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Campaign is created as <span className="font-semibold">draft</span>.</li>
                            <li>Scheduling, billing (₹99/month), and delivery provider integration can be added next.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}