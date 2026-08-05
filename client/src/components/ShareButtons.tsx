import { Button } from "@/components/ui/button";
import { Share2, Facebook, Twitter, MessageCircle, Linkedin } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonsProps {
  title: string;
  url: string;
  description?: string;
}

export default function ShareButtons({ title, url, description }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || "");

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], "_blank", "width=600,height=400");
    toast.success(`تم النسخ للمشاركة على ${platform}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ الرابط");
  };

  return (
    <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
      <div className="flex items-center gap-2 mb-2 w-full">
        <span className="text-sm font-semibold">شارك هذا المحتوى:</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("facebook")}
        className="gap-2"
        title="شارك على فيسبوك"
      >
        <Facebook className="w-4 h-4" />
        فيسبوك
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("twitter")}
        className="gap-2"
        title="شارك على تويتر"
      >
        <Twitter className="w-4 h-4" />
        تويتر
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("whatsapp")}
        className="gap-2"
        title="شارك على واتساب"
      >
        <MessageCircle className="w-4 h-4" />
        واتساب
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare("linkedin")}
        className="gap-2"
        title="شارك على لينكدإن"
      >
        <Linkedin className="w-4 h-4" />
        لينكدإن
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="gap-2"
        title="نسخ الرابط"
      >
        <Share2 className="w-4 h-4" />
        نسخ الرابط
      </Button>
    </div>
  );
}
