import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Mic2, ImagePlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { usePostArtists, getGetArtistsQueryKey } from '../../api/generated/artists/artists';
import { toast } from '../../store/useToastStore';
import { cn } from '../../lib/utils';
import { ArtistInputGender, type Artist, type ArtistInput } from '../../api/generated/model';

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

interface ArtistFormPaneProps {
    initialName: string;
    onBack: () => void;
    onCreated: (artist: Artist) => void;
}

const GENDER_OPTIONS: ArtistInputGender[] = [
    ArtistInputGender.FEMALE,
    ArtistInputGender.MALE,
];

export default function ArtistFormPane({ initialName, onBack, onCreated }: ArtistFormPaneProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [officialName, setOfficialName] = useState(initialName);
    const [hiragana, setHiragana] = useState('');
    const [disambiguation, setDisambiguation] = useState('');
    const [gender, setGender] = useState<ArtistInputGender>(ArtistInputGender.FEMALE);
    const [profileImage, setProfileImage] = useState<File | undefined>(undefined);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const { mutateAsync: createArtist, isPending } = usePostArtists();

    useEffect(() => {
        if (!profileImage) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(profileImage);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [profileImage]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            toast.error(t('artistForm.invalidImageType', 'JPG 또는 PNG 형식의 이미지만 업로드할 수 있습니다.'));
            e.target.value = '';
            return;
        }

        if (file.size > MAX_PROFILE_IMAGE_SIZE) {
            toast.error(t('artistForm.imageTooLarge', '프로필 이미지는 최대 5MB까지 업로드할 수 있습니다.'));
            e.target.value = '';
            return;
        }

        setProfileImage(file);
    };

    const handleRemoveImage = () => {
        setProfileImage(undefined);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = officialName.trim();
        if (!trimmedName || !gender) {
            toast.error(t('artistForm.missingFields', '출연자 공식 이름과 성별은 필수입니다.'));
            return;
        }

        const payload: ArtistInput = {
            officialName: trimmedName,
            gender,
            hiragana: hiragana.trim() || undefined,
            disambiguation: disambiguation.trim() || undefined,
            profileImage,
        };

        try {
            const created = await createArtist({ data: payload });
            queryClient.invalidateQueries({ queryKey: getGetArtistsQueryKey() });
            toast.success(t('artistForm.createSuccess', '신규 출연자가 등록되어 목록에 추가되었습니다.'));
            onCreated(created);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('artistForm.createFail', '출연자 등록에 실패했습니다.'));
        }
    };

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-300 overflow-hidden">
            {/* Header (좌측 상단 뒤로가기 버튼) */}
            <div className="flex items-center gap-2 p-4 border-b border-border/50 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="rounded-full w-8 h-8 hover:bg-muted shrink-0"
                    disabled={isPending}
                    title={t('buttons.back', '뒤로가기')}
                    aria-label={t('buttons.back', '뒤로가기')}
                >
                    <ArrowLeft className="w-4 h-4 text-foreground" />
                </Button>
                <h2 className="font-bold text-lg text-primary truncate flex items-center gap-1.5">
                    <Mic2 className="w-4 h-4 shrink-0" />
                    {t('artistForm.title', '신규 출연자 등록')}
                </h2>
            </div>

            <ScrollArea className="flex-1">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-3 px-4">
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="artist-official-name" className="text-xs font-bold text-muted-foreground">
                                {t('artistForm.fields.officialName', '공식 이름')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="artist-official-name"
                                value={officialName}
                                onChange={(e) => setOfficialName(e.target.value)}
                                placeholder={t('artistForm.fields.officialNamePlaceholder', '출연자 공식 표기명')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="artist-hiragana" className="text-xs font-bold text-muted-foreground">
                                {t('artistForm.fields.hiragana', '히라가나 (읽는 법)')}
                            </Label>
                            <Input
                                id="artist-hiragana"
                                value={hiragana}
                                onChange={(e) => setHiragana(e.target.value)}
                                placeholder={t('artistForm.fields.hiraganaPlaceholder', '예: ぱふゅーむ (선택)')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="artist-disambiguation" className="text-xs font-bold text-muted-foreground">
                                {t('artistForm.fields.disambiguation', '소속 / 식별 설명 (동명이인 구분, 선택)')}
                            </Label>
                            <Input
                                id="artist-disambiguation"
                                value={disambiguation}
                                maxLength={100}
                                onChange={(e) => setDisambiguation(e.target.value)}
                                placeholder={t('artistForm.fields.disambiguationPlaceholder', '예: 솔로 가수, LE SSERAFIM, 성우 등')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-muted-foreground">
                                {t('artistForm.fields.gender', '성별')} <span className="text-destructive">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {GENDER_OPTIONS.map((option) => (
                                    <Button
                                        key={option}
                                        type="button"
                                        variant={gender === option ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setGender(option)}
                                        disabled={isPending}
                                        className={cn(
                                            'h-8 text-xs px-2 font-medium',
                                            gender === option
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-background text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {t(`artistForm.fields.genderOptions.${option}`, option)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 프로필 이미지 업로드 (최대 5MB, JPG/PNG) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="artist-profile-image" className="text-xs font-bold text-muted-foreground">
                                    {t('artistForm.fields.profileImage', '프로필 이미지 (선택)')}
                                </Label>
                                <span className="text-[10px] text-muted-foreground">
                                    {t('artistForm.fields.profileImageHint', 'JPG, PNG 형식 / 최대 5MB')}
                                </span>
                            </div>
                            <input
                                ref={fileInputRef}
                                id="artist-profile-image"
                                type="file"
                                accept="image/jpeg,image/png"
                                onChange={handleImageChange}
                                className="hidden"
                                disabled={isPending}
                            />
                            {profileImage && previewUrl ? (
                                <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-muted/30">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img
                                            src={previewUrl}
                                            alt={officialName || 'Preview'}
                                            className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                                        />
                                        <span className="text-xs truncate text-foreground">
                                            {profileImage.name}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveImage}
                                        disabled={isPending}
                                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isPending}
                                    className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-primary"
                                >
                                    <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                                    {t('artistForm.fields.selectImage', '이미지 선택')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full font-bold shadow-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {t('buttons.register', '등록하기')}
                    </Button>
                </form>
            </ScrollArea>
        </div>
    );
}
