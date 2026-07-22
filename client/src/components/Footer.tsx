import { Link } from "wouter";
import { Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-20">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">
              النادي الثقافي الأدبي
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              نادٍ ثقافي أدبي في جامعة بوليتكنك فلسطين، يُعنى بالأدب والفكر والفنون، ويحتضن اللغة العربية كأحد أهم اهتماماته.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-base font-bold text-foreground mb-4">
              الروابط السريعة
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/">
                  <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                    الرئيسية
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/about">
                  <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                    عن النادي
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/activities">
                  <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                    الأنشطة
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/articles">
                  <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                    المقالات
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-base font-bold text-foreground mb-4">
              معلومات التواصل
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">basira@ppu.edu.ps</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">+970 2 2984 9000</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">
                  جامعة بوليتكنك فلسطين، الخليل
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-base font-bold text-foreground mb-4">
              روابط مفيدة
            </h4>
            <p className="text-muted-foreground text-sm mb-4">
              تصفح جميع الروابط والمصادر المهمة
            </p>
            <Link href="/quick-links">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                الروابط السريعة
              </Button>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border pt-8">
          <div className="text-center text-muted-foreground text-sm space-y-3">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/privacy-policy">
                <span className="hover:text-accent transition-colors cursor-pointer">
                  سياسة الخصوصية
                </span>
              </Link>
              <span className="opacity-40">·</span>
              <Link href="/terms-of-use">
                <span className="hover:text-accent transition-colors cursor-pointer">
                  شروط الاستخدام
                </span>
              </Link>
            </div>
            <p>
              جميع الحقوق محفوظة 2026 النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين ،تصميم وتطوير : أحمد كامل عيده.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
