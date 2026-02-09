'use client';

import {
    Users,
    TrendingUp,
    Banknote,
    Zap,
    PlusCircle,
    FileCheck,
    Battery
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DealerDashboard() {
    const [stats, setStats] = useState({
        metrics: { totalLeads: 0, conversionRate: 0, commission: 0, activeAssets: 0 },
        recentLeads: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/dealer/stats');
                const data = await res.json();
                if (data.success) {
                    setStats(data.data);
                }
            } catch (error) {
                console.error('Failed to load stats', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dealer Dashboard</h1>
                <p className="text-gray-500 mt-2">Overview of your solar & EV business</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dealer-portal/leads/new" className="flex items-center gap-4 p-6 bg-brand-600 text-white rounded-xl shadow-md hover:bg-brand-700 transition-colors transform hover:-translate-y-1">
                    <div className="p-3 bg-white/20 rounded-lg">
                        <PlusCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">New Lead</h3>
                        <p className="text-brand-100 text-sm">Create a new customer lead</p>
                    </div>
                </Link>

                <button className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-brand-300 transition-colors text-left transform hover:-translate-y-1">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-lg">Process Loan</h3>
                        <p className="text-gray-500 text-sm">Upload docs for financing</p>
                    </div>
                </button>

                <button className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-brand-300 transition-colors text-left transform hover:-translate-y-1">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <Battery className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-lg">Add Asset</h3>
                        <p className="text-gray-500 text-sm">Register new vehicle/battery</p>
                    </div>
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total Leads"
                    value={stats.metrics.totalLeads}
                    icon={Users}
                    trend="+12%"
                    loading={loading}
                />
                <KPICard
                    title="Conversion Rate"
                    value={`${stats.metrics.conversionRate}%`}
                    icon={TrendingUp}
                    trend="+2.4%"
                    loading={loading}
                />
                <KPICard
                    title="Commission"
                    value={`₹${stats.metrics.commission.toLocaleString()}`}
                    icon={Banknote}
                    trend="-5%"
                    trendColor="text-red-500"
                    loading={loading}
                    subtext="Pending payout: ₹12k"
                />
                <KPICard
                    title="Active Assets"
                    value={stats.metrics.activeAssets}
                    icon={Zap}
                    trend="+8"
                    loading={loading}
                    subtext="Deployed in field"
                />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-gray-900">Performance Overview</h3>
                        <select className="text-sm border-gray-200 rounded-lg">
                            <option>Last 30 Days</option>
                            <option>Last Quarter</option>
                        </select>
                    </div>
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm">Analytics Integration Pending</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-6">Recent Leads</h3>
                    <div className="space-y-4">
                        {loading ? (
                            [1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)
                        ) : stats.recentLeads.length > 0 ? (
                            stats.recentLeads.map((lead: any) => (
                                <Link href={`/dealer-portal/leads?new=${lead.id}`} key={lead.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs uppercase">
                                            {lead.owner_name[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{lead.owner_name}</p>
                                            <p className="text-xs text-gray-500 capitalize">{lead.interest_level}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize 
                                        ${lead.lead_status === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {lead.lead_status}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
                        )}
                    </div>
                    <Link href="/dealer-portal/leads" className="block w-full text-center mt-6 py-2 text-sm text-brand-600 font-medium hover:bg-brand-50 rounded-lg transition-colors">
                        View All Leads
                    </Link>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, trend, trendColor = "text-green-600", subtext = "vs last month", loading }: any) {
    if (loading) return <div className="h-32 bg-white rounded-xl border border-gray-100 shadow-sm animate-pulse" />;

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500 text-sm font-medium">{title}</span>
                <Icon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                <span className={`${trendColor} text-sm font-medium mb-1 flex items-center`}>
                    <TrendingUp className={`w-3 h-3 mr-1 ${trendColor.includes('red') ? 'rotate-180' : ''}`} /> {trend}
                </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{subtext}</p>
        </div>
    );
}
