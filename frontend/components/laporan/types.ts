export type ReportFilterType = 'daily' | 'monthly' | 'yearly';

export interface ReportStatItem {
    label: string;
    value: string;
    icon: any;
    color: string;
    bg?: string;
    sub?: string;
}

export const REPORT_FILTER_LABELS: Record<ReportFilterType, string> = {
    daily: 'Harian',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
};