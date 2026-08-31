import { useState } from 'react';
import { X, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { usePostEvents } from '../../api/generated/events/events';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../store/useToastStore';
import type { EventInput } from '../../api/generated/model';

interface EventFormPaneProps {
    onClose: () => void;
}

export default function EventFormPane({ onClose }: EventFormPaneProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    
    // Form fields
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [doorsOpen, setDoorsOpen] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [venueId, setVenueId] = useState(''); // Using a raw input for venueId temporarily
    const [links, setLinks] = useState<string[]>(['']);

    const { mutateAsync: createEvent, isPending } = usePostEvents();

    const handleLinkChange = (index: number, value: string) => {
        const newLinks = [...links];
        newLinks[index] = value;
        setLinks(newLinks);
    };

    const addLink = () => setLinks([...links, '']);
    
    const removeLink = (index: number) => {
        if (links.length > 1) {
            setLinks(links.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title || !date || !startTime || !endTime || !venueId) {
            toast.error('타이틀, 개최일, 시작/종료 시간, 공연장 ID는 필수입니다.');
            return;
        }

        const toDateTime = (time: string) => new Date(`${date}T${time}:00`).toISOString();

        const payload: EventInput = {
            title,
            venueId,
            openingTime: doorsOpen ? toDateTime(doorsOpen) : undefined,
            startTime: toDateTime(startTime),
            endTime: toDateTime(endTime),
            relatedLinks: links.filter(l => l.trim() !== ''),
        };

        try {
            await createEvent({ data: payload });
            toast.success('이벤트가 성공적으로 등록되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['getEvents'] });
            onClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '이벤트 등록에 실패했습니다.');
        }
    };

    return (
        <aside className="w-full h-full bg-card border-l border-border shadow-lg flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <h2 className="font-bold text-base text-primary">{t('buttons.newEvent', '새 이벤트 등록')}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-7 h-7 hover:bg-muted" disabled={isPending}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-3 px-4">
                    {/* Event Form */}
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="title" className="text-xs font-bold text-muted-foreground">타이틀</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이벤트 타이틀" className="h-8 text-xs bg-background border-input" disabled={isPending} />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="date" className="text-xs font-bold text-muted-foreground">개최일</Label>
                            <Input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs bg-background border-input" disabled={isPending} />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="doorsOpen" className="text-xs font-bold text-muted-foreground">개장 시간</Label>
                                <Input type="time" id="doorsOpen" value={doorsOpen} onChange={(e) => setDoorsOpen(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="startTime" className="text-xs font-bold text-muted-foreground">개연 시간</Label>
                                <Input type="time" id="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endTime" className="text-xs font-bold text-muted-foreground">종료 시간</Label>
                                <Input type="time" id="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="venue" className="text-xs font-bold text-muted-foreground">공연장 ID (임시)</Label>
                            <Input id="venue" value={venueId} onChange={(e) => setVenueId(e.target.value)} placeholder="UUID 입력..." className="h-8 text-xs bg-background border-input" disabled={isPending} />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground">관련 링크</Label>
                            {links.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        placeholder="https://..." 
                                        value={link}
                                        onChange={(e) => handleLinkChange(index, e.target.value)}
                                        className="h-8 text-xs bg-background border-input flex-1" 
                                        disabled={isPending}
                                    />
                                    {links.length > 1 && (
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeLink(index)} 
                                            className="shrink-0 w-7 h-7 text-muted-foreground hover:text-destructive"
                                            disabled={isPending}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-primary" disabled={isPending}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> 링크 추가
                            </Button>
                        </div>
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full font-bold shadow-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        등록하기
                    </Button>

                    <hr className="border-border my-2" />

                    {/* Threads Section (Disabled during creation) */}
                    <div className="flex flex-col h-[200px] opacity-50 pointer-events-none">
                        <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                            스레드
                            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">0</span>
                        </h3>
                        <div className="flex-1 rounded-md bg-muted/30 border border-border flex items-center justify-center">
                            <p className="text-xs text-muted-foreground text-center">
                                이벤트를 등록한 후에 스레드를 작성할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </form>
            </ScrollArea>
        </aside>
    );
}
