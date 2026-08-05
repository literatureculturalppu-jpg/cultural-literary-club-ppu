import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container text-center py-20">
        <h1 className="text-6xl md:text-8xl font-bold text-accent mb-4">
          404
        </h1>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          الصفحة غير موجودة
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم حذفها. يرجى العودة إلى الصفحة الرئيسية.
        </p>
        <Link href="/">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6 text-lg">
            العودة إلى الرئيسية
          </Button>
        </Link>
      </div>
    </div>
  );
}
