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
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <h2 className="font-bold text-base text-primary">{t('buttons.newEvent', '새 이벤트 등록')}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-7 h-7 hover:bg-muted">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-4 p-3 px-4">
                    {/* Event Form */}
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="title" className="text-xs font-bold text-muted-foreground">타이틀</Label>
                            <Input id="title" placeholder="이벤트 타이틀" className="h-8 text-xs bg-background border-input" />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="date" className="text-xs font-bold text-muted-foreground">개최일</Label>
                            <Input type="date" id="date" className="h-8 text-xs bg-background border-input" />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="doorsOpen" className="text-xs font-bold text-muted-foreground">개장 시간</Label>
                                <Input type="time" id="doorsOpen" className="h-8 text-xs px-2 bg-background border-input" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="startTime" className="text-xs font-bold text-muted-foreground">개연 시간</Label>
                                <Input type="time" id="startTime" className="h-8 text-xs px-2 bg-background border-input" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endTime" className="text-xs font-bold text-muted-foreground">종료 시간</Label>
                                <Input type="time" id="endTime" className="h-8 text-xs px-2 bg-background border-input" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="venue" className="text-xs font-bold text-muted-foreground">공연장</Label>
                            <Input id="venue" placeholder="공연장 검색..." className="h-8 text-xs bg-background border-input" />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="artists" className="text-xs font-bold text-muted-foreground">출연 아티스트</Label>
                            <Input id="artists" placeholder="아티스트 검색..." className="h-8 text-xs bg-background border-input" />
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
                                    />
                                    {links.length > 1 && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeLink(index)} 
                                            className="shrink-0 w-7 h-7 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addLink} className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-primary">
                                <Plus className="w-3.5 h-3.5 mr-1" /> 링크 추가
                            </Button>
                        </div>
                    </div>

                    <Button className="w-full font-bold shadow-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                        <Save className="w-4 h-4 mr-2" /> 등록하기
                    </Button>

                    <hr className="border-border my-2" />

                    {/* Threads Section */}
                    <div className="flex flex-col h-[200px]">
                        <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                            스레드
                            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">0</span>
                        </h3>
                        <div className="flex-1 rounded-md bg-muted/30 border border-border flex items-center justify-center">
                            <p className="text-xs text-muted-foreground text-center">
                                등록된 스레드가 없습니다.<br/>
                                첫 번째 스레드를 작성해보세요!
                            </p>
                        </div>

                        {/* Thread Input */}
                        <div className="relative mt-2">
                            <Textarea 
                                placeholder="스레드를 작성해 주세요..." 
                                className="text-sm bg-background border-input resize-none pr-12 pb-2 min-h-[60px]" 
                            />
                            <Button size="icon" className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
