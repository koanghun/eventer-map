export interface Performer {
    id: number;
    canonical_name: string;
    normalized_name: string;
    aliases?: string[];  // 배열로 변경 (API 형식)
    name?: string; // DEPRECATED: 제거 예정, canonical_name 사용
    created_at: string;
    updated_at?: string;
}

export interface Place {
    id: number;
    canonical_name: string;
    normalized_name: string;
    aliases?: string[];  // 배열로 변경 (API 형식)
    name?: string; // DEPRECATED: 제거 예정, canonical_name 사용
    address: string;
    latitude: number;
    longitude: number;
    created_at: string;
}

export interface Event {
    id?: number;
    title: string;
    description?: string;
    event_date: string; // YYYY-MM-DD
    door_time?: string; // 개장 HH:MM
    start_time?: string; // 개연 HH:MM
    end_time?: string; // 종연 HH:MM
    location: string;
    address?: string;
    latitude: number;
    longitude: number;
    performers?: string;
    performer_ids?: number[];  // 출연자 ID 배열 (권장)
    related_link?: string;
    created_at?: string;
    updated_at?: string;

    // 추적 필드
    created_by?: number;
    updated_by?: number;
    report_count?: number;
    is_hidden?: boolean;
}

export interface EventHistory {
    id: number;
    event_id: number;
    user_id: number;
    user_name?: string;
    user_email?: string;
    action: 'created' | 'updated' | 'deleted';
    snapshot: Event;
    changes_summary?: string;
    created_at: string;
}

export interface EventReport {
    reason: 'spam' | 'inappropriate' | 'wrong_info' | 'other';
    description?: string;
}

export interface EventReportResponse {
    id: number;
    event_id: number;
    reporter_id: number;
    reporter_name: string;
    reason: 'spam' | 'inappropriate' | 'wrong_info' | 'other';
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved';
    created_at: string;
}

export interface EventFormData {
    title: string;
    description: string;
    event_date: string;
    door_time: string;
    start_time: string;
    end_time: string;
    location: string;
    address: string;
    latitude: number;
    longitude: number;
    performers: string;
    performer_ids: number[];  // 출연자 ID 배열
    related_link: string;
}
