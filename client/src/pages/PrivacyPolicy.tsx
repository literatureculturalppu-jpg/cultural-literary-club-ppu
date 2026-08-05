export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">سياسة الخصوصية</h1>
          <p className="text-muted-foreground">
            آخر تحديث: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl space-y-8 text-foreground leading-relaxed">
          <p className="text-muted-foreground">
            يحرص النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين على خصوصية أعضائه. توضح هذه الصفحة
            ما هي البيانات التي نجمعها، وكيف نستخدمها، وكيف نحميها.
          </p>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">1. البيانات التي نجمعها</h2>
            <p className="text-muted-foreground">
              عند إنشاء حساب أو استكمال استمارة الانضمام، قد نجمع: الاسم، البريد الإلكتروني، رقم
              الهاتف والواتساب، الرقم الجامعي، الكلية والتخصص والسنة الدراسية، وأي معلومات أخرى
              تقدّمها طوعاً في ملفك الشخصي أو عند التسجيل في الأنشطة.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">2. كيف نستخدم بياناتك</h2>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>إدارة عضويتك وتسجيلك في الأنشطة والفعاليات.</li>
              <li>التواصل معك بخصوص أنشطة النادي وتحديثاته عبر البريد الإلكتروني أو الإشعارات داخل التطبيق.</li>
              <li>عرض اسمك فقط (دون بيانات الاتصال) لبقية أعضاء أي فريق تنضم إليه، بينما يطّلع مشرف الفريق والمسؤول على بياناتك الكاملة لأغراض التنظيم الإداري.</li>
              <li>تحسين خدمات النادي وتجربة استخدام الموقع.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">3. المساعد الذكي "بصير"</h2>
            <p className="text-muted-foreground">
              محادثاتك مع المساعد الذكي "بصير" تُرسَل إلى مزوّد خدمة ذكاء اصطناعي خارجي لمعالجتها
              وتوليد الرد. لا نخزّن نص محادثاتك مع بصير على خوادمنا؛ نحتفظ فقط بعدد الأسئلة التي
              طرحتها كل يوم لتطبيق الحد اليومي المسموح به على حسابك.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">4. دردشة الفرق</h2>
            <p className="text-muted-foreground">
              الرسائل المتبادلة داخل دردشة أي فريق تُخزَّن على جهازك فقط (عبر ذاكرة المتصفح
              المحلية) ولا تُخزَّن في قاعدة بيانات النادي على الإطلاق. تُستخدم خوادمنا فقط لتوصيل
              الرسائل لحظياً بين أعضاء الفريق المتصلين.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">5. مشاركة البيانات</h2>
            <p className="text-muted-foreground">
              لا نبيع بياناتك ولا نشاركها مع أي جهة خارجية لأغراض تسويقية. قد تُشارَك بعض البيانات
              مع مزوّدي خدمات تقنية موثوقين (مثل استضافة الموقع أو معالجة الذكاء الاصطناعي) بالقدر
              اللازم فقط لتشغيل الخدمة.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">6. حقوقك</h2>
            <p className="text-muted-foreground">
              يمكنك الاطلاع على بياناتك وتعديلها من صفحة ملفك الشخصي في أي وقت. لطلب حذف حسابك أو
              الاستفسار عن بياناتك، يمكنك التواصل معنا عبر البريد الإلكتروني الموضّح في تذييل
              الموقع.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">7. تحديثات هذه السياسة</h2>
            <p className="text-muted-foreground">
              قد نحدّث هذه السياسة من وقت لآخر لمواكبة أي تغييرات في خدماتنا. سنقوم بنشر أي تعديل
              جوهري على هذه الصفحة.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
