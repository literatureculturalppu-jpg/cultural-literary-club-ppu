export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">شروط الاستخدام</h1>
          <p className="text-muted-foreground">
            آخر تحديث: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl space-y-8 text-foreground leading-relaxed">
          <p className="text-muted-foreground">
            يرجى قراءة هذه الشروط بعناية قبل استخدام موقع النادي الثقافي الأدبي. استخدامك للموقع
            يعني موافقتك على هذه الشروط.
          </p>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">1. استخدام الحساب</h2>
            <p className="text-muted-foreground">
              أنت مسؤول عن الحفاظ على سرية بيانات دخولك، وعن أي نشاط يتم من خلال حسابك. يجب أن
              تكون المعلومات التي تقدّمها عند التسجيل صحيحة ودقيقة.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">2. المساعد الذكي "بصير"</h2>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>بصير مخصص للإجابة عن الأسئلة العلمية والثقافية والأدبية المتعلقة بالنادي فقط، ولا يقدّم معلومات في مواضيع خارج هذا النطاق.</li>
              <li>لا يقدّم بصير أي فتاوى أو آراء أو تفسيرات دينية من أي نوع.</li>
              <li>لكل عضو حصة يومية من الأسئلة (٣٠ سؤالاً)، وللمسؤولين حصة مضاعفة (٦٠ سؤالاً)، تتجدد يومياً.</li>
              <li>إجابات بصير قد تحتوي أحياناً على أخطاء؛ لا تُعتمد كمصدر رسمي وحيد للمعلومات.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">3. دردشة الفرق</h2>
            <p className="text-muted-foreground">
              يُسمح فقط بإرسال النصوص والروابط داخل دردشة الفريق. يُمنع إرسال أي محتوى مسيء أو
              مخالف لقيم النادي. يحتفظ مشرف الفريق أو المسؤول بصلاحية إغلاق الدردشة عند الحاجة.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">4. السلوك المقبول</h2>
            <p className="text-muted-foreground">
              يُتوقع من جميع الأعضاء التعامل باحترام مع بعضهم البعض، وعدم استخدام الموقع لأي غرض
              غير قانوني أو مسيء أو يخالف القيم الأكاديمية والأخلاقية للجامعة والنادي.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">5. التعديلات</h2>
            <p className="text-muted-foreground">
              يحتفظ النادي بحق تعديل هذه الشروط أو ميزات الموقع (بما في ذلك حدود استخدام بصير) في
              أي وقت، مع نشر أي تحديث جوهري على هذه الصفحة.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">6. التواصل</h2>
            <p className="text-muted-foreground">
              لأي استفسار بخصوص هذه الشروط، يمكنك التواصل معنا عبر البريد الإلكتروني الموضّح في
              تذييل الموقع.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
