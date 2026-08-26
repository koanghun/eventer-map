import { useState } from 'react';
import { X, Save, Send, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';

interface EventFormPaneProps {
    onClose: () => void;
}

export default function EventFormPane({ onClose }: EventFormPaneProps) {
    const { t } = useTranslation();
    const [links, setLinks] = useState<string[]>(['']);

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

    return (
        <aside className="w-full h-full bg-card border-l border-border shadow-lg flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <h2 className="font-bold text-lg text-primary">{t('buttons.newEvent', '새 이벤트 등록')}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-8 h-8 hover:bg-muted">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-6">
                    {/* Event Form */}
                    <div className="flex flex-col gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="title" className="text-xs font-bold text-muted-foreground">타이틀</Label>
                            <Input id="title" placeholder="이벤트 타이틀" className="text-sm bg-background border-input" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="date" className="text-xs font-bold text-muted-foreground">개최일</Label>
                            <Input type="date" id="date" className="text-sm bg-background border-input" />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="doorsOpen" className="text-xs font-bold text-muted-foreground">개장 시간</Label>
                                <Input type="time" id="doorsOpen" className="text-sm px-2 bg-background border-input" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="startTime" className="text-xs font-bold text-muted-foreground">개연 시간</Label>
                                <Input type="time" id="startTime" className="text-sm px-2 bg-background border-input" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="endTime" className="text-xs font-bold text-muted-foreground">종료 시간</Label>
                                <Input type="time" id="endTime" className="text-sm px-2 bg-background border-input" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="venue" className="text-xs font-bold text-muted-foreground">공연장</Label>
                            <Input id="venue" placeholder="공연장 검색..." className="text-sm bg-background border-input" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="artists" className="text-xs font-bold text-muted-foreground">출연 아티스트</Label>
                            <Input id="artists" placeholder="아티스트 검색..." className="text-sm bg-background border-input" />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground">관련 링크</Label>
                            {links.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        placeholder="https://..." 
                                        value={link}
                                        onChange={(e) => handleLinkChange(index, e.target.value)}
                                        className="text-sm bg-background border-input flex-1" 
                                    />
                                    {links.length > 1 && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeLink(index)} 
                                            className="shrink-0 w-8 h-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={addLink} 
                                className="w-full text-xs text-muted-foreground border-dashed border-border"
                            >
                                <Plus className="w-3 h-3 mr-1" /> 링크 추가
                            </Button>
                        </div>

                        <Button className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                            <Save className="w-4 h-4 mr-2" /> 저장하기
                        </Button>
                    </div>

                    <hr className="border-border/50" />

                    {/* Threads Section */}
                    <div className="flex flex-col gap-3">
                        <h3 className="font-bold text-sm text-foreground flex items-center justify-between">
                            스레드
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">0</span>
                        </h3>
                        
                        {/* Threads List (Empty state placeholder) */}
                        <div className="bg-muted/20 border border-border/50 rounded-lg p-4 min-h-[100px] flex items-center justify-center text-center">
                            <p className="text-xs text-muted-foreground">
                                등록된 스레드가 없습니다.<br/>첫 스레드를 작성해 보세요!
                            </p>
                        </div>

                        {/* Thread Input */}
                        <div className="relative mt-2">
                            <Textarea 
                                placeholder="스레드를 작성해 주세요..." 
                                className="text-sm bg-background border-input resize-none pr-12 pb-2 min-h-[80px]" 
                            />
                            <Button size="icon" className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
