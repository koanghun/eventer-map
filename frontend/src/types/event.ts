export interface Performer {
    id: number;
    canonical_name: string;
    normalized_name: string;
    aliases?: string;  // JSON 문자열 (SQLite 호환)
    name?: string; // DEPRECATED: 제거 예정, canonical_name 사용
    created_at: string;
    updated_at?: string;
}

export interface Place {
    id: number;
    canonical_name: string;
    normalized_name: string;
    aliases?: string;  // JSON 문자열 (SQLite 호환)
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
    related_link?: string;
    created_at?: string;
    updated_at?: string;
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
    related_link: string;
}
