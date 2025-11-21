export interface Event {
    id?: number;
    title: string;
    description?: string;
    event_date: string; // YYYY-MM-DD
    event_time?: string; // HH:MM
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
    event_time: string;
    location: string;
    address: string;
    latitude: number;
    longitude: number;
    performers: string;
    related_link: string;
}
